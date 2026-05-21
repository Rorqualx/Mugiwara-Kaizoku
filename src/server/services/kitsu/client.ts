/**
 * Kitsu API Client
 *
 * HTTP client for kitsu.io's JSON:API. No API key required.
 * Conservative rate limit at 10 requests/second.
 */

import { logger } from '@/utils/logger';

import type { KitsuDetailsResponse, KitsuSearchResponse } from './types';

const log = logger.child('KitsuClient');

// Kitsu's JSON:API root is `/api/edge/` (singular). The `/edges/` path returns
// HTTP 404 — confirmed via curl during the iter-0 baseline of the Kitsu loop.
const BASE_URL = 'https://kitsu.io/api/edge';
const DEFAULT_TIMEOUT = 15000;

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
      const oldest = this.timestamps[0];
      if (oldest !== undefined) {
        const waitMs = this.windowMs - (now - oldest) + 25;
        await new Promise<void>(resolve => { setTimeout(resolve, waitMs); });
      }
    }
    this.timestamps.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(10, 1000);

async function kitsuFetch<T>(
  path: string,
  options: { timeout?: number } = {},
): Promise<T> {
  await rateLimiter.waitIfNeeded();
  const { timeout = DEFAULT_TIMEOUT } = options;
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`Kitsu API ${response.status}: ${errorText}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Search manga by free-text title. */
export async function searchManga(
  title: string,
  limit: number = 5,
): Promise<KitsuSearchResponse> {
  const cappedLimit = Math.min(Math.max(limit, 1), 20);
  const path = `/manga?filter[text]=${encodeURIComponent(title)}&page[limit]=${cappedLimit}`;
  log.info('Searching Kitsu', { title, limit: cappedLimit });
  const result = await kitsuFetch<KitsuSearchResponse>(path);
  log.info('Kitsu search results', {
    title,
    returned: result.data.length,
    total: result.meta?.count,
  });
  return result;
}

/** Get manga details by Kitsu ID. */
export async function getMangaDetails(id: string): Promise<KitsuDetailsResponse> {
  log.info('Fetching Kitsu manga details', { id });
  const result = await kitsuFetch<KitsuDetailsResponse>(`/manga/${id}`);
  log.info('Kitsu details fetched', {
    id,
    canonicalTitle: result.data.attributes.canonicalTitle,
    status: result.data.attributes.status,
  });
  return result;
}

/** Availability ping. Used by health checks. */
export async function isAvailable(): Promise<boolean> {
  try {
    const result = await searchManga('naruto', 1);
    return result.data.length > 0;
  } catch (error: unknown) {
    log.warn('Kitsu availability check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
