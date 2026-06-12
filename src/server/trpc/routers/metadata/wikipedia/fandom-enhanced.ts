/**
 * Fandom Enhanced Metadata Router
 *
 * Handles fetching enhanced metadata from Fandom wiki pages.
 *
 * Procedures:
 * - fetchEnhancedMangaMetadata: Get enhanced manga metadata from Fandom page
 *
 * Extracted from: metadata-wikipedia.ts (lines 157-334)
 *
 * Refactoring:
 * - Reduced from 178 lines to ~85 lines
 * - Reduced complexity from 124 to ~15-20
 * - Extracted URL parsing to parseFandomUrl helper
 * - Extracted data merging to mergeMetadata helper
 */

import { z } from 'zod';


import { toTRPCError } from '@/server/trpc/errors';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import { mergeMetadata, parseFandomUrl, type EnhancedMetadataResult } from './helpers';

export const fandomEnhancedRouter = router({
  fetchEnhancedMangaMetadata: publicProcedure
    .input(z.object({
      mangaPageUrl: z.string().url(),
      includeGallery: z.boolean().default(true)
    }))
    .mutation(async ({ input }): Promise<EnhancedMetadataResult> => {
      try {
        logger.info(`Fetching enhanced metadata for URL: ${input.mangaPageUrl}`);
        const { FandomService } = await import('@/server/services/fandom/FandomService');
        logger.debug('Fandom service imported, creating instance...');

        // Use parseFandomUrl helper (replaces lines 207-229)
        const { subdomain, title } = parseFandomUrl(input.mangaPageUrl);
        logger.info(`Extracted subdomain: "${subdomain}" and title: "${title}" from URL`);

        // Create FandomService instance
        const fandomService = new FandomService(subdomain);

        // Get page metadata which includes volumes and chapters
        const pageMetadata = await fandomService.getPageMetadata(title);

        // Also get basic manga info for additional fields
        const mangaInfo = await fandomService.getMangaInfo(title);

        if (mangaInfo ?? pageMetadata) {
          logger.info('Successfully fetched manga data from Fandom page', {
            hasMangaInfo: !!mangaInfo,
            hasPageMetadata: !!pageMetadata,
            volumesListUrl: (pageMetadata && typeof pageMetadata === 'object' && 'volumesListUrl' in pageMetadata)
              ? pageMetadata.volumesListUrl
              : undefined,
            volumeCount: (pageMetadata && typeof pageMetadata === 'object' && 'volumes' in pageMetadata && Array.isArray(pageMetadata.volumes))
              ? pageMetadata.volumes.length
              : undefined,
            chapterCount: (pageMetadata && typeof pageMetadata === 'object' && 'chapters' in pageMetadata && Array.isArray(pageMetadata.chapters))
              ? pageMetadata.chapters.length
              : undefined
          });

          // Use mergeMetadata helper (replaces lines 249-314)
          const enhancedData = mergeMetadata(mangaInfo, pageMetadata, input.mangaPageUrl);

          logger.info('Enhanced data transformed:', {
            title: enhancedData.title,
            status: enhancedData.publication.status,
            genres: enhancedData.publication.genres,
            author: enhancedData.publication.author
          });

          return enhancedData;
        } else {
          logger.error('Failed to fetch enhanced metadata - no data returned');
          throw toTRPCError(new Error('Failed to fetch enhanced metadata'));
        }
      } catch (error: unknown) {
        logger.error(`Error fetching enhanced metadata: ${error instanceof Error ? error.message : String(error)}`, error);
        throw toTRPCError(error instanceof Error ? error : new Error(`Metadata fetch failed: ${String(error)}`));
      }
    }),
});
