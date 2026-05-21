/**
 * Enrichment Extraction Helpers for Chapter Orchestrator
 * Extracts enrichment data from various provider metadata
 */

import { logger } from '@/utils/logger';

import { processChapterEnrichment } from './data-extractors';
import { isRecord } from './type-guards';

import type { ChapterEnrichment, FandomData, ProviderMetadataRecord } from './types';

/**
 * Extract chapter enrichment data from Fandom provider metadata
 * Complexity: 8
 */
export function extractFandomEnrichment(
  fandomData: FandomData | undefined
): Record<number, ChapterEnrichment> | undefined {
  if (!fandomData?.volumeData || !Array.isArray(fandomData.volumeData)) {
    return undefined;
  }

  logger.info(`[chapterOrchestrator] Found Fandom enrichment data with ${fandomData.volumeData.length} volumes`);
  const chapterEnrichmentMap: Record<number, ChapterEnrichment> = {};
  let chapterIndex = 0;

  for (const volume of fandomData.volumeData) {
    if (!isRecord(volume) || !Array.isArray(volume['chapters'])) continue;

    for (const chapter of volume['chapters']) {
      const result = processChapterEnrichment(chapter, chapterIndex);
      if (result) {
        chapterEnrichmentMap[result.chapterNum] = result.enrichment;
      }
      chapterIndex++;
    }
  }

  const enrichmentCount = Object.keys(chapterEnrichmentMap).length;
  logger.info(`[chapterOrchestrator] Extracted enrichment for ${enrichmentCount} chapters from Fandom`);
  return chapterEnrichmentMap;
}

/**
 * Extract Fandom data from provider metadata
 * Complexity: 4
 */
export function getFandomDataFromProvider(
  providerMeta: ProviderMetadataRecord
): FandomData | undefined {
  const rawFandomData = providerMeta['fandom'] ?? providerMeta['FANDOM'];
  return rawFandomData && typeof rawFandomData === 'object' ? rawFandomData as FandomData : undefined;
}
