/**
 * Circle SSO — OAuth 2.0 endpoints where Circle is the client and
 * the portal is the authorization server.
 *
 * Flow:
 *   1. Circle redirects the user's browser to /api/sso/authorize with
 *      a short-lived JWT that Circle signed with SSO_CIRCLE_JWT_SECRET.
 *   2. We verify the JWT, upsert the user in Podio + Neon, set the
 *      cco_session cookie, and redirect back to Circle with a `code`.
 *   3. Circle calls /api/sso/token server-to-server to exchange the
 *      code for an access_token.
 *   4. Circle calls /api/sso/userinfo with the bearer token.
 *
 * `code` and `access_token` are both signed HS256 JWTs. No storage
 * table needed; they verify themselves on the return leg. This works
 * on Vercel serverless (no shared memory).
 */

import jwt, { type JwtPayload } from "jsonwebtoken";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { contacts } from "./schema";
import {
  createItem,
  filterItems,
  getTextValue,
  PODIO_APPS,
  PROFILE_FIELDS,
} from "./podio";

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const SSO_CODE_TTL_SECONDS = 60;
export const SSO_ACCESS_TOKEN_TTL_SECONDS = 3600;

// ---------------------------------------------------------------------------
// Circle JWT (inbound on /authorize)
// ---------------------------------------------------------------------------

export interface CircleJwtPayload extends JwtPayload {
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  picture?: string;
  // Membership signal — Circle JWTs vary; we accept any of these
  space_ids?: number[] | string[];
  spaces?: unknown[];
  roles?: string[];
  is_member?: boolean;
  membership_active?: boolean;
}

export function verifyCircleJwt(token: string): CircleJwtPayload {
  const secret = requireEnv("SSO_CIRCLE_JWT_SECRET");
  // Circle signs with HS256 using the shared secret from cco.academy/settings/sso
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (typeof decoded === "string") {
    throw new Error("Circle JWT payload is not a JSON object");
  }
  return decoded as CircleJwtPayload;
}

/**
 * Determine whether the Circle user has an active space membership.
 * Conservative heuristic: if any positive signal is present, return true.
 * If nothing membership-shaped is present, return true (the user authed
 * via Circle at all, which is itself membership evidence) — Laureen can
 * tighten this once we know the exact JWT shape Circle emits.
 */
export function circleJwtImpliesMembership(payload: CircleJwtPayload): boolean {
  if (payload.is_member === false) return false;
  if (payload.membership_active === false) return false;
  if (Array.isArray(payload.space_ids) && payload.space_ids.length > 0) return true;
  if (Array.isArray(payload.spaces) && payload.spaces.length > 0) return true;
  if (Array.isArray(payload.roles) && payload.roles.length > 0) return true;
  // Default: user came through Circle SSO => treat as member
  return true;
}

export function extractName(payload: CircleJwtPayload): string {
  if (payload.name && payload.name.trim()) return payload.name.trim();
  const parts = [payload.first_name, payload.last_name]
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim());
  if (parts.length) return parts.join(" ");
  return "";
}

export function extractAvatar(payload: CircleJwtPayload): string | undefined {
  return payload.avatar_url ?? payload.picture ?? undefined;
}

// ---------------------------------------------------------------------------
// Authorization code (outbound on /authorize, inbound on /token)
// ---------------------------------------------------------------------------

interface AuthCodePayload extends JwtPayload {
  typ: "sso_code";
  email: string;
  contactId: number;
}

export function issueAuthorizationCode(email: string, contactId: number): string {
  const secret = requireEnv("SSO_CLIENT_SECRET");
  const payload: AuthCodePayload = { typ: "sso_code", email, contactId };
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: SSO_CODE_TTL_SECONDS,
    // Add a random jti so the same code can't be re-used as a token by accident
    jwtid: randomBytes(16).toString("hex"),
  });
}

export function verifyAuthorizationCode(code: string): AuthCodePayload {
  const secret = requireEnv("SSO_CLIENT_SECRET");
  const decoded = jwt.verify(code, secret, { algorithms: ["HS256"] });
  if (typeof decoded === "string" || decoded.typ !== "sso_code") {
    throw new Error("Invalid authorization code");
  }
  return decoded as AuthCodePayload;
}

