import { cookies } from "next/headers";
import { db } from "./db";
import { contacts, sessions } from "./schema";
import { eq, and, gt } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { createHash } from "crypto";
import {
  filterItems,
  getTextValue,
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

  // Upgrade any non-bcrypt hash (MD5 or plaintext "JG8032!"-style master
  // passwords from Podio) to bcrypt on first successful login.
  if (!contact.passwordHash.startsWith("$2")) {
    const bcryptHash = await hash(password, 12);
    await db
      .update(contacts)
      .set({ passwordHash: bcryptHash })
      .where(eq(contacts.podioItemId, contact.podioItemId));
  }

  return {
    success: true,
    contactId: contact.podioItemId,
    name: contact.fullName ?? email,
  };
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Check if it's a bcrypt hash ($2a$, $2b$, $2y$)
  if (storedHash.startsWith("$2")) {
    return compare(password, storedHash);
  }

  // Legacy MD5 hash (32 hex chars)
  if (storedHash.length === 32 && /^[a-f0-9]+$/i.test(storedHash)) {
    const md5 = createHash("md5").update(password).digest("hex");
    return md5.toLowerCase() === storedHash.toLowerCase();
  }

  // Plain text comparison (very legacy, shouldn't exist)
  return password === storedHash;
}

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

    const record = {
      podioItemId: item.item_id,
      email: emailVal.toLowerCase().trim(),
      passwordHash: passwordVal,
      fullName: nameVal,
      circleMember: false,
      payload: item.fields as unknown as Record<string, unknown>,
      syncedAt: new Date(),
    };

    await db
      .insert(contacts)
      .values(record)
      .onConflictDoUpdate({
        target: contacts.podioItemId,
        set: record,
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
