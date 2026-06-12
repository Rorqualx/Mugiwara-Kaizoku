/**
 * Metadata Fandom Chapter Router
 *
 * Handles Fandom chapter metadata extraction:
 * - fetchFandomChapterMetadata: Fetch metadata for specific Fandom chapter pages
 *   - Cover image extraction from infoboxes with intelligent scoring
 *   - Description/synopsis parsing from multiple section types
 *   - Release date extraction
 *   - Page count extraction
 *   - Infobox proxy URL generation for images
 *   - Optional fields handling
 *   - Chapter-specific image matching
 *
 * Extracted from metadata-fandom-basic.ts for better organization and size management.
 */

import { z } from 'zod';

import { toTRPCError, TRPCErrors } from '@/server/trpc/errors';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import { handleError } from '../metadata-utils';

import { findBestCoverImage } from './image-scoring';
import {
  extractTitle,
  extractChapterNumber,
  extractDescription,
  extractReleaseDate,
  extractPageCount,
} from './metadata-extractors';
import {
  extractChapterNumberFromUrl,
  normalizeFandomImageUrl,
  generateProxyUrl,
} from './url-processing';

import type { ChapterMetadata } from './types';

export const metadataFandomChapterRouter = router({
  /**
   * Fetch metadata for a specific Fandom chapter page
   */
  fetchFandomChapterMetadata: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
        forceRefresh: z.boolean().optional(),
      })
    )
    .mutation(
      async ({ input }): Promise<ChapterMetadata> => {
        try {
          const { url, forceRefresh } = input;

          // Validate it's a Fandom URL
          if (!url.includes('fandom.com')) {
            throw TRPCErrors.badRequest('Not a valid Fandom wiki URL');
          }

          logger.info(
            `Fetching chapter metadata from: ${url}${forceRefresh ? ' (force refresh)' : ''}`
          );

          const axios = (await import('axios')).default;
          const { load } = await import('cheerio');

          // Fetch the chapter page
          const headers: Record<string, string> = {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          };

          // Add cache-busting headers if forceRefresh is true
          if (forceRefresh) {
            headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            headers['Pragma'] = 'no-cache';
            headers['Expires'] = '0';
          }

          const response = await axios.get(url, { headers });
          const responseData: unknown = response.data;
          const $ =
            typeof responseData === 'string'
              ? load(responseData)
              : load(String(responseData));

          // Extract chapter number from URL to help with image selection
          const chapterNumberFromUrl = extractChapterNumberFromUrl(url);

          // Find the best cover image
          const bestImageUrl = findBestCoverImage($, chapterNumberFromUrl);

          // Normalize and proxy the image URL if found
          let coverImageUrl: string | undefined;
          if (bestImageUrl) {
            const normalizedUrl = normalizeFandomImageUrl(bestImageUrl);
            logger.info(`Chapter cover image found: ${normalizedUrl}`);
            coverImageUrl = await generateProxyUrl(normalizedUrl);
          }

          // Extract metadata fields
          const title = extractTitle($);
          const chapterNumber = extractChapterNumber($, title);
          const description = extractDescription($);
          const releaseDate = extractReleaseDate($);
          const pageCount = extractPageCount($);

          logger.info(
            `Fetched chapter metadata: cover=${!!coverImageUrl}, desc=${description.length} chars`
          );

          // Build result with conditional properties
          const result: ChapterMetadata = {};

          if (coverImageUrl) {
            result.coverImageUrl = coverImageUrl;
          }

          if (description) {
            const trimmedDesc = description.substring(0, 500);
            result.description = trimmedDesc;
            result.summary = trimmedDesc;
            result.synopsis = trimmedDesc;
          }

          if (title) {
            result.title = title;
          }

          if (chapterNumber) {
            result.chapterNumber = chapterNumber;
          }

          if (releaseDate) {
            result.releaseDate = releaseDate;
          }

          if (pageCount !== undefined) {
            result.pageCount = pageCount;
          }

          return result;
        } catch (error: unknown) {
          logger.error(
            `Error fetching chapter metadata: ${error instanceof Error ? error.message : String(error)}`
          );
          throw toTRPCError(handleError(error));
        }
      }
    ),
});
