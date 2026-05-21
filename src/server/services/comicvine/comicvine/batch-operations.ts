/**
 * ComicVine Batch Operations
 *
 * Batch fetching operations for volumes and issues, following Kapowarr's
 * efficient batching pattern (100 per request, 1000 max per batch).
 *
 * Uses direct fetch calls with built-in rate limiting to avoid complex
 * dependency injection of existing services.
 */

/* eslint-disable no-await-in-loop -- Sequential requests required for rate limiting */
/* eslint-disable max-depth -- Pagination logic requires nested conditionals */

import { logger } from '@/utils/logger';

import type { ComicVineVolume, ComicVineIssue, ComicVineListResponse } from './types';

// ============================================================================
// Constants
// ============================================================================

/** Maximum volumes per request (ComicVine API limit) */
const BATCH_SIZE = 100;

/** Maximum total volumes per batch operation (safety limit) */
const MAX_BATCH = 1000;

/** Default delay between batch requests in ms */
const DEFAULT_BATCH_DELAY_MS = 2000;

/** Field list for basic volume info in batch fetch */
const BASIC_VOLUME_FIELDS = [
  'id',
  'name',
  'image',
  'start_year',
  'publisher',
  'count_of_issues',
  'deck',
  'description',
  'site_detail_url',
].join(',');

/** Field list for basic issue info in batch fetch */
const BASIC_ISSUE_FIELDS = [
  'id',
  'name',
  'issue_number',
  'image',
  'description',
  'cover_date',
  'store_date',
  'volume',
].join(',');

// ============================================================================
// Types
// ============================================================================

/**
 * Options for batch fetch operations
 */
export interface BatchFetchOptions {
  /** Delay between batch requests in ms (default: 2000) */
  batchDelayMs?: number | undefined;
  /** API key for ComicVine */
  apiKey: string;
}

/**
 * Result of a batch volume fetch
 */
export interface BatchVolumeResult {
  /** Map of volume ID to volume data */
  volumes: Map<string, ComicVineVolume>;
  /** IDs that failed to fetch */
  failedIds: string[];
  /** Total volumes fetched */
  count: number;
}

/**
 * Result of a batch issue fetch
 */
