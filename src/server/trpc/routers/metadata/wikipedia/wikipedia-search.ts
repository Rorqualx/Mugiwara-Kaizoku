/**
 * Wikipedia Search Router
 *
 * Handles searching Wikipedia for manga titles.
 *
 * Procedures:
 * - searchWikipedia: Search Wikipedia for manga
 *
 * Extracted from: metadata-wikipedia.ts (lines 77-105)
 */

import { z } from 'zod';

import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

export const wikipediaSearchRouter = router({
  searchWikipedia: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().optional().default(5),
      })
    )
    .query(async ({ input }): Promise<AsyncResult<unknown[], Error>> => {
      try {
        logger.info(`Searching Wikipedia for: ${input.query}`);
        // Import Wikipedia service
        const { wikipediaService } = await import(
          '@/server/services/wikipedia/wikipedia/service'
        );
        // Search Wikipedia
        const results = await wikipediaService.searchManga(input.query);
        // Transform results
        const transformedResults = results.map((result) => ({
          id: result.pageId,
          title: result['title'],
          description: result.extract ?? '',
          url: result.url,
          source: 'wikipedia',
        }));
        return createSuccessResult(transformedResults);
      } catch (error: unknown) {
        logger.error(
          `Error searching Wikipedia: ${error instanceof Error ? error.message : String(error)}`
        );
        return createErrorResult(
          error instanceof Error
            ? error
            : new Error(`Failed to search Wikipedia: ${String(error)}`)
        );
      }
    }),
});
