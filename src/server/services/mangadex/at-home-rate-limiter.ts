/**
 * MangaDex AtHome Endpoint Rate Limiter
 *
 * MangaDex enforces a per-IP cap of **40 requests / minute** on
 * `GET /at-home/server/{chapterId}` — far stricter than the global
 * ~5 req/s (300/min) ceiling that the `mangadex-ts-client` limiter applies
 * uniformly to every endpoint. During a "search monitored manga" run the
 * release dispatcher enqueues thousands of `mangadex_download` jobs, and the
 * worker pool fires `getChapterImages` (an at-home call) far above 40/min,
 * tripping HTTP 429 ("Rate Limit Exceeded") and — on persistent violation —
 * a temporary 403 IP ban. The 2026-06-12 monitored run lost ~10% of chapters
 * (275/2718) entirely to this.
 *
 * This module is a **process-global** leaky-bucket pacer dedicated to the
 * at-home endpoint. Every `getChapterImages` call acquires a slot here first
 * (see `KaizokuMangaDexClient.getChapterImages`), so the aggregate at-home
 * request rate across all concurrent workers is smoothed to a safe value
 * under MangaDex's published limit.
 *
 * Single-process assumption: the queue worker runs in-process with the Next.js
 * server inside one container, so a module-singleton is the correct shared
 * state. If the worker is ever sharded across processes/hosts this must become
 * DB- or Redis-backed.
 *
 * @module server/services/mangadex/at-home-rate-limiter
 */

import { logger } from '@/utils/logger';

const log = logger.child('AtHomeRateLimiter');

/** Default safe ceiling: 35/min leaves headroom under MangaDex's 40/min cap. */
const DEFAULT_MAX_PER_MINUTE = 35;

/**
 * Max time a worker will block waiting for a slot before shedding the job back
 * to the queue. Kept well under the 300s job lease so a blocked acquire can
 * never outlive its lease and trigger a duplicate claim. When the backlog is
 * deeper than this, jobs reschedule via the queue's own exponential backoff
 * instead of monopolising worker slots.
 */
const DEFAULT_MAX_WAIT_MS = 90_000;

/**
 * Thrown when the next available slot is further out than the max wait. The
 * queue treats this like any other job failure → `retrying` with exponential
 * backoff, which is exactly the backpressure behaviour we want: the job comes
 * back once the burst has drained instead of holding a worker slot idle.
 */
export class AtHomeRateLimitBackpressureError extends Error {
  /** Marks this as a transient/retryable condition for any error classifier. */
  readonly retryable = true;

  constructor(waitMs: number, maxWaitMs: number) {
    super(
      `MangaDex at-home rate limiter backpressure: next slot is ~${Math.round(
        waitMs / 1000,
      )}s out (> ${Math.round(maxWaitMs / 1000)}s cap); deferring to queue`,
    );
    this.name = 'AtHomeRateLimitBackpressureError';
  }
}

/** Snapshot of limiter activity for observability / dashboards. */
export interface AtHomeLimiterMetrics {
  /** Slots granted (requests allowed through). */
  acquired: number;
  /** Jobs shed back to the queue because the wait exceeded the cap. */
  shed: number;
  /** Cumulative time callers spent blocked waiting for a slot (ms). */
  totalWaitMs: number;
  /** Largest single wait observed (ms). */
  maxWaitMs: number;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Leaky-bucket pacer. Reservation is atomic: the read-decide-write on
 * `nextSlotAt` happens synchronously with no intervening `await`, so
 * concurrent callers in the single-threaded event loop each claim a distinct,
 * monotonically increasing slot.
 */
export class AtHomeRateLimiter {
  private readonly intervalMs: number;
  private readonly maxWaitMs: number;
  /** Earliest timestamp (ms epoch) at which the next request may go out. */
  private nextSlotAt = 0;
  private readonly metrics: AtHomeLimiterMetrics = {
    acquired: 0,
    shed: 0,
    totalWaitMs: 0,
    maxWaitMs: 0,
  };

  constructor(maxPerMinute: number, maxWaitMs: number) {
    this.intervalMs = 60_000 / maxPerMinute;
    this.maxWaitMs = maxWaitMs;
  }

  /**
   * Block until this caller's paced slot is due, then return. Throws
   * {@link AtHomeRateLimitBackpressureError} when the slot is further out than
   * the configured max wait (caller should let the job reschedule).
   *
   * @param signal Optional abort signal (e.g. the owning job's hard-timeout)
   *   that cancels the wait early.
   */
  async acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new Error('Aborted');
    }

    const now = Date.now();
    const slot = Math.max(now, this.nextSlotAt);
    const waitMs = slot - now;

    if (waitMs > this.maxWaitMs) {
      // Do NOT advance nextSlotAt — shedding must not consume a slot, or the
      // backlog would never drain.
      this.metrics.shed++;
      throw new AtHomeRateLimitBackpressureError(waitMs, this.maxWaitMs);
    }

    // Reserve atomically (synchronous), then sleep until the slot is due.
    this.nextSlotAt = slot + this.intervalMs;
    this.metrics.acquired++;
    this.metrics.totalWaitMs += waitMs;
    if (waitMs > this.metrics.maxWaitMs) this.metrics.maxWaitMs = waitMs;

    if (waitMs > 0) await this.sleep(waitMs, signal);
  }

  /** Returns a copy of current metrics (safe to log/serialise). */
  getMetrics(): AtHomeLimiterMetrics {
    return { ...this.metrics };
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(signal?.reason instanceof Error ? signal.reason : new Error('Aborted'));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}

/**
 * Process-global singleton shared by every `KaizokuMangaDexClient` instance.
 * Tunable via `MANGADEX_ATHOME_MAX_PER_MIN` and `MANGADEX_ATHOME_MAX_WAIT_MS`.
 */
export const atHomeRateLimiter = new AtHomeRateLimiter(
  readPositiveIntEnv('MANGADEX_ATHOME_MAX_PER_MIN', DEFAULT_MAX_PER_MINUTE),
  readPositiveIntEnv('MANGADEX_ATHOME_MAX_WAIT_MS', DEFAULT_MAX_WAIT_MS),
);

log.info('MangaDex at-home rate limiter initialised', {
  maxPerMinute: readPositiveIntEnv('MANGADEX_ATHOME_MAX_PER_MIN', DEFAULT_MAX_PER_MINUTE),
  maxWaitMs: readPositiveIntEnv('MANGADEX_ATHOME_MAX_WAIT_MS', DEFAULT_MAX_WAIT_MS),
});
