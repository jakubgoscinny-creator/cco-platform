/**
 * Circle → CCO Portal SSO.
 *
 * Direction:
 *   - Circle (cco.academy) is the identity provider.
 *   - The portal is the relying party.
 *   - A user logged into Circle clicks a link that ultimately hits
 *     /api/sso/circle?token=<jwt>. If the JWT verifies, the portal
 *     upserts the user and sets cco_session.
 *
 * JWT details:
 *   - HS256, signed with SSO_CIRCLE_JWT_SECRET (shared with the
 *     token-signing service on the Circle side — see
 *     docs/CIRCLE_SSO_SETUP.md).
 *   - MUST have a short `exp` — we enforce max 5 minutes from `iat`
 *     as a belt-and-braces check against stolen/replayed links.
 *   - Required claims: `email`. Everything else is optional.
 *
 * What this module does NOT verify:
 *   - It does not call Circle's Headless Auth API. The token-signing
 *     service on the Circle side is the authoritative source. The
 *     shared secret is the trust anchor, so that service MUST be
 *     server-side only — never ship the secret to a browser.
 */

import { jwtVerify, type JWTPayload } from "jose";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { contacts } from "./schema";
import {
  filterItems,
  getTextValue,
  PODIO_APPS,
  CONTACT_FIELDS,
} from "./podio";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * Max lifetime of the inbound Circle JWT. The token-signing service
 * should emit tokens with TTLs well under this (60s is plenty). This
 * cap is a defense-in-depth: even if the signing service misbehaves
 * and issues a 24h token, we still reject it here.
 */
const MAX_JWT_AGE_SECONDS = 300;

// ---------------------------------------------------------------------------
// JWT verification
// ---------------------------------------------------------------------------

export interface CircleJwtClaims extends JWTPayload {
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  /** Circle's internal member ID, passed through for audit if the signer includes it. */
  community_member_id?: number;
  /** Any positive signal the signer sets for active membership. */
  is_member?: boolean;
  circle_member?: boolean;
}

export interface VerifiedCircleIdentity {
  email: string;
  fullName: string;
  avatarUrl: string | null;
  circleMember: boolean;
  rawClaims: CircleJwtClaims;
}

/**
 * Verify an HS256 JWT issued by the token-signing service. Returns the
 * extracted identity. Throws on any failure (invalid signature, expired,
 * missing required claims). Callers should map the error to a 400 or
 * 302 to /sign-in rather than surfacing error strings to the user.
 */
export async function verifyCircleAuthJwt(
  token: string
): Promise<VerifiedCircleIdentity> {
  const secret = requireEnv("SSO_CIRCLE_JWT_SECRET");
  const secretBytes = new TextEncoder().encode(secret);

  const { payload } = await jwtVerify(token, secretBytes, {
    algorithms: ["HS256"],
    // Cap the accepted lifetime. `exp` is enforced by jose by default;
    // `maxTokenAge` additionally rejects tokens whose `iat` is too old.
    maxTokenAge: `${MAX_JWT_AGE_SECONDS}s`,
  });

  const claims = payload as CircleJwtClaims;

  const email = typeof claims.email === "string" ? claims.email.trim() : "";
  if (!email) {
    throw new Error("JWT missing required claim: email");
  }

  const fullName = pickName(claims);
  const avatarUrl = typeof claims.avatar_url === "string" ? claims.avatar_url : null;
  const circleMember = deriveMembership(claims);

  return {
    email: email.toLowerCase(),
    fullName,
    avatarUrl,
    circleMember,
    rawClaims: claims,
  };
}

function pickName(claims: CircleJwtClaims): string {
  if (typeof claims.name === "string" && claims.name.trim()) {
    return claims.name.trim();
  }
  const parts = [claims.first_name, claims.last_name]
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim());
  return parts.join(" ");
}

/**
 * If the signer explicitly tells us false, honor that. Otherwise default
 * true — the user authenticated on cco.academy, they're a Circle member
 * by definition. The signer can tighten this later by checking actual
 * space membership.
 */
