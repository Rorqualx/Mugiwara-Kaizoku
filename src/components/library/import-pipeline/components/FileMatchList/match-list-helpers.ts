/**
 * Match List Helpers
 *
 * Shared utilities for the inline file match list UI.
 *
 * @module components/library/import-pipeline/components/FileMatchList/match-list-helpers
 */

import type {
  FileToChapterMapping,
  MetadataChapter,
  MetadataVolume,
} from '@/components/library/import-pipeline/types';

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format bytes into a human-readable size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] ?? 'B'}`;
}

// ============================================================================
// Sorting
// ============================================================================

/**
 * Sort mappings into active (unmatched first) and skipped sections
 */
export function sortMappingsForDisplay(
  mappings: Map<string, FileToChapterMapping>
): { active: FileToChapterMapping[]; skipped: FileToChapterMapping[] } {
  const active: FileToChapterMapping[] = [];
  const skipped: FileToChapterMapping[] = [];

  for (const mapping of mappings.values()) {
    if (mapping.status === 'skipped') {
      skipped.push(mapping);
    } else {
      active.push(mapping);
    }
  }

  // Unmatched first, then matched — within each group sort by volume/chapter number
  active.sort((a, b) => {
    const aMatched = a.status === 'auto_matched' || a.status === 'manual_matched';
    const bMatched = b.status === 'auto_matched' || b.status === 'manual_matched';
    if (!aMatched && bMatched) return -1;
    if (aMatched && !bMatched) return 1;
    const aNum = a.file.volumeNumber ?? a.file.chapterNumber ?? Infinity;
    const bNum = b.file.volumeNumber ?? b.file.chapterNumber ?? Infinity;
    return aNum - bNum;
  });

  skipped.sort((a, b) => {
    const aNum = a.file.chapterNumber ?? Infinity;
    const bNum = b.file.chapterNumber ?? Infinity;
    return aNum - bNum;
  });

  return { active, skipped };
}

// ============================================================================
// Available Items
// ============================================================================

export interface AvailableChapter {
  chapter: MetadataChapter;
  isUsed: boolean;
}

export interface AvailableVolume {
  volume: MetadataVolume;
  isFullyMatched: boolean;
  matchedCount: number;
}

/**
 * Get chapters with `isUsed` flag based on current mappings
 */
export function getAvailableChapters(
  chapters: MetadataChapter[],
  mappings: Map<string, FileToChapterMapping>
): AvailableChapter[] {
  const usedIds = new Set<string>();

  for (const mapping of mappings.values()) {
    if (mapping.status === 'unmatched' || mapping.status === 'skipped') continue;
    if (mapping.metadataChapter) {
      usedIds.add(mapping.metadataChapter.id);
    }
    if (mapping.volumeChapters) {
      for (const ch of mapping.volumeChapters) {
        usedIds.add(ch.id);
      }
    }
  }

  return chapters.map((chapter) => ({
    chapter,
    isUsed: usedIds.has(chapter.id),
  }));
}

/**
 * Get volumes with match status based on current mappings
 */
export function getAvailableVolumes(
  volumes: MetadataVolume[],
  mappings: Map<string, FileToChapterMapping>
): AvailableVolume[] {
  const usedIds = new Set<string>();

  for (const mapping of mappings.values()) {
    if (mapping.status === 'unmatched' || mapping.status === 'skipped') continue;
    if (mapping.metadataChapter) {
      usedIds.add(mapping.metadataChapter.id);
    }
    if (mapping.volumeChapters) {
      for (const ch of mapping.volumeChapters) {
        usedIds.add(ch.id);
      }
    }
  }

  return volumes.map((volume) => {
    const matchedCount = volume.chapters.filter((ch) => usedIds.has(ch.id)).length;
    return {
      volume,
      isFullyMatched: matchedCount === volume.chapters.length,
      matchedCount,
    };
  });
}
