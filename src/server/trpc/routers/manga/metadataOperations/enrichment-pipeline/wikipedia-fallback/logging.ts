/**
 * Logging helpers
 */

import { logger } from '@/utils/logger';

import type { ChapterEnrichmentMaps } from '../types';
import type { EnrichmentState } from './enrichment-state';

export function hasEnrichmentData(maps: ChapterEnrichmentMaps): boolean {
  return Object.keys(maps.chapterTitleMap).length > 0
    || Object.keys(maps.chapterVolumeMap).length > 0
    || Object.keys(maps.volumeDescriptionMap).length > 0;
}

export function logCoverageSkip(state: EnrichmentState): void {
  logger.info(
    `[enrichmentPipeline] Wikipedia skipped — Fandom coverage sufficient ` +
    `(${Math.round(state.coveragePct * 100)}% titles filled, ${state.filledTitles}/${state.totalChapters})`,
  );
}

export function logGapFillResult(maps: ChapterEnrichmentMaps): void {
  logger.info(
    `[enrichmentPipeline] Wikipedia gap-fill applied: ` +
    `${Object.keys(maps.chapterTitleMap).length} titles, ` +
    `${Object.keys(maps.chapterVolumeMap).length} volume assignments, ` +
    `${Object.keys(maps.volumeDescriptionMap).length} volume descriptions`,
  );
}