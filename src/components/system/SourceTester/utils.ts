/**
 * Utility functions for SourceTester component
 */
import type { MangaResult, ChapterResult } from './types';

/**
 * Interface for mangal JSON manga result
 */
export interface MangalJsonManga {
  id: string;
  name: string;
  url: string;
  status?: string;
  description?: string;
  coverUrl?: string;
  chapters?: MangalJsonChapter[];
}

/**
 * Interface for mangal JSON chapter
 */
export interface MangalJsonChapter {
  name: string;
  index: number;
  url: string;
  date: string;
}

/**
 * Type guard for MangalJsonManga
 */
export function isMangalJsonManga(value: unknown): value is MangalJsonManga {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['name'] === 'string' &&
    typeof obj['url'] === 'string'
  );
}

/**
 * Type guard for MangalJsonChapter
 */
export function isMangalJsonChapter(value: unknown): value is MangalJsonChapter {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['name'] === 'string' &&
    typeof obj['index'] === 'number' &&
    typeof obj['url'] === 'string' &&
    typeof obj['date'] === 'string'
  );
}

/**
 * Type guard for array of MangalJsonChapter
 */
export function isMangalJsonChapterArray(value: unknown): value is MangalJsonChapter[] {
  return Array.isArray(value) && value.every(isMangalJsonChapter);
}

/**
 * Parse chapter metadata from a single line
 */
/* eslint-disable no-param-reassign -- Helper function intentionally mutates output object */
function parseChapterMetadataLine(line: string, chapter: ChapterResult): void {
  if (line.startsWith('Number:')) {
    chapter.number = line.substring('Number:'.length).trim() || '0';
    return;
  }

  if (line.startsWith('Date:')) {
    const dateValue = line.substring('Date:'.length).trim();
    if (dateValue) chapter.date = dateValue;
    return;
  }

  if (line.startsWith('URL:')) {
    const urlValue = line.substring('URL:'.length).trim();
    if (urlValue) chapter.url = urlValue;
  }
}
/* eslint-enable no-param-reassign */

/**
 * Parse a single chapter block
 */
function parseChapterBlock(block: string): ChapterResult | null {
  const lines = block.split('\n');
  const titleMatch = lines[0]?.match(/\[\d+\] (.+)/);

  if (!titleMatch?.[1]) return null;

  const chapterTitle = titleMatch[1];
  const numberMatch = chapterTitle.match(/Chapter\s+(\d+)/i);

  const chapter: ChapterResult = {
    title: chapterTitle,
    number: numberMatch?.[1] ?? '0'
  };

  // Parse additional metadata
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    parseChapterMetadataLine(line, chapter);
  }

  return chapter;
}

/**
 * Parse chapters results from command output
 */
export function parseChaptersResults(output: string): ChapterResult[] {
  const chapters: ChapterResult[] = [];
  const chapterBlocks = output.split('\n\n');

  for (const block of chapterBlocks) {
    if (!block.trim()) continue;

    const chapter = parseChapterBlock(block);
    if (chapter) {
      chapters.push(chapter);
    }
  }

  return chapters;
}

/**
 * Parse manga metadata from a single line
 */
/* eslint-disable no-param-reassign -- Helper function intentionally mutates output object */
function parseMangaMetadataLine(line: string, manga: MangaResult, sourceName: string): void {
  if (line.startsWith('Source:')) {
    const sourceValue = line.substring('Source:'.length).trim();
    manga.source = sourceValue || sourceName;
    return;
  }

  if (line.startsWith('URL:')) {
    const urlValue = line.substring('URL:'.length).trim();
    if (urlValue) manga.url = urlValue;
    return;
  }

  if (line.startsWith('Status:')) {
    const status = line.substring('Status:'.length).trim();
    if (status) manga.status = status.charAt(0).toUpperCase() + status.slice(1);
    return;
  }

  if (line.startsWith('Description:')) {
    const descValue = line.substring('Description:'.length).trim();
    if (descValue) manga.description = descValue;
    return;
  }

  if (line.startsWith('Cover:')) {
    const coverValue = line.substring('Cover:'.length).trim();
    if (coverValue) manga.coverUrl = coverValue;
  }
}
/* eslint-enable no-param-reassign */

/**
 * Parse a single manga block
 */
function parseMangaBlock(block: string, sourceName: string): MangaResult | null {
  const lines = block.split('\n');
  const titleMatch = lines[0]?.match(/\[\d+\] (.+)/);

  if (!titleMatch?.[1]) return null;

  const title = titleMatch[1];
  const mangaId = `${sourceName}-${title.toLowerCase().replace(/\s+/g, '-')}`;

  const manga: MangaResult = {
    title: title,
    id: mangaId,
    source: sourceName
  };

  // Parse additional metadata
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    parseMangaMetadataLine(line, manga, sourceName);
  }

  if (!manga.coverUrl) {
    manga.coverUrl = '/cover-not-found.jpg';
  }

  return manga;
}

/**
 * Parse search results from command output
 */
export function parseSearchResults(output: string, sourceName: string): MangaResult[] {
  const results: MangaResult[] = [];
  const mangaBlocks = output.split('\n\n');

  for (const block of mangaBlocks) {
    if (!block.trim()) continue;

    const manga = parseMangaBlock(block, sourceName);
    if (manga) {
      results.push(manga);
    }
  }

  return results;
}

/**
 * Extract stdout/stderr from mangal command results
 */
export function extractCommandOutput(result: unknown): { stdout: string; stderr: string } {
  if (!result || typeof result !== 'object') {
    return { stdout: '', stderr: '' };
  }

  const resultObj = result as Record<string, unknown>;

  // For custom mangal output property
  if (typeof resultObj['mangalOutput'] === 'object' && resultObj['mangalOutput'] !== null) {
    return resultObj['mangalOutput'] as { stdout: string; stderr: string };
  }

  // For direct stdout/stderr properties (backward compatibility)
  return {
    stdout: typeof resultObj['stdout'] === 'string' ? resultObj['stdout'] : '',
    stderr: typeof resultObj['stderr'] === 'string' ? resultObj['stderr'] : ''
  };
}
