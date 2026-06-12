/**
 * Chapter & Volume Normalization
 *
 * Normalizes raw chapter/volume data from Wikipedia and Fandom into
 * standardized ChapterDataItem[] and VolumeDataItem[] arrays.
 * Includes quality filters: ISBN stripping, year contamination detection,
 * and gap-based truncation.
 */

import { parseChapterToken } from '@/server/parsers/chapter-number-extractor';
import type { WikipediaMangaData, WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';
import { logger } from '@/utils/logger';

import type { ChapterDataItem, VolumeDataItem } from '../types';

const log = logger.child('ChapterNormalization');

// ============================================================================
// Wikipedia Chapter Normalization
// ============================================================================

/**
 * Normalize Wikipedia chapters to ChapterDataItem[].
 * Filters out obviously bogus chapter numbers (ISBN fragments, year misparses).
 */
export function normalizeWikipediaChapters(data: WikipediaMangaData): ChapterDataItem[] {
  const items: ChapterDataItem[] = [];
  if (!data.chapterList) return items;

  const declaredCount = data.chapters ?? 0;
  const listLength = data.chapterList.length;
  const infoboxCredible = declaredCount > 0 && listLength <= declaredCount * 3;
  const maxReasonable = infoboxCredible
    ? Math.ceil(declaredCount * 2.5)
    : 0; // 0 = no cap (infobox missing or stale)

  for (const ch of data.chapterList) {
    const num = extractWikipediaChapterNumber(ch);
    if (num === null || num < 0) continue;
    if (num === 978 || num === 979) continue;
    if (maxReasonable > 0 && num > maxReasonable) continue;
    if (isLikelyYearContamination(num, declaredCount, data.chapterList)) continue;

    const item: ChapterDataItem = { number: num };
    if (ch.title) item.title = ch.title;
    if (ch.volumeNumber !== undefined) item.volume = ch.volumeNumber;
    if (ch.pages !== undefined) item.pages = ch.pages;
    if (ch.releaseDate) item.releaseDate = ch.releaseDate;
    items.push(item);
  }

  const sorted = items.sort((a, b) => a.number - b.number);
  const truncated = applyGapTruncation(sorted, declaredCount);

  // Enrich placeholder chapters with volume data (number, release date)
  enrichFromVolumeTable(truncated, data.volumeList);

  return truncated;
}

/** Assign volume numbers and release dates to chapters using volume table ranges */
function enrichFromVolumeTable(
  chapters: ChapterDataItem[],
  volumeList: WikipediaMangaData['volumeList'],
): void {
  if (!volumeList?.length || chapters.length === 0) return;

  // Build volume ranges: vol N covers chapters chStart..chEnd
  const volRanges: Array<{ vol: number; start: number; end: number; date: string | null }> = [];
  for (const v of volumeList) {
    const vol = v.number;
    const vUnknown: unknown = v;
    const vObj = vUnknown as { chapterStart?: number; chapterEnd?: number };
    const start = typeof vObj.chapterStart === 'number' ? vObj.chapterStart : undefined;
    const end = typeof vObj.chapterEnd === 'number' ? vObj.chapterEnd : undefined;
    const date = v.originalReleaseDate ?? null;
    if (vol > 0 && start !== undefined && end !== undefined) {
      volRanges.push({ vol, start, end, date });
    }
  }

  if (volRanges.length === 0) return;

  for (const ch of chapters) {
    if (ch.volume !== undefined && ch.releaseDate) continue; // already complete
    const matchingVol = volRanges.find(vr => ch.number >= vr.start && ch.number <= vr.end);
    if (!matchingVol) continue;
    ch.volume ??= matchingVol.vol;
    if (!ch.releaseDate && matchingVol.date) ch.releaseDate = matchingVol.date;
  }
}

/** Extract numeric chapter number from WikipediaChapter */
function extractWikipediaChapterNumber(ch: WikipediaChapter): number | null {
  if (typeof ch.number === 'number') return ch.number;
  if (typeof ch.number === 'string') {
    return parseChapterToken(ch.number);
  }
  return null;
}

/** Detect chapter numbers that are actually publication years (e.g., 2003, 2015).
 *  Only filters when:
 *  1. The number is in [1900, 2099] (plausible year range)
 *  2. The number is isolated (no adjacent chapters within ±5)
 *  3. The declared count is known and the number far exceeds it (>2x) */
function isLikelyYearContamination(
  num: number,
  declaredCount: number,
  chapterList: WikipediaChapter[],
): boolean {
  if (num < 1900 || num > 2099) return false;
  if (declaredCount > 0 && num <= declaredCount * 2) return false;
  const neighbors = chapterList.filter(ch => {
    const n = typeof ch.number === 'number' ? ch.number : parseFloat(String(ch.number));
    return !isNaN(n) && Math.abs(n - num) > 0 && Math.abs(n - num) <= 5;
  });
  return neighbors.length === 0;
}

/** Truncate at large gaps when pre-gap count matches declared count.
 *  Detects sequel/spinoff chapters mixed into the main series list. */
function applyGapTruncation(
  sorted: ChapterDataItem[],
  declaredCount: number,
): ChapterDataItem[] {
  if (sorted.length <= 1 || declaredCount <= 0) return sorted;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev || !curr) continue;
    const gap = curr.number - prev.number;
    if (gap > 20 && i >= declaredCount * 0.85 && i <= declaredCount * 1.15) {
      log.info(`[normalizeWikipedia] Gap truncation at chapter ${prev.number}: ${i} chapters kept (declared: ${declaredCount}, gap: ${gap})`);
      return sorted.slice(0, i);
    }
  }

  return sorted;
}

