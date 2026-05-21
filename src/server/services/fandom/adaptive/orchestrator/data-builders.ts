/**
 * Data Builders for Adaptive Parser
 *
 * Functions to build FandomMangaData entries from parsed volume/chapter data.
 *
 * @module orchestrator/data-builders
 */

import type { FandomMangaData } from '@/server/services/fandom/types';
import type { ChapterData, VolumeData } from '@/server/services/metadata/utils/fandom-table-parser/fandom-types';
import { logger } from '@/utils/logger';


import { extractChaptersFromNumberedListItems } from '../bulleted-list-parser';

import type { AdaptiveParseResult, FetchedMetadata } from '../types';

/** Standard parsed data format */
export interface StandardParsedData {
  volumes: VolumeData[];
  chapters: ChapterData[];
}

/**
 * Builds a volume entry for FandomMangaData.
 * @param titleMap - Optional map of chapter number to title for enriching chapters
 */
export function buildVolumeEntry(
  v: VolumeData,
  titleMap?: Map<number, string>
): NonNullable<FandomMangaData['volumeList']>[number] {
  const entry: NonNullable<FandomMangaData['volumeList']>[number] = {
    volumeNumber: v.number,
    number: v.number,
  };

  if (v.title) entry.title = v.title;
  if (v.coverImage) entry.coverImage = v.coverImage;
  if (v.releaseDate) entry.releaseDate = v.releaseDate;
  if (v.releaseDateEn) entry.releaseDateEn = v.releaseDateEn;
  if (v.isbn) entry.isbn = v.isbn;
  if (v.isbnEn) entry.isbnEn = v.isbnEn;
  if (v.description) entry.description = v.description;
  if (v.pageCount !== undefined) {
    entry.pageCount = v.pageCount;
  }

  // Include chapters if present, enriching with titles from titleMap
  if (v.chapters?.length) {
    entry.chapters = v.chapters.map((ch) => {
      // Type guard for chapter-like objects
      const chObj = ch as { number?: number; title?: string; url?: string; coverImage?: string; summary?: string; releaseDate?: string; pages?: number };
      const chNum = chObj.number;

      const chapterEntry: NonNullable<typeof entry.chapters>[number] = {
        chapterNumber: String(chNum ?? ''),
      };
      if (chNum !== undefined) {
        chapterEntry.number = chNum;
      }

      // Use title from titleMap if chapter title is missing or just a number
      let title = chObj.title;
      if (titleMap && (!isRealTitle(title)) && chNum !== undefined) {
        const mappedTitle = titleMap.get(chNum);
        if (mappedTitle) title = mappedTitle;
      }
      if (title) chapterEntry.title = title;

      if (chObj.url) chapterEntry.url = chObj.url;
      if (chObj.coverImage) chapterEntry.coverImage = chObj.coverImage;
      if (chObj.summary) chapterEntry.summary = chObj.summary;
      if (chObj.releaseDate) chapterEntry.releaseDate = chObj.releaseDate;
      if (chObj.pages) chapterEntry.pages = chObj.pages;
      return chapterEntry;
    });
    entry.chapterCount = entry.chapters.length;
  }

  return entry;
}

/**
 * Builds a chapter entry for FandomMangaData.
 */
export function buildChapterEntry(ch: ChapterData): NonNullable<FandomMangaData['chapterList']>[number] {
  const entry: NonNullable<FandomMangaData['chapterList']>[number] = {
    chapterNumber: String(ch.number),
    number: ch.number,
  };

  if (ch.title) entry.title = ch.title;
  if (ch.url) entry.url = ch.url;
  if (ch.coverImage) entry.coverImage = ch.coverImage;
  if (ch.summary) entry.summary = ch.summary;
  if (ch.releaseDate) entry.releaseDate = ch.releaseDate;
  if (ch.pageCount !== undefined) entry.pages = ch.pageCount;
  if (ch.volume !== undefined) {
    entry.volumeNumber = ch.volume;
    entry.volume = ch.volume;
  }

  return entry;
}

/** Chapter list entry type */
type ChapterListEntry = NonNullable<FandomMangaData['chapterList']>[number];

/** Cross-reference volume assignments from volume-embedded chapters to flat chapters.
 *  Flat chapters from parseChapterTables often lack volume data, while volumeChapters
 *  from extractChaptersFromVolumes always have correct volumeNumber from nested structure. */
