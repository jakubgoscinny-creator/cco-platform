/**
 * Password-reset JWT sign / verify (CCO-T031).
 *
 * Token shape:
 *   { iss: "cco-portal", purpose: "reset_password", sub: <contactId>,
 *     jti: <uuid>, iat, exp }
 *
 * - HS256 (jose), shared with no one — server-only secret
 *   `RESET_PASSWORD_JWT_SECRET` (generate with `openssl rand -hex 32`).
 * - 30-minute TTL.
 * - jti is also stored on `contacts.passwordResetJti` so a successful
 *   /reset-password consumption can clear it — replays within the TTL
 *   are rejected at the DB layer, not just at JWT decode.
 *
 * Why a fresh secret rather than `SSO_CIRCLE_JWT_SECRET`:
 *   - Different blast radius and rotation policy. The Circle secret is
 *     shared with cco-sso-signer (the inbound SSO path); a reset secret
 *     never leaves the portal. Keeping them separate means rotating one
 *     doesn't churn the other.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "crypto";

export const RESET_TOKEN_TTL_SECONDS = 30 * 60;

const ISSUER = "cco-portal";
const PURPOSE = "reset_password";

function getSecret(): Uint8Array {
  const s = process.env.RESET_PASSWORD_JWT_SECRET;
  if (!s) throw new Error("Missing env var: RESET_PASSWORD_JWT_SECRET");
  return new TextEncoder().encode(s);
}

export interface ResetTokenClaims extends JWTPayload {
  purpose: typeof PURPOSE;
  sub: string;
  jti: string;
}

/**
 * Sign a fresh reset-token JWT for `contactId`. Returns the token and
 * the jti (caller stores the jti on the contact for single-use enforcement).
 */
export async function signResetToken(contactId: number): Promise<{
  token: string;
  jti: string;
  expiresAt: Date;
}> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000);
  const token = await new SignJWT({ purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(String(contactId))
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret());
  return { token, jti, expiresAt };
}

/**
 * Verify a reset-token JWT. Throws on any failure (invalid signature,
 * expired, wrong purpose, missing claims). On success returns the
 * contactId + jti for the caller to cross-check against the DB.
 */
export async function verifyResetToken(
  token: string
): Promise<{ contactId: number; jti: string }> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    algorithms: ["HS256"],
  });

  if (payload.purpose !== PURPOSE) {
    throw new Error("Token is not a password-reset token");
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Token is missing a subject");
  }
  if (typeof payload.jti !== "string" || !payload.jti) {
    throw new Error("Token is missing a jti");
  }

  const contactId = Number(payload.sub);
  if (!Number.isFinite(contactId) || contactId <= 0) {
    throw new Error("Token subject is not a valid contact id");
  }

  return { contactId, jti: payload.jti };
}
