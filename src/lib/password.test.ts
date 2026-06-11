import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import {
  hashPassword,
  verifyPassword,
  makeResetPendingSentinel,
  RESET_PENDING_PREFIX,
} from "./password";

// CCO-T048 regression suite for the multi-algo verify ladder. The ladder
// guards production sign-in for four generations of stored credentials —
// lock each branch's behavior so refactors can't silently drop one.

describe("verifyPassword ladder", () => {
  it("verifies an argon2id hash written by hashPassword", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.startsWith("$argon2")).toBe(true);
    await expect(verifyPassword("correct horse battery", stored)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", stored)).resolves.toBe(false);
  });

  it("rejects a malformed argon2 record instead of throwing", async () => {
    await expect(verifyPassword("anything", "$argon2id$corrupt")).resolves.toBe(false);
  });

  it("verifies legacy MD5 (Zenforo era), case-insensitively", async () => {
    const md5 = createHash("md5").update("LegacyPass1").digest("hex");
    await expect(verifyPassword("LegacyPass1", md5)).resolves.toBe(true);
    await expect(verifyPassword("LegacyPass1", md5.toUpperCase())).resolves.toBe(true);
    await expect(verifyPassword("nope", md5)).resolves.toBe(false);
  });

  it("falls back to plain-text equality for very-legacy rows", async () => {
    await expect(verifyPassword("JG8032!", "JG8032!")).resolves.toBe(true);
    await expect(verifyPassword("JG8032", "JG8032!")).resolves.toBe(false);
  });

  it("rejects an empty stored hash", async () => {
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });
});

describe("reset-pending sentinel (CCO-T048)", () => {
  it("creates a prefixed, unique sentinel", () => {
    const a = makeResetPendingSentinel();
    const b = makeResetPendingSentinel();
    expect(a.startsWith(RESET_PENDING_PREFIX)).toBe(true);
    expect(a).not.toEqual(b);
  });

  it("never verifies — even when the typed password IS the stored sentinel", async () => {
    const sentinel = makeResetPendingSentinel();
    // Without the explicit prefix guard this would fall through to the
    // plain-text-equality branch and grant a login to anyone who learned
    // the stored value (e.g. via a DB leak).
    await expect(verifyPassword(sentinel, sentinel)).resolves.toBe(false);
    await expect(verifyPassword("any guess", sentinel)).resolves.toBe(false);
  });

  it("does not collide with real hash formats", () => {
    const sentinel = makeResetPendingSentinel();
    expect(sentinel.startsWith("$argon2")).toBe(false);
    expect(sentinel.startsWith("$2")).toBe(false);
    expect(/^[a-f0-9]{32}$/i.test(sentinel)).toBe(false);
  });
});
