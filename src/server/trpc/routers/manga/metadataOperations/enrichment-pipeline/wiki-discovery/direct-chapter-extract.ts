/**
 * Direct Chapter Extraction (Robust Fallback)
 *
 * Extracts chapters directly from Fandom HTML using simple regex patterns.
 * Used as a fallback when the adaptive parser fails to parse the page structure.
 */

import { logParseFailure } from '@/server/services/metadata/parse-failure-logger';
import { logger } from '@/utils/logger';

import type { ChapterDataItem } from '../types';

const log = logger.child('DirectChapterExtract');

/** Try adding a chapter if number is valid and unseen */
function tryAddChapter(
  num: number, title: string, seen: Set<number>, chapters: ChapterDataItem[],
): void {
  if (!seen.has(num) && num > 0 && title.length > 1) {
    seen.add(num);
    chapters.push({ number: num, title });
  }
}

/** Extract chapters from link text matching "NNN. Title" */
function extractFromLinks(
  $content: import('cheerio').Cheerio<import('domhandler').Element>,
  $: import('cheerio').CheerioAPI,
  seen: Set<number>,
  chapters: ChapterDataItem[],
): void {
  $content.find('a[href*="/wiki/"]').each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/^(-?\d{1,4}(?:\.\d)?)\.\s*(.+)/);
    if (match?.[1] && match[2]) {
      tryAddChapter(parseFloat(match[1]), match[2].trim(), seen, chapters);
    }
  });
}

/** Extract chapters from table cells/list items matching "Chapter N: Title" */
function extractFromCells(
  $content: import('cheerio').Cheerio<import('domhandler').Element>,
  $: import('cheerio').CheerioAPI,
  seen: Set<number>,
  chapters: ChapterDataItem[],
): void {
  $content.find('td, li').each((_, el) => {
    const text = $(el).text().trim();
    const m = text.match(/^Chapter\s+(\d{1,4})[\s:–-]+(.{2,80})$/i);
    if (m?.[1] && m[2]) {
      tryAddChapter(parseInt(m[1], 10), m[2].trim(), seen, chapters);
    }
  });
}

/** Extract chapters from plain text lines matching "NNN. Title" */
function extractFromText(
  $content: import('cheerio').Cheerio<import('domhandler').Element>,
  seen: Set<number>,
  chapters: ChapterDataItem[],
): void {
  const lines = $content.text().split(/\n/);
  for (const line of lines) {
    const m = line.trim().match(/^(-?\d{1,4}(?:\.\d)?)\.\s*([A-Z].{1,100})$/);
    if (m?.[1] && m[2]) {
      tryAddChapter(parseFloat(m[1]), m[2].trim(), seen, chapters);
    }
  }
}

/**
 * Direct chapter extraction from a Fandom wiki page using simple patterns.
 * Fallback when the adaptive parser fails to parse the page structure.
 */
export async function directChapterExtract(url: string): Promise<ChapterDataItem[]> {
  const { load } = await import('cheerio');

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MugiwariKaizoku/1.0 (manga metadata enrichment)' },
    });
    if (!response.ok) return [];

    const html = await response.text();
    const $ = load(html);
    const $content = $('.mw-parser-output');
    if ($content.length === 0) return [];

    const chapters: ChapterDataItem[] = [];
    const seen = new Set<number>();

    extractFromLinks($content, $, seen, chapters);
    if (chapters.length < 10) extractFromCells($content, $, seen, chapters);
    if (chapters.length < 10) extractFromText($content, seen, chapters);

    if (chapters.length > 0) {
      log.info(`Direct extraction found ${chapters.length} chapters from ${url}`);
    }
    return chapters.sort((a, b) => a.number - b.number);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Direct chapter extraction failed: ${msg}`);
    void logParseFailure({
      source: 'fandom',
      stage: 'direct-chapter-extract.fetch',
      url,
      reason: msg,
    });
    return [];
  }
}
