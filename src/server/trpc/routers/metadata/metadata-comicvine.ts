/**
 * Metadata ComicVine Router
 *
 * This module handles ComicVine-specific metadata operations:
 * - Fetching volume metadata by ID or URL
 * - Fetching detailed volume/issue information with pagination
 * - Extracting cover images, publisher data, and creator credits
 * - Parsing ComicVine URLs (patterns: 4050-XXXXX for volumes, 4000-XXXXX for issues)
 */

import { z } from 'zod';

import { comicVineScraper } from '@/server/services/comicvine/scrapingService';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { fetchComicvineDetails } from './metadata-comicvine/details-fetcher';
import { parseMetadataInput } from './metadata-comicvine/input-parser';
import { safeGet, safeGetString, safeGetNumber } from './metadata-utils';

// ============================================================================
// Helper Functions (extracted to reduce complexity)
// ============================================================================

interface ComicvineMetadataResult {
  id?: string | number;
  title?: string;
  cover?: string;
  description?: string;
  alternativeTitles?: string[];
  genres?: string[];
  authors?: string[];
  publisher?: string;
  status?: string;
  volumeCount?: number;
  issueCount?: number;
  startYear?: number;
  siteDetailUrl?: string;
}

/**
 * Extracts metadata fields from a ComicVine manga response
 * Reduces complexity by consolidating field extraction logic
 */
function extractComicvineMetadata(manga: unknown, comicvineId: string): ComicvineMetadataResult {
  const result: ComicvineMetadataResult = { id: comicvineId };

  // Extract title (name is primary field for ComicVine)
  const name = safeGetString(manga, 'name');
  const title = safeGetString(manga, 'title');
  if (typeof name === 'string') result.title = name;
  else if (typeof title === 'string') result.title = title;

  // Extract cover image
  const coverImage = safeGetString(manga, 'coverImage');
  const coverUrl = safeGetString(manga, 'coverUrl');
  if (typeof coverImage === 'string') result.cover = coverImage;
  else if (typeof coverUrl === 'string') result.cover = coverUrl;

  // Extract text fields
  const description = safeGetString(manga, 'description');
  if (typeof description === 'string') result.description = description;

  const publisher = safeGetString(manga, 'publisher');
  if (typeof publisher === 'string') result.publisher = publisher;

  const publicationStatus = safeGetString(manga, 'publicationStatus');
  if (typeof publicationStatus === 'string') result.status = publicationStatus;

  // Extract array fields (with proper string[] type filtering)
  const alternativeTitles = safeGet(manga, 'alternativeTitles');
  if (Array.isArray(alternativeTitles)) {
    result.alternativeTitles = alternativeTitles.filter((t): t is string => typeof t === 'string');
  }

  const genres = safeGet(manga, 'genres');
  if (Array.isArray(genres)) {
    result.genres = genres.filter((g): g is string => typeof g === 'string');
  }

  const authors = safeGet(manga, 'authors');
  if (Array.isArray(authors)) {
    result.authors = authors.filter((a): a is string => typeof a === 'string');
  }

  // Extract numeric fields
  const volumeCount = safeGetNumber(manga, 'volumeCount');
  if (typeof volumeCount === 'number') result.volumeCount = volumeCount;

  const chapterCount = safeGetNumber(manga, 'chapterCount');
  if (typeof chapterCount === 'number') result.issueCount = chapterCount;

  const releaseYear = safeGetNumber(manga, 'releaseYear');
  if (typeof releaseYear === 'number') result.startYear = releaseYear;

  // Extract site detail URL (ComicVine uses both snake_case and camelCase)
  const siteDetailUrl =
    safeGetString(manga, 'site_detail_url') ?? safeGetString(manga, 'siteDetailUrl');
  if (typeof siteDetailUrl === 'string') result.siteDetailUrl = siteDetailUrl;

  return result;
}

// ============================================================================
// ComicVine Router
// ============================================================================

