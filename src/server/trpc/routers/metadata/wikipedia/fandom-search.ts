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

import { toTRPCError } from '@/server/trpc/errors';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { unwrapResultOrThrow } from '@/server/trpc/unwrap-result';
import { logger } from '@/utils/logger';

/** A single Fandom wiki search hit returned over the wire */
interface FandomWikiSearchHit {
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
}

export const fandomSearchRouter = router({
  searchFandomWikis: publicProcedure.
  input(z.object({
    title: z.string(),
    wikis: z.array(z.string()).optional()
  })).
  query(async ({ input }): Promise<FandomWikiSearchHit[]> => {
    try {
      const { fandomSearchService } = await import('@/server/services/fandom/fandomSearchService');
      const result = await fandomSearchService.searchAllWikis(input.title, input.wikis);
      const data = unwrapResultOrThrow(result, 'Fandom wiki search failed');
      return (data as { results?: FandomWikiSearchHit[] }).results ?? [];
    }
    catch (error: unknown) {
      logger.error(`Error searching Fandom wikis: ${error instanceof Error ? error.message : String(error)}`);
      throw toTRPCError(error instanceof Error ? error : new Error(`Search failed: ${String(error)}`));
    }
  }),
});
