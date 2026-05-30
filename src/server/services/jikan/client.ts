/**
 * Jikan API Client
 *
 * HTTP client for the Jikan v4 REST API (free MyAnimeList proxy).
 * No authentication required. Rate limit: 3 requests/second.
 *
 * @module server/services/jikan/client
 */

import { logger } from '@/utils/logger';

import type { JikanMangaResponse } from './types';

const log = logger.child('JikanClient');

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4/manga';
const DEFAULT_TIMEOUT_MS = 15_000;
const RATE_LIMIT_DELAY_MS = 350;

/** Allowlist: only the Jikan API domain is permitted */
const ALLOWED_ORIGIN = 'https://api.jikan.moe';

let lastRequestTime = 0;

/** Enforce rate limit by delaying if needed */
async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise<void>((r) => { setTimeout(r, RATE_LIMIT_DELAY_MS - elapsed); });
  }
  lastRequestTime = Date.now();
}

/** Build and validate a Jikan URL for a given MAL ID + optional sub-path */
function buildJikanUrl(malId: number, subPath = ''): string {
  if (!Number.isInteger(malId) || malId <= 0) {
    throw new Error(`Invalid MAL ID: ${malId}`);
  }
  const url = `${JIKAN_BASE_URL}/${malId}${subPath}`;
  if (!url.startsWith(ALLOWED_ORIGIN)) {
    throw new Error(`URL does not match allowed origin: ${url}`);
  }
  return url;
}

/**
 * Fetch manga data from Jikan by MAL ID.
 *
 * @param malId - MyAnimeList manga ID (positive integer)
 * @param retries - Number of retry attempts on failure
 * @returns Raw Jikan response or null on failure
 */
export async function fetchMangaById(
  malId: number,
  retries: number = 3,
): Promise<JikanMangaResponse | null> {
  const url = buildJikanUrl(malId);

  /* eslint-disable no-await-in-loop -- retry loop is intentionally sequential: rate-limit gate, request, 429 backoff, and error backoff must each complete before the next attempt */
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await enforceRateLimit();

      const controller = new AbortController();
      const timeout = setTimeout(() => { controller.abort(); }, DEFAULT_TIMEOUT_MS);

      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (resp.status === 429) {
        const wait = Math.min(10_000, (attempt + 1) * 2_000);
        log.warn('Jikan rate limited (429), retrying', { malId, attempt, waitMs: wait });
        await new Promise<void>((r) => { setTimeout(r, wait); });
        continue;
      }

      if (!resp.ok) {
        log.debug('Jikan non-OK response', { malId, status: resp.status });
        return null;
      }

      return (await resp.json()) as JikanMangaResponse;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (attempt < retries - 1) {
        log.debug('Jikan fetch error, retrying', { malId, attempt, error: msg });
        await new Promise<void>((r) => { setTimeout(r, 1_000); });
      } else {
        log.warn('Jikan fetch failed after retries', { malId, retries, error: msg });
      }
    }
  }
  /* eslint-enable no-await-in-loop */

  return null;
}

/**
 * Check if the Jikan API is reachable.
 * Pings a well-known manga (Naruto, MAL ID 11) to test connectivity.
 */
export async function isAvailable(): Promise<boolean> {
  try {
    await enforceRateLimit();
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, 5_000);
    const narutoUrl = buildJikanUrl(11);
    const resp = await fetch(narutoUrl, { signal: controller.signal });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Phase 5 Sprint #2: extended MAL surfaces (recommendations, relations)
// ============================================================================

export interface JikanRecommendationEntry {
  mal_id: number;
  url?: string;
  images?: { jpg?: { image_url?: string; large_image_url?: string } };
  title?: string;
}

export interface JikanRecommendationsResponse {
  data?: Array<{ entry?: JikanRecommendationEntry; votes?: number }>;
}

/**
 * Fetch MAL recommendations for a manga.
 * Returns null on failure; empty data → empty array.
 *
 * Endpoint: GET /manga/{id}/recommendations
 */
export async function fetchRecommendationsByMALId(
  malId: number,
  retries: number = 2,
): Promise<JikanRecommendationsResponse | null> {
  const url = buildJikanUrl(malId, '/recommendations');
  /* eslint-disable no-await-in-loop -- retry loop must sequence rate-limit/request/backoff */
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await enforceRateLimit();
      const controller = new AbortController();
      const timeout = setTimeout(() => { controller.abort(); }, DEFAULT_TIMEOUT_MS);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (resp.status === 429) {
        const wait = Math.min(10_000, (attempt + 1) * 2_000);
        log.warn('Jikan recommendations rate-limited, retrying', { malId, attempt, waitMs: wait });
        await new Promise<void>((r) => { setTimeout(r, wait); });
        continue;
      }
      if (!resp.ok) {
        log.debug('Jikan recommendations non-OK', { malId, status: resp.status });
        return null;
      }
      return (await resp.json()) as JikanRecommendationsResponse;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (attempt < retries - 1) {
        log.debug('Jikan recommendations fetch error, retrying', { malId, attempt, error: msg });
        await new Promise<void>((r) => { setTimeout(r, 1_000); });
      } else {
        log.warn('Jikan recommendations fetch failed after retries', { malId, retries, error: msg });
      }
    }
  }
  /* eslint-enable no-await-in-loop */
  return null;
}
