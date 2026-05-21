/**
 * Table Data Processor
 *
 * Processes table data into volumes and chapters with reduced complexity.
 * Split from monolithic processTableData to meet ESLint complexity limits.
 *
 * Original complexity: 22 (exceeded max 20)
 * New complexity: Each function ≤ 10, main orchestrator ≤ 8
 *
 * Extracted from: ContentExtractor.ts (lines 317-387)
 * Date: 2025-11-21
 */

import type { TableData } from '@/server/parsers/extractors/table-extractor/types';

import type { VolumeData, ChapterData } from './types';

/**
 * Process volume tables from extracted table data
 * Extracts volumes with their associated chapters from table data
 *
 * @param tables - Array of table data to process
 * @returns Array of extracted volume data
 */
function processVolumeTables(tables: TableData[]): VolumeData[] {
  const volumes: VolumeData[] = [];

  for (const table of tables) {
    if (table.volumes) {
      for (const vol of table.volumes) {
        const volume: VolumeData = {
          volumeNumber: vol.volumeNumber,
          ...(vol.title && { title: vol.title }),
          ...(vol.coverImage && { coverImage: vol.coverImage }),
          ...(vol.isbn && { isbn: vol.isbn }),
          ...(vol.releaseDate && { releaseDate: vol.releaseDate }),
          chapters: vol.chapters.map((ch): ChapterData => ({
            chapterNumber: ch.chapterNumber,
            ...(ch.title && { title: ch.title }),
            volumeNumber: vol.volumeNumber,
            ...(ch.releaseDate && { releaseDate: ch.releaseDate }),
            ...(ch.url && { url: ch.url }),
            source: 'table' as const
          })),
          source: table.type === 'gallery' ? 'gallery' : 'table'
        };
        volumes.push(volume);
      }
    }
  }

  return volumes;
}

/**
 * Process chapter tables from extracted table data
 * Extracts standalone chapters from table data
 *
 * @param tables - Array of table data to process
 * @returns Array of extracted chapter data
 */
function processChapterTables(tables: TableData[]): ChapterData[] {
  const chapters: ChapterData[] = [];

  for (const table of tables) {
    if (table.chapters) {
      for (const ch of table.chapters) {
        chapters.push({
          chapterNumber: ch.chapterNumber,
          ...(ch.title && { title: ch.title }),
          ...(ch.volumeNumber && { volumeNumber: ch.volumeNumber }),
          ...(ch.releaseDate && { releaseDate: ch.releaseDate }),
          ...(ch.url && { url: ch.url }),
          source: 'table'
        });
      }
    }
  }

  return chapters;
}

/**
 * Process story arcs from table data
 * Extracts chapters from story arc tables
 *
 * @param tables - Array of table data to process
 * @returns Array of chapter data extracted from story arcs
 */
function processStoryArcs(tables: TableData[]): ChapterData[] {
  const chapters: ChapterData[] = [];

  for (const table of tables) {
    if (table.arcs) {
      for (const arc of table.arcs) {
        for (const ch of arc.chapters) {
          const chapterTitle = ch.title ?? `${arc.name} - Chapter ${ch.chapterNumber}`;
          chapters.push({
            chapterNumber: ch.chapterNumber,
            title: chapterTitle,
            ...(ch.volumeNumber && { volumeNumber: ch.volumeNumber }),
            ...(ch.releaseDate && { releaseDate: ch.releaseDate }),
            ...(ch.url && { url: ch.url }),
            source: 'table'
          });
        }
      }
    }
  }

  return chapters;
}

/**
 * Process table data into volumes and chapters
 * Main orchestrator with reduced complexity
 *
 * Delegates to specialized functions for each table type:
 * - processVolumeTables: Extracts volumes with chapters
 * - processChapterTables: Extracts standalone chapters
 * - processStoryArcs: Extracts chapters from story arcs
 *
 * @param tables - Array of table data to process
 * @returns Object containing extracted volumes and chapters
 */
export function processTableData(tables: TableData[]): {
  volumes: VolumeData[];
  chapters: ChapterData[];
} {
  // Extract data from different table types
  const volumes = processVolumeTables(tables);
  const chaptersFromTables = processChapterTables(tables);
  const chaptersFromArcs = processStoryArcs(tables);

  // Combine all chapters
  const allChapters = [...chaptersFromTables, ...chaptersFromArcs];

  return { volumes, chapters: allChapters };
}
