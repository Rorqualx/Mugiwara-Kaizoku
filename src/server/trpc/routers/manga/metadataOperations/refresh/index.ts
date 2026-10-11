/**
 * RefreshMetaData Orchestrator
 *
 * Delegates to the shared enrichment pipeline (same logic as oneClickEnrich).
 * Emits WebSocket progress events so the frontend progress bar works.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { protectedProcedure } from '@/server/trpc/procedures';
import { assertMembership, requireUserId } from '@/server/trpc/routers/_shared/library-access';
import { includeMangaRelations } from '@/server/trpc/routers/manga/shared';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import { handleError } from '../utils';

import { emitRefreshProgress, runMetadataRefresh, TOTAL_REFRESH_PHASES } from './run-refresh';

// ============================================================================
// Orchestrator Procedure
// ============================================================================

export const metadataRefreshProcedures = router({
  refreshMetaData: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        forceRefresh: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, forceRefresh } = input;
      await assertMembership(ctx.prisma, requireUserId(ctx), id);

      logger.info(`Refreshing metadata for manga ID ${id}`);

      const manga = await ctx.prisma.manga.findUnique({
        where: { id },
        include: includeMangaRelations,
      });

      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found.' });
      }

      try {
        const { manga: freshManga, removedPhantoms } = await runMetadataRefresh(ctx.prisma, manga, forceRefresh === true);

        // Re-fetch so the returned manga (and the UI that renders it) reflects the
        // just-removed phantoms rather than the pre-sweep snapshot.
        const cleaned = removedPhantoms > 0
          ? await ctx.prisma.manga.findUnique({ where: { id }, include: includeMangaRelations })
          : null;

        await emitRefreshProgress(id, 'completed', TOTAL_REFRESH_PHASES, 'Metadata refresh complete');
        return cleaned ?? freshManga ?? manga;
      } catch (error: unknown) {
        const errorMessage = handleError(error).message;
        logger.error(`Error refreshing metadata for manga ID ${id}: ${errorMessage}`);
        await emitRefreshProgress(id, 'error', 0, 'Metadata refresh failed', errorMessage);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to refresh metadata: ${errorMessage}`,
        });
      }
    }),
});
