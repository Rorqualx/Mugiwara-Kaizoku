/**
 * ComicVine Table Metadata Extraction
 *
 * Extracts publisher, year, and themes from ComicVine "Volume details" tables.
 * Complements the main metadata-extractor.ts with table-specific extraction.
 *
 * @module comicvine/table-metadata-extractor
 */

import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

// ============================================================================
// Publisher Extraction
// ============================================================================

function getNextCellText($: CheerioAPI, cell: Element): string {
  const nextCell = $(cell).next('td');
  if (!nextCell.length) return '';
  const link = nextCell.find('a').first();
  return link.length ? link.text().trim() : nextCell.text().trim();
}

function getDdText($: CheerioAPI, el: Element): string {
  const dd = $(el).next('dd, td');
  const link = dd.find('a').first();
  return link.length ? link.text().trim() : dd.text().trim();
}

/**
 * Extract publisher from ComicVine page
 */
export function extractPublisher($: CheerioAPI): string | undefined {
  // Pattern 1: Volume details table
  const tableCells = $('table th, table td').toArray();
  for (const cell of tableCells) {
    const text = $(cell).text().trim().toLowerCase();
    if (text === 'publisher') {
      const value = getNextCellText($, cell);
      if (value) return value;
    }
  }

  // Pattern 2: "Published by" text
  const match = $('body').text().match(/Published by\s+([A-Za-z][\w\s]+)/i);
  if (match?.[1]) return match[1].trim();

  // Pattern 3: data-field
  const dataField = $('[data-field="publisher"]').text().trim() ||
    $('[data-field="publisher"] a').text().trim();
  if (dataField) return dataField;

  // Pattern 4: dt/dd pairs
  const dtElements = $('dt, th').toArray();
  for (const el of dtElements) {
    const label = $(el).text().toLowerCase().trim();
    if (label === 'publisher' || label === 'published by') {
      const value = getDdText($, el);
      if (value) return value;
    }
  }

  return undefined;
}

// ============================================================================
// Year Extraction
// ============================================================================

function getNextCellYear($: CheerioAPI, cell: Element): number | undefined {
  const nextCell = $(cell).next('td');
  if (!nextCell.length) return undefined;
  const yearMatch = nextCell.text().match(/(\d{4})/);
  return yearMatch?.[1] ? parseInt(yearMatch[1], 10) : undefined;
}

function getDdYear($: CheerioAPI, el: Element): number | undefined {
  const dd = $(el).next('dd, td');
  const yearMatch = dd.text().match(/(\d{4})/);
  return yearMatch?.[1] ? parseInt(yearMatch[1], 10) : undefined;
}

/**
 * Extract release year from ComicVine page
 */
export function extractReleaseYear($: CheerioAPI): number | undefined {
  // Pattern 1: "Started in YYYY"
  const startedMatch = $('body').text().match(/Started\s*(?:in|:)?\s*(\d{4})/i);
  if (startedMatch?.[1]) return parseInt(startedMatch[1], 10);

  // Pattern 2: Volume details table
  const tableCells = $('table th, table td').toArray();
  for (const cell of tableCells) {
    const text = $(cell).text().trim().toLowerCase();
    if (text === 'year' || text === 'start year') {
      const value = getNextCellYear($, cell);
      if (value) return value;
    }
  }

  // Pattern 3: data-field
  const dataFieldYear = $('[data-field="start_year"]').text().trim();
  if (dataFieldYear) {
    const yearMatch = dataFieldYear.match(/(\d{4})/);
    if (yearMatch?.[1]) return parseInt(yearMatch[1], 10);
  }

  // Pattern 4: dt/dd pairs
  const dtElements = $('dt, th').toArray();
  for (const el of dtElements) {
    const label = $(el).text().toLowerCase().trim();
    if (label === 'year' || label === 'start year' || label === 'release') {
      const value = getDdYear($, el);
      if (value) return value;
    }
  }

  return undefined;
}

// ============================================================================
// Themes Extraction
// ============================================================================

function parseThemesFromCell($: CheerioAPI, cell: Element): string[] {
  const themes: string[] = [];
  const nextCell = $(cell).next('td');
  if (!nextCell.length) return themes;

  const links = nextCell.find('a').toArray();
  if (links.length > 0) {
    for (const link of links) {
      const theme = $(link).text().trim();
      if (theme && !themes.includes(theme)) themes.push(theme);
    }
  } else {
    const themeText = nextCell.text().trim();
    for (const t of themeText.split(/[,;]/)) {
      const theme = t.trim();
      if (theme && !themes.includes(theme)) themes.push(theme);
    }
  }

  return themes;
}

/**
 * Extract themes from "Volume details" table
 */
export function extractThemesFromTable($: CheerioAPI): string[] {
  const tableCells = $('table th, table td').toArray();
  for (const cell of tableCells) {
    const text = $(cell).text().trim().toLowerCase();
    if (text === 'themes' || text === 'theme') {
      return parseThemesFromCell($, cell);
    }
  }
  return [];
}
