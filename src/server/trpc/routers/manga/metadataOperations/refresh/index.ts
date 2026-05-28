/**
 * RefreshMetaData Orchestrator
 *
 * Delegates to the shared enrichment pipeline (same logic as oneClickEnrich).
 * Emits WebSocket progress events so the frontend progress bar works.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { realtimeEmitter, type MetadataRefreshPhase } from '@/server/services/realtime/RealtimeEventEmitter';
import { publicProcedure } from '@/server/trpc/procedures';
import { includeMangaRelations } from '@/server/trpc/routers/manga/shared';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import { runEnrichmentPipeline } from '../enrichment-pipeline';
import { extractBoundAniListId } from '../enrichment-pipeline/phase-provider-fetch';
import { handleError } from '../utils';

import { clearAutoBindingsForReidentify } from './clear-auto-bindings';

// ============================================================================
// Progress Emitter
// ============================================================================

const TOTAL_PHASES = 10;

/** Emit a metadata refresh progress event to the WebSocket channel */
async function emitProgress(
  mangaId: number,
  phase: MetadataRefreshPhase,
  phaseIndex: number,
  message: string,
  error?: string
): Promise<void> {
  await realtimeEmitter.emitMetadataRefreshProgress({
    mangaId,
    phase,
    phaseIndex,
    totalPhases: TOTAL_PHASES,
    message,
    error,
  });
}

/** Map enrichment pipeline phases to the WebSocket phases the frontend expects.
 *  The message from the pipeline is passed through as-is for real-time status. */
const phaseMap: Record<string, { phase: MetadataRefreshPhase; index: number }> = {
  fetching: { phase: 'fetching_providers', index: 1 },
  enriching: { phase: 'enriching_metadata', index: 2 },
  persisting: { phase: 'persisting_data', index: 3 },
  reconciling: { phase: 'reconciling_chapters', index: 4 },
  validating: { phase: 'validating_volumes', index: 5 },
  fandom: { phase: 'fandom_scraping', index: 6 },
  fandom_enrichment: { phase: 'fandom_enrichment', index: 7 },
  fandom_chapters: { phase: 'fandom_chapters', index: 7 },
  wikipedia: { phase: 'wikipedia_enrichment', index: 7 },
  wikipedia_enrichment: { phase: 'wikipedia_enrichment', index: 7 },
  applying: { phase: 'applying_data', index: 8 },
  finalizing: { phase: 'rebuilding_chapters', index: 9 },
};

// ============================================================================
// Orchestrator Procedure
// ============================================================================

export const metadataRefreshProcedures = router({
  refreshMetaData: publicProcedure
    .input(
      z.object({
        id: z.number(),
        forceRefresh: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, forceRefresh } = input;

      logger.info(`Refreshing metadata for manga ID ${id}`);

      const manga = await ctx.prisma.manga.findUnique({
        where: { id },
        include: includeMangaRelations,
      });

      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found.' });
      }

      try {
        await emitProgress(id, 'starting', 0, 'Starting metadata refresh...');

        // Capture the bound AniList id BEFORE reidentify clears it, so the
        // pipeline can fall back to it when the fresh AniList title search finds
        // nothing (AniList can't reproduce some titles by search — see
        // fetchAniListDirect). Without this, reidentify destroys a correct
        // binding and cascades garbage into ComicVine/Wikipedia.
        const previousAniListId = extractBoundAniListId(manga.providerMetadata);

        if (forceRefresh === true) {
          const cleared = await clearAutoBindingsForReidentify(ctx.prisma, id);
          if (cleared.providersCleared.length > 0) {
            logger.info(
              `Reidentify cleared auto bindings for manga ${id}: `
              + `[${cleared.providersCleared.join(', ')}] `
              + `(preserved: [${cleared.providersPreserved.join(', ') || 'none'}])`,
            );
          }
        }

        const { manga: freshManga } = await runEnrichmentPipeline(
          id,
          manga.title,
          async (pipelinePhase, message) => {
            const mapped = phaseMap[pipelinePhase];
            if (mapped) {
              await emitProgress(id, mapped.phase, mapped.index, message);
            }
          },
          { forceRefresh: forceRefresh ?? false, previousAniListId },
        );

        await emitProgress(id, 'completed', TOTAL_PHASES, 'Metadata refresh complete');
        return freshManga ?? manga;
      } catch (error: unknown) {
        const errorMessage = handleError(error).message;
        logger.error(`Error refreshing metadata for manga ID ${id}: ${errorMessage}`);
        await emitProgress(id, 'error', 0, 'Metadata refresh failed', errorMessage);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to refresh metadata: ${errorMessage}`,
        });
      }
    }),
});
