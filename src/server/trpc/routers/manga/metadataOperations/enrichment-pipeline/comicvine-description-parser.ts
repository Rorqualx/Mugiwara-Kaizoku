/**
 * ComicVine Volume Description Parser
 *
 * Extracts individual chapter titles from ComicVine volume descriptions.
 * Volume descriptions often contain chapter lists like:
 *   "Chapter Titles\n1.Death＆Strawberry\n2.Starter\n3.Headhittin'"
 *
 * Reuses patterns from @/server/services/comicvine/constants.ts and
 * parsing logic from @/utils/comicvine-chapter-parser.ts.
 */

import { CHAPTER_RANGE_PATTERN } from '@/server/services/comicvine/constants';
import { parseChaptersFromDescription } from '@/utils/comicvine-chapter-parser';
import { logger } from '@/utils/logger';

import type { ChapterDataItem } from './types';

const log = logger.child('ComicVineDescriptionParser');

/** Intermediate result from parsing a single volume's description */
interface VolumeParseResult {
  volumeNumber: number;
  descriptionText: string;
  parsedChapterCount: number;
  chapters: ChapterDataItem[];
}

/**
 * Parse ComicVine volume descriptions to extract individual chapter titles.
 *
 * The enrichmentResult from oneClickEnrich stores volumes with description
 * fields that often contain structured chapter lists. This parser extracts
 * those into normalized ChapterDataItem arrays.
 *
 * @param enrichedData - The enrichedData from EnrichmentResult (enrichmentResult.enrichedData)
 * @returns Parsed chapters and raw volume description metadata
 */
export function parseComicVineDescriptions(enrichedData: unknown): {
  chapters: ChapterDataItem[];
  volumeDescriptions: VolumeParseResult[];
} {
  const result: { chapters: ChapterDataItem[]; volumeDescriptions: VolumeParseResult[] } = {
    chapters: [],
    volumeDescriptions: [],
  };

  const volumes = extractVolumesFromEnrichedData(enrichedData);
  if (volumes.length === 0) return result;

  log.info(`Parsing ${volumes.length} ComicVine volume descriptions for chapters`);

  // Track global chapter numbering offset for volumes that parse title-only chapters
  let globalChapterOffset = 0;

  for (const vol of volumes) {
    const volNum = parseVolumeNumber(vol);
    if (volNum === null) continue;

    const description = extractDescription(vol);
    if (!description) continue;

    // First check for chapter range patterns like "Chapter 24 - 46" or "Contains Chapter 1 - 23"
    const rangeChapters = tryExpandChapterRange(description, volNum);

    // Fall back to individual chapter parsing if no range found
    const parsed = rangeChapters.length > 0 ? [] : parseChaptersFromDescription(description);

    const volumeResult: VolumeParseResult = {
      volumeNumber: volNum,
      descriptionText: description,
      parsedChapterCount: rangeChapters.length > 0 ? rangeChapters.length : parsed.length,
      chapters: [],
    };

    // Use range-expanded chapters if available
    if (rangeChapters.length > 0) {
      for (const item of rangeChapters) {
        volumeResult.chapters.push(item);
        result.chapters.push(item);
      }
    } else {
      for (const ch of parsed) {
        const chapterNumber = ch.chapterNumber > 0 ? ch.chapterNumber : globalChapterOffset + ch.chapterNumber;
        const item: ChapterDataItem = {
          number: chapterNumber,
          title: ch.title,
          volume: volNum,
        };
        volumeResult.chapters.push(item);
        result.chapters.push(item);
      }
    }

    // Update offset based on the highest chapter number seen in this volume
    const allChNums = volumeResult.chapters.map(c => c.number);
    if (allChNums.length > 0) {
      const maxChNum = Math.max(...allChNums);
      if (maxChNum > globalChapterOffset) {
        globalChapterOffset = maxChNum;
      }
    }

    result.volumeDescriptions.push(volumeResult);
  }

  // Deduplicate by chapter number (keep entry with title)
  const deduped = deduplicateByChapterNumber(result.chapters);
  result.chapters = deduped;

  log.info(`Parsed ${result.chapters.length} chapters from ${result.volumeDescriptions.length} volume descriptions`);

  return result;
}

/**
 * Extract volumes array from the enrichedData structure.
 * Handles the nested manga.volumes path from EnrichmentResult.enrichedData.
 */
function extractVolumesFromEnrichedData(enrichedData: unknown): Array<Record<string, unknown>> {
  if (!enrichedData || typeof enrichedData !== 'object') return [];

  const data = enrichedData as Record<string, unknown>;

  // Path: enrichedData.manga.volumes
  const manga = data['manga'];
  if (!manga || typeof manga !== 'object') return [];

  const mangaObj = manga as Record<string, unknown>;
  const volumes = mangaObj['volumes'];
  if (!Array.isArray(volumes)) return [];

  return volumes.filter(
    (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
  );
}

/** Parse a volume number from various field names */
function parseVolumeNumber(vol: Record<string, unknown>): number | null {
  const raw = vol['volumeNumber'] ?? vol['number'];
  if (typeof raw === 'number') return raw > 0 ? raw : null;
  if (typeof raw === 'string') {
    const num = parseInt(raw, 10);
    return !isNaN(num) && num > 0 ? num : null;
  }
  return null;
}

/** Extract description text from a volume object */
function extractDescription(vol: Record<string, unknown>): string | null {
  const desc = vol['description'];
  if (typeof desc === 'string' && desc.length > 0) return desc;
  return null;
}

/**
 * Try to expand a chapter range like "Chapter 24 - 46" into individual chapter entries.
 * Returns empty array if no range pattern found.
 */
function tryExpandChapterRange(description: string, volumeNumber: number): ChapterDataItem[] {
  // Split on paragraph boundaries BEFORE stripping HTML, then clean
  const lines = description
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  for (const line of lines) {
    const match = CHAPTER_RANGE_PATTERN.exec(line);
    if (!match?.[1] || !match[2]) {
      // Debug: log lines that contain "chapter" but didn't match range pattern
      if (/chapter/i.test(line)) {
        log.debug(`Range pattern miss on line: "${line.slice(0, 100)}"`);
      }
      continue;
    }

    const start = parseFloat(match[1]);
    const end = parseFloat(match[2]);

    if (isNaN(start) || isNaN(end) || start >= end || end - start > 500) continue;

    log.debug(`Expanded chapter range ${start}-${end} for volume ${volumeNumber}`);

    const chapters: ChapterDataItem[] = [];
    // Expand integer range; skip if either endpoint is decimal — those need
    // per-chapter handling rather than integer iteration.
    const startInt = Math.floor(start);
    const endInt = Math.floor(end);
    for (let i = startInt; i <= endInt; i++) {
      chapters.push({ number: i, volume: volumeNumber });
    }
    return chapters;
  }

  return [];
}

/** Deduplicate chapters by number, keeping the entry with a title */
function deduplicateByChapterNumber(chapters: ChapterDataItem[]): ChapterDataItem[] {
  const seen = new Map<number, ChapterDataItem>();
  for (const ch of chapters) {
    const existing = seen.get(ch.number);
    if (!existing) {
      seen.set(ch.number, ch);
    } else if (!existing.title && ch.title) {
      seen.set(ch.number, ch);
    }
  }
  return [...seen.values()].sort((a, b) => a.number - b.number);
}
