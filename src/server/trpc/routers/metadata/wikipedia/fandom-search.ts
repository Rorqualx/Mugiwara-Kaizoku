/**
 * Fandom Wiki Search Router
 *
 * Handles searching across multiple Fandom wikis for manga.
 *
 * Procedures:
 * - searchFandomWikis: Search across Fandom wikis
 *
 * Extracted from: metadata-wikipedia.ts (lines 109-153)
 *
 * Fixes:
 * - Line 141: Removed unnecessary optional chain after type assertion
 */

import { z } from 'zod';

import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, createSuccessResult, isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

export const fandomSearchRouter = router({
  searchFandomWikis: publicProcedure.
  input(z.object({
    title: z.string(),
    wikis: z.array(z.string()).optional()
  })).
  query(async ({ input }): Promise<AsyncResult<Array<{
    title: string;
    url: string;
    snippet: string;
    wiki: string;
    pageId: number;
    score?: number;
    size?: number;
    wordcount?: number;
    timestamp?: string;
    isRecommended?: boolean;
  }>, Error>> => {
    try {
      const { fandomSearchService } = await import('@/server/services/fandom/fandomSearchService');
      const result = await fandomSearchService.searchAllWikis(input.title, input.wikis);
      if (isSuccess(result)) {
        // FIX: Removed unnecessary optional chain after type assertion
        const typedResults = (result.data as { results?: Array<{
          title: string;
          url: string;
          snippet: string;
          wiki: string;
          pageId: number;
          score?: number;
          size?: number;
          wordcount?: number;
          timestamp?: string;
          isRecommended?: boolean;
        }> }).results ?? [];
        return createSuccessResult(typedResults);
      } else if (isError(result)) {
        return createErrorResult(result.error as Error);
      } else {
        return createErrorResult(new Error('Unexpected result status'));
      }
    }
    catch (error: unknown) {
      logger.error(`Error searching Fandom wikis: ${error instanceof Error ? error.message : String(error)}`);
      return createErrorResult(error instanceof Error ? error : new Error(`Search failed: ${String(error)}`));
    }
  }),
});
