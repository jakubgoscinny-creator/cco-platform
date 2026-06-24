import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// CCO-T065: the Podio rate-limit circuit breaker. Once Podio returns HTTP 420,
// every Podio call must fail fast (without hitting Podio) until the Retry-After
// window elapses — the anti-amplification guard the 2026-06-24 outage lacked.
// vi.resetModules() + dynamic import gives each test a fresh module instance
// (breaker state + token cache reset). Fake timers drive the recovery window
// deterministically (the breaker compares Date.now() to rateLimitedUntil).

function tokenResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
  };
}

function rateLimited(retryAfter: string) {
  return {
    ok: false,
    status: 420,
    headers: { get: (h: string) => (h === "Retry-After" ? retryAfter : null) },
    text: async () => "rate limited",
  };
}

function unauthorized() {
  return { ok: false, status: 401, headers: { get: () => null }, text: async () => "unauth" };
}

function okItem(id: number) {
  return { ok: true, status: 200, json: async () => ({ item_id: id }) };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  process.env.PODIO_REFRESH_TOKEN = "rt";
  process.env.PODIO_CLIENT_ID = "cid";
  process.env.PODIO_CLIENT_SECRET = "secret";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Podio circuit breaker (CCO-T065)", () => {
  it("trips on a 420 and short-circuits subsequent calls without hitting Podio", async () => {
    const { getItem, PodioRateLimitError } = await import("./podio");
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(rateLimited("2"));
    await expect(getItem(1)).rejects.toBeInstanceOf(PodioRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Breaker open: rejects immediately, NO new fetch.
    await expect(getItem(2)).rejects.toBeInstanceOf(PodioRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("carries the Retry-After window on the thrown error (rejects form, never vacuous)", async () => {
    const { getItem } = await import("./podio");
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(rateLimited("37"));
    await expect(getItem(1)).rejects.toMatchObject({ retryAfterSeconds: 37 });
    // Open-breaker error still reports a positive remaining wait.
    await expect(getItem(2)).rejects.toMatchObject({ retryAfterSeconds: expect.any(Number) });
  });

  it("short-circuits ALL podioFetch entry points, not just getItem", async () => {
    const { getItem, filterItems, createItem, PodioRateLimitError } = await import("./podio");
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(rateLimited("5"));
    await expect(getItem(1)).rejects.toBeInstanceOf(PodioRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Different entry points share the podioFetch chokepoint → also fail fast.
    await expect(filterItems(123, {})).rejects.toBeInstanceOf(PodioRateLimitError);
    await expect(createItem(123, {})).rejects.toBeInstanceOf(PodioRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("trips the breaker when the OAuth token endpoint itself is rate-limited", async () => {
    const { getItem, PodioRateLimitError } = await import("./podio");
    fetchMock.mockResolvedValueOnce(rateLimited("9")); // token fetch returns 420
    await expect(getItem(1)).rejects.toBeInstanceOf(PodioRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Breaker now open → next call short-circuits before any fetch.
    await expect(getItem(2)).rejects.toBeInstanceOf(PodioRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("trips on a 420 that follows a 401 token refresh (retry no longer returned raw)", async () => {
    const { getItem, PodioRateLimitError } = await import("./podio");
    fetchMock
      .mockResolvedValueOnce(tokenResponse()) // initial token
      .mockResolvedValueOnce(unauthorized()) // item → 401
      .mockResolvedValueOnce(tokenResponse()) // token refresh
      .mockResolvedValueOnce(rateLimited("12")); // retry item → 420
    await expect(getItem(1)).rejects.toBeInstanceOf(PodioRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // Breaker tripped on the post-401 retry path too.
    await expect(getItem(2)).rejects.toBeInstanceOf(PodioRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("recovers and calls Podio again once the window elapses", async () => {
    const { getItem, PodioRateLimitError } = await import("./podio");
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(rateLimited("1"));
    await expect(getItem(1)).rejects.toBeInstanceOf(PodioRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Still open just before the 1s window.
    vi.advanceTimersByTime(999);
    await expect(getItem(2)).rejects.toBeInstanceOf(PodioRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Recovered just after. Token still cached, so recovery is a single fetch.
    vi.advanceTimersByTime(2);
    fetchMock.mockResolvedValueOnce(okItem(2));
    await expect(getItem(2)).resolves.toEqual({ item_id: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to a 60s window when Retry-After is an HTTP-date (not delta-seconds)", async () => {
    const { getItem } = await import("./podio");
    const httpDate = {
      ok: false,
      status: 420,
      headers: { get: (h: string) => (h === "Retry-After" ? "Wed, 21 Oct 2099 07:28:00 GMT" : null) },
      text: async () => "rate limited",
    };
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(httpDate);
    // A far-future HTTP-date clamps to the 1h max; a malformed one would default
    // to 60. Either way the parse must NOT collapse to NaN/throw.
    await expect(getItem(1)).rejects.toMatchObject({
      retryAfterSeconds: expect.any(Number),
    });
  });
});

describe("withPodioFallback / isPodioRateLimit (CCO-T066)", () => {
  it("returns the op result when the Podio op succeeds", async () => {
    const { withPodioFallback } = await import("./podio");
    await expect(withPodioFallback(async () => "live", () => "mirror")).resolves.toBe("live");
  });

  it("returns the fallback when the op throws (no error escapes)", async () => {
    const { withPodioFallback } = await import("./podio");
    await expect(
      withPodioFallback(async () => {
        throw new Error("boom");
      }, () => "mirror")
    ).resolves.toBe("mirror");
  });

  it("passes the error to the fallback so it can branch on isPodioRateLimit", async () => {
    const { withPodioFallback, isPodioRateLimit, PodioRateLimitError } = await import("./podio");
    const out = await withPodioFallback(
      async () => {
        throw new PodioRateLimitError(42);
      },
      (err) => (isPodioRateLimit(err) ? `retry:${err.retryAfterSeconds}` : "other")
    );
    expect(out).toBe("retry:42");
  });

  it("isPodioRateLimit is true only for PodioRateLimitError", async () => {
    const { isPodioRateLimit, PodioRateLimitError } = await import("./podio");
    expect(isPodioRateLimit(new PodioRateLimitError(1))).toBe(true);
    expect(isPodioRateLimit(new Error("plain"))).toBe(false);
    expect(isPodioRateLimit(null)).toBe(false);
  });
});