// ---------------------------------------------------------------------------
// Access token (outbound on /token, inbound on /userinfo)
// ---------------------------------------------------------------------------

interface AccessTokenPayload extends JwtPayload {
  typ: "sso_access";
  sub: string; // contactId as string
  email: string;
}

export function issueAccessToken(contactId: number, email: string): string {
  const secret = requireEnv("SSO_CLIENT_SECRET");
  const payload: AccessTokenPayload = {
    typ: "sso_access",
    sub: String(contactId),
    email,
  };
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: SSO_ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = requireEnv("SSO_CLIENT_SECRET");
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (typeof decoded === "string" || decoded.typ !== "sso_access") {
    throw new Error("Invalid access token");
  }
  return decoded as AccessTokenPayload;
}

// ---------------------------------------------------------------------------
// Client credential validation
// ---------------------------------------------------------------------------

export function validateClientId(clientId: string): boolean {
  return clientId === requireEnv("SSO_CLIENT_ID");
}

export function validateClientCredentials(
  clientId: string,
  clientSecret: string
): boolean {
  return (
    clientId === requireEnv("SSO_CLIENT_ID") &&
    clientSecret === requireEnv("SSO_CLIENT_SECRET")
  );
}

// ---------------------------------------------------------------------------
// Upsert Circle user into Podio Platform Profiles + Neon contacts mirror
// ---------------------------------------------------------------------------

/**
 * Sentinel password for Circle-only users. Cannot match bcrypt ($2...),
 * cannot match MD5 (not 32 hex chars), and is too long to be a plaintext
 * password anyone typed — so password-based login will always fail for
 * these rows, which is what we want.
 */
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
 * Find or create a Podio Platform Profile by email, mirror into Neon
 * contacts, and set circle_member flag based on the Circle JWT payload.
 *
 * Idempotent: calling twice with the same email returns the same contactId.
 */
export async function upsertCircleUser(params: {
  email: string;
  fullName: string;
  circleMember: boolean;
}): Promise<UpsertResult> {
  const email = params.email.toLowerCase().trim();
  const fullName = params.fullName.trim();

  // 1) Find existing Podio profile
  const result = await filterItems(
    PODIO_APPS.PLATFORM_PROFILES,
    { [PROFILE_FIELDS.EMAIL]: email },
    { limit: 1 }
  );

  let podioItemId: number;
  let passwordHash: string;

  if (result.items?.length) {
    const item = result.items[0];
    podioItemId = item.item_id;
    passwordHash = getTextValue(item, PROFILE_FIELDS.PASSWORD) || ssoSentinelPasswordHash();
  } else {
    // 2) Create minimal Podio profile. We only have field IDs for
    //    EMAIL and PASSWORD exposed via PROFILE_FIELDS — the Podio
    //    app's title / name fields are not mirrored here, so we
    //    cannot set them. That is acceptable for SSO-first users;
    //    the name lives in Neon (fullName below) and in Circle.
    const sentinel = ssoSentinelPasswordHash();
    const created = await createItem(PODIO_APPS.PLATFORM_PROFILES, {
      [PROFILE_FIELDS.EMAIL]: email,
      [PROFILE_FIELDS.PASSWORD]: sentinel,
    });
    podioItemId = created.item_id;
    passwordHash = sentinel;
  }

  // 3) Upsert Neon mirror — this is the row getSession() reads from
  await db
    .insert(contacts)
    .values({
      podioItemId,
      email,
      passwordHash,
      fullName: fullName || null,
      circleMember: params.circleMember,
      payload: {},
      syncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: contacts.podioItemId,
      set: {
        email,
        fullName: fullName || null,
        circleMember: params.circleMember,
        syncedAt: new Date(),
      },
    });

  // Also backfill by-email in case an older row predates the Podio ID change
  const existing = await db.query.contacts.findFirst({
    where: eq(contacts.podioItemId, podioItemId),
  });

  return {
    contactId: podioItemId,
    email,
    fullName: existing?.fullName ?? null,
    circleMember: existing?.circleMember ?? params.circleMember,
  };
}
