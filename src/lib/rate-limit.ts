/**
 * Per-key rate limiter backed by Neon (CCO-T031 hardening pass).
 *
 * Designed for low-volume, high-value endpoints like /forgot-password
 * where we want to (a) prevent a single IP from flooding Podio with
 * createItem calls (which is how my session burned the Podio rate-limit
 * cap on 2026-05-21), and (b) make targeted email-enumeration / DoS
 * attacks visibly more expensive than just hammering the form.
 *
 * NOT for hot-path endpoints (auth, /catalog, gating). Those are higher
 * volume and would need a more sophisticated approach (in-memory LRU +
 * periodic flush, or an edge solution). For forgot-password / change-
 * password / reset-password, one extra Neon row update per request is
 * a fine trade.
 *
 * Window strategy: sliding window approximated by a fixed window that
 * resets when its current window has elapsed. Simple, predictable,
 * roughly correct.
 */

import { sql } from "drizzle-orm";
import { db } from "./db";

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the window resets (0 if currently allowed). */
  retryAfterSeconds: number;
  /** Hits this window so far, including the just-attempted hit. */
  count: number;
}

/**
 * Check-and-increment a counter for `key`. If the counter for the
 * current window already exceeds `max`, return `{ allowed: false }`
 * WITHOUT incrementing further. Otherwise increment and return
 * `{ allowed: true }`.
 *
 * Implementation: one SQL statement using ON CONFLICT to handle both
 * the create-row case and the same-window increment / reset-window
 * cases. The window resets when (now - window_start) ≥ windowSeconds.
 *
 * `key` should be namespaced by the caller (e.g. "forgot:ip:1.2.3.4")
 * so different endpoints don't share buckets.
 */
export async function checkAndIncrement(
  key: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitVerdict> {
  const interval = `${windowSeconds} seconds`;

  // Atomic upsert. On conflict, either reset the window (if elapsed)
  // or increment the count. RETURNING gives us the post-state to
  // decide allow/deny.
  const result = await db.execute<{
    count: number;
    window_start: Date;
  }>(sql`
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN (now() - rate_limits.window_start) >= ${interval}::interval THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN (now() - rate_limits.window_start) >= ${interval}::interval THEN now()
        ELSE rate_limits.window_start
      END
    RETURNING count, window_start
  `);

  const row = (result.rows ?? result)[0] as { count: number; window_start: Date } | undefined;
  if (!row) {
    // Defensive: if the upsert returned nothing for some reason, fail-open.
    return { allowed: true, retryAfterSeconds: 0, count: 0 };
  }

  if (row.count <= max) {
    return { allowed: true, retryAfterSeconds: 0, count: row.count };
  }

  // Over the limit. Compute time-until-reset.
  const windowStart = new Date(row.window_start).getTime();
  const resetAt = windowStart + windowSeconds * 1000;
  const retryAfterSeconds = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));

  return { allowed: false, retryAfterSeconds, count: row.count };
}