export interface BatchIssueResult {
  /** Map of volume ID to array of issues */
  issuesByVolume: Map<string, ComicVineIssue[]>;
  /** Volume IDs that failed to fetch */
  failedVolumeIds: string[];
  /** Total issues fetched */
  count: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Split array into chunks of specified size
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Build ComicVine API URL with parameters
 */
function buildApiUrl(
  endpoint: string,
  apiKey: string,
  params: Record<string, string>
): string {
  const baseUrl = 'https://comicvine.gamespot.com/api';
  const url = new URL(`${baseUrl}${endpoint}`);

  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

/**
 * Fetch JSON from ComicVine API with retry logic
 */
async function fetchWithRetry<T>(
  url: string,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mugiwara-Kaizoku/1.0 (https://github.com/mugiwara-kaizoku)',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 420 || response.status === 429) {
          // Rate limited - wait longer
          logger.warn(`[BatchOps] Rate limited, waiting before retry (attempt ${attempt + 1})`);
          await sleep(5000 * (attempt + 1));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`[BatchOps] Request failed (attempt ${attempt + 1}):`, lastError.message);

      if (attempt < maxRetries - 1) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Fetch multiple volumes in batch (Kapowarr pattern: 100 per request)
 *
 * @param ids - Array of ComicVine volume IDs to fetch
 * @param options - Batch fetch options including API key
 * @returns Map of volume ID to volume data, plus failed IDs
 *
 * @example
 * ```typescript
 * const result = await fetchVolumesBatch(['4050-12345', '4050-67890'], {
 *   apiKey: 'your-api-key'
 * });
 *
 * for (const [id, volume] of result.volumes) {
 *   console.log(`${id}: ${volume.name}`);
 * }
 * ```
 */
export async function fetchVolumesBatch(
  ids: string[],
  options: BatchFetchOptions
): Promise<BatchVolumeResult> {
  const { apiKey, batchDelayMs = DEFAULT_BATCH_DELAY_MS } = options;

  const results = new Map<string, ComicVineVolume>();
  const failedIds: string[] = [];

  // Limit to MAX_BATCH for safety
  const idsToFetch = ids.slice(0, MAX_BATCH);

  // Normalize IDs (remove '4050-' prefix if present)
  const normalizedIds = idsToFetch.map((id) => id.replace(/^4050-/, ''));

  // Split into batches of BATCH_SIZE
  const batches = chunk(normalizedIds, BATCH_SIZE);

  logger.info(`[BatchOps] Fetching ${idsToFetch.length} volumes in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    if (!batch || batch.length === 0) {
      continue;
    }

    try {
      // Build filter: id:123|456|789
      const filter = `id:${batch.join('|')}`;

      const url = buildApiUrl('/volumes/', apiKey, {
        filter,
        field_list: BASIC_VOLUME_FIELDS,
        limit: String(BATCH_SIZE),
      });

      const response = await fetchWithRetry<ComicVineListResponse<ComicVineVolume>>(url);

      if (response.status_code === 1 && Array.isArray(response.results)) {
        for (const volume of response.results) {
          results.set(String(volume.id), volume);
        }

        logger.debug(
          `[BatchOps] Batch ${i + 1}/${batches.length}: Fetched ${response.results.length} volumes`
        );
      } else {
        // Mark all IDs in this batch as failed
        failedIds.push(...batch);
        logger.warn(
          `[BatchOps] Batch ${i + 1}/${batches.length} failed: ${response.error}`
        );
      }
    } catch (error: unknown) {
      // Mark all IDs in this batch as failed
      failedIds.push(...batch);
      logger.error(
        `[BatchOps] Batch ${i + 1}/${batches.length} error:`,
        error instanceof Error ? error.message : String(error)
      );
    }

    // Delay between batches (except for the last batch)
    if (i < batches.length - 1) {
      await sleep(batchDelayMs);
    }
  }

  logger.info(
    `[BatchOps] Completed: ${results.size} volumes fetched, ${failedIds.length} failed`
  );

  return {
    volumes: results,
    failedIds,
    count: results.size,
  };
}

/**
 * Fetch issues for multiple volumes in batch
 *
 * @param volumeIds - Array of ComicVine volume IDs to fetch issues for
 * @param options - Batch fetch options including API key
 * @returns Map of volume ID to issues array, plus failed volume IDs
 *
 * @example
 * ```typescript
 * const result = await fetchIssuesBatch(['4050-12345', '4050-67890'], {
 *   apiKey: 'your-api-key'
 * });
 *
 * for (const [volumeId, issues] of result.issuesByVolume) {
 *   console.log(`Volume ${volumeId}: ${issues.length} issues`);
 * }
 * ```
 */
export async function fetchIssuesBatch(
  volumeIds: string[],
  options: BatchFetchOptions
): Promise<BatchIssueResult> {
  const { apiKey, batchDelayMs = DEFAULT_BATCH_DELAY_MS } = options;

  const issuesByVolume = new Map<string, ComicVineIssue[]>();
  const failedVolumeIds: string[] = [];
  let totalCount = 0;

  // Limit to MAX_BATCH for safety
  const idsToFetch = volumeIds.slice(0, MAX_BATCH);

  // Normalize IDs
  const normalizedIds = idsToFetch.map((id) => id.replace(/^4050-/, ''));

  logger.info(`[BatchOps] Fetching issues for ${idsToFetch.length} volumes`);

  for (let i = 0; i < normalizedIds.length; i++) {
    const volumeId = normalizedIds[i];
    if (!volumeId) {
      continue;
    }

    const issues: ComicVineIssue[] = [];

    try {
      // Paginate through all issues for this volume
      let offset = 0;
      let hasMore = true;
      const maxPages = 10; // Safety limit (1000 issues max)
      let pageCount = 0;

      while (hasMore && pageCount < maxPages) {
        const filter = `volume:${volumeId}`;

        const url = buildApiUrl('/issues/', apiKey, {
          filter,
          field_list: BASIC_ISSUE_FIELDS,
          limit: String(BATCH_SIZE),
          offset: String(offset),
          sort: 'issue_number:asc',
        });

        const response = await fetchWithRetry<ComicVineListResponse<ComicVineIssue>>(url);

        if (response.status_code === 1 && Array.isArray(response.results)) {
          issues.push(...response.results);

          // Check if there are more results
          hasMore = response.number_of_total_results > offset + response.results.length;
          offset += BATCH_SIZE;
          pageCount++;

          // Small delay between pagination requests
          if (hasMore) {
            await sleep(batchDelayMs / 2);
          }
        } else {
          hasMore = false;
          if (response.error !== 'OK') {
            logger.warn(`[BatchOps] Issue fetch for volume ${volumeId} failed: ${response.error}`);
          }
        }
      }

      if (issues.length > 0) {
        issuesByVolume.set(volumeId, issues);
        totalCount += issues.length;
        logger.debug(`[BatchOps] Volume ${volumeId}: ${issues.length} issues`);
      }
    } catch (error: unknown) {
      failedVolumeIds.push(volumeId);
      logger.error(
        `[BatchOps] Failed to fetch issues for volume ${volumeId}:`,
        error instanceof Error ? error.message : String(error)
      );
    }

    // Delay between volumes (except for the last one)
    if (i < normalizedIds.length - 1) {
      await sleep(batchDelayMs);
    }
  }

  logger.info(
    `[BatchOps] Completed: ${totalCount} issues for ${issuesByVolume.size} volumes, ${failedVolumeIds.length} failed`
  );

  return {
    issuesByVolume,
    failedVolumeIds,
    count: totalCount,
  };
}