function deriveMembership(claims: CircleJwtClaims): boolean {
  if (claims.is_member === false) return false;
  if (claims.circle_member === false) return false;
  return true;
}

// ---------------------------------------------------------------------------
// User upsert
// ---------------------------------------------------------------------------

/** Non-matchable sentinel password for SSO-only contacts. */
function ssoSentinelPasswordHash(): string {
  return `sso:${randomBytes(48).toString("hex")}`;
}

export interface UpsertResult {
  contactId: number;
  email: string;
  fullName: string | null;
  circleMember: boolean;
}

/**
 * Find a Podio Contact by email, mirror into Neon contacts, and set
 * circle_member from the Circle JWT claims. If the contact doesn't
 * exist in Podio, throws — the Circle webhook is responsible for
 * creating Contacts when members join; we don't create them here.
 *
 * Uses the Contacts app (14660191), matching auth.ts. The email field
 * is Podio type "email" — filter requires array syntax, and reading
 * the value needs {type, value} unwrap.
 */
export async function upsertCircleUser(params: {
  email: string;
  fullName: string;
  circleMember: boolean;
}): Promise<UpsertResult> {
  const email = params.email.toLowerCase().trim();
  const fullName = params.fullName.trim();

  // Look up existing Podio Contact by email.
  // Email-type fields filter on a string array, not a bare string.
  const result = await filterItems(
    PODIO_APPS.CONTACTS,
    { [CONTACT_FIELDS.EMAIL]: [email] },
    { limit: 1 }
  );

  if (!result.items?.length) {
    throw new Error(`No Podio Contact found for email: ${email}`);
  }

  const item = result.items[0];
  const podioItemId = item.item_id;

  // Read name from Podio (fall back to Circle-provided name)
  const podioName = getTextValue(item, CONTACT_FIELDS.NAME) || item.title || "";
  const resolvedName = podioName || fullName;

  // Read password — PASSWORD_MASTER is a plaintext text field
  const passwordHash =
    getTextValue(item, CONTACT_FIELDS.PASSWORD_MASTER) || ssoSentinelPasswordHash();

  // Read email from the Podio item. Contacts email field is type "email"
  // with values shaped as {type: "other", value: "user@example.com"}.
  const emailField = item.fields?.find(
    (f) => f.field_id === CONTACT_FIELDS.EMAIL
  );
  const rawEmail = emailField?.values?.[0]?.value;
  const podioEmail =
    typeof rawEmail === "string"
      ? rawEmail
      : (rawEmail as { value?: string } | undefined)?.value ?? email;

  // Mirror into Neon
  await db
    .insert(contacts)
    .values({
      podioItemId,
      email: podioEmail.toLowerCase().trim(),
      passwordHash,
      fullName: resolvedName || null,
      circleMember: params.circleMember,
      payload: item.fields as unknown as Record<string, unknown>,
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: contacts.podioItemId,
      set: {
        email: podioEmail.toLowerCase().trim(),
        fullName: resolvedName || null,
        circleMember: params.circleMember,
        syncedAt: new Date(),
      },
    });

  const existing = await db.query.contacts.findFirst({
    where: eq(contacts.podioItemId, podioItemId),
  });

  return {
    contactId: podioItemId,
    email: podioEmail.toLowerCase().trim(),
    fullName: existing?.fullName ?? null,
    circleMember: existing?.circleMember ?? params.circleMember,
  };
}

// ---------------------------------------------------------------------------
// Membership flag (re-exported for potential future use from other modules)
// ---------------------------------------------------------------------------

/**
 * Stand-alone helper to flip circle_member on an existing contact. Not
 * used by the main SSO path (upsertCircleUser already sets the flag)
 * but kept for administrative/ad-hoc use.
 */
export async function markAsCircleMember(contactId: number): Promise<void> {
  await db
    .update(contacts)
    .set({ circleMember: true })
    .where(eq(contacts.podioItemId, contactId));
}
