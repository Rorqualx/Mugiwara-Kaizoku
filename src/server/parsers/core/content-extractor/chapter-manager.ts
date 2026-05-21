/**
 * Chapter Manager
 *
 * Handles chapter merging and volume assignment operations.
 * Provides utilities for deduplicating chapters and organizing them within volumes.
 *
 * Extracted from: ContentExtractor.ts (lines 389-447)
 * Date: 2025-11-21
 */

import type { ChapterData, VolumeData } from './types';

/**
 * Merge duplicate chapters, preferring non-null values
 *
 * Deduplicates chapters by chapter number, merging data from duplicates.
 * When multiple chapters share the same number, non-null values are preferred.
 * Returns a sorted array of unique chapters.
 *
 * @param chapters - Array of chapters that may contain duplicates
 * @returns Deduplicated and sorted array of chapters
 */
export function mergeChapters(chapters: ChapterData[]): ChapterData[] {
  const chapterMap = new Map<string, ChapterData>();

  for (const chapter of chapters) {
    const key = chapter.chapterNumber;
    const existing = chapterMap.get(key);

    if (existing) {
      // Merge data, preferring non-null values
      const merged: ChapterData = {
        chapterNumber: existing.chapterNumber,
        source: existing.source,
        ...(existing.title ?? chapter.title ? { title: existing.title ?? chapter.title } : {}),
        ...(existing.volumeNumber ?? chapter.volumeNumber ? { volumeNumber: existing.volumeNumber ?? chapter.volumeNumber } : {}),
        ...(existing.releaseDate ?? chapter.releaseDate ? { releaseDate: existing.releaseDate ?? chapter.releaseDate } : {}),
        ...(existing.url ?? chapter.url ? { url: existing.url ?? chapter.url } : {})
      };
      chapterMap.set(key, merged);
    } else {
      chapterMap.set(key, { ...chapter });
    }
  }

  return Array.from(chapterMap.values()).sort((a, b) => {
    const aNum = parseFloat(a.chapterNumber);
    const bNum = parseFloat(b.chapterNumber);
    return aNum - bNum;
  });
}

/**
 * Assign chapters to volumes and sort
 *
 * Assigns orphan chapters to their corresponding volumes based on volumeNumber.
 * Prevents duplicate assignments and sorts chapters within each volume.
 * Modifies the volumes array in place.
 *
 * @param volumes - Array of volumes to assign chapters to
 * @param chapters - Array of chapters to assign
 */
export function assignChaptersToVolumes(
  volumes: VolumeData[],
  chapters: ChapterData[]
): void {
  for (const chapter of chapters) {
    if (chapter.volumeNumber) {
      const volume = volumes.find(v => v.volumeNumber === chapter.volumeNumber);
      if (volume) {
        // Check if chapter already exists in volume
        const exists = volume.chapters.some(ch => ch.chapterNumber === chapter.chapterNumber);
        if (!exists) {
          volume.chapters.push(chapter);
        }
      }
    }
  }

  // Sort chapters within each volume
  for (const volume of volumes) {
    volume.chapters.sort((a, b) => {
      const aNum = parseFloat(a.chapterNumber);
      const bNum = parseFloat(b.chapterNumber);
      return aNum - bNum;
    });
  }
}
