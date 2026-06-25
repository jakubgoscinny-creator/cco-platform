import { describe, it, expect, vi, beforeEach } from "vitest";

// CCO-T063: unit-cover the webhook's routing/dispatch core without a Next
// runtime. Mock the side-effecting sync helpers (so no Neon/db) and the Podio
// verify call; keep PODIO_APPS real so a field-id/app-id drift is caught.
const h = vi.hoisted(() => ({
  syncOneTest: vi.fn(async () => true),
  syncOneDomain: vi.fn(async () => true),
  deleteTest: vi.fn(async () => {}),
  deleteDomain: vi.fn(async () => {}),
  verifyPodioHook: vi.fn(async () => {}),
}));

vi.mock("./sync", () => ({
  syncOneTest: h.syncOneTest,
  syncOneDomain: h.syncOneDomain,
  deleteTest: h.deleteTest,
  deleteDomain: h.deleteDomain,
}));

vi.mock("./podio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./podio")>();
  return { ...actual, verifyPodioHook: h.verifyPodioHook };
});

import {
  parseWebhookBody,
  normalizePodioEvent,
  resolveWebhookApp,
  handlePodioEvent,
} from "./podio-webhook";
import { PODIO_APPS } from "./podio";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseWebhookBody", () => {
  it("parses Podio's native application/x-www-form-urlencoded body", () => {
    expect(
      parseWebhookBody("type=item.update&item_id=123&hook_id=9", "application/x-www-form-urlencoded")
    ).toEqual({ type: "item.update", item_id: "123", hook_id: "9" });
  });

  it("parses a JSON body when content-type says JSON (GlobiFlow)", () => {
    expect(parseWebhookBody('{"type":"item.create","item_id":5}', "application/json")).toEqual({
      type: "item.create",
      item_id: 5,
    });
  });

  it("falls back to JSON for an unlabeled JSON body", () => {
    expect(parseWebhookBody('{"type":"item.create"}', "")).toEqual({ type: "item.create" });
  });

  it("does NOT misfire the JSON fallback on a real multi-field form body", () => {
    expect(parseWebhookBody("type=item.update&item_id=1", "")).toEqual({
      type: "item.update",
      item_id: "1",
    });
  });

  it("returns {} for an empty body, never throws on junk", () => {
    expect(parseWebhookBody("", "application/json")).toEqual({});
    expect(parseWebhookBody("{bad json", "application/json")).toBeTypeOf("object");
  });
});

describe("normalizePodioEvent", () => {
  it("coerces form-encoded strings to numbers", () => {
    const e = normalizePodioEvent({
      type: "item.update",
      item_id: "12345",
      hook_id: "678",
    });
    expect(e).toEqual({
      type: "item.update",
      itemId: 12345,
      hookId: 678,
      code: null,
      appId: null,
    });
  });

  it("captures the verify code and a Globiflow app_id", () => {
    const e = normalizePodioEvent({ type: "hook.verify", hook_id: "9", code: "42" });
    expect(e.code).toBe("42");
    expect(e.hookId).toBe(9);

    const g = normalizePodioEvent({ type: "item.create", item_id: 5, app_id: 16243239 });
    expect(g.appId).toBe(16243239);
    expect(g.itemId).toBe(5);
  });

  it("yields nulls for missing/blank/non-numeric fields and never throws", () => {
    const e = normalizePodioEvent({ type: "item.update", item_id: "", hook_id: "abc" });
    expect(e.itemId).toBeNull();
    expect(e.hookId).toBeNull();
    expect(normalizePodioEvent({}).type).toBe("");
  });
});

