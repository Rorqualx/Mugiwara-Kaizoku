/**
 * Metadata Fandom Enhanced Router
 *
 * This module provides enhanced Fandom metadata extraction procedures with:
 * - Chapter detail fetching (covers, descriptions, synopsis, page count)
 * - Gallery image extraction from infoboxes
 * - Progress tracking for batch chapter fetches
 * - Multi-tier caching integration
 * - Enhanced cheerio parsing
 *
 * Extracted from metadata.ts (lines 521-863) as part of metadata router refactoring.
 */

import { z } from 'zod';

import { calculateTotalChapters } from '@/server/services/metadata/chapter-count-helpers';
import { toTRPCError, TRPCErrors } from '@/server/trpc/errors';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import { handleError } from '../metadata-utils';

import { fetchChapterDetailsBatch } from './chapter-details-fetcher';
import { extractWikiBaseUrl, fetchPageHtml, fetchVolumesPageIfExists } from './page-fetcher';
import { formatVolumeDetails } from './response-formatter';
import { extractChapterUrls, parseAndDeduplicateVolumes } from './volume-parser';

import type { VolumeDetail } from './response-formatter';

export const metadataFandomEnhancedRouter = router({
  /**
   * Parse a Fandom URL with enhanced chapter metadata (including covers)
   */
  parseFandomUrlEnhanced: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
        fetchChapterCovers: z.boolean().optional().default(false),
        maxChaptersToFetch: z.number().optional().default(50),
      })
    )
    .mutation(
      async ({
        input,
      }): Promise<{
        volumes: number;
        chapters: number;
        volumeDetails: VolumeDetail[];
      }> => {
        try {
          const { url, fetchChapterCovers, maxChaptersToFetch } = input;

          // Validate it's a Fandom URL
          if (!url.includes('fandom.com')) {
            throw TRPCErrors.badRequest('Not a valid Fandom wiki URL');
          }

          logger.info(`Parsing Fandom URL with enhanced options: ${url}`);
          logger.info(
            `Fetch chapter covers: ${fetchChapterCovers}, Max chapters: ${maxChaptersToFetch}`
          );

          // Extract wiki base URL
          const wikiBaseUrl = extractWikiBaseUrl(url);

          // Fetch the page
          let html = await fetchPageHtml(url);

          // Check if this is the main manga page that links to a separate volumes page
          html = await fetchVolumesPageIfExists(html, wikiBaseUrl);

          // Parse volume tables with enhanced options
          const uniqueVolumes = await parseAndDeduplicateVolumes(html);

          // Collect all chapter URLs for automatic detail fetching
          const chapterUrls = extractChapterUrls(uniqueVolumes);

          // Control automatic chapter detail fetching based on input parameter
          const skipAutoFetch = !fetchChapterCovers;
          const chapterDetailsMap =
            !skipAutoFetch && chapterUrls.length > 0
              ? await fetchChapterDetailsBatch(chapterUrls, maxChaptersToFetch)
              : new Map<string, unknown>();

          // Calculate totals using helper
          const totalChapters = calculateTotalChapters(html, uniqueVolumes);

          // Format the response with enriched chapter details
          const volumeDetails = formatVolumeDetails(uniqueVolumes, chapterDetailsMap);

          logger.info(
            `Parsed ${uniqueVolumes.length} volumes with ${totalChapters} chapters from Fandom (enhanced: ${fetchChapterCovers}, details fetched: ${chapterDetailsMap.size})`
          );

          return {
            volumes: uniqueVolumes.length,
            chapters: totalChapters,
            volumeDetails,
          };
        } catch (error: unknown) {
          logger.error(
            `Error parsing Fandom URL: ${error instanceof Error ? error.message : String(error)}`
          );
          throw toTRPCError(handleError(error));
        }
      }
    ),
});
