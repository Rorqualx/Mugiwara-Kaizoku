// @file-size-justified: Specialized Fandom wiki parser with multi-format volume/chapter extraction logic
/* eslint-disable max-lines -- Parser with cohesive volume/chapter extraction that cannot be cleanly split */
/**
 * Bulleted List Parser for Fandom Wikis
 *
 * Handles wikis that use H3 or H4 headers for volumes and bulleted lists (<ul>) for chapters.
 * Examples: Mob Psycho 100, Bleach, Tokyo Ghoul, Dr. Stone
 *
 * Structure pattern:
 * <h3>Volume 1</h3>  (or <h4>)
 * <figure>cover image</figure>
 * <ul>
 *   <li>Chapter 1: Title</li>
 *   <li>Chapter 2: Title</li>
 * </ul>
 *
 * @module bulleted-list-parser
 */

import { load } from 'cheerio';

import { logger } from '@/utils/logger';

import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

/**
 * Parsed volume from bulleted list structure.
 */
export interface BulletedVolume {
  number: number;
  title?: string;
  coverImage?: string;
  chapters: BulletedChapter[];
}

/**
 * Parsed chapter from bulleted list.
 */
export interface BulletedChapter {
  number: number;
  title?: string;
  url?: string;
  volumeNumber: number;
}

/**
 * Result of bulleted list parsing.
 */
export interface BulletedParseResult {
  volumes: BulletedVolume[];
  chapters: BulletedChapter[];
  success: boolean;
}

/**
 * Extracts chapter number from text.
 * Supports: "Chapter 1", "Ch. 1", "Stage.01", "Stage 1", "1:", "001", etc.
 * Also supports Volume 0 prequel format: "Chapter 0-1", "000-1" → 0.1
 */
function extractChapterNumber(text: string): number | null {
  // Special handling for Volume 0 prequel format: "Chapter 0-1", "000-1" → 0.1, 0.2, etc.
  const zeroChapterPatterns = [
    /chapter\s*0+-(\d+)/i,        // Chapter 0-1 → 0.1
    /^0+-(\d+)(?:\.|$|\s)/,       // 000-1, 000-1. → 0.1
    /\b0+-(\d+)\b/,               // 000-1 anywhere → 0.1
  ];
  for (const pattern of zeroChapterPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseFloat(`0.${match[1]}`);
    }
  }

  // Match patterns: "Chapter 1", "Ch. 1", "Stage.01", "Stage 1", "1:", "001", etc.
  const patterns = [
    /Chapter\s*(\d+(?:\.\d+)?)/i,
    /Ch\.\s*(\d+(?:\.\d+)?)/i,
    /Stage\.?\s*(\d+(?:\.\d+)?)/i, // Evangelion uses "Stage.01" format
    /^(\d+)[\s:.\-–—]/,
    /^(\d+)$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseFloat(match[1]);
    }
  }

  return null;
}

/**
 * Extracts volume number from header text.
 */
