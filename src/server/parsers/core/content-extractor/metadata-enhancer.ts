/**
 * Metadata Enhancer
 *
 * Enhances extracted data with metadata information.
 * Infers missing metadata from extracted volumes and chapters.
 *
 * Extracted from: ContentExtractor.ts (lines 449-485)
 * Date: 2025-11-21
 */

import type { ExtractedMetadata } from '@/server/parsers/extractors/metadata-extractor/types';

import type { VolumeData, ChapterData } from './types';

/**
 * Enhance volumes and chapters with metadata
 *
 * Adds missing metadata fields by inferring from volumes/chapters:
 * - Total volumes/chapters counts
 * - Status based on latest chapter release date
 *
 * @param volumes - Extracted volume data
 * @param chapters - Extracted chapter data
 * @param metadata - Base metadata to enhance
 * @returns Enhanced metadata with inferred values
 */
export function enhanceWithMetadata(
  volumes: VolumeData[],
  chapters: ChapterData[],
  metadata: ExtractedMetadata
): ExtractedMetadata {
  const enhanced = { ...metadata };

  // Add total counts to metadata if not present
  if (!enhanced.volumes && volumes.length > 0) {
    enhanced.volumes = Math.max(...volumes.map(v => v.volumeNumber));
  }

  if (!enhanced.chapters && chapters.length > 0) {
    const maxChapter = Math.max(...chapters.map(ch => parseFloat(ch.chapterNumber)));
    enhanced.chapters = Math.floor(maxChapter);
  }

  // Infer status from chapter dates
  if (!enhanced.status && chapters.length > 0) {
    const latestChapter = chapters[chapters.length - 1];
    if (latestChapter?.releaseDate) {
      const releaseDate = new Date(latestChapter.releaseDate);
      const monthsAgo = (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

      if (monthsAgo < 3) {
        enhanced.status = 'ONGOING';
      } else if (monthsAgo > 12) {
        enhanced.status = 'COMPLETED';
      }
    }
  }

  return enhanced;
}