function crossReferenceVolumeAssignments(
  flatChapters: ChapterListEntry[],
  volumeChapters: ChapterListEntry[],
): void {
  const volumeByChapter = new Map<number, number>();
  for (const vch of volumeChapters) {
    if (vch.number !== undefined && typeof vch.number === 'number' && vch.volumeNumber !== undefined) {
      volumeByChapter.set(vch.number, vch.volumeNumber);
    }
  }
  if (volumeByChapter.size === 0) return;

  let crossRefCount = 0;
  for (const ch of flatChapters) {
    if (ch.volumeNumber !== undefined || ch.number === undefined || typeof ch.number !== 'number') continue;
    const vol = volumeByChapter.get(ch.number);
    if (vol !== undefined) {
      ch.volumeNumber = vol;
      ch.volume = vol;
      crossRefCount++;
    }
  }
  logger.info(`[buildMangaData] Cross-referenced ${crossRefCount} volume assignments from nested to flat chapters (${volumeByChapter.size} available)`);
}

/** Type guard for chapter data from volumes. */
function isChapterLike(ch: unknown): ch is { number: number; title?: string; url?: string } {
  return typeof ch === 'object' && ch !== null && 'number' in ch && typeof (ch as { number: unknown }).number === 'number';
}

/**
 * Processes a single chapter from a volume into a chapter list entry.
 */
function processVolumeChapter(
  ch: { number: number; title?: string; url?: string },
  volNumber: number
): ChapterListEntry {
  const entry: ChapterListEntry = {
    chapterNumber: String(ch.number),
    number: ch.number,
    volumeNumber: volNumber,
    volume: volNumber,
  };
  if (ch.title) entry.title = ch.title;
  if (ch.url) entry.url = ch.url;
  return entry;
}

/**
 * Merges chapter data into existing entry if it has more info.
 * Returns a new entry with merged data.
 */
function mergeChapterEntry(existing: ChapterListEntry, ch: { title?: string; url?: string }): ChapterListEntry {
  const merged = { ...existing };
  if (!merged.title && ch.title) {
    merged.title = ch.title;
  }
  if (!merged.url && ch.url) {
    merged.url = ch.url;
  }
  return merged;
}

/**
 * Extracts chapters from volumes (nested structure) and converts to flat list.
 * Deduplicates by chapter number to handle wikis with Japanese/English tabs.
 */
export function extractChaptersFromVolumes(
  volumes: VolumeData[]
): NonNullable<FandomMangaData['chapterList']> {
  // Use a Map to deduplicate by chapter number
  const chapterMap = new Map<number, ChapterListEntry>();

  for (const vol of volumes) {
    if (!vol.chapters) continue;
    for (const ch of vol.chapters) {
      if (!isChapterLike(ch)) continue;

      const existing = chapterMap.get(ch.number);
      if (existing) {
        chapterMap.set(ch.number, mergeChapterEntry(existing, ch));
        continue;
      }

      chapterMap.set(ch.number, processVolumeChapter(ch, vol.number));
    }
  }

  const chapters = Array.from(chapterMap.values());
  logger.info(`[extractChaptersFromVolumes] Extracted ${chapters.length} unique chapters (deduplicated)`);
  return chapters;
}

/**
 * Checks if a title is a "real" title (not just a number or "Chapter N" placeholder).
 * Titles like "0", "123", "Chapter 1" are not considered real titles.
 */
function isRealTitle(title: string | undefined): boolean {
  if (!title || title.length === 0) return false;
  // Check if title is just a number (e.g., "0", "123")
  if (/^\d+$/.test(title)) return false;
  // Check if title is just "Chapter N" or "Ch. N" placeholder
  if (/^(Chapter|Ch\.?)\s*\d+$/i.test(title)) return false;
  // Must have at least some alphabetic characters to be a real title
  return /[a-zA-Z]/.test(title);
}

/**
 * Merges chapter titles from numbered list items into chapters that lack titles.
 * Handles wikis like Dandadan where table has chapter numbers but titles are in separate li elements.
 * Also handles Fire Force where chapters have title set to just the number (e.g., "0", "1").
 */
