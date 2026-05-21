/**
 * MangaUpdates API Client
 *
 * HTTP client for the MangaUpdates v1 public API.
 * No API key required for read-only endpoints.
 *
 * Rate limit: conservative 60 requests/minute.
 */

import { logger } from '@/utils/logger';

import type { MUReleaseSearchResponse, MUSearchResponse, MUSeriesDetails } from './types';

const log = logger.child('MangaUpdatesClient');

const BASE_URL = 'https://api.mangaupdates.com/v1';
const DEFAULT_TIMEOUT = 15000;

/** Simple sliding-window rate limiter */
class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestInWindow = this.timestamps[0];
      if (oldestInWindow !== undefined) {
        const waitMs = this.windowMs - (now - oldestInWindow) + 50;
        log.info('Rate limit reached, waiting', { waitMs });
        await new Promise<void>(resolve => { setTimeout(resolve, waitMs); });
      }
    }

    this.timestamps.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(60, 60000);

/**
 * Make an HTTP request to the MangaUpdates API.
 */
async function muFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; timeout?: number } = {},
): Promise<T> {
  await rateLimiter.waitIfNeeded();

  const { method = 'GET', body, timeout = DEFAULT_TIMEOUT } = options;
  const url = `${BASE_URL}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`MangaUpdates API ${response.status}: ${errorText}`);
    }

    return await response.json() as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Public API Methods
// ============================================================================

/**
 * Search for manga series by title.
 *
 * @param title - Search query
 * @param limit - Max results (default 5, max 100)
 * @returns Search response with hits
 */
export async function searchSeries(
  title: string,
  limit: number = 5,
): Promise<MUSearchResponse> {
  log.info('Searching MangaUpdates', { title, limit });

  const result = await muFetch<MUSearchResponse>('/series/search', {
    method: 'POST',
    body: { search: title, per_page: limit },
  });

  log.info('MangaUpdates search results', {
    title,
    totalHits: result.total_hits,
    returned: result.results.length,
  });

  return result;
}

/**
 * Get detailed series information by ID.
 *
 * @param seriesId - MangaUpdates series ID
 * @returns Full series details
 */
export async function getSeriesDetails(
  seriesId: number,
): Promise<MUSeriesDetails> {
  log.info('Fetching MangaUpdates series details', { seriesId });

  const result = await muFetch<MUSeriesDetails>(`/series/${seriesId}`);

  log.info('MangaUpdates series details fetched', {
    seriesId,
    title: result.title,
    status: result.status,
    licensed: result.licensed,
  });

  return result;
}

/**
 * Search for chapter/volume releases by title.
 * Returns release records with dates, groups, and optional series metadata.
 *
 * @param title - Search query (text-based, not series ID)
 * @param perPage - Max results per page (default 40)
 * @param page - Page number (default 1)
 * @returns Release search response
 */
export async function searchReleases(
  title: string,
  perPage: number = 40,
  page: number = 1,
): Promise<MUReleaseSearchResponse> {
  log.info('Searching MangaUpdates releases', { title, perPage, page });

  const result = await muFetch<MUReleaseSearchResponse>('/releases/search', {
    method: 'POST',
    body: { search: title, per_page: perPage, page, include_metadata: true },
  });

  log.info('MangaUpdates release search results', {
    title,
    totalHits: result.total_hits,
    returned: result.results.length,
  });

  return result;
}

/**
 * Check if the MangaUpdates API is reachable.
 */
export async function isAvailable(): Promise<boolean> {
  try {
    const result = await searchSeries('test', 1);
    return result.total_hits >= 0;
  } catch (error: unknown) {
    log.warn('MangaUpdates availability check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