function extractVolumeNumber(text: string): number | null {
  // Match "Volume 1", "Vol. 1", "Volume 01", etc.
  const patterns = [
    /Volume\s*(\d+)/i,
    /Vol\.\s*(\d+)/i,
    /^(\d+)$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Cleans chapter title by removing chapter number prefix.
 * Supports decimal chapters (1.5, 2.1) for bonus/special chapters.
 * Handles Stage prefix (Evangelion uses "Stage.01: Title" format).
 */
function cleanChapterTitle(text: string): string {
  return text
    .replace(/^Chapter\s*\d+(?:\.\d+)?[\s:.\-–—]*/i, '')
    .replace(/^Ch\.\s*\d+(?:\.\d+)?[\s:.\-–—]*/i, '')
    .replace(/^Stage\.?\s*\d+(?:\.\d+)?[\s:.\-–—]*/i, '') // Evangelion Stage format
    .replace(/^#?\d+(?:\.\d+)?[\s:.\-–—]+/, '')
    .trim();
}

/**
 * Parses chapters from a <ul> element.
 * Deduplicates chapters by number to avoid duplicates from nested structures.
 */
function parseChapterList(
  $: CheerioAPI,
  $ul: Cheerio<Element>,
  volumeNumber: number
): BulletedChapter[] {
  const chapters: BulletedChapter[] = [];
  const seenChapters = new Set<number>();

  $ul.find('> li').each((_, li) => {
    const $li = $(li);
    const text = $li.text().trim();

    // Skip empty or navigation items
    if (!text || text.length < 3) return;

    // Try to find a chapter link
    const $link = $li.find('a').first();
    const href = $link.attr('href');

    // Extract chapter number from the FULL TEXT (not link text)
    // because format is "Chapter 1: Title" where link only has "Title"
    const chapterNum = extractChapterNumber(text);

    if (chapterNum !== null && !seenChapters.has(chapterNum)) {
      seenChapters.add(chapterNum);
      const title = cleanChapterTitle(text);

      const chapter: BulletedChapter = {
        number: chapterNum,
        volumeNumber,
      };

      if (title.length > 0) {
        chapter.title = title;
      }

      if (href?.startsWith('/wiki/')) {
        chapter.url = href;
      }

      chapters.push(chapter);
    }
  });

  return chapters;
}

/**
 * Finds URL for a chapter by searching links in a cell.
 */
function findChapterUrl(
  $: CheerioAPI,
  $cell: Cheerio<Element>,
  chapterNum: number
): string | undefined {
  let url: string | undefined;
  const $links = $cell.find('a');

  $links.each((_, link) => {
    const $link = $(link);
    const linkText = $link.text().trim();
    const href = $link.attr('href') ?? '';

    // Check if link text contains the chapter number
    if (linkText.includes(String(chapterNum)) || extractChapterNumber(linkText) === chapterNum) {
      if (href.startsWith('/wiki/')) {
        url = href;
      }
    }
  });

  return url;
}

/**
 * Parses a single line of text into a chapter if it matches chapter patterns.
 */
function parseChapterFromLine(
  line: string,
  volumeNumber: number,
  seenChapters: Set<number>
): BulletedChapter | null {
  const trimmedLine = line.trim();
  if (!trimmedLine) return null;

  const chapterNum = extractChapterNumber(trimmedLine);
  if (chapterNum === null) return null;
  if (seenChapters.has(chapterNum)) return null;

  seenChapters.add(chapterNum);
  const title = cleanChapterTitle(trimmedLine);

  const chapter: BulletedChapter = {
    number: chapterNum,
    volumeNumber,
  };

  if (title.length > 0 && title.length < 200) {
    chapter.title = title;
  }

  return chapter;
}

/**
 * Splits text into chapter entries, handling newline, comma, and concatenated formats.
 */
function splitChapterEntries(text: string): string[] {
  const entries: string[] = [];
  const lines = text.split(/[\n\r]+/);

  for (const line of lines) {
    // Check for concatenated chapter entries (Kuroko pattern): "01. Title02. Title03. Title"
    // Split at chapter number boundaries - look for 2-4 digit numbers followed by period
    // Use .+? to match any characters (including spaces in titles) between chapter numbers
    if (/\d{2,4}\.\s+.+?\d{2,4}\./.test(line)) {
      // Split at the boundary before each chapter number (NN. or NNN.)
      // Use lookahead to split at "01.", "02.", "100.", etc.
      const parts = line.split(/(?=\d{2,4}\.\s)/);
      const validParts = parts.filter((p) => /^\d{2,4}\.\s/.test(p.trim()));
      if (validParts.length > 0) {
        entries.push(...validParts.map((p) => p.trim()));
        continue;
      }
    }
    // Check for comma-separated chapter entries
    if (/\d{2,4}\.\s+.+?,\s*\d{2,4}\./.test(line)) {
      const commaSplit = line.split(/,\s*(?=\d{2,4}\.)/);
      entries.push(...commaSplit.map((e) => e.trim()));
    } else {
      entries.push(line);
    }
  }

  return entries;
}

/**
 * Parses chapters from a <table> element.
 * Handles Fairy Tail and Kuroko no Basket style tables where chapters are listed
 * in table cells with numbered format like "01. Title".
 */
function parseChapterTable(
  $: CheerioAPI,
  $table: Cheerio<Element>,
  volumeNumber: number
): BulletedChapter[] {
  const chapters: BulletedChapter[] = [];
  const seenChapters = new Set<number>();

  $table.find('td, th').each((_, cell) => {
    const $cell = $(cell);
    const cellText = $cell.text().trim();

    if (!cellText || cellText.length < 3) return;

    const entries = splitChapterEntries(cellText);

    for (const entry of entries) {
      const chapter = parseChapterFromLine(entry, volumeNumber, seenChapters);
      if (chapter) {
        const chapterUrl = findChapterUrl($, $cell, chapter.number);
        if (chapterUrl) {
          chapter.url = chapterUrl;
        }
        chapters.push(chapter);
      }
    }
  });

  return chapters;
}

/**
 * Parses H3/H4+bulleted list structure from HTML.
 *
 * @param html - HTML content to parse
 * @returns Parsed volumes and chapters
 */
export function parseBulletedListStructure(html: string): BulletedParseResult {
  const $ = load(html);
  const volumes: BulletedVolume[] = [];
  const allChapters: BulletedChapter[] = [];
  const seenVolumes = new Set<number>();

  // Find all H3 and H4 headers that look like volume headers
  const $content = $('.mw-parser-output');
  const $headers = $content.find('h3, h4');

  logger.debug(`[bulleted-list-parser] Found ${$headers.length} H3/H4 headers`);

  // eslint-disable-next-line complexity, max-statements -- Multi-format volume/chapter extraction from wiki headers with table/list/sibling traversal
  $headers.each((_, header) => {
    const $header = $(header);
    const headerText = $header.text().trim();

    // Check if this is a volume header
    const volumeNum = extractVolumeNumber(headerText);
    if (volumeNum === null) return;

    // Skip duplicate volumes
    if (seenVolumes.has(volumeNum)) return;
    seenVolumes.add(volumeNum);

    // Special case: header inside table cell (Fairy Tail style)
    // Structure: <table><tr><th><h3>Volume 1</h3></th></tr><tr><td>chapters</td></tr></table>
    const $parentCell = $header.parent();
    if ($parentCell.is('th, td')) {
      const $containingTable = $header.closest('table') as Cheerio<Element>;
      if ($containingTable.length > 0) {
        // Parse chapters from this table (excluding the header row)
        const chapters = parseChapterTable($, $containingTable, volumeNum);
        if (chapters.length > 0) {
          const volume: BulletedVolume = { number: volumeNum, chapters };
          volumes.push(volume);
          allChapters.push(...chapters);
          return;
        }
      }
    }

    // Find the next <ul> or <table> after this header (may have <figure>, etc. in between)
    let $next = $header.next();
    let $ul: Cheerio<Element> | null = null;
    let $table: Cheerio<Element> | null = null;
    let $figure: Cheerio<Element> | null = null;
    let attempts = 0;

    while ($next.length && attempts < 10) {
      if ($next.is('ul')) {
        $ul = $next;
        break;
      }
      // Also check for tables with chapter content (Fairy Tail, Kuroko no Basket style)
      if ($next.is('table')) {
        // Check if table contains chapter-like content
        const tableText = $next.text();
        if (/chapter|\d+\./i.test(tableText)) {
          $table = $next;
          break;
        }
      }
      if ($next.is('figure')) {
        $figure = $next;
      }
      // Check inside collapsible sections (Dr. Stone uses .mw-collapsible, FMA uses .collapsible)
      const isCollapsible =
        $next.hasClass('mw-collapsible') ||
        $next.hasClass('collapsible') ||
        $next.find('.mw-collapsible, .collapsible').length > 0;

      if (isCollapsible) {
        // Try .mw-collapsible-content first (standard MediaWiki)
        const $collapsibleContent = $next.find('.mw-collapsible-content ul, .collapsible ul').first();
        if ($collapsibleContent.length > 0) {
          $ul = $collapsibleContent;
          break;
        }
        // Also check for direct ul inside collapsible (some structures don't have .mw-collapsible-content)
        const $directUl = $next.find('ul').first();
        if ($directUl.length > 0) {
          $ul = $directUl;
          break;
        }
        // Check for tables inside collapsible
        const $collapsibleTable = $next.find('table').first();
        if ($collapsibleTable.length > 0 && /chapter|\d+\./i.test($collapsibleTable.text())) {
          $table = $collapsibleTable;
          break;
        }
      }
      // Check inside any div that might contain the ul or table
      if ($next.is('div') && !$next.is('h2, h3, h4')) {
        const $innerUl = $next.find('> ul').first();
        if ($innerUl.length > 0) {
          $ul = $innerUl;
          break;
        }
        const $innerTable = $next.find('> table').first();
        if ($innerTable.length > 0 && /chapter|\d+\./i.test($innerTable.text())) {
          $table = $innerTable;
          break;
        }
      }
      if ($next.is('h2, h3, h4')) {
        // Hit next section, stop
        break;
      }
      $next = $next.next();
      attempts++;
    }

    if (!$ul && !$table) {
      logger.debug(`[bulleted-list-parser] No <ul> or <table> found after Volume ${volumeNum}`);
      return;
    }

    // Parse chapters from the <ul> or <table>
    let chapters: BulletedChapter[];
    if ($ul) {
      chapters = parseChapterList($, $ul, volumeNum);
    } else if ($table) {
      chapters = parseChapterTable($, $table, volumeNum);
    } else {
      chapters = [];
    }

    // Get cover image if available
    let coverImage: string | undefined;
    if ($figure) {
      const $img = $figure.find('img');
      coverImage = $img.attr('data-src') ?? $img.attr('src');
    }

    const volume: BulletedVolume = {
      number: volumeNum,
      chapters,
    };

    if (coverImage) {
      volume.coverImage = coverImage;
    }

    volumes.push(volume);
    allChapters.push(...chapters);
  });

  logger.info(`[bulleted-list-parser] Parsed ${volumes.length} volumes, ${allChapters.length} chapters`);

  return {
    volumes,
    chapters: allChapters,
    success: volumes.length > 0 || allChapters.length > 0,
  };
}

/**
 * Extracts chapters from table cells that contain <li> elements.
 * Pattern: table > tbody > tr > td > ul > li > a[href*="/wiki/Chapter"]
 * Used by: Blue Lock, Demon Slayer, etc.
 */
function extractChaptersFromTableLists(
  $: CheerioAPI,
  volumeNumber: number
): BulletedChapter[] {
  const chapters: BulletedChapter[] = [];
  const seenChapters = new Set<number>();

  const $content = $('.mw-parser-output');
  $content.find('table td li, table th li').each((_, li) => {
    const chapter = parseTableListItem($, $(li), volumeNumber, seenChapters);
    if (chapter) {
      chapters.push(chapter);
    }
  });

  return chapters;
}

/**
 * Parses a single table list item into a chapter.
 */
function parseTableListItem(
  _$: CheerioAPI,
  $li: Cheerio<Element>,
  volumeNumber: number,
  seenChapters: Set<number>
): BulletedChapter | null {
  const text = $li.text().trim();
  const $link = $li.find('a').first();
  const href = $link.attr('href');

  const chapterNum = extractChapterNumber(text);
  if (chapterNum === null || seenChapters.has(chapterNum)) {
    return null;
  }

  seenChapters.add(chapterNum);
  const title = cleanChapterTitle(text);

  const chapter: BulletedChapter = {
    number: chapterNum,
    volumeNumber,
  };

  if (title.length > 0 && title.length < 200) {
    chapter.title = title;
  }

  if (href?.startsWith('/wiki/')) {
    chapter.url = href;
  }

  return chapter;
}

/**
 * Extracts chapters from any page with chapter links.
 * Fallback for when standard structure detection fails.
 * Also handles Category pages which use .category-page__members container.
 */
function extractChaptersFromAnyLinks($: CheerioAPI): BulletedChapter[] {
  const chapters: BulletedChapter[] = [];
  const seenChapters = new Set<number>();

  // Check standard wiki content container
  const $content = $('.mw-parser-output');
  $content.find('a[href*="/wiki/Chapter_"], a[href*="/wiki/Chapter%20"]').each((_, link) => {
    const chapter = parseChapterLink($, $(link), seenChapters);
    if (chapter) {
      chapters.push(chapter);
    }
  });

  // Also check Category page container (used by Fire Punch, Tokyo Ghoul, etc.)
  const $categoryMembers = $('.category-page__members');
  $categoryMembers.find('a[href*="/wiki/Chapter_"], a[href*="/wiki/Chapter%20"]').each((_, link) => {
    const chapter = parseChapterLink($, $(link), seenChapters);
    if (chapter) {
      chapters.push(chapter);
    }
  });

  // Try numbered title format (Erased wiki pattern: /wiki/01._Title)
  if (chapters.length === 0) {
    const numberedChapters = extractChaptersFromNumberedTitleLinks($);
    chapters.push(...numberedChapters);
  }

  return chapters.sort((a, b) => a.number - b.number);
}

/**
 * Extracts chapters from links with numbered title format.
 * Pattern: /wiki/01._Flashback:_May_2006 -> Chapter 1
 * Used by: Erased (Boku dake ga Inai Machi)
 */
function extractChaptersFromNumberedTitleLinks($: CheerioAPI): BulletedChapter[] {
  const chapters: BulletedChapter[] = [];
  const seenChapters = new Set<number>();

  const $content = $('.mw-parser-output');
  // Find all links and filter by numbered pattern
  $content.find('a[href^="/wiki/"]').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim();

    // Match URLs like /wiki/01._Title or /wiki/1._Title
    const urlMatch = href.match(/\/wiki\/(\d{1,3})\._/);
    if (!urlMatch?.[1]) return;

    const chapterNum = parseInt(urlMatch[1], 10);
    if (seenChapters.has(chapterNum) || chapterNum <= 0 || chapterNum >= 10000) return;

    seenChapters.add(chapterNum);

    // Extract title from text (format: "01. Title")
    const titleMatch = text.match(/^\d{1,3}\.\s*(.+)$/);
    const title = titleMatch?.[1]?.trim();

    const chapter: BulletedChapter = {
      number: chapterNum,
      volumeNumber: 0,
    };

    if (title && title.length > 0 && title.length < 200) {
      chapter.title = title;
    }

    chapter.url = href;
    chapters.push(chapter);
  });

  if (chapters.length > 0) {
    logger.info(`[bulleted-list-parser] Numbered title link extraction found ${chapters.length} chapters`);
  }

  return chapters;
}

/**
 * Parses a single chapter link into a chapter object.
 */
function parseChapterLink(
  _$: CheerioAPI,
  $link: Cheerio<Element>,
  seenChapters: Set<number>
): BulletedChapter | null {
  const href = $link.attr('href') ?? '';
  const text = $link.text().trim();

  const urlMatch = href.match(/Chapter[_\s](\d+)/i);
  const textMatch = text.match(/Chapter\s*(\d+)|^(\d+)/i);
  const chapterNum = urlMatch?.[1] ?? textMatch?.[1] ?? textMatch?.[2];

  if (!chapterNum) {
    return null;
  }

  const num = parseInt(chapterNum, 10);
  if (seenChapters.has(num) || num <= 0 || num >= 10000) {
    return null;
  }

  seenChapters.add(num);
  const chapter: BulletedChapter = {
    number: num,
    volumeNumber: 0,
  };

  if (text.length > 0 && text.length < 200) {
    chapter.title = text;
  }

  if (href.startsWith('/wiki/')) {
    chapter.url = href;
  }

  return chapter;
}

/**
 * Extracts chapters from plain text list items without links.
 * Handles wikis like Monster where chapters are listed as "Chapter X: Title" without hyperlinks.
 */
function extractChaptersFromPlainTextLists($: CheerioAPI): BulletedChapter[] {
  const chapters: BulletedChapter[] = [];
  const seenChapters = new Set<number>();

  const $content = $('.mw-parser-output');
  $content.find('li').each((_, li) => {
    const $li = $(li);
    const text = $li.text().trim();

    // Match "Chapter X:" or "Chapter X:" pattern (with or without colon)
    const match = text.match(/^Chapter\s*(\d+)(?:\s*[:.\-–—])?\s*(.*)$/i);
    if (!match?.[1]) return;

    const chapterNum = parseInt(match[1], 10);
    if (seenChapters.has(chapterNum) || chapterNum <= 0 || chapterNum >= 10000) return;

    seenChapters.add(chapterNum);
    const chapter: BulletedChapter = {
      number: chapterNum,
      volumeNumber: 0,
    };

    const title = match[2]?.trim();
    if (title && title.length > 0 && title.length < 200) {
      chapter.title = title;
    }

    // Check if there's a link inside
    const $link = $li.find('a').first();
    const href = $link.attr('href');
    if (href?.startsWith('/wiki/')) {
      chapter.url = href;
    }

    chapters.push(chapter);
  });

  return chapters.sort((a, b) => a.number - b.number);
}

/**
 * Extracts chapters from numbered list items (Dandadan format: "001. Title").
 * Handles wikis where chapters are in <li> elements with format "NNN. Title (Japanese)".
 */
export function extractChaptersFromNumberedListItems(html: string): BulletedChapter[] {
  const $ = load(html);
  const chapters: BulletedChapter[] = [];
  const seenChapters = new Set<number>();

  const $content = $('.mw-parser-output');
  $content.find('li').each((_, li) => {
    const $li = $(li);
    const text = $li.text().trim();

    // Match "NNN. Title" or "NNNN - Title" pattern (001. Title, 0001 - Title, etc.)
    // Also capture everything up to the first parenthesis (Japanese title)
    const match = text.match(/^(\d{1,4})\s*[-\u2013\u2014.]\s+(.+?)(?:\s*\(|$)/);
    if (!match?.[1] || !match[2]) return;

    const chapterNum = parseInt(match[1], 10);
    if (seenChapters.has(chapterNum) || chapterNum < 0 || chapterNum >= 10000) return;

    seenChapters.add(chapterNum);
    const chapter: BulletedChapter = {
      number: chapterNum,
      volumeNumber: 0,
      title: match[2].trim(),
    };

    // Check if there's a link inside
    const $link = $li.find('a').first();
    const href = $link.attr('href');
    if (href?.startsWith('/wiki/')) {
      chapter.url = href;
    }

    chapters.push(chapter);
  });

  logger.info(`[bulleted-list-parser] Numbered list extraction found ${chapters.length} chapters`);
  return chapters.sort((a, b) => a.number - b.number);
}

/**
 * Extracts volume number from table text (e.g., "1 I Am Kuroko" -> 1).
 */
function extractVolumeFromTableStart(text: string): { number: number; title: string } | null {
  // Match pattern: "N Title" or "Volume N Title"
  const match = text.match(/^(?:Volume\s+)?(\d+)\s+(.+?)(?:\s*Release|$)/i);
  if (match?.[1] && match[2]) {
    return { number: parseInt(match[1], 10), title: match[2].trim() };
  }
  return null;
}

/**
 * Extracts volumes and chapters from standalone volume tables.
 * Handles Kuroko no Basket pattern where each table is a volume with chapters inside.
 */
function extractVolumesFromStandaloneTables($: CheerioAPI): { volumes: BulletedVolume[]; chapters: BulletedChapter[] } {
  const volumes: BulletedVolume[] = [];
  const allChapters: BulletedChapter[] = [];
  const seenVolumes = new Set<number>();

  const $content = $('.mw-parser-output');
  $content.find('table').each((_, table) => {
    const $table = $(table);
    const tableText = $table.text().trim();

    // Check if this looks like a volume table (starts with number + title)
    const volumeInfo = extractVolumeFromTableStart(tableText);
    if (!volumeInfo) return;
    if (seenVolumes.has(volumeInfo.number)) return;
    seenVolumes.add(volumeInfo.number);

    // Extract chapters from this table
    const chapters = parseChapterTable($, $table, volumeInfo.number);

    // Get cover image if available
    const $img = $table.find('img').first();
    const coverImage = $img.attr('data-src') ?? $img.attr('src');

    const volume: BulletedVolume = {
      number: volumeInfo.number,
      title: volumeInfo.title,
      chapters,
    };

    if (coverImage) {
      volume.coverImage = coverImage;
    }

    volumes.push(volume);
    allChapters.push(...chapters);
  });

  // Detect per-volume numbering: if many chapters share the same number across volumes,
  // renumber globally by accumulating offsets (Kuroko: ch 1-9 per vol → ch 1-275 global).
  const uniqueNumbers = new Set(allChapters.map(ch => ch.number)).size;
  if (allChapters.length > uniqueNumbers * 1.5 && volumes.length >= 3) {
    logger.info(`[extractVolumesFromStandaloneTables] Per-volume numbering detected (${allChapters.length} chapters, ${uniqueNumbers} unique numbers), renumbering globally`);
    let globalOffset = 0;
    for (const vol of volumes) {
      for (const ch of vol.chapters) {
        ch.number = globalOffset + ch.number;
      }
      globalOffset += vol.chapters.length;
    }
    // Rebuild allChapters from renumbered volumes
    allChapters.length = 0;
    for (const vol of volumes) {
      allChapters.push(...vol.chapters);
    }
  }

  return { volumes, chapters: allChapters };
}

/**
 * Enhanced bulleted list parser that also handles table-based chapter lists.
 */
export function parseBulletedListEnhanced(html: string): BulletedParseResult {
  const standardResult = parseBulletedListStructure(html);

  if (standardResult.chapters.length > 0) {
    return standardResult;
  }

  const $ = load(html);
  const tableChapters = extractChaptersFromTableLists($, 0);

  if (tableChapters.length > 0) {
    logger.info(`[bulleted-list-parser] Table list extraction found ${tableChapters.length} chapters`);
    return {
      volumes: standardResult.volumes,
      chapters: tableChapters,
      success: true,
    };
  }

  const anyChapters = extractChaptersFromAnyLinks($);

  if (anyChapters.length > 0) {
    logger.info(`[bulleted-list-parser] Fallback link extraction found ${anyChapters.length} chapters`);
    return {
      volumes: standardResult.volumes,
      chapters: anyChapters,
      success: true,
    };
  }

  // Try plain text list items without links (Monster wiki pattern)
  const plainTextChapters = extractChaptersFromPlainTextLists($);
  if (plainTextChapters.length > 0) {
    logger.info(`[bulleted-list-parser] Plain text list extraction found ${plainTextChapters.length} chapters`);
    return {
      volumes: standardResult.volumes,
      chapters: plainTextChapters,
      success: true,
    };
  }

  // Try numbered list items (Death Note pattern: "001. Title")
  const numberedListChapters = extractChaptersFromNumberedListItems(html);
  if (numberedListChapters.length > 0) {
    logger.info(`[bulleted-list-parser] Numbered list extraction found ${numberedListChapters.length} chapters`);
    return {
      volumes: standardResult.volumes,
      chapters: numberedListChapters,
      success: true,
    };
  }

  // Try standalone volume tables (Kuroko no Basket pattern: each table is a volume)
  const standaloneResult = extractVolumesFromStandaloneTables($);
  if (standaloneResult.volumes.length > 0) {
    logger.info(`[bulleted-list-parser] Standalone table extraction found ${standaloneResult.volumes.length} vols, ${standaloneResult.chapters.length} chaps`);
    return {
      volumes: standaloneResult.volumes,
      chapters: standaloneResult.chapters,
      success: true,
    };
  }

  return standardResult;
}

/**
 * Checks if header has a ul sibling within max attempts (including inside collapsible sections).
 */
function headerHasUlSibling($: CheerioAPI, header: Element): boolean {
  let $next = $(header).next();
  let attempts = 0;

  while ($next.length && attempts < 5) {
    if ($next.is('ul')) {
      return true;
    }
    // Check inside collapsible sections (.mw-collapsible or .collapsible)
    const hasCollapsible =
      $next.hasClass('mw-collapsible') ||
      $next.hasClass('collapsible') ||
      $next.find('.mw-collapsible, .collapsible').length > 0;
    if (hasCollapsible && $next.find('ul').length > 0) {
      return true;
    }
    // Check inside any div for direct ul
    if ($next.is('div') && $next.find('> ul').length > 0) {
      return true;
    }
    if ($next.is('h2, h3, h4')) {
      return false;
    }
    $next = $next.next();
    attempts++;
  }

  return false;
}

/**
 * Checks if a page uses the bulleted list structure.
 *
 * @param html - HTML content to check
 * @returns true if the page appears to use H3/H4+ul structure
 */
export function isBulletedListStructure(html: string): boolean {
  const $ = load(html);

  const $content = $('.mw-parser-output');
  const $volumeHeaders = $content.find('h3, h4').filter((_, el) => {
    const text = $(el).text();
    return /Volume\s*\d+/i.test(text);
  });

  if ($volumeHeaders.length === 0) {
    return false;
  }

  let hasUlAfterHeader = false;
  $volumeHeaders.each((_, header) => {
    if (headerHasUlSibling($, header)) {
      hasUlAfterHeader = true;
      return false; // break
    }
  });

  return hasUlAfterHeader;
}

/**
 * Checks if page has chapter links in table lists, category members, or anywhere.
 * Also checks for plain text chapter lists (Monster wiki pattern) and numbered title links (Erased pattern).
 */
export function hasTableListChapters(html: string): boolean {
  const $ = load(html);
  const $content = $('.mw-parser-output');

  // Check for chapter links in table cells
  const tableChapterLinks = $content.find('table td li a[href*="/wiki/Chapter"], table th li a[href*="/wiki/Chapter"]');
  if (tableChapterLinks.length >= 5) {
    return true;
  }

  // Check for chapter links in standard wiki content
  const anyChapterLinks = $content.find('a[href*="/wiki/Chapter_"]');
  if (anyChapterLinks.length >= 10) {
    return true;
  }

  // Check for chapter links in Category page container (Fire Punch, etc.)
  const $categoryMembers = $('.category-page__members');
  const categoryChapterLinks = $categoryMembers.find('a[href*="/wiki/Chapter_"]');
  if (categoryChapterLinks.length >= 5) {
    return true;
  }

  // Check for plain text chapter lists (Monster wiki pattern)
  let plainTextChapterCount = 0;
  $content.find('li').each((_, li) => {
    if (/^Chapter\s*\d+/i.test($(li).text().trim())) {
      plainTextChapterCount++;
    }
  });
  if (plainTextChapterCount >= 10) {
    return true;
  }

  // Check for numbered title links (Erased pattern: /wiki/01._Title)
  let numberedTitleCount = 0;
  $content.find('a[href^="/wiki/"]').each((_, link) => {
    const href = $(link).attr('href') ?? '';
    if (/\/wiki\/\d{1,3}\._/.test(href)) {
      numberedTitleCount++;
    }
  });
  return numberedTitleCount >= 10;
}

/**
 * Checks if page has standalone volume tables (Kuroko no Basket pattern).
 * Each table represents a single volume with a chapter list inside.
 */
export function hasStandaloneVolumeTables(html: string): boolean {
  const $ = load(html);
  const $content = $('.mw-parser-output');
  const $tables = $content.find('table');

  let volumeTableCount = 0;
  $tables.each((_, table) => {
    const tableText = $(table).text().trim();

    // Check if table text starts with a volume number pattern
    // E.g., "1\nVolume Title\nChapters list:..." or just "1\nTitle..."
    const startsWithNumber = /^\d{1,2}[\s\n]/.test(tableText);
    const hasChaptersList = /Chapters list:/i.test(tableText);
    const hasNumberedChapters = /\d{2}\.\s+\w/.test(tableText);

    if (startsWithNumber && (hasChaptersList || hasNumberedChapters)) {
      volumeTableCount++;
    }
  });

  // Consider it a match if we find at least 5 standalone volume tables
  return volumeTableCount >= 5;
}
