/**
 * useReleaseDateMerger Hook
 *
 * Merges release dates from database chapters into enriched volume data structures.
 * Creates an immutable copy of the volume data with updated release dates.
 *
 * This hook ensures that fresh release dates from metadata refreshes are displayed
 * in the chapter list UI without mutating the original data structures.
 *
 * Extracted from: ResponsiveChapterList.tsx (lines 156-185)
 * Created: 2025-11-17
 * Agent: 6 (Hooks Extraction Phase)
 */

import { useMemo } from 'react';

import type { EnrichedVolume } from '@/components/manga/ResponsiveChapterList/types';
import { logger } from '@/utils/logger';

import type { Chapter } from '@prisma/client';


// ============================================================================
// Hook Definition
// ============================================================================

/**
 * Merges release dates from database chapters into enriched volume data
 *
 * Creates a deep copy of the volume data structure and merges release dates
 * from the database chapters array. Matches chapters by index field (most
 * reliable identifier across providers).
 *
 * **Immutability Guarantee**: Original parameters are never mutated. All
 * modifications are performed on deep copies using map() and spread operators.
 *
 * **Performance**: Uses useMemo to cache results when dependencies don't change.
 * Only recomputes when enrichedVolumeData or chapters array references change.
 *
 * @param enrichedVolumeData - Volume data from provider metadata (nullable)
 * @param chapters - Database chapters with release dates (optional)
 * @returns Immutable copy of volume data with merged release dates, or null
 *
 * @example
 * ```tsx
 * const volumesWithDates = useReleaseDateMerger(
 *   enrichedVolumeData,
 *   manga.Chapter
 * );
 * ```
 */
export function useReleaseDateMerger(
  enrichedVolumeData: EnrichedVolume[] | null,
  chapters: Chapter[] | undefined
): EnrichedVolume[] | null {
  return useMemo(() => {
    // Guard: No volume data to merge into
    if (!enrichedVolumeData) {
      return null;
    }

    // Guard: No chapters to extract release dates from
    if (!chapters || chapters.length === 0) {
      return enrichedVolumeData;
    }

    try {
      // STEP 1: Build chapter index -> releaseDate lookup map
      // Use Map for O(1) lookup performance with type-safe keys
      const releaseDateMap = new Map<number, Date>();

      chapters.forEach((chapter) => {
        // Only add entries with valid index and releaseDate
        if (typeof chapter.index === 'number' && chapter.releaseDate !== null) {
          releaseDateMap.set(chapter.index, chapter.releaseDate);
        }
      });

      // STEP 2: Create immutable copy of volume data with merged dates
      // Use map() to create new arrays/objects at every level (deep copy)
      const updatedVolumes = enrichedVolumeData.map((volume) => {
        // Handle Chapter array: only process if it exists
        const updatedChapters = volume.Chapter?.map((chapter) => {
          // Match chapters by index field (most reliable identifier)
          if (chapter.index !== undefined && releaseDateMap.has(chapter.index)) {
            const releaseDate = releaseDateMap.get(chapter.index);
            // Only merge if releaseDate exists (type guard for Map.get())
            if (releaseDate !== undefined) {
              return {
                ...chapter, // Shallow copy chapter properties
                releaseDate, // Override/add releaseDate
              };
            }
          }
          // No match or no releaseDate → return original chapter
          return chapter;
        });

        // Return volume with updated chapters (preserve undefined if no chapters)
        return updatedChapters !== undefined
          ? { ...volume, Chapter: updatedChapters }
          : volume;
      });

      return updatedVolumes;
    } catch (error) {
      // Log errors but don't crash the component
      logger.error('[useReleaseDateMerger] Error merging release dates:', error);

      // Fallback: Return original data on error
      return enrichedVolumeData;
    }
  }, [enrichedVolumeData, chapters]);
}
