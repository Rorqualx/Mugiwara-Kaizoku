/**
 * Merge Tool Helpers
 *
 * Utility functions for the merge tool.
 */

import type { ProviderChapter } from './merge-tool-types';

/**
 * Calculate chapters grouped by volume
 */
export function calculateChaptersByVolume(providerChapters: ProviderChapter[]): Record<number, number[]> {
  const chaptersByVolume: Record<number, number[]> = {};

  for (const chapter of providerChapters) {
    if (chapter.volume !== undefined) {
      chaptersByVolume[chapter.volume] ??= [];
      (chaptersByVolume[chapter.volume] as number[]).push(chapter.chapterNumber);
    }
  }

  // Sort chapter numbers within each volume
  for (const volume in chaptersByVolume) {
    if (Object.prototype.hasOwnProperty.call(chaptersByVolume, volume)) {
      (chaptersByVolume[Number(volume)] as number[]).sort((a, b) => a - b);
    }
  }

  return chaptersByVolume;
}

/**
 * Count chapters that have at least one metadata field (title, description, or cover image)
 */
export function countTitlesWithMetadata(providerChapters: ProviderChapter[]): number {
  return providerChapters.filter(ch => ch.title || ch.description || ch.coverImage).length;
}

/**
 * Count unique volumes in provider chapters
 */
export function countUniqueVolumes(providerChapters: ProviderChapter[]): number {
  const volumeSet = new Set<number>();
  for (const chapter of providerChapters) {
    if (chapter.volume !== undefined) {
      volumeSet.add(chapter.volume);
    }
  }
  return volumeSet.size;
}