describe("resolveWebhookApp", () => {
  it("resolves the explicit ?app= param", () => {
    expect(resolveWebhookApp("tests", null)).toBe("tests");
    expect(resolveWebhookApp("domains", null)).toBe("domains");
  });

  it("falls back to a body app_id via PODIO_APPS", () => {
    expect(resolveWebhookApp(null, PODIO_APPS.TESTS)).toBe("tests");
    expect(resolveWebhookApp(null, PODIO_APPS.DOMAINS)).toBe("domains");
  });

  it("prefers the explicit param over app_id", () => {
    expect(resolveWebhookApp("domains", PODIO_APPS.TESTS)).toBe("domains");
  });

  it("returns null for an unknown app (→ caller no-ops)", () => {
    expect(resolveWebhookApp("contacts", null)).toBeNull();
    expect(resolveWebhookApp(null, 99999999)).toBeNull();
    expect(resolveWebhookApp(null, null)).toBeNull();
  });
});

describe("handlePodioEvent", () => {
  it("verify handshake → activates the hook (app-independent)", async () => {
    const r = await handlePodioEvent(
      { type: "hook.verify", itemId: null, hookId: 678, code: "abc", appId: null },
      null
    );
    expect(h.verifyPodioHook).toHaveBeenCalledWith(678, "abc");
    expect(r).toEqual({ ok: true, action: "verified" });
  });

  it("verify handshake missing code → skipped, no Podio call", async () => {
    const r = await handlePodioEvent(
      { type: "hook.verify", itemId: null, hookId: 678, code: null, appId: null },
      "tests"
    );
    expect(h.verifyPodioHook).not.toHaveBeenCalled();
    expect(r.action).toBe("skipped");
  });

  it("item.update on tests → syncOneTest", async () => {
    const r = await handlePodioEvent(
      { type: "item.update", itemId: 111, hookId: null, code: null, appId: null },
      "tests"
    );
    expect(h.syncOneTest).toHaveBeenCalledWith(111);
    expect(h.syncOneDomain).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, action: "synced" });
  });

  it("item.create on domains → syncOneDomain", async () => {
    const r = await handlePodioEvent(
      { type: "item.create", itemId: 222, hookId: null, code: null, appId: null },
      "domains"
    );
    expect(h.syncOneDomain).toHaveBeenCalledWith(222);
    expect(r.action).toBe("synced");
  });

  it("item.delete on tests → deleteTest (no getItem needed)", async () => {
    const r = await handlePodioEvent(
      { type: "item.delete", itemId: 333, hookId: null, code: null, appId: null },
      "tests"
    );
    expect(h.deleteTest).toHaveBeenCalledWith(333);
    expect(r).toEqual({ ok: true, action: "deleted" });
  });

  it("item.delete on domains → deleteDomain", async () => {
    await handlePodioEvent(
      { type: "item.delete", itemId: 444, hookId: null, code: null, appId: null },
      "domains"
    );
    expect(h.deleteDomain).toHaveBeenCalledWith(444);
  });

  it("unknown app on an item event → skipped, no side effect", async () => {
    const r = await handlePodioEvent(
      { type: "item.update", itemId: 555, hookId: null, code: null, appId: null },
      null
    );
    expect(h.syncOneTest).not.toHaveBeenCalled();
    expect(h.syncOneDomain).not.toHaveBeenCalled();
    expect(r.action).toBe("skipped");
    expect(r.detail).toContain("unknown app");
  });

  it("missing item_id on an item event → skipped", async () => {
    const r = await handlePodioEvent(
      { type: "item.update", itemId: null, hookId: null, code: null, appId: null },
      "tests"
    );
    expect(h.syncOneTest).not.toHaveBeenCalled();
    expect(r.action).toBe("skipped");
  });

  it("unhandled event type → 200 no-op", async () => {
    const r = await handlePodioEvent(
      { type: "comment.create", itemId: 1, hookId: null, code: null, appId: null },
      "tests"
    );
    expect(r).toEqual({ ok: true, action: "skipped", detail: "unhandled type comment.create" });
  });

  it("item that does not map (mapper → false) → skipped, not error", async () => {
    h.syncOneTest.mockResolvedValueOnce(false);
    const r = await handlePodioEvent(
      { type: "item.update", itemId: 666, hookId: null, code: null, appId: null },
      "tests"
    );
    expect(r.action).toBe("skipped");
    expect(r.detail).toContain("did not map");
  });
});
