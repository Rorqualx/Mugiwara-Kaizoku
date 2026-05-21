/**
 * Response parsing for AI Agent Phase Orchestrator
 *
 * Handles parsing ChapterEnrichmentMaps from agent text responses.
 */

import { createEmptyEnrichmentMaps } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import type { ChapterEnrichmentMaps } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

const log = logger.child('ResponseParser');

/**
 * Parse ChapterEnrichmentMaps from agent response
 */
export function parseEnrichmentMapsFromResponse(
  response: string
): AsyncResult<ChapterEnrichmentMaps, Error> {
  try {
    log.info('Parsing AI response', {
      responseLength: response.length,
      preview: response.slice(0, 300),
      tail: response.slice(-200),
    });

    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.warn('No JSON found in AI response', { responseLength: response.length });
      return createErrorResult(new Error('No JSON found in agent response'));
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ChapterEnrichmentMaps>;
    const titleCount = Object.keys(parsed.chapterTitleMap ?? {}).length;
    const volumeCount = Object.keys(parsed.chapterVolumeMap ?? {}).length;
    log.info('AI response parsed successfully', { titleCount, volumeCount, jsonLength: jsonMatch[0].length });
    const maps = createEmptyEnrichmentMaps();

    // Merge parsed data into maps
    if (parsed.chapterTitleMap) {
      Object.assign(maps.chapterTitleMap, parsed.chapterTitleMap);
    }
    if (parsed.chapterVolumeMap) {
      Object.assign(maps.chapterVolumeMap, parsed.chapterVolumeMap);
    }
    if (parsed.chapterCoverMap) {
      Object.assign(maps.chapterCoverMap, parsed.chapterCoverMap);
    }
    if (parsed.chapterDescriptionMap) {
      Object.assign(maps.chapterDescriptionMap, parsed.chapterDescriptionMap);
    }
    if (parsed.chapterPagesMap) {
      Object.assign(maps.chapterPagesMap, parsed.chapterPagesMap);
    }
    if (parsed.chapterReleaseDateMap) {
      Object.assign(maps.chapterReleaseDateMap, parsed.chapterReleaseDateMap);
    }
    if (parsed.volumeDescriptionMap) {
      Object.assign(maps.volumeDescriptionMap, parsed.volumeDescriptionMap);
    }

    return createSuccessResult(maps);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn('Failed to parse AI response', { error: err.message, responseLength: response.length });
    return createErrorResult(err);
  }
}
