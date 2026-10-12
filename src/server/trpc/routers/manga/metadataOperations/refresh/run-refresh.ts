/**
 * The metadata refresh sequence shared by the single-title mutation and the
 * queued bulk refresh: optionally clear automatic bindings (re-identify), run
 * the enrichment pipeline, then sweep end-of-series phantoms.
 *
 * Progress is emitted on the title's WebSocket channel either way, so a
 * queued refresh drives the same progress bar as a manual one.
 */

import { realtimeEmitter, type MetadataRefreshPhase } from '@/server/services/realtime/RealtimeEventEmitter';
import { logger } from '@/utils/logger';

import { runEnrichmentPipeline } from '../enrichment-pipeline';
import { extractBoundAniListId } from '../enrichment-pipeline/phase-provider-fetch';
import { removePhantomArtifacts } from '../enrichment-pipeline/phase-volume-phantom-prune';
import { MetadataRefreshSkippedError } from '../enrichment-pipeline/pipeline-orchestrator/anchor-gate';

import { clearAutoBindingsForReidentify } from './clear-auto-bindings';

import type { EnrichmentPipelineResult } from '../enrichment-pipeline/types';

type PrismaClient = typeof import('@/server/db').prisma;

export const TOTAL_REFRESH_PHASES = 10;

/** Emit a metadata refresh progress event to the WebSocket channel */
export async function emitRefreshProgress(
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
    totalPhases: TOTAL_REFRESH_PHASES,
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

export interface MetadataRefreshOutcome {
  /** The manga as the pipeline left it, before the phantom sweep. */
  manga: EnrichmentPipelineResult['manga'];
  /** Phantom volumes and chapters removed after the pipeline. */
  removedPhantoms: number;
}

/**
 * Refresh one title's metadata.
 *
 * @param forceRefresh - re-identify: clear automatic bindings first so every
 *   provider is matched again. False keeps the bindings and only refreshes.
 * @throws MetadataRefreshSkippedError when AniList did not answer and the
 *   pipeline left the title unchanged.
 */
export async function runMetadataRefresh(
  db: PrismaClient,
  manga: { id: number; title: string; providerMetadata: unknown },
  forceRefresh: boolean,
): Promise<MetadataRefreshOutcome> {
  const { id } = manga;
  await emitRefreshProgress(id, 'starting', 0, 'Starting metadata refresh...');

  // Capture the bound AniList id BEFORE reidentify clears it, so the
  // pipeline can fall back to it when the fresh AniList title search finds
  // nothing (AniList can't reproduce some titles by search — see
  // fetchAniListDirect). Without this, reidentify destroys a correct
  // binding and cascades garbage into ComicVine/Wikipedia.
  const previousAniListId = extractBoundAniListId(manga.providerMetadata);

  if (forceRefresh) {
    const cleared = await clearAutoBindingsForReidentify(db, id);
    if (cleared.providersCleared.length > 0) {
      logger.info(
        `Reidentify cleared auto bindings for manga ${id}: `
        + `[${cleared.providersCleared.join(', ')}] `
        + `(preserved: [${cleared.providersPreserved.join(', ') || 'none'}])`,
      );
    }
  }

  const { manga: freshManga, skipped } = await runEnrichmentPipeline(
    id,
    manga.title,
    async (pipelinePhase, message) => {
      const mapped = phaseMap[pipelinePhase];
      if (mapped) {
        await emitRefreshProgress(id, mapped.phase, mapped.index, message);
      }
    },
    { forceRefresh, previousAniListId },
  );

  // AniList did not answer: the pipeline wrote nothing, and the phantom sweep
  // below must not run either. Throwing records the job as not completed.
  if (skipped) throw new MetadataRefreshSkippedError(id, skipped);

  // Explicit phantom-removal step: delete any end-of-series phantom volumes
  // and chapters this title still carries so a reidentify leaves the DB —
  // and, after the client refetch on 'completed', the UI — phantom-free.
  // Idempotent with the pipeline's own finalize sweeps.
  const removed = await removePhantomArtifacts(id);
  const removedPhantoms = removed.outOfRangeVolumes + removed.chapters + removed.emptyVolumes;
  if (removedPhantoms > 0) {
    logger.info(
      `Reidentify removed phantoms for manga ${id}: ${removed.chapters} chapter(s), `
      + `${removed.outOfRangeVolumes + removed.emptyVolumes} volume(s)`,
    );
  }

  return { manga: freshManga, removedPhantoms };
}
