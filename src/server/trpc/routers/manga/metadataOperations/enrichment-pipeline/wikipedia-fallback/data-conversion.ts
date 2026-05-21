/**
 * Data conversion: Wikipedia data to gap-fill maps
 */

import type { WikipediaMangaData, WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';

import { createEmptyEnrichmentMaps } from '../types';

import type { EnrichmentState } from './enrichment-state';
import type { ChapterEnrichmentMaps } from '../types';

/** Convert WikipediaMangaData to ChapterEnrichmentMaps, only filling gaps */
export function convertToGapFillMaps(
  data: WikipediaMangaData,
  state: EnrichmentState,
  forceVolumeAssignments = false,
): ChapterEnrichmentMaps {
  const maps = createEmptyEnrichmentMaps();

  if (data.chapterList) {
    for (const chapter of data.chapterList) {
      populateChapterGaps(chapter, undefined, maps, state, forceVolumeAssignments);
    }
  }

  if (data.volumeList) {
    for (const volume of data.volumeList) {
      populateVolumeGaps(volume, maps, state, forceVolumeAssignments);
    }
  }

  return maps;
}

/** Populate maps from a single chapter entry, skipping already-filled fields */
export function populateChapterGaps(
  chapter: WikipediaChapter,
  volumeNumber: number | undefined,
  maps: ChapterEnrichmentMaps,
  state: EnrichmentState,
  forceVolume = false,
): void {
  const chNum = parseChapterNumber(chapter.number);
  if (chNum === null) return;

  const { chapterTitleMap, chapterVolumeMap, chapterReleaseDateMap, chapterPagesMap } = maps;
  if (chapter.title && !state.chaptersWithTitle.has(chNum)) chapterTitleMap[chNum] = chapter.title;
  const vol = volumeNumber ?? chapter.volumeNumber;
  if (vol !== undefined && (forceVolume || !state.chaptersWithVolume.has(chNum))) chapterVolumeMap[chNum] = vol;
  if (chapter.releaseDate && !state.chaptersWithReleaseDate.has(chNum)) chapterReleaseDateMap[chNum] = chapter.releaseDate;
  if (chapter.pages && !state.chaptersWithPages.has(chNum)) chapterPagesMap[chNum] = chapter.pages;
}

/** Populate maps from a volume entry (description + nested chapters) */
export function populateVolumeGaps(
  volume: { number: number; description?: string; summary?: string; chapters: WikipediaChapter[] },
  maps: ChapterEnrichmentMaps,
  state: EnrichmentState,
  forceVolume = false,
): void {
  const desc = volume.description ?? volume.summary;
  if (desc && !state.volumesWithDescription.has(volume.number)) {
    const { volumeDescriptionMap } = maps;
    volumeDescriptionMap[volume.number] = desc;
  }

  for (const chapter of volume.chapters) {
    populateChapterGaps(chapter, volume.number, maps, state, forceVolume);
  }
}

/** Parse a chapter number from string|number, or null if invalid */
export function parseChapterNumber(num: string | number): number | null {
  const parsed = typeof num === 'number' ? num : parseFloat(num);
  return isNaN(parsed) ? null : parsed;
}