// ============================================================================
// Fandom Chapter Normalization
// ============================================================================

/**
 * Normalize Fandom chapter data from both flat chapterList and nested volumeList.
 */
export function normalizeFandomChapters(
  data: { chapterList?: Array<Record<string, unknown>>; volumeList?: Array<Record<string, unknown>> },
): ChapterDataItem[] {
  const byNumber = new Map<number, ChapterDataItem>();

  if (data.chapterList) {
    for (const ch of data.chapterList) {
      const item = normalizeSingleFandomChapter(ch);
      if (item) byNumber.set(item.number, item);
    }
  }

  // Build volume release date map for inheritance
  const volDateMap = new Map<number, string>();
  if (data.volumeList) {
    for (const vol of data.volumeList) {
      const vn = parseNum(vol['volumeNumber'] ?? vol['number']);
      const rd = asString(vol['releaseDate']);
      if (vn !== null && rd) volDateMap.set(vn, rd);
    }
    const nestedChapters = extractNestedVolumeChapters(data.volumeList);
    for (const item of nestedChapters) {
      if (!byNumber.has(item.number)) {
        byNumber.set(item.number, item);
      }
    }
  }

  // Inherit volume release dates for chapters that have a volume but no date
  if (volDateMap.size > 0) {
    for (const ch of byNumber.values()) {
      if (!ch.releaseDate && ch.volume !== undefined) {
        const volDate = volDateMap.get(ch.volume);
        if (volDate) ch.releaseDate = volDate;
      }
    }
  }

  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

/** Strip HTML tags from a string */
function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

/** Normalize a single chapter entry from the flat chapterList */
function normalizeSingleFandomChapter(ch: Record<string, unknown>): ChapterDataItem | null {
  const num = parseNum(ch['chapterNumber'] ?? ch['number']);
  if (num === null || num <= 0) return null;
  if (num === 978 || num === 979) return null;

  const item: ChapterDataItem = { number: num };
  const rawTitle = asString(ch['title']);
  const title = rawTitle ? stripHtmlTags(rawTitle) : undefined;
  if (title) item.title = title;
  const volume = parseNum(ch['volumeNumber'] ?? ch['volume']);
  if (volume !== null) item.volume = volume;
  const cover = asString(ch['coverImage'] ?? ch['coverUrl']);
  if (cover) item.cover = cover;
  const description = asString(ch['summary']);
  if (description) item.description = description;
  const pages = parseNum(ch['pages']);
  if (pages !== null) item.pages = pages;
  const releaseDate = asString(ch['releaseDate']);
  if (releaseDate) item.releaseDate = releaseDate;
  return item;
}

/** Extract and normalize chapters nested inside volumeList[].chapters */
function extractNestedVolumeChapters(
  volumeList: Array<Record<string, unknown>>,
): ChapterDataItem[] {
  const items: ChapterDataItem[] = [];

  for (const vol of volumeList) {
    const volNum = parseNum(vol['volumeNumber'] ?? vol['number']);
    const volReleaseDate = asString(vol['releaseDate']);
    const chapters = vol['chapters'];
    if (!Array.isArray(chapters)) continue;

    for (const ch of chapters as Array<Record<string, unknown>>) {
      const num = parseNum(ch['chapterNumber'] ?? ch['number']);
      if (num === null || num <= 0) continue;
      if (num === 978 || num === 979) continue;

      const item: ChapterDataItem = { number: num };
      const title = asString(ch['title']);
      if (title) item.title = title;
      if (volNum !== null) item.volume = volNum;
      const cover = asString(ch['coverImage']);
      if (cover) item.cover = cover;
      const description = asString(ch['summary']);
      if (description) item.description = description;
      const pages = parseNum(ch['pages']);
      if (pages !== null) item.pages = pages;
      // Chapter's own release date, or inherit from parent volume
      const releaseDate = asString(ch['releaseDate']) ?? volReleaseDate;
      if (releaseDate) item.releaseDate = releaseDate;
      items.push(item);
    }
  }

  return items;
}

// ============================================================================
// Fandom Volume Normalization
// ============================================================================

/**
 * Normalize Fandom volume data.
 * Derives chapterStart/chapterEnd from nested chapters or flat chapterList.
 */
// eslint-disable-next-line complexity -- sequential field assignments, not branching logic
export function normalizeFandomVolumes(
  data: { volumeList?: Array<Record<string, unknown>>; chapterList?: Array<Record<string, unknown>> },
): VolumeDataItem[] {
  if (!data.volumeList) return [];

  const flatRanges = buildFlatChapterRanges(data.chapterList);
  const items: VolumeDataItem[] = [];

  for (const vol of data.volumeList) {
    const num = parseNum(vol['volumeNumber'] ?? vol['number']);
    if (num === null) continue;
    const item: VolumeDataItem = { number: num };
    const title = asString(vol['title']);
    if (title) item.title = title;
    const description = asString(vol['description']);
    if (description) item.description = description;
    const coverImage = asString(vol['coverImage']);
    if (coverImage) item.coverImage = coverImage;
    const releaseDate = asString(vol['releaseDate']);
    if (releaseDate) item.releaseDate = releaseDate;
    const releaseDateEn = asString(vol['releaseDateEn']);
    if (releaseDateEn) item.releaseDateEn = releaseDateEn;
    const isbn = asString(vol['isbn']);
    if (isbn) item.isbn = isbn;
    const isbnEn = asString(vol['isbnEn']);
    if (isbnEn) item.isbnEn = isbnEn;
    const pageCount = parseNum(vol['pageCount']);
    if (pageCount !== null) item.pageCount = pageCount;

    const chapters = vol['chapters'];
    if (Array.isArray(chapters) && chapters.length > 0) {
      const chNums = (chapters as Array<Record<string, unknown>>)
        .map(ch => parseNum(ch['chapterNumber'] ?? ch['number']))
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b);
      const first = chNums[0];
      const last = chNums[chNums.length - 1];
      if (first !== undefined) item.chapterStart = first;
      if (last !== undefined) item.chapterEnd = last;
    }

    if (item.chapterStart === undefined || item.chapterEnd === undefined) {
      const flatRange = flatRanges.get(num);
      if (flatRange) {
        item.chapterStart ??= flatRange.start;
        item.chapterEnd ??= flatRange.end;
      }
    }

    items.push(item);
  }

  return items;
}

/** Build volume → {start, end} map from flat chapterList volume assignments */
function buildFlatChapterRanges(
  chapterList: Array<Record<string, unknown>> | undefined,
): Map<number, { start: number; end: number }> {
  const ranges = new Map<number, { start: number; end: number }>();
  if (!chapterList) return ranges;

  for (const ch of chapterList) {
    const volNum = parseNum(ch['volumeNumber'] ?? ch['volume']);
    const chNum = parseNum(ch['number'] ?? ch['chapterNumber']);
    if (volNum === null || chNum === null || volNum <= 0 || chNum <= 0) continue;

    const existing = ranges.get(volNum);
    if (!existing) {
      ranges.set(volNum, { start: chNum, end: chNum });
    } else {
      existing.start = Math.min(existing.start, chNum);
      existing.end = Math.max(existing.end, chNum);
    }
  }

  return ranges;
}

// ============================================================================
// Shared Utilities
// ============================================================================

export function parseNum(value: unknown): number | null {
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  return null;
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
