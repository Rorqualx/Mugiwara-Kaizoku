/**
 * Volume Processor Module
 *
 * Handles volume and chapter filtering, enrichment, and sorting.
 * Uses chapter-enricher module to reduce complexity.
 *
 * Extracted from: importService.ts (lines 368-552)
 */

import { getUnknownProperty } from '@/utils/type-guards/safe-access';

import { enrichChaptersWithMetadata } from './chapter-enricher';
import { isRecord, isArray } from './utils';

/**
 * Check if volume is selected based on various ID formats
 *
 * Handles both numeric IDs and provider-scoped IDs (e.g., "comicvine-1")
 *
 * @param volumeNumber - Volume number to check
 * @param selectedVolumes - Array of selected volume IDs
 * @returns True if volume is selected
 */
function isVolumeSelected(
  volumeNumber: unknown,
  selectedVolumes: (number | string)[]
): boolean {
  return selectedVolumes.some(selectedId => {
    if (typeof selectedId === 'number') {
      return selectedId === volumeNumber;
    }
    // For provider-scoped IDs, extract the numeric part
    const match = String(selectedId).match(/-(\d+)$/);
    if (match) {
      const matchedNum = match[1];
      if (matchedNum !== undefined) {
        return parseInt(matchedNum, 10) === volumeNumber;
      }
    }
    return String(selectedId) === String(volumeNumber);
  });
}

/**
 * Check if chapter is selected
 *
 * Matches chapters by URL or by chapter number + volume combination
 *
 * @param chapter - Chapter to check
 * @param selectedChapters - Array of selected chapter data
 * @param volumeNumber - Volume number this chapter belongs to
 * @returns True if chapter is selected
 */
function isChapterSelected(
  chapter: Record<string, unknown>,
  selectedChapters: unknown[],
  volumeNumber: unknown
): boolean {
  const chapterUrl = getUnknownProperty(chapter, 'url');
  const chapterNumber = getUnknownProperty(chapter, 'number') ?? getUnknownProperty(chapter, 'chapterNumber');

  return selectedChapters.some(selected => {
    if (typeof selected === 'string') {
      return selected === chapterUrl;
    }
    if (!isRecord(selected)) return false;
    return (
      getUnknownProperty(selected, 'number') === chapterNumber &&
      getUnknownProperty(selected, 'volume') === volumeNumber
    );
  });
}

/**
 * Extract enriched volume title from ComicVine format
 *
 * ComicVine titles: "Fire Force #1: Fire Walk With Me" or "Fire Force\n    #1: Fire Walk With Me"
 * Extracts just the enriched subtitle portion
 *
 * @param rawTitle - Raw title from provider
 * @param volumeNumber - Volume number for formatting
 * @returns Formatted enriched title or undefined
 */
