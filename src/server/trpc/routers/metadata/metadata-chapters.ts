/**
 * Metadata Chapters Router
 *
 * Chapter-focused metadata operations module. This module provides:
 * - Enhanced volume parsing with chapter details
 * - Batch chapter detail fetching
 * - Progressive chapter detail fetching with caching
 * - Progress tracking with callbacks
 * - Multi-tier caching integration
 *
 * Extracted from metadata.ts (lines 2760-3061) for better modularity.
 */

import { z } from 'zod';

import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { safeGet, isRecord } from './metadata-utils';

// ============================================================================
// Router Definition
// ============================================================================

export const metadataChaptersRouter = router({
  /**
   * Parse enhanced volumes with chapter details
   * Extracts volume and chapter information from a Fandom wiki page
   */
  parseEnhancedVolumes: publicProcedure
    .input(z.object({
      volumesPageUrl: z.string().url(),
      extractChapterUrls: z.boolean().default(true)
    }))
    .mutation(async ({ input }): Promise<AsyncResult<{
      volumes: Array<{
        volumeNumber: number;
        title: string;
        chapters: Array<{
          chapterNumber: string;
          title: string;
          url?: string;
          releaseDate?: {
            japan?: string;
            english?: string;
          };
        }>;
      }>;
      totalVolumes: number;
      totalChapters: number;
    }, Error>> => {
      try {
        const axios = (await import('axios')).default;
        const { parseVolumeTables } = await import('@/server/services/metadata/utils/fandomTableParser');

        // Fetch the page
        const response = await axios.get(input.volumesPageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MangaManager/1.0)'
          },
          timeout: 30000
        });

        // Extract wiki base URL for converting relative URLs to absolute
        const urlObj = new URL(input.volumesPageUrl);
        const _wikiBaseUrl = `${urlObj.protocol}//${urlObj.host}`;

        // Use the existing fandomTableParser which handles Fire Force and other formats
        const responseData: unknown = response.data;
        const htmlStr = typeof responseData === 'string' ? responseData : String(responseData);
        const parsedData = parseVolumeTables(htmlStr);

        if (parsedData.length === 0) {
          return createErrorResult(new Error('No volume data found on the page'));
        }

        // Convert the parsed data to the expected format
        const volumes = parsedData.map((vol) => ({
          volumeNumber: vol.number,
          title: vol["title"] ?? '',
          chapters: (vol["chapters"] ?? []).map((ch: unknown) => {
            if (!isRecord(ch)) return { chapterNumber: '', title: '' };

            const chapterNumber = String(safeGet(ch, 'chapterNumber') ?? '');
            const title = String(safeGet(ch, 'title') ?? '');
            const chapter: { chapterNumber: string; title: string; url?: string; releaseDate?: { japan?: string; english?: string } } = {
              chapterNumber,
              title
            };

            // Include URL if it was extracted
            const chUrl = safeGet(ch, 'url');
            if (chUrl) {
              // Make sure URL is absolute
              const urlStr = String(chUrl);
              chapter.url = urlStr.startsWith('http') ?
                urlStr :
                new URL(urlStr, input.volumesPageUrl).toString();
            }

            // Include release dates if available
            const chReleaseDate = safeGet(ch, 'releaseDate');
            if (chReleaseDate ?? vol.releaseDate) {
              chapter.releaseDate = {};
              if (chReleaseDate) {
                chapter.releaseDate.japan = String(chReleaseDate);
                chapter.releaseDate.english = String(chReleaseDate);
              } else if (vol.releaseDate) {
                chapter.releaseDate.japan = String(vol.releaseDate);
                chapter.releaseDate.english = String(vol.releaseDate);
              }
            }

            return chapter;
          })
        }));

        const totalChapters = volumes.reduce((sum, vol) => sum + vol["chapters"].length, 0);

        logger.info(`Parsed ${volumes.length} volumes with ${totalChapters} chapters from ${input.volumesPageUrl}`);

        return createSuccessResult({
          volumes,
          totalVolumes: volumes.length,
          totalChapters
        });
      }
      catch (error: unknown) {
        logger.error(`Error parsing enhanced volumes: ${error instanceof Error ? error.message : String(error)}`);
        return createErrorResult(error instanceof Error ? error : new Error(`Volume parsing failed: ${String(error)}`));
      }
    }),

  /**
   * Fetch chapter details for specific chapters
   * Batch fetches chapter details with rate limiting and progress tracking
   */
  fetchChapterDetails: publicProcedure
    .input(z.object({
      chapterUrls: z.array(z.string().url()),
      mangaId: z.number()
    }))
    .mutation(async ({ input }): Promise<AsyncResult<{
      success: boolean;
      count: number;
      failed: number;
      details: Array<{
        url: string;
        chapterNumber?: string;
        title?: string;
        coverImageUrl?: string;
        description?: string;
        synopsis?: string;
        releaseDate?: string;
        pageCount?: number;
      }>;
    }, Error>> => {
      try {
        const { ChapterDetailService } = await import('@/server/services/fandom/chapter-detail');
        const chapterService = new ChapterDetailService();

        const details = await chapterService.batchFetchChapterDetails(input.chapterUrls, {
          batchSize: 5,
          delayMs: 300,
          maxRetries: 2,
          onProgress: (completed: number, total: number) => {
            logger.info(`Chapter detail fetch progress: ${completed}/${total}`);
          }
        });

        // Save chapter details to database if needed
        // This would require a new table or extending the existing chapter model
        logger.info(`Fetched details for ${details.length} chapters out of ${input.chapterUrls.length} requested`);
        return createSuccessResult({
          success: true,
          count: details.length,
          failed: input.chapterUrls.length - details.length,
          details: details
        });
      }
      catch (error: unknown) {
        logger.error(`Error fetching chapter details: ${error instanceof Error ? error.message : String(error)}`);
        return createErrorResult(error instanceof Error ? error : new Error(`Chapter detail fetch failed: ${String(error)}`));
      }
    }),

  /**
   * Progressive fetch chapter details with streaming support
   * Fetches chapter details in batches and returns results progressively
   * Includes multi-tier caching for improved performance
   */
  fetchChapterDetailsProgressive: publicProcedure
    .input(z.object({
      chapterUrls: z.array(z.string().url()),
      mangaId: z.number(),
      batchSize: z.number().optional().default(10),
      onlyMissingDetails: z.boolean().optional().default(true)
    }))
    // eslint-disable-next-line max-lines-per-function -- Complex procedural endpoint
    .mutation(async ({ input }): Promise<AsyncResult<{
      success: boolean;
      totalCount: number;
      processedCount: number;
      batchResults: Array<{
        batchNumber: number;
        details: Array<{
          url: string;
          chapterNumber?: string;
          title?: string;
          coverImageUrl?: string;
          description?: string;
          synopsis?: string;
          releaseDate?: string;
          pageCount?: number;
        }>;
      }>;
    }, Error>> => {
      try {
        const { chapterUrls, mangaId: _mangaId, batchSize, onlyMissingDetails } = input;

        logger.info(`Starting progressive chapter detail fetch for ${chapterUrls.length} chapters`);

        // Import the chapter detail service
        const { ChapterDetailService } = await import('@/server/services/fandom/chapter-detail');
        const chapterService = new ChapterDetailService();

        // Check cache first if onlyMissingDetails is true
        let urlsToFetch = chapterUrls;
        const cachedDetails = new Map<string, unknown>();

        if (onlyMissingDetails) {
          // Check which URLs already have cached details
          const { MultiTierCache } = await import('@/server/services/comicvine/modules/multiTierCache');
          const cache = new MultiTierCache({
            l1MaxSize: 100,
            l1TtlMs: 5 * 60 * 1000,
            l2Enabled: true,
            l2TtlMs: 24 * 60 * 60 * 1000,
            l2Namespace: 'fandom:chapter-details'
          });

          const cacheChecks = await Promise.all(
            chapterUrls.map(async (url) => {
              const cacheKey = `chapter_details:${url}`;
              const cached = await cache.get(cacheKey);
              if (cached) {
                cachedDetails.set(url, cached);
                return null;
              }
              return url;
            })
          );

          urlsToFetch = cacheChecks.filter((url): url is string => url !== null);
          logger.info(`Found ${cachedDetails.size} cached details, fetching ${urlsToFetch.length} new ones`);
        }

        // Process in batches
        const batchResults = [];
        const totalBatches = Math.ceil(urlsToFetch.length / batchSize);

        for (let i = 0; i < totalBatches; i++) {
          const start = i * batchSize;
          const end = Math.min(start + batchSize, urlsToFetch.length);
          const batchUrls = urlsToFetch.slice(start, end);

          logger.info(`Processing batch ${i + 1}/${totalBatches}: ${batchUrls.length} chapters`);

          // Fetch details for this batch with rate limiting
          // eslint-disable-next-line no-await-in-loop -- Sequential batch processing required for rate limiting between batches
          const batchDetails = await Promise.all(
            batchUrls.map(async (url, index) => {
              // Add small delay between requests to avoid rate limiting
              await new Promise(resolve => {
                setTimeout(resolve, index * 100);
              });

              try {
                const details = await chapterService.fetchChapterDetails(url);

                // Cache the result
                if (details) {
                  const { MultiTierCache } = await import('@/server/services/comicvine/modules/multiTierCache');
                  const cache = new MultiTierCache({
                    l1MaxSize: 100,
                    l1TtlMs: 5 * 60 * 1000,
                    l2Enabled: true,
                    l2TtlMs: 24 * 60 * 60 * 1000,
                    l2Namespace: 'fandom:chapter-details'
                  });
                  const cacheKey = `chapter_details:${url}`;
                  await cache.set(cacheKey, details); // Cache for 24 hours
                }

                return {
                  url,
                  ...details
                };
              } catch (error) {
                logger.error(`Failed to fetch details for ${url}:`, error);
                return {
                  url,
                  title: 'Failed to fetch',
                  error: true
                };
              }
            })
          );

          batchResults.push({
            batchNumber: i + 1,
            details: batchDetails
          });
        }

        // Include cached results in the response
        if (cachedDetails.size > 0) {
          const cachedBatch = {
            batchNumber: 0, // Use 0 for cached results
            details: Array.from(cachedDetails.entries()).map(([url, details]) => ({
              url,
              ...(details as Record<string, unknown>),
              fromCache: true
            }))
          };
          batchResults.unshift(cachedBatch);
        }

        return createSuccessResult({
          success: true,
          totalCount: chapterUrls.length,
          processedCount: urlsToFetch.length + cachedDetails.size,
          batchResults
        });
      }
      catch (error: unknown) {
        logger.error(`Error in progressive chapter fetch: ${error instanceof Error ? error.message : String(error)}`);
        return createErrorResult(error instanceof Error ? error : new Error(`Progressive fetch failed: ${String(error)}`));
      }
    })
});