export function mergeChapterTitlesFromNumberedList(
  html: string,
  chapters: ChapterData[]
): ChapterData[] {
  // Log incoming chapters for debugging
  logger.info(`[mergeChapterTitles] Input: ${chapters.length} chapters`);
  if (chapters.length > 0) {
    const sampleTitles = chapters.slice(0, 3).map((ch) => ({ num: ch.number, title: ch.title }));
    logger.info(`[mergeChapterTitles] Sample input titles: ${JSON.stringify(sampleTitles)}`);
  }

  // Check if most chapters lack REAL titles (not just numbers or placeholders)
  const chaptersWithRealTitles = chapters.filter((ch) => isRealTitle(ch.title));
  const titleRatio = chaptersWithRealTitles.length / Math.max(chapters.length, 1);

  logger.info(`[mergeChapterTitles] Title ratio: ${titleRatio} (${chaptersWithRealTitles.length}/${chapters.length} have real titles)`);

  // If more than 30% have real titles, no need to merge
  if (titleRatio > 0.3) {
    logger.info(`[mergeChapterTitles] Skipping merge - ratio ${titleRatio} > 0.3`);
    return chapters;
  }

  // Try to extract titles from numbered list items
  const numberedListChapters = extractChaptersFromNumberedListItems(html);
  if (numberedListChapters.length === 0) {
    logger.info(`[mergeChapterTitles] No chapters found from numbered list extraction`);
    return chapters;
  }

  // Log extracted chapter titles
  const sampleExtracted = numberedListChapters.slice(0, 3).map((ch) => ({ num: ch.number, title: ch.title }));
  logger.info(`[mergeChapterTitles] Extracted ${numberedListChapters.length} titles, sample: ${JSON.stringify(sampleExtracted)}`);

  // If we have no input chapters, use the extracted chapters directly
  // This handles wikis like Fire Force List_of_Volumes where the flat chapter list
  // is empty but chapters are found in numbered list items
  if (chapters.length === 0) {
    logger.info(`[mergeChapterTitles] No input chapters, using ${numberedListChapters.length} extracted chapters directly`);
    return numberedListChapters;
  }

  // Build a map of chapter number -> title (only real titles)
  const titleMap = new Map<number, string>();
  for (const ch of numberedListChapters) {
    if (isRealTitle(ch.title)) {
      titleMap.set(ch.number, ch.title as string);
    }
  }
  logger.info(`[mergeChapterTitles] Title map size: ${titleMap.size}`);

  // Merge titles into existing chapters (replace non-real titles)
  let mergedCount = 0;
  const mergedChapters = chapters.map((ch) => {
    if (!isRealTitle(ch.title)) {
      const title = titleMap.get(ch.number);
      if (title) {
        mergedCount++;
        return { ...ch, title };
      }
    }
    return ch;
  });

  if (mergedCount > 0) {
    logger.info(`[mergeChapterTitles] Merged ${mergedCount} titles from numbered list items`);
    const sampleMerged = mergedChapters.slice(0, 3).map((ch) => ({ num: ch.number, title: ch.title }));
    logger.info(`[mergeChapterTitles] Sample merged titles: ${JSON.stringify(sampleMerged)}`);
  } else {
    logger.info(`[mergeChapterTitles] No titles merged`);
  }

  return mergedChapters;
}

/**
 * Converts parsed volumes/chapters to FandomMangaData format.
 */