function extractVolumeTitle(rawTitle: unknown, volumeNumber: unknown): string | undefined {
  if (typeof rawTitle !== 'string') return undefined;

  // Match patterns like "#1: Fire Walk With Me" (the enriched part)
  const enrichedMatch = rawTitle.match(/#\d+:\s*(.+?)(?:\n|$)/);
  if (enrichedMatch?.[1]) {
    return `#${volumeNumber}: ${enrichedMatch[1].trim()}`;
  }

  // Try alternate pattern: "Series Name #1: Subtitle"
  const altMatch = rawTitle.match(/(?:.*?)\s*#\d+:\s*(.+?)(?:\n|$)/);
  if (altMatch?.[1]) {
    return `#${volumeNumber}: ${altMatch[1].trim()}`;
  }

  return undefined;
}

/**
 * Prepare volumes with selected chapters
 *
 * Filters volumes and chapters based on selection, enriches chapters with
 * cached metadata, and extracts enriched volume titles.
 *
 * @param volumes - All available volumes
 * @param selectedVolumes - Selected volume IDs
 * @param selectedChapters - Selected chapter data
 * @param chapterMetadataCache - Cached chapter metadata
 * @returns Filtered and enriched volumes
 */
export function prepareVolumes(
  volumes: unknown[],
  selectedVolumes: (number | string)[],
  selectedChapters: unknown[],
  chapterMetadataCache: Map<string, unknown>
): unknown[] {
  return volumes
    .filter(volume => {
      if (!isRecord(volume)) return false;
      const volumeNumber = getUnknownProperty(volume, 'volumeNumber') ?? getUnknownProperty(volume, 'number');
      return isVolumeSelected(volumeNumber, selectedVolumes);
    })
    .map(volume => {
      if (!isRecord(volume)) return volume;
      const volumeNumber = getUnknownProperty(volume, 'volumeNumber') ?? getUnknownProperty(volume, 'number');
      const volumeChapters = getUnknownProperty(volume, 'chapters');
      const volumeChaptersArray = isArray(volumeChapters) ? volumeChapters : [];

      // Filter chapters based on selection
      const filteredChapters = volumeChaptersArray.filter((chapter: unknown) => {
        if (!isRecord(chapter)) return false;
        return isChapterSelected(chapter, selectedChapters, volumeNumber);
      });

      // Enrich chapters with cached metadata (using chapter-enricher module)
      const enrichedChapters = enrichChaptersWithMetadata(filteredChapters, chapterMetadataCache);

      // Extract enriched volume title from ComicVine format
      const rawTitle = getUnknownProperty(volume, 'title') ?? getUnknownProperty(volume, 'name') ?? getUnknownProperty(volume, 'volumeName') ?? getUnknownProperty(volume, 'volumeTitle');
      const fallbackTitle = rawTitle ?? `Volume ${volumeNumber}`;
      const volumeTitle = extractVolumeTitle(rawTitle, volumeNumber);

      // Ensure volume has all needed fields with proper fallbacks
      return {
        ...volume,
        // Preserve all title variations
        title: fallbackTitle,
        volumeTitle: volumeTitle ?? getUnknownProperty(volume, 'volumeTitle'),
        volumeNumber,
        number: volumeNumber,
        // Preserve cover and summary
        coverImageUrl: getUnknownProperty(volume, 'coverImageUrl') ?? getUnknownProperty(volume, 'coverUrl') ?? getUnknownProperty(volume, 'coverImage'),
        summary: getUnknownProperty(volume, 'summary') ?? getUnknownProperty(volume, 'description'),
        description: getUnknownProperty(volume, 'description') ?? getUnknownProperty(volume, 'summary'),
        // Include enriched chapters
        chapters: enrichedChapters,
        chapterCount: enrichedChapters.length,
        selected: true
      };
    });
}

/**
 * Process volumes and chapters by sorting them
 *
 * IMPORTANT: Creates new objects instead of mutating parameters
 * to fix ESLint no-param-reassign error.
 *
 * @param data - Data containing volumes
 * @returns Data with sorted volumes and chapters
 */
export function processVolumesAndChapters(data: unknown): unknown {
  if (!isRecord(data)) return data;

  const volumes = getUnknownProperty(data, 'volumes');
  if (!Array.isArray(volumes)) return data;

  // Sort volumes by number
  const sortedVolumes = (Array.isArray(volumes) ? [...volumes as unknown[]] : []).sort((a: unknown, b: unknown) => {
    if (!isRecord(a) || !isRecord(b)) return 0;
    const aNum = Number(getUnknownProperty(a, 'volumeNumber') ?? getUnknownProperty(a, 'number') ?? 0);
    const bNum = Number(getUnknownProperty(b, 'volumeNumber') ?? getUnknownProperty(b, 'number') ?? 0);
    return aNum - bNum;
  });

  // Sort chapters within each volume (create new objects to avoid mutation)
  const volumesWithSortedChapters = sortedVolumes.map((volume: unknown) => {
    if (!isRecord(volume)) return volume;
    const chapters = getUnknownProperty(volume, 'chapters');
    if (!Array.isArray(chapters)) return volume;

    const sortedChapters = (Array.isArray(chapters) ? [...chapters as unknown[]] : []).sort((a: unknown, b: unknown) => {
      if (!isRecord(a) || !isRecord(b)) return 0;
      const aNum = Number(getUnknownProperty(a, 'chapterNumber') ?? getUnknownProperty(a, 'number') ?? 0);
      const bNum = Number(getUnknownProperty(b, 'chapterNumber') ?? getUnknownProperty(b, 'number') ?? 0);
      return aNum - bNum;
    });

    // Return new object instead of mutating
    return {
      ...volume,
      chapters: sortedChapters
    };
  });

  // Return new data object
  return {
    ...data,
    volumes: volumesWithSortedChapters
  };
}
