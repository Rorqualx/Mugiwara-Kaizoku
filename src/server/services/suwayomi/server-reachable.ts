/**
 * Suwayomi server reachability check.
 *
 * Lightweight `{ __typename }` GraphQL probe with a short fetch timeout
 * and a TTL-cached result. Used to short-circuit the indexer-search and
 * download-fallback paths when the user has Suwayomi turned off (e.g.
 * `suwayomi.autoStart: false` and the server isn't running).
 *
 * Why not rely on the existing GraphQL client's per-call error swallowing?
 * - The Suwayomi adapter only learns "server is down" by issuing the full
 *   getChapters call and watching it return 0 chapters. That fans out one
 *   `[ERROR] Failed to get chapters` log per quick-download attempt and
 *   wastes the connect timeout on the hot path.
 * - Worse, the MangaDex download handler delegates to Suwayomi when its
 *   own job fails (rate-limit, network flap). Without a reachability gate
 *   those delegated jobs all fail with `No pages returned from Suwayomi`,
 *   which marks chapters FAILED on jobs the user can't recover.
 *
 * The cache TTL trades responsiveness against probe cost. 60s is long
 * enough that a burst of searches is cheap, short enough that starting
 * Suwayomi back up surfaces within a minute.
 */

import { logger } from '@/utils/logger';

const log = logger.child('SuwayomiReachability');

/** Same hardcoded URL the GraphQL client's DEFAULT_CONFIG uses. */
const SUWAYOMI_GRAPHQL_URL = 'http://localhost:4567/api/graphql';

const CACHE_TTL_MS = 60_000;
const PROBE_TIMEOUT_MS = 3_000;

interface ReachabilityCacheEntry {
  reachable: boolean;
  expiresAt: number;
}

let cache: ReachabilityCacheEntry | null = null;

/**
 * Returns true if Suwayomi answered a tiny GraphQL probe within
 * {@link PROBE_TIMEOUT_MS}. Result is cached for {@link CACHE_TTL_MS}
 * regardless of outcome.
 *
 * Network errors, non-2xx responses, GraphQL parse errors, and timeouts
 * are all treated as `unreachable`. We don't try to be clever about
 * "transient blip vs hard down" — callers want a binary yes/no for the
 * fast path.
 */
export async function isSuwayomiReachable(): Promise<boolean> {
  const now = Date.now();
  if (cache !== null && cache.expiresAt > now) {
    return cache.reachable;
  }

  const reachable = await probeOnce();
  cache = { reachable, expiresAt: now + CACHE_TTL_MS };
  return reachable;
}

/** Force the next call to re-probe. Exposed for tests + manual recovery flows. */
export function invalidateSuwayomiReachabilityCache(): void {
  cache = null;
}

async function probeOnce(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const resp = await fetch(SUWAYOMI_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      log.info('Suwayomi probe non-2xx', { status: resp.status });
      return false;
    }
    return true;
  } catch (err: unknown) {
    log.info('Suwayomi probe failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
