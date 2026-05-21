/**
 * Table Row Processors - Extract volume/chapter info from table rows.
 * Uses early returns to stay under max-depth of 4.
 */

import type { VolumeInfo, ChapterInfo } from './types';

const VOLUME_PATTERNS = [/Volume\s+(\d+\.?\d*)/i, /Vol\.?\s*(\d+)/i, /Tome\s+(\d+)/i, /第(\d+)巻/];
const CHAPTER_PATTERNS = [/Chapter\s+(\d+\.?\d*)/i, /Ch\.?\s*(\d+)/i, /Episode\s+(\d+)/i, /第(\d+)話/];
const ISBN_PATTERNS = [/ISBN[\s:]*([0-9]{10,13})/i, /ISBN[\s:]*([0-9-]+)/i];
const DATE_PATTERNS = [
  /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
  /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/,
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
];

function matchPattern(text: string, patterns: RegExp[], transform?: (s: string) => string): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return transform ? transform(match[1]) : match[1];
  }
  return null;
}

function matchVolume(text: string): number | null {
  const result = matchPattern(text, VOLUME_PATTERNS);
  return result ? parseInt(result, 10) : null;
}

function matchChapter(text: string): string | null {
  return matchPattern(text, CHAPTER_PATTERNS);
}

function matchISBN(text: string): string | null {
  return matchPattern(text, ISBN_PATTERNS, s => s.replace(/-/g, ''));
}

function matchDate(text: string): string | null {
  return matchPattern(text, DATE_PATTERNS);
}

export interface RowIndices {
  volume: number;
  chapter: number;
  title: number;
  isbn: number;
  date: number;
}

export function processVolumeRow(cells: string[], indices: RowIndices): VolumeInfo | null {
  if (indices.volume < 0) return null;
  const volumeCell = cells[indices.volume];
  if (!volumeCell) return null;

  const volumeNum = matchVolume(volumeCell);
  if (volumeNum === null) return null;

  const volume: VolumeInfo = { volumeNumber: volumeNum, chapters: [] };

  if (indices.title >= 0) {
    const titleValue = cells[indices.title];
    if (titleValue) volume.title = titleValue;
  }
  if (indices.isbn >= 0) {
    const isbnCell = cells[indices.isbn];
    if (isbnCell) {
      const isbn = matchISBN(isbnCell);
      if (isbn) volume.isbn = isbn;
    }
  }
  if (indices.date >= 0) {
    const dateCell = cells[indices.date];
    if (dateCell) {
      const releaseDate = matchDate(dateCell);
      if (releaseDate) volume.releaseDate = releaseDate;
    }
  }

  return volume;
}

export function processChapterRow(cells: string[], indices: RowIndices): ChapterInfo | null {
  if (indices.chapter < 0) return null;
  const chapterCell = cells[indices.chapter];
  if (!chapterCell) return null;

  const chapterNum = matchChapter(chapterCell);
  if (chapterNum === null) return null;

  const chapter: ChapterInfo = { chapterNumber: chapterNum };

  if (indices.title >= 0) {
    const titleValue = cells[indices.title];
    if (titleValue) chapter.title = titleValue;
  }
  if (indices.volume >= 0) {
    const volumeCell = cells[indices.volume];
    if (volumeCell) {
      const volumeNum = matchVolume(volumeCell);
      if (volumeNum !== null) chapter.volumeNumber = volumeNum;
    }
  }
  if (indices.date >= 0) {
    const dateCell = cells[indices.date];
    if (dateCell) {
      const releaseDate = matchDate(dateCell);
      if (releaseDate) chapter.releaseDate = releaseDate;
    }
  }

  return chapter;
}

export function findColumnIndices(headers: string[]): RowIndices {
  return {
    volume: headers.findIndex(h => /volume|vol/i.test(h)),
    chapter: headers.findIndex(h => /chapter|ch\./i.test(h)),
    title: headers.findIndex(h => /title|name/i.test(h)),
    isbn: headers.findIndex(h => /isbn/i.test(h)),
    date: headers.findIndex(h => /date|release/i.test(h))
  };
}
