/**
 * Import Executor - Chapter Merging Helpers
 *
 * Functions for merging chapters from different providers into display volumes.
 *
 * @module components/addManga/services/quickAddService/import-executor/chapter-merging
 */

import { logger } from '@/utils/logger';

// ============================================================================
// Chapter Merging
// ============================================================================

/**
 * Merge chapters from chapter source into display volumes
 */
export function mergeChaptersIntoDisplayVolumes(
  displayVolumes: Array<Record<string, unknown>>,
  volumeDisplaySource: string,
  chapterDisplaySource: string,
  sourcesMetadata: Record<string, unknown>
): void {
  const chapterSourceVolumes = findChapterSourceVolumes(chapterDisplaySource, volumeDisplaySource, sourcesMetadata);
  if (!chapterSourceVolumes || chapterSourceVolumes.length === 0) return;

  const chaptersByVolume = buildChaptersByVolumeMap(chapterSourceVolumes);
  const mergedCount = mergeChaptersFromMap(displayVolumes, chaptersByVolume);

  logger.debug('[import-executor] Chapter merging complete', {
    mergedVolumeCount: mergedCount,
    totalDisplayVolumes: displayVolumes.length
  });
}

/**
 * Build a map of volume number to chapters
 */
function buildChaptersByVolumeMap(sourceVolumes: unknown[]): Map<number, unknown[]> {
  const chaptersByVolume = new Map<number, unknown[]>();
  for (const vol of sourceVolumes) {
    const volObj = vol as Record<string, unknown>;
    const volNum = (volObj['volumeNumber'] ?? volObj['number']) as number | undefined;
    const chapters = volObj['chapters'] as unknown[] | undefined;
    if (volNum !== undefined && chapters && chapters.length > 0) {
      chaptersByVolume.set(volNum, chapters);
    }
  }
  return chaptersByVolume;
}

/**
 * Merge chapters from map into display volumes
 */
function mergeChaptersFromMap(
  displayVolumes: Array<Record<string, unknown>>,
  chaptersByVolume: Map<number, unknown[]>
): number {
  let mergedCount = 0;
  for (const displayVol of displayVolumes) {
    const displayVolNum = (displayVol['volumeNumber'] ?? displayVol['number']) as number | undefined;
    const existingChapters = displayVol['chapters'] as unknown[] | undefined;

    if (displayVolNum === undefined) continue;

    const sourceChapters = chaptersByVolume.get(displayVolNum);
    if (sourceChapters && (!existingChapters || existingChapters.length < sourceChapters.length)) {
      displayVol['chapters'] = sourceChapters;
      displayVol['chapterCount'] = sourceChapters.length;
      displayVol['totalChapters'] = sourceChapters.length;
      mergedCount++;
    }
  }
  return mergedCount;
}

/**
 * Find volumes from chapter source
 */
function findChapterSourceVolumes(
  chapterDisplaySource: string,
  volumeDisplaySource: string,
  sourcesMetadata: Record<string, unknown>
): unknown[] | undefined {
  const chapterSourceData = sourcesMetadata[chapterDisplaySource] as Record<string, unknown> | undefined;
  let chapterSourceVolumes = chapterSourceData?.['volumeDetails'] as unknown[] | undefined;

  if (!chapterSourceVolumes || chapterSourceVolumes.length === 0) {
    chapterSourceVolumes = findFallbackChapterSource(volumeDisplaySource, sourcesMetadata);
  }

  return chapterSourceVolumes;
}

/**
 * Find fallback chapter source from other providers
 */
function findFallbackChapterSource(
  volumeDisplaySource: string,
  sourcesMetadata: Record<string, unknown>
): unknown[] | undefined {
  for (const [providerKey, providerData] of Object.entries(sourcesMetadata)) {
    if (providerKey === volumeDisplaySource) continue;
    const pData = providerData as Record<string, unknown>;
    const pVolumes = pData['volumeDetails'] as unknown[] | undefined;
    if (pVolumes && pVolumes.length > 0 && hasVolumesWithChapters(pVolumes)) {
      return pVolumes;
    }
  }
  return undefined;
}

/**
 * Check if volumes array has entries with chapters
 */
function hasVolumesWithChapters(volumes: unknown[]): boolean {
  return volumes.some((v: unknown) => {
    const vol = v as Record<string, unknown>;
    const chs = vol['chapters'] as unknown[] | undefined;
    return chs && chs.length > 0;
  });
}
