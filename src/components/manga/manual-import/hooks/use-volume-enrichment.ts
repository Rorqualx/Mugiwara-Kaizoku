/**
 * useVolumeEnrichment Hook
 *
 * Enriches chapter data with volume information from manga metadata.
 * Uses gap-filling algorithm to estimate missing volume data.
 *
 * @module components/manga/manual-import/hooks/use-volume-enrichment
 */

import { useMemo } from 'react';

import { logger } from '@/utils/logger';

import type { Chapter } from '../types';

/**
 * Extracts volume data from provider metadata (ComicVine or Fandom)
 *
 * @param providerMetadata - Provider metadata object
 * @returns Array of volume data objects
 */
function extractVolumeData(providerMetadata: Record<string, unknown>): unknown[] {
  const comicvineData = providerMetadata['comicvine'];
  const fandomData = providerMetadata['fandom'];

  let volumeData: unknown[] = [];

  if (comicvineData && typeof comicvineData === 'object') {
    const cv = comicvineData as Record<string, unknown>;
    const cvData = cv['volumeData'] ?? cv['volumes'];
    volumeData = (Array.isArray(cvData) ? cvData : []) as unknown[];
  }

  if (volumeData.length === 0 && fandomData && typeof fandomData === 'object') {
    const fd = fandomData as Record<string, unknown>;
    const fdData = fd['volumeData'] ?? fd['volumes'];
    volumeData = (Array.isArray(fdData) ? fdData : []) as unknown[];
  }

  return volumeData;
}

/**
 * Builds a map of chapter IDs to volume numbers from volume data
 *
 * @param volumeData - Array of volume data objects
 * @param rawChapters - Original chapter array to match against
 * @returns Map of chapter ID to volume number
 */
function buildChapterVolumeMap(
  volumeData: unknown[],
  rawChapters: Chapter[]
): Map<number, number> {
  const chapterVolumeMap = new Map<number, number>();

  for (const vol of volumeData) {
    if (!vol || typeof vol !== 'object') continue;

    const volume = vol as Record<string, unknown>;
    const volumeNumber = volume['volumeNumber'] ?? volume['volume'] ?? volume['number'];
    const chaptersList = volume['chapters'];

    if (typeof volumeNumber !== 'number' || !Array.isArray(chaptersList)) continue;

    for (const ch of chaptersList) {
      if (!ch || typeof ch !== 'object') continue;

      const chapter = ch as Record<string, unknown>;
      const chNumRaw = chapter['number'];

      // Parse chapter number (metadata stores as string)
      let chNum: number | null = null;
      if (typeof chNumRaw === 'string') {
        const parsed = parseFloat(chNumRaw);
        if (!isNaN(parsed)) {
          chNum = parsed;
        }
      } else if (typeof chNumRaw === 'number') {
        chNum = chNumRaw;
      }

      // Match metadata chapter number to database chapter's chapterNumber
      if (chNum !== null) {
        const matchingChapter = rawChapters.find(dbCh => dbCh.chapterNumber === chNum);
        if (matchingChapter) {
          chapterVolumeMap.set(matchingChapter.id, volumeNumber);
        }
      }
    }
  }

  return chapterVolumeMap;
}

/**
 * Fills volume gaps using intelligent estimation based on neighboring chapters
 *
 * @param sortedChapters - Chapters sorted by chapter number
 * @param chapterVolumeMap - Map to update with estimated volumes
 */
function fillVolumeGaps(
  sortedChapters: Chapter[],
  chapterVolumeMap: Map<number, number>
): void {
  for (let i = 0; i < sortedChapters.length; i++) {
    const chapter = sortedChapters[i];
    if (chapter && chapter.volume === undefined) {
      // Find nearest chapter before with a volume
      let prevVolume: number | undefined;
      for (let j = i - 1; j >= 0; j--) {
        const prev = sortedChapters[j];
        if (prev?.volume !== undefined) {
          prevVolume = prev.volume;
          break;
        }
      }

      // Find nearest chapter after with a volume
      let nextVolume: number | undefined;
      for (let j = i + 1; j < sortedChapters.length; j++) {
        const next = sortedChapters[j];
        if (next?.volume !== undefined) {
          nextVolume = next.volume;
          break;
        }
      }

      // Assign volume based on neighbors
      let estimatedVolume: number | undefined;

      if (prevVolume !== undefined && nextVolume !== undefined) {
        if (prevVolume === nextVolume) {
          // Surrounded by same volume -> use that volume
          estimatedVolume = prevVolume;
        } else {
          // At volume boundary -> prefer next volume (chapters typically belong to the volume they lead into)
          estimatedVolume = nextVolume;
        }
      } else if (prevVolume !== undefined && nextVolume === undefined) {
        // At the end, only have previous volume -> use it
        estimatedVolume = prevVolume;
      } else if (prevVolume === undefined && nextVolume !== undefined) {
        // At the beginning, only have next volume -> use it
        estimatedVolume = nextVolume;
      }

      if (estimatedVolume !== undefined) {
        chapter.volume = estimatedVolume;
        chapterVolumeMap.set(chapter.id, estimatedVolume);
      }
    }
  }
}

/**
 * Enriches chapters with volume data from manga metadata
 *
 * This hook processes manga provider metadata to extract volume information
 * and assigns it to chapters. It also fills in volume gaps using intelligent
 * estimation based on neighboring chapters.
 *
 * @param rawChapters - Original chapter array from database
 * @param mangaData - Manga metadata containing provider data
 * @returns Chapters enriched with volume numbers
 */
export function useVolumeEnrichment(
  rawChapters: Chapter[],
  mangaData: unknown
): Chapter[] {
  return useMemo(() => {
    if (!mangaData || typeof mangaData !== 'object') return rawChapters;

    try {
      const manga = mangaData as Record<string, unknown>;
      const providerMetadata = manga['providerMetadata'];

      if (!providerMetadata || typeof providerMetadata !== 'object') return rawChapters;

      const metadata = providerMetadata as Record<string, unknown>;
      const volumeData = extractVolumeData(metadata);

      if (volumeData.length === 0) return rawChapters;

      // Build chapter ID -> volume number map
      const chapterVolumeMap = buildChapterVolumeMap(volumeData, rawChapters);

      // Enrich chapters with volume data
      let enrichedChapters = rawChapters.map(ch => {
        const volumeFromMap = chapterVolumeMap.get(ch.id);
        if (volumeFromMap) {
          return { ...ch, volume: volumeFromMap };
        }
        return ch;
      });

      // Fill volume gaps with intelligent estimation
      // Sort chapters by chapter number for sequential analysis
      const sortedChapters = [...enrichedChapters].sort((a, b) => {
        const aNum = a.chapterNumber ?? a.index;
        const bNum = b.chapterNumber ?? b.index;
        return aNum - bNum;
      });

      fillVolumeGaps(sortedChapters, chapterVolumeMap);

      // Update enrichedChapters with gap-filled data
      enrichedChapters = enrichedChapters.map(ch => {
        const volumeFromMap = chapterVolumeMap.get(ch.id);
        if (volumeFromMap !== undefined) {
          return { ...ch, volume: volumeFromMap };
        }
        return ch;
      });

      return enrichedChapters;
    } catch (error) {
      logger.error('[ManualImport] Error extracting volume data:', error);
      return rawChapters;
    }
  }, [rawChapters, mangaData]);
}
