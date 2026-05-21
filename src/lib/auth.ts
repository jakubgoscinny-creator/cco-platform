import { cookies } from "next/headers";
import { db } from "./db";
import { contacts, sessions } from "./schema";
import { eq, and, gt } from "drizzle-orm";
import { hash as bcryptHash } from "bcryptjs";
import { verifyPassword } from "./password";
import {
  filterItems,
  getTextValue,
  getCategoryValue,
  PODIO_APPS,
  CONTACT_FIELDS,
} from "./podio";

const SESSION_COOKIE = "cco_session";
const SESSION_DURATION_DAYS = 30;

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export async function authenticate(
  email: string,
  password: string
): Promise<{ success: true; contactId: number; name: string } | { success: false; error: string }> {
  // First check local mirror
  let contact = await db.query.contacts.findFirst({
    where: eq(contacts.email, email.toLowerCase().trim()),
  });

  // If not in mirror, fetch from Podio
  if (!contact) {
    const podioContact = await fetchContactFromPodio(email);
    if (!podioContact) {
      return { success: false, error: "Invalid email or password" };
    }
    contact = podioContact;
  }

  // Verify password: try bcrypt first, then MD5 legacy, then plaintext
  const isValid = await verifyPassword(password, contact.passwordHash);
  if (!isValid) {
    return { success: false, error: "Invalid email or password" };
  }

  // Upgrade any non-bcrypt / non-argon2 hash (MD5 or plaintext
  // "JG8032!"-style master passwords from Podio) to bcrypt on first
  // successful login. CCO-T031 introduces argon2id as the new write
  // standard for password-reset and change-password paths, but this
  // upgrade-on-login path stays on bcrypt for now to keep the T031
  // diff scoped; migrating it to argon2id is tracked under CCO-T038
  // alongside the Podio write-through gap.
  if (
    !contact.passwordHash.startsWith("$2") &&
    !contact.passwordHash.startsWith("$argon2")
  ) {
    const upgradedHash = await bcryptHash(password, 12);
    await db
      .update(contacts)
      .set({ passwordHash: upgradedHash })
      .where(eq(contacts.podioItemId, contact.podioItemId));
  }

  // Per CCO-T006: refresh from Podio after successful auth so subscription_status
  // (and name/email) reflect Podio's current truth. Cache-hit path would otherwise
  // serve a stale tier (e.g. a member who upgraded since their last sign-in
  // wouldn't see Member-tier tests until next cache miss).
  // Fire-and-no-await would race against gating; await here. Cost: one extra
  // Podio call per successful sign-in. Sign-ins are rare.
  try {
    await fetchContactFromPodio(email);
  } catch (err) {
    // Refresh failure is non-fatal — auth already succeeded against cached creds.
    console.error("Post-auth refresh from Podio failed (non-fatal):", err);
  }

  return {
    success: true,
    contactId: contact.podioItemId,
    name: contact.fullName ?? email,
  };
}

// `verifyPassword` was inlined here previously. It now lives in
// src/lib/password.ts as part of CCO-T031 so the hash/verify surface
// is centralised. The behaviour is identical (argon2 → bcrypt → MD5
// → plaintext ladder); argon2 is a new branch for hashes written by
// the T031 reset and change-password paths.

async function fetchContactFromPodio(
  email: string
): Promise<typeof contacts.$inferSelect | null> {
  try {
    // Contacts email-type fields filter on a string array, not a bare string.
    const result = await filterItems(
      PODIO_APPS.CONTACTS,
      { [CONTACT_FIELDS.EMAIL]: [email.toLowerCase().trim()] },
      { limit: 1 }
    );

    if (!result.items?.length) return null;

    const item = result.items[0];
    const nameVal = getTextValue(item, CONTACT_FIELDS.NAME) || item.title || "";
    const passwordVal = getTextValue(item, CONTACT_FIELDS.PASSWORD_MASTER);

    // Email field on Contacts is type "email" — values are { type, value }
    // pairs (e.g. { type: "other", value: "user@example.com" }), so
    // getTextValue won't unwrap them. Read directly.
    const emailField = item.fields?.find(
      (f) => f.field_id === CONTACT_FIELDS.EMAIL
    );
    const rawEmail = emailField?.values?.[0]?.value;
    const emailVal =
      typeof rawEmail === "string"
        ? rawEmail
        : (rawEmail as { value?: string } | undefined)?.value;

    if (!emailVal || !passwordVal) return null;

    // Per CCO-T006: read SUBSCRIPTION_STATUS so the portal can gate Member-tier
    // tests. Empty string means non-subscriber; getCategoryValue returns ""
    // when the field is unset, so we normalise to null for the column.
    const subStatusRaw = getCategoryValue(item, CONTACT_FIELDS.SUBSCRIPTION_STATUS);
    const subscriptionStatus = subStatusRaw || null;

    const record = {
      podioItemId: item.item_id,
      email: emailVal.toLowerCase().trim(),
      passwordHash: passwordVal,
      fullName: nameVal,
      circleMember: false,
      subscriptionStatus,
      // CCO-T031: passwordResetJti is set by /forgot-password and cleared
      // by /reset-password — never written from the Podio sync path.
      // Default null on first upsert; preserved by not touching it in the
      // onConflictDoUpdate `set` clause below (which uses this same record
      // but only writes the columns we just computed).
      passwordResetJti: null as string | null,
      payload: item.fields as unknown as Record<string, unknown>,
      syncedAt: new Date(),
    };

    // CCO-T031: do NOT clobber passwordResetJti via the conflict-update path
    // — that column is owned by the reset action, not the Podio sync. The
    // insert path still sets it (to null) for fresh rows; the conflict path
    // explicitly omits it.
    const conflictUpdate = {
      email: record.email,
      passwordHash: record.passwordHash,
      fullName: record.fullName,
      circleMember: record.circleMember,
      subscriptionStatus: record.subscriptionStatus,
      payload: record.payload,
      syncedAt: record.syncedAt,
    };
    await db
      .insert(contacts)
      .values(record)
      .onConflictDoUpdate({
        target: contacts.podioItemId,
        set: conflictUpdate,
      });

    return {
      ...record,
      syncedAt: record.syncedAt,
    };
  } catch (err) {
    console.error("Failed to fetch contact from Podio:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(contactId: number): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const [session] = await db
    .insert(sessions)
    .values({ contactId, expiresAt })
    .returning({ id: sessions.id });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" (not "strict") so the cookie is sent on top-level GET
    // navigations from other sites — required for SSO redirects from
    // cco-sso-signer.vercel.app → portal. "strict" would withhold the
    // cookie on any navigation initiated cross-site, breaking SSO.
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return session.id;
}

export async function getSession(): Promise<{
  sessionId: string;
  contactId: number;
} | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.id, sessionId),
      gt(sessions.expiresAt, new Date())
    ),
  });

  if (!session) return null;

  return { sessionId: session.id, contactId: session.contactId };
}

export async function getSessionContact(): Promise<{
  contactId: number;
  email: string;
  fullName: string | null;
  subscriptionStatus: string | null;
} | null> {
  const session = await getSession();
  if (!session) return null;

  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.podioItemId, session.contactId),
  });

  if (!contact) return null;

  return {
    contactId: contact.podioItemId,
    email: contact.email,
    fullName: contact.fullName,
    subscriptionStatus: contact.subscriptionStatus,
  };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  cookieStore.delete(SESSION_COOKIE);
}
