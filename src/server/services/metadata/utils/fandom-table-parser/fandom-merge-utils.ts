/**
 * Fandom Merge Utilities
 *
 * Utilities for merging volume and chapter data from multiple parsing sources
 * to create comprehensive metadata without duplicates.
 *
 * Extracted from: fandomTableParser.ts (lines 335-401)
 */

import type { ChapterData, VolumeData } from './fandom-types';

/**
 * Merge volume data from multiple sources
 */
export function mergeVolumeData(primary: VolumeData[], secondary: VolumeData[]): VolumeData[] {
  const volumeMap = new Map<number, VolumeData>();

  // Add primary volumes
  primary.forEach(vol => {
    volumeMap.set(vol.number, vol);
  });

  // Merge or add secondary volumes
  secondary.forEach(vol => {
    if (volumeMap.has(vol.number)) {
      const existing = volumeMap.get(vol.number);
      if (existing !== undefined) {
        // Merge data, preferring existing non-empty values
        const merged: VolumeData = {
          ...vol,
          ...existing,
        };
        const mergedCoverImage = existing.coverImage ?? vol.coverImage;
        if (mergedCoverImage !== undefined) merged.coverImage = mergedCoverImage;
        const mergedChapters = (existing.chapters && existing.chapters.length > 0) ? existing.chapters : vol.chapters;
        if (mergedChapters !== undefined) merged.chapters = mergedChapters;
        volumeMap.set(vol.number, merged);
      }
    } else {
      volumeMap.set(vol.number, vol);
    }
  });
  return Array.from(volumeMap.values()).sort((a, b) => a.number - b.number);
}

/**
 * Merge chapter data from multiple sources
 */
export function mergeChapterData(primary: ChapterData[], secondary: ChapterData[]): ChapterData[] {
  const chapterMap = new Map<number, ChapterData>();

  // Add primary chapters (prefer these as they likely have titles)
  primary.forEach(ch => {
    chapterMap.set(ch.number, ch);
  });

  // Add secondary chapters only if not already present
  secondary.forEach(ch => {
    if (!chapterMap.has(ch.number)) {
      chapterMap.set(ch.number, ch);
    } else {
      // Merge data if secondary has additional info
      const existing = chapterMap.get(ch.number);
      if (existing === undefined) return;

      if (!existing.title || existing.title === `Chapter ${ch.number}`) {
        const newTitle = ch.title ?? existing.title;
        if (newTitle !== undefined) existing.title = newTitle;
      }
      if (!existing.url && ch.url) {
        existing.url = ch.url;
      }
      // Merge cover image from secondary if primary doesn't have one
      if (!existing.coverImage && ch.coverImage) {
        existing.coverImage = ch.coverImage;
      }
    }
  });
  return Array.from(chapterMap.values()).sort((a, b) => a.number - b.number);
}
