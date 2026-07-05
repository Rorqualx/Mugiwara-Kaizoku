/**
 * AniList Health Probe
 *
 * Lightweight, cached check of whether the AniList API is currently reachable.
 * Powers the home-page outage banner: when AniList is down (e.g. rate-limited
 * or "temporarily disabled" upstream), we surface AniList's own error message
 * to the user and keep serving stale discovery data underneath.
 *
 * The result is cached briefly (60s) so a real outage doesn't get hammered with
 * probes and so the banner clears on its own once AniList recovers.
 *
 * @module server/services/anilist/health
 */

import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { logger } from '@/utils/logger';

import { anilistClient } from './client';
import * as anilistQueries from './queries';

const HEALTH_NAMESPACE = 'anilist-health';
const HEALTH_KEY = 'status';
const HEALTH_TTL_SECONDS = 60;

/** Current reachability of the AniList API. */
export interface AnilistHealth {
  /** True when the last probe succeeded. */
  available: boolean;
  /** AniList's own error message when unavailable, else null. */
  message: string | null;
}

const GENERIC_UNAVAILABLE = 'AniList is currently unavailable. Please try again later.';

/** Pull `errors[0].message` out of an AniList JSON error body, if present. */
function messageFromJsonBody(raw: string): string | null {
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) return null;

  try {
    const parsed: unknown = JSON.parse(raw.slice(jsonStart));
    if (typeof parsed !== 'object' || parsed === null || !('errors' in parsed)) return null;
    const errors = (parsed as { errors: unknown }).errors;
    if (!Array.isArray(errors)) return null;
    const first = errors[0] as { message?: unknown } | undefined;
    return first && typeof first.message === 'string' && first.message.length > 0
      ? first.message
      : null;
  } catch {
    return null;
  }
}

/**
 * Pull a human-readable message out of an AniList client error. AniListError
 * wraps the raw response body (e.g. `AniList API error: {"errors":[{"message":
 * "..."}]}`) or a `GraphQL error: <message>` string, so try both shapes.
 */
function extractAnilistMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  const fromJson = messageFromJsonBody(raw);
  if (fromJson) return fromJson;

  const gqlMarker = 'GraphQL error:';
  const gqlIndex = raw.indexOf(gqlMarker);
  if (gqlIndex >= 0) {
    const msg = raw.slice(gqlIndex + gqlMarker.length).trim();
    if (msg.length > 0) return msg;
  }

  return GENERIC_UNAVAILABLE;
}

/**
 * Return the (cached) AniList health status, probing with a minimal trending
 * query on a cache miss.
 */
export async function getAnilistHealth(): Promise<AnilistHealth> {
  const cached = await cacheProvider.get<AnilistHealth>(HEALTH_KEY, HEALTH_NAMESPACE);
  if (cached) return cached;

  let health: AnilistHealth;
  try {
    // Minimal, fail-fast probe (1 item, single attempt).
    await anilistClient.query(
      anilistQueries.GET_TRENDING_MANGA,
      { page: 1, perPage: 1, isAdult: false },
      1
    );
    health = { available: true, message: null };
  } catch (error: unknown) {
    health = { available: false, message: extractAnilistMessage(error) };
    logger.warn('[AniList Health] Probe failed', { message: health.message });
  }

  await cacheProvider.set(HEALTH_KEY, health, {
    ttl: HEALTH_TTL_SECONDS,
    namespace: HEALTH_NAMESPACE,
    tags: ['anilist', 'health'],
  });

  return health;
}