export function buildMangaData(
  parsedData: StandardParsedData,
  url: string
): FandomMangaData {
  // Build a title map from flat chapters if they have real titles
  // This will be used to enrich volume-embedded chapters
  const titleMap = new Map<number, string>();
  for (const ch of parsedData.chapters) {
    if (isRealTitle(ch.title)) {
      titleMap.set(ch.number, ch.title as string);
    }
  }

  if (titleMap.size > 0) {
    logger.info(`[buildMangaData] Built title map with ${titleMap.size} titles from flat chapters`);
  }

  // Build volume list with chapters, enriching with titles from titleMap
  const volumeList = parsedData.volumes.map((v) => buildVolumeEntry(v, titleMap));

  // Get chapters from flat array OR extract from volumes (nested structure)
  const flatChapters = parsedData.chapters.map(buildChapterEntry);
  const volumeChapters = extractChaptersFromVolumes(parsedData.volumes);

  // Check if flat chapters have real titles (not just numbers or placeholders)
  const flatHasRealTitles = flatChapters.some((ch) => ch.title && !/^\d+$/.test(ch.title) && /[a-zA-Z]/.test(ch.title));
  const volumeHasRealTitles = volumeChapters.some((ch) => ch.title && !/^\d+$/.test(ch.title) && /[a-zA-Z]/.test(ch.title));

  logger.info(`[buildMangaData] Flat chapters: ${flatChapters.length}, hasRealTitles: ${flatHasRealTitles}`);
  logger.info(`[buildMangaData] Volume chapters: ${volumeChapters.length}, hasRealTitles: ${volumeHasRealTitles}`);

  // Use the chapterList with the most data/titles for backwards compatibility
  // (volumeList now has embedded chapters with enriched titles)
  let chapterList: NonNullable<FandomMangaData['chapterList']>;
  if (flatHasRealTitles && flatChapters.length > 0) {
    logger.info(`[buildMangaData] Using flat chapters (have real titles)`);
    crossReferenceVolumeAssignments(flatChapters, volumeChapters);
    chapterList = flatChapters;
  } else if (volumeChapters.length > flatChapters.length) {
    logger.info(`[buildMangaData] Using volume chapters (more chapters)`);
    chapterList = volumeChapters;
  } else {
    logger.info(`[buildMangaData] Using flat chapters (default)`);
    chapterList = flatChapters;
  }

  // Use the larger of flat chapterList or volume-embedded counts.
  // Flat chapters (from parseChapterTables/parseBulletedListStructure) may find more than
  // volume-embedded counts when not all chapters map to volume tables (Kuroko: 275 vs 99).
  const volumeChapterCount = volumeList.reduce((sum, v) => sum + (v.chapterCount ?? v.chapters?.length ?? 0), 0);
  const totalChapters = Math.max(chapterList.length, volumeChapterCount);

  return {
    title: '', // Will be filled by caller
    volumeList,
    chapterList,
    volumes: String(volumeList.length),
    chapters: String(totalChapters),
    totalChapters,
    stats: {
      totalVolumes: volumeList.length,
      totalChapters,
    },
    links: {
      volumesPage: url,
    },
    source: 'dynamic',
  };
}

/**
 * Merges fetched metadata into FandomMangaData.
 */
// eslint-disable-next-line complexity -- Metadata field merging with null-safe assignment across multiple optional fields
export function mergeMetadataIntoMangaData(
  mangaData: FandomMangaData,
  metadata: FetchedMetadata,
  mainPageUrl?: string
): FandomMangaData {
  const merged = { ...mangaData };

  // Set title from metadata (series title, not page title)
  if (metadata.title && !merged.title) {
    merged.title = metadata.title;
  }

  // Basic fields
  if (metadata.author) merged.author = metadata.author;
  if (metadata.publisher) merged.publisher = metadata.publisher;
  if (metadata.magazine) merged.magazine = metadata.magazine;
  if (metadata.synopsis) {
    merged.synopsis = metadata.synopsis;
    merged.description = metadata.synopsis;
  }
  if (metadata.genres) merged.genres = metadata.genres;
  if (metadata.demographic) merged.demographic = metadata.demographic;
  if (metadata.status) merged.status = metadata.status;
  if (metadata.startDate) merged.startDate = metadata.startDate;
  if (metadata.endDate) merged.endDate = metadata.endDate;
  if (metadata.coverImage) merged.coverImage = metadata.coverImage;
  if (metadata.alternativeTitles) merged.alternativeTitles = metadata.alternativeTitles;

  // Build metadata object
  merged.metadata = {
    ...(metadata.author ? { author: metadata.author } : {}),
    ...(metadata.artist ? { artist: metadata.artist } : {}),
    ...(metadata.publisher ? { publisher: metadata.publisher } : {}),
    ...(metadata.demographic ? { demographic: metadata.demographic } : {}),
    ...(metadata.genres ? { genres: metadata.genres } : {}),
    ...(metadata.status ? { status: metadata.status } : {}),
    ...(metadata.startDate ? { startDate: metadata.startDate } : {}),
    ...(metadata.endDate ? { endDate: metadata.endDate } : {}),
  };

  // Add main page link
  if (mainPageUrl && merged.links) {
    merged.links.mainPage = mainPageUrl;
  }

  return merged;
}

/**
 * Creates a failure result.
 */
export function createFailureResult(
  domain: string,
  url: string,
  startTime: number,
  error: string,
  usedCache = false
): AdaptiveParseResult {
  return {
    success: false,
    error,
    parsedUrl: url,
    domain,
    durationMs: Date.now() - startTime,
    usedCache,
    usedLegacyFallback: false,
    confidence: 0,
  };
}
