import { describe, it, expect } from "vitest";
import { secretEquals, extractRequestSecret } from "./webhook-auth";

// CCO-T063: the webhook auth primitives are the only thing standing between the
// public internet and a write into the Neon mirror, so lock their behavior:
// constant-time-ish equality that fails CLOSED, and dual Bearer/?key= extraction
// (native Podio hooks can only send ?key=).

describe("secretEquals", () => {
  it("matches identical secrets", () => {
    expect(secretEquals("s3cret-value", "s3cret-value")).toBe(true);
  });

  it("rejects a different secret of equal length", () => {
    expect(secretEquals("aaaaaa", "aaaaab")).toBe(false);
  });

  it("rejects on length mismatch (no throw)", () => {
    expect(secretEquals("short", "longer-secret")).toBe(false);
  });

  it("rejects an empty provided secret", () => {
    expect(secretEquals("", "real-secret")).toBe(false);
  });
});

function fakeReq(opts: { auth?: string | null; key?: string | null }) {
  return {
    headers: { get: (h: string) => (h === "authorization" ? opts.auth ?? null : null) },
    nextUrl: { searchParams: { get: (k: string) => (k === "key" ? opts.key ?? null : null) } },
  };
}

describe("extractRequestSecret", () => {
  it("reads a Bearer header", () => {
    expect(extractRequestSecret(fakeReq({ auth: "Bearer abc123" }))).toBe("abc123");
  });

  it("reads the ?key= query param (native Podio hook shape)", () => {
    expect(extractRequestSecret(fakeReq({ key: "xyz789" }))).toBe("xyz789");
  });

  it("prefers the Bearer header over ?key=", () => {
    expect(extractRequestSecret(fakeReq({ auth: "Bearer header-wins", key: "query" }))).toBe(
      "header-wins"
    );
  });

  it("returns '' when neither is present (→ fails closed downstream)", () => {
    expect(extractRequestSecret(fakeReq({}))).toBe("");
  });

  it("ignores a non-Bearer Authorization scheme", () => {
    expect(extractRequestSecret(fakeReq({ auth: "Basic Zm9v" }))).toBe("");
  });
});