export const metadataComicvineRouter = router({
  /**
   * Fetch enhanced metadata from ComicVine by ID or URL
   *
   * Supports:
   * - Direct volume ID
   * - ComicVine volume URL (pattern: 4050-XXXXX)
   */
  fetchComicvineMetadata: publicProcedure
    .input(
      z.object({
        url: z.string().optional(),
        id: z.string().optional(),
      })
    )
    .mutation(
      async ({
        input,
      }): Promise<
        AsyncResult<
          {
            id?: string | number;
            cover?: string;
            description?: string;
            alternativeTitles?: string[];
            genres?: string[];
            authors?: string[];
            publisher?: string;
            status?: string;
            volumeCount?: number;
            issueCount?: number;
            startYear?: number;
          },
          Error
        >
      > => {
        try {
          const { url, id } = input;

          // Extract ID from URL if provided
          let comicvineId: string | undefined = id;

          if (url?.includes('comicvine.gamespot.com')) {
            // Extract volume ID from URL like: https://comicvine.gamespot.com/one-piece/4050-1234/
            const match = url.match(/4050-(\d+)/);
            if (match) {
              comicvineId = match[1];
            } else {
              return createErrorResult(new Error('Invalid ComicVine URL format'));
            }
          }

          if (!comicvineId) {
            return createErrorResult(new Error('ComicVine ID or URL is required'));
          }

          logger.info(`Fetching enhanced metadata for ComicVine ID: ${comicvineId}`);

          // Import ComicVine service
          const { comicvineService } = await import('../../../services/comicvine/service');

          // Fetch manga/volume details
          // Note: getVolume returns ComicVineResponse, not AsyncResult
          const response = await comicvineService.getVolume(comicvineId, '');
          const typedResponse = response as { error?: string; results?: unknown };

          // ComicVineResponse uses error: "OK" for success, results for data
          if (typedResponse.error === 'OK' && typedResponse.results) {
            const manga = typedResponse.results;
            const metadataResult = extractComicvineMetadata(manga, comicvineId);
            logger.info(`ComicVine metadata extracted successfully`, { id: comicvineId });
            return createSuccessResult(metadataResult);
          } else if (typedResponse.results === null) {
            logger.warn(`ComicVine volume not found: ${comicvineId}`);
            return createErrorResult(new Error(`ComicVine volume not found: ${comicvineId}`));
          } else {
            logger.warn(`ComicVine fetch failed: ${typedResponse.error}`);
            return createErrorResult(new Error(`ComicVine error: ${typedResponse.error ?? 'Unknown error'}`));
          }
        } catch (error: unknown) {
          logger.error(`Error fetching ComicVine metadata: ${error instanceof Error ? error.message : String(error)}`);
          return createErrorResult(
            error instanceof Error ? error : new Error(`Failed to fetch ComicVine metadata: ${String(error)}`)
          );
        }
      }
    ),

  /**
   * Fetch detailed information for a specific ComicVine volume or issue
   *
   * Supports:
   * - Volume URLs (pattern: 4050-XXXXX)
   * - Issue URLs (pattern: 4000-XXXXX)
   * - Direct volume/issue ID
   * - Pagination for large issue lists
   * - Complete cover image variations (small/medium/large/original)
   * - Publisher, creator, and character credits
   */
  fetchComicvineVolumeDetails: publicProcedure
    .input(
      z.object({
        url: z.string().optional(),
        id: z.string().optional(),
        type: z.enum(['volume', 'issue']).default('volume'),
      })
    )
    .mutation(
      // eslint-disable-next-line max-lines-per-function -- ComicVine API response parsing requires detailed type mapping
      async ({
        input,
      }): Promise<
        AsyncResult<
          {
            id: number;
            name?: string;
            description?: string;
            coverImages?: {
              small?: string;
              medium?: string;
              large?: string;
              original?: string;
            };
            publisher?: {
              id: number;
              name?: string;
            };
            startYear?: number;
            issueCount?: number;
            issues?: Array<{
              id: number;
              name?: string;
              issueNumber?: string;
              coverImages?: {
                small?: string;
                medium?: string;
                large?: string;
                original?: string;
              };
              description?: string;
              deck?: string;
              coverDate?: string;
              storeDate?: string;
              siteDetailUrl?: string;
            }>;
            characters?: Array<{
              id: number;
              name?: string;
            }>;
            creators?: Array<{
              id: number;
              name?: string;
              role?: string;
            }>;
            firstIssue?: {
              id: number;
              name?: string;
              issueNumber?: string;
            };
            lastIssue?: {
              id: number;
              name?: string;
              issueNumber?: string;
            };
            dateAdded?: string;
            dateLastUpdated?: string;
            // Issue-specific fields
            coverDate?: string;
            storeDate?: string;
            volume?: {
              id: number;
              name?: string;
            };
            characterCredits?: Array<{
              id: number;
              name?: string;
            }>;
            personCredits?: Array<{
              id: number;
              name?: string;
              role?: string;
            }>;
          },
          Error
        >
      > => {
        try {
          const { url, id, type } = input;
          const parsedInput = parseMetadataInput(url, id, type);
          if (!parsedInput.success) {
            return createErrorResult(new Error(parsedInput.error));
          }

          const { id: itemId, type: itemType } = parsedInput.data;
          const numericId = parseInt(itemId, 10);
          logger.info(`Fetching detailed ${itemType} information for ComicVine ID: ${numericId}`);

          const { comicvineService } = await import('../../../services/comicvine/service');
          const result = await fetchComicvineDetails(comicvineService, itemType, numericId);

          if (!result) {
            return createErrorResult(
              new Error(`${itemType === 'issue' ? 'Issue' : 'Volume'} with ID ${numericId} not found`)
            );
          }

          return createSuccessResult(result);
        } catch (error: unknown) {
          logger.error(
            `Error fetching ComicVine volume/issue details: ${error instanceof Error ? error.message : String(error)}`
          );
          return createErrorResult(
            error instanceof Error ? error : new Error(`Failed to fetch ComicVine details: ${String(error)}`)
          );
        }
      }
    ),

  /**
   * Fetch issue cover images from ComicVine - tries API first, falls back to scraping
   *
   * API-first approach (faster & more reliable):
   * 1. Extract volume ID from URL
   * 2. Try ComicVine API to get issues with cover images (instant)
   * 3. Fall back to FlareSolverr scraping if API fails (20-60s)
   *
   * Note: The API DOES return cover images via the `image` field for each issue.
   *
   * @param url - ComicVine series/volume page URL (pattern: 4050-XXXXX)
   * @returns Array of cover URLs indexed by issue number
   */
  scrapeIssueCovers: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
      })
    )
    .mutation(
      async ({
        input,
      }): Promise<
        AsyncResult<
          {
            covers: string[];
            totalIssues: number;
            coversFound: number;
          },
          Error
        >
      > => {
        try {
          const { url } = input;

          // === API-FIRST VERSION v2 - 2025-12-07 ===
          logger.info(`[ComicVine scrapeIssueCovers v2] Called with URL: ${url}`);

          // Validate URL is a ComicVine URL
          if (!url.includes('comicvine.gamespot.com')) {
            return createErrorResult(new Error('URL must be a ComicVine page'));
          }

          // Step 1: Try to extract volume ID and use API first
          const volumeMatch = url.match(/\/4050-(\d+)/);
          if (volumeMatch?.[1]) {
            const volumeId = parseInt(volumeMatch[1], 10);
            logger.info(`[ComicVine] Trying API first for issue covers (volume ${volumeId})`);

            try {
              const { comicvineService } = await import('../../../services/comicvine/service');
              const issues = await comicvineService.getAllVolumeIssues(volumeId);

              if (issues.length > 0) {
                // Sort by issue number and extract cover URLs
                const sortedIssues = [...issues].sort((a, b) => {
                  const numA = parseFloat(a.issue_number ?? '0');
                  const numB = parseFloat(b.issue_number ?? '0');
                  return numA - numB;
                });

                const covers = sortedIssues.map(issue =>
                  issue.image?.original_url ?? issue.image?.super_url ?? issue.image?.medium_url ?? ''
                );

                const coversFound = covers.filter(c => c !== '').length;
                logger.info(`[ComicVine API] Found ${coversFound} issue covers out of ${covers.length} issues`);

                return createSuccessResult({
                  covers,
                  totalIssues: covers.length,
                  coversFound,
                });
              }
              logger.info(`[ComicVine API] No issues found, falling back to scraping`);
            } catch (apiError: unknown) {
              logger.warn(`[ComicVine API] Failed to fetch issues, falling back to scraping:`, {
                error: apiError instanceof Error ? apiError.message : String(apiError)
              });
            }
          }

          // Step 2: Fall back to scraping (FlareSolverr)
          logger.info(`[ComicVine] Scraping issue covers from: ${url}`);
          const covers = await comicVineScraper.scrapeIssueCovers(url);

          const coversFound = covers.filter((c: string) => c !== '').length;
          logger.info(`[ComicVine Scraper] Found ${coversFound} issue covers out of ${covers.length} issues`);

          return createSuccessResult({
            covers,
            totalIssues: covers.length,
            coversFound,
          });
        } catch (error: unknown) {
          logger.error(
            `Error fetching ComicVine issue covers: ${error instanceof Error ? error.message : String(error)}`
          );
          return createErrorResult(
            error instanceof Error ? error : new Error(`Failed to fetch issue covers: ${String(error)}`)
          );
        }
      }
    ),
});
