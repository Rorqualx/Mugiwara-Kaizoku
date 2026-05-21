/**
 * Wikipedia Static Analyzer
 *
 * Analyzes Wikipedia page HTML structure to detect page type, content structure,
 * and recommend the appropriate parser. Does not extract data - only analyzes structure.
 *
 * @module wikipedia/adaptive/static-analyzer
 */

/* eslint-disable no-param-reassign -- Analysis helpers intentionally mutate passed objects for cleaner code */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import {
  WikipediaPageType,
  WikipediaStructureType,
  type WikipediaParserType,
  type WikipediaStructureAnalysis,
  type WikitableAnalysis,
  type SectionAnalysis,
  type InfoboxAnalysis,
  type LinkAnalysis,
} from './types';

import type { AnyNode, Element } from 'domhandler';

// ============================================================================
// Constants
// ============================================================================

/** Infobox classes used in Wikipedia */
const INFOBOX_CLASSES = [
  'infobox',
  'infobox-manga',
  'infobox-animanga',
  'infobox-book',
  'infobox-media',
];

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze Wikipedia page structure to determine parsing strategy.
 *
 * @param html - Raw HTML content of the page
 * @param url - Optional URL for context
 * @returns Complete structure analysis with parser recommendation
 */
export function analyzeWikipediaStructure(
  html: string,
  url?: string
): WikipediaStructureAnalysis {
  const startTime = Date.now();
  const $ = cheerio.load(html);

  // Detect page type from URL or content
  const pageType = detectPageType($, url);

  // Run all analysis modules
  const tables = analyzeWikitables($);
  const sections = analyzeSections($);
  const infobox = analyzeInfobox($);
  const links = analyzeLinks($);

  // Determine structure type
  const structureType = determineStructureType(tables, sections, infobox);

  // Get parser recommendation
  const { parser, confidence, reason } = recommendParser(
    pageType,
    structureType,
    tables,
    sections,
    infobox,
    links
  );

  const analysisTimeMs = Date.now() - startTime;

  logger.debug('[WikipediaAnalyzer] Analysis complete', {
    pageType,
    structureType,
    recommendedParser: parser,
    confidence,
    analysisTimeMs,
  });

  return {
    pageType,
    structureType,
    tables,
    sections,
    infobox,
    links,
    recommendedParser: parser,
    confidence,
    recommendationReason: reason,
    analysisTimeMs,
  };
}

// ============================================================================
// Page Type Detection
// ============================================================================

/**
 * Detect the type of Wikipedia page.
 */
function detectPageType(
  $: cheerio.CheerioAPI,
  url?: string
): WikipediaPageType {
  // Check URL for List_of_* pattern
  if (url?.includes('List_of_') || url?.includes('List%20of')) {
    return 'list-page';
  }

  // Check page title
  const pageTitle = $('h1#firstHeading').text().trim();
  if (pageTitle.toLowerCase().startsWith('list of')) {
    return 'list-page';
  }

  // Check for section anchor in URL
  if (url?.includes('#')) {
    const anchor = url.split('#')[1];
    if (anchor && ['Manga', 'Media', 'Publication', 'Volumes', 'Chapters'].includes(anchor)) {
      return 'section-anchor';
    }
  }

  // Check if it's a disambiguation page
  if ($('.disambiguation').length > 0) {
    return 'unknown';
  }

  // Default to main article
  return 'main-article';
}

// ============================================================================
// Wikitable Analysis
// ============================================================================

/**
 * Analyze wikitable structure in the page.
 */
function analyzeWikitables($: cheerio.CheerioAPI): WikitableAnalysis {
  const tables = $('table.wikitable');
  const analysis: WikitableAnalysis = {
    totalCount: tables.length,
    volumeTables: 0,
    chapterTables: 0,
    combinedTables: 0,
    columnHeaders: [],
    hasSortable: false,
  };

  if (tables.length === 0) {
    return analysis;
  }

  tables.each((_, table) => {
    const $table = $(table);
    if ($table.hasClass('sortable')) {
      analysis.hasSortable = true;
    }

    const headers = extractTableHeaders($, $table);
    analysis.columnHeaders.push(headers);

    const tableType = classifyTable(headers);
    incrementTableCount(analysis, tableType);
  });

  return analysis;
}

/**
 * Extract headers from a table.
 */
function extractTableHeaders(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<Element>
): string[] {
  const headers: string[] = [];
  $table.find('tr').first().find('th').each((_, th) => {
    headers.push($(th).text().trim().toLowerCase());
  });
  return headers;
}

/**
 * Increment the appropriate table count.
 */
function incrementTableCount(
  analysis: WikitableAnalysis,
  tableType: 'volume' | 'chapter' | 'combined' | 'other'
): void {
  if (tableType === 'volume') {
    analysis.volumeTables++;
  } else if (tableType === 'chapter') {
    analysis.chapterTables++;
  } else if (tableType === 'combined') {
    analysis.combinedTables++;
  }
}

/**
 * Classify a table based on its column headers.
 */
function classifyTable(headers: string[]): 'volume' | 'chapter' | 'combined' | 'other' {
  const headerText = headers.join(' ');

  const hasVolumeIndicators = headers.some(h =>
    h.includes('volume') || h.includes('vol.') || h.includes('isbn') ||
    (h.includes('release') && h.includes('date'))
  );

  const hasChapterIndicators = headers.some(h =>
    h.includes('chapter') || h.includes('title') || h.includes('pages')
  );

  const hasNumberColumn = headers.some(h =>
    h === 'no.' || h === '#' || h === 'no' || /^\d+$/.test(h)
  );

  if (hasVolumeIndicators && hasChapterIndicators) return 'combined';
  if (hasVolumeIndicators && hasNumberColumn) return 'volume';
  if (hasChapterIndicators && hasNumberColumn) return 'chapter';
  if (headerText.includes('content') || headerText.includes('chapters')) return 'volume';

  return 'other';
}

// ============================================================================
// Section Analysis
// ============================================================================

/**
 * Analyze page sections for manga-related content.
 */
function analyzeSections($: cheerio.CheerioAPI): SectionAnalysis {
  const analysis: SectionAnalysis = {
    headers: [],
    hasMangaSection: false,
    hasMediaSection: false,
    hasPublicationSection: false,
    hasVolumesSection: false,
    hasChaptersSection: false,
    relevantSectionIds: [],
  };

  $('h2, h3').each((_, header) => {
    const $header = $(header);
    const headerText = $header.find('.mw-headline').text().trim() || $header.text().trim();
    const headerId = $header.find('.mw-headline').attr('id') ?? '';

    analysis.headers.push(headerText);
    updateSectionFlags(analysis, headerText, headerId);
  });

  return analysis;
}

/**
 * Update section flags based on header text.
 */
function updateSectionFlags(
  analysis: SectionAnalysis,
  headerText: string,
  headerId: string
): void {
  const lowerText = headerText.toLowerCase();

  if (lowerText === 'manga' || lowerText.includes('manga')) {
    analysis.hasMangaSection = true;
    if (headerId) analysis.relevantSectionIds.push(headerId);
  }

  if (lowerText === 'media' || lowerText.includes('media')) {
    analysis.hasMediaSection = true;
    if (headerId) analysis.relevantSectionIds.push(headerId);
  }

  if (lowerText === 'publication' || lowerText.includes('publication')) {
    analysis.hasPublicationSection = true;
    if (headerId) analysis.relevantSectionIds.push(headerId);
  }

  if (lowerText === 'volumes' || lowerText.includes('volume list')) {
    analysis.hasVolumesSection = true;
    if (headerId) analysis.relevantSectionIds.push(headerId);
  }

  if (lowerText === 'chapters' || lowerText.includes('chapter list')) {
    analysis.hasChaptersSection = true;
    if (headerId) analysis.relevantSectionIds.push(headerId);
  }
}

// ============================================================================
// Infobox Analysis
// ============================================================================

/**
 * Analyze infobox structure.
 */
function analyzeInfobox($: cheerio.CheerioAPI): InfoboxAnalysis {
  const analysis: InfoboxAnalysis = {
    hasInfobox: false,
    infoboxClass: null,
    fields: [],
    hasCoverImage: false,
    hasVolumeCount: false,
    hasChapterCount: false,
  };

  const $infobox = findInfobox($);
  if (!$infobox) return analysis;

  analysis.hasInfobox = true;
  analysis.infoboxClass = getInfoboxClass($infobox);
  extractInfoboxFields($, $infobox, analysis);

  return analysis;
}

/**
 * Find the infobox element.
 */
function findInfobox($: cheerio.CheerioAPI): cheerio.Cheerio<Element> | null {
  for (const className of INFOBOX_CLASSES) {
    const found = $(`.${className}`);
    if (found.length > 0) return found.first() as cheerio.Cheerio<Element>;
  }

  const generic = $('table.infobox');
  return generic.length > 0 ? generic.first() as cheerio.Cheerio<Element> : null;
}

/**
 * Get the infobox class name.
 */
function getInfoboxClass($infobox: cheerio.Cheerio<Element>): string {
  for (const className of INFOBOX_CLASSES) {
    if ($infobox.hasClass(className)) return className;
  }
  return 'infobox';
}

/**
 * Extract fields from infobox.
 */
function extractInfoboxFields(
  $: cheerio.CheerioAPI,
  $infobox: cheerio.Cheerio<Element>,
  analysis: InfoboxAnalysis
): void {
  $infobox.find('tr').each((_, row) => {
    const $row = $(row);
    const label = $row.find('th').text().trim().toLowerCase();

    if (label) {
      analysis.fields.push(label);
      if (label.includes('volume')) analysis.hasVolumeCount = true;
      if (label.includes('chapter')) analysis.hasChapterCount = true;
    }

    if ($row.find('img').length > 0) analysis.hasCoverImage = true;
  });

  if ($infobox.find('.infobox-image img').length > 0) {
    analysis.hasCoverImage = true;
  }
}

// ============================================================================
// Link Analysis
// ============================================================================

/**
 * Analyze links in the page.
 */
function analyzeLinks($: cheerio.CheerioAPI): LinkAnalysis {
  const analysis: LinkAnalysis = {
    volumeLinks: 0,
    chapterLinks: 0,
    linksToListPage: false,
    listPageUrl: null,
    linkPatterns: [],
  };

  const seenPatterns = new Set<string>();

  $('a').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim().toLowerCase();

    countLinkTypes(analysis, href, text);
    checkListPageLink(analysis, href);
    collectLinkPattern(analysis, href, seenPatterns);
  });

  return analysis;
}

/**
 * Count volume and chapter links.
 */
function countLinkTypes(analysis: LinkAnalysis, href: string, text: string): void {
  if (href.includes('Volume_') || href.includes('volume_') ||
      text.includes('volume') || /vol\.?\s*\d+/i.test(text)) {
    analysis.volumeLinks++;
  }

  if (href.includes('Chapter_') || href.includes('chapter_') ||
      text.includes('chapter') || /ch\.?\s*\d+/i.test(text)) {
    analysis.chapterLinks++;
  }
}

/**
 * Check if link points to a list page.
 */
function checkListPageLink(analysis: LinkAnalysis, href: string): void {
  if (!href.includes('List_of_')) return;
  if (!href.includes('chapter') && !href.includes('volume')) return;

  analysis.linksToListPage = true;
  if (!analysis.listPageUrl) {
    const match = href.match(/\/wiki\/(List_of_[^#?]+)/);
    if (match?.[1]) {
      analysis.listPageUrl = `https://en.wikipedia.org/wiki/${match[1]}`;
    }
  }
}

/**
 * Collect link patterns.
 */
function collectLinkPattern(
  analysis: LinkAnalysis,
  href: string,
  seenPatterns: Set<string>
): void {
  if (seenPatterns.size >= 5) return;
  if (!href.includes('Chapter_') && !href.includes('Volume_')) return;

  const pattern = href.replace(/\d+/g, 'N');
  if (!seenPatterns.has(pattern)) {
    seenPatterns.add(pattern);
    analysis.linkPatterns.push(pattern);
  }
}

// ============================================================================
// Structure Type Determination
// ============================================================================

/**
 * Determine the overall structure type of the page.
 */
function determineStructureType(
  tables: WikitableAnalysis,
  sections: SectionAnalysis,
  infobox: InfoboxAnalysis
): WikipediaStructureType {
  if (tables.volumeTables > 0) return WikipediaStructureType.WIKITABLE_VOLUMES;
  if (tables.chapterTables > 0) return WikipediaStructureType.WIKITABLE_CHAPTERS;
  if (tables.combinedTables > 0) return WikipediaStructureType.COMBINED_TABLE;
  if (sections.hasMediaSection) return WikipediaStructureType.MEDIA_SECTION;
  if (sections.hasPublicationSection) return WikipediaStructureType.PUBLICATION_SECTION;
  if (sections.hasMangaSection) return WikipediaStructureType.MEDIA_SECTION;
  if (infobox.hasInfobox && tables.totalCount === 0) return WikipediaStructureType.INFOBOX_ONLY;
  if (tables.totalCount > 0) return WikipediaStructureType.COMBINED_TABLE;

  return WikipediaStructureType.UNKNOWN;
}

// ============================================================================
// Parser Recommendation
// ============================================================================

interface ParserRecommendation {
  parser: WikipediaParserType;
  confidence: number;
  reason: string;
}

/**
 * Recommend the best parser based on analysis.
 */
// eslint-disable-next-line max-params -- Parser recommendation requires all analysis components
function recommendParser(
  pageType: WikipediaPageType,
  structureType: WikipediaStructureType,
  tables: WikitableAnalysis,
  sections: SectionAnalysis,
  infobox: InfoboxAnalysis,
  links: LinkAnalysis
): ParserRecommendation {
  // List pages with tables are most reliable
  if (pageType === 'list-page' && tables.totalCount > 0) {
    return { parser: 'list-page', confidence: 0.95, reason: 'Dedicated list page with tables' };
  }

  // Volume/chapter tables
  const isVolumeOrChapter = structureType === WikipediaStructureType.WIKITABLE_VOLUMES ||
                            structureType === WikipediaStructureType.WIKITABLE_CHAPTERS;
  if (isVolumeOrChapter) {
    const count = tables.volumeTables + tables.chapterTables;
    return { parser: 'wikitable', confidence: 0.85, reason: `Found ${count} structured tables` };
  }

  // Combined tables
  if (structureType === WikipediaStructureType.COMBINED_TABLE) {
    return { parser: 'combined', confidence: 0.8, reason: 'Found combined volume/chapter tables' };
  }

  // Media/Publication section
  const isMediaOrPub = structureType === WikipediaStructureType.MEDIA_SECTION ||
                       structureType === WikipediaStructureType.PUBLICATION_SECTION;
  if (isMediaOrPub) {
    return { parser: 'media-section', confidence: 0.7, reason: 'Data in Media/Publication section' };
  }

  // Infobox only
  if (structureType === WikipediaStructureType.INFOBOX_ONLY && infobox.hasInfobox) {
    return { parser: 'infobox-only', confidence: 0.5, reason: 'Only infobox data available' };
  }

  // Links to list page
  if (links.linksToListPage && links.listPageUrl) {
    return { parser: 'combined', confidence: 0.6, reason: 'Links to dedicated list page' };
  }

  return { parser: 'combined', confidence: 0.4, reason: 'Using combined approach as fallback' };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick check if page is a list page (without full analysis).
 */
export function isListPage(html: string, url?: string): boolean {
  if (url?.includes('List_of_')) return true;

  const $ = cheerio.load(html);
  const title = $('h1#firstHeading').text().trim();
  return title.toLowerCase().startsWith('list of');
}

/**
 * Quick check if page has manga-related content.
 */
export function hasMangaContent(html: string): boolean {
  const $ = cheerio.load(html);

  for (const className of INFOBOX_CLASSES) {
    if ($(`.${className}`).length > 0) return true;
  }

  const sections = $('h2 .mw-headline, h3 .mw-headline').map((_, el) =>
    $(el).text().toLowerCase()
  ).get();

  return sections.some(s =>
    s.includes('manga') || s.includes('volumes') || s.includes('chapters')
  );
}

/**
 * Extract section content by ID.
 */
export function extractSectionById(
  $: cheerio.CheerioAPI,
  sectionId: string
): cheerio.Cheerio<Element> | null {
  const $headline = $(`#${sectionId}`);
  if ($headline.length === 0) return null;

  const $header = $headline.closest('h2, h3');
  if ($header.length === 0) return null;

  const content = collectSectionContent($, $header);
  if (content.length === 0) return null;

  return wrapSectionContent($, content);
}

/**
 * Collect content elements for a section.
 */
function collectSectionContent(
  $: cheerio.CheerioAPI,
  $header: cheerio.Cheerio<AnyNode>
): Element[] {
  const content: Element[] = [];
  const headerLevel = $header.prop('tagName');
  let $current = $header.next();

  while ($current.length > 0) {
    const tagName = $current.prop('tagName') ?? '';
    if (shouldStopAtHeader(headerLevel ?? '', tagName)) break;

    content.push($current[0] as Element);
    $current = $current.next();
  }

  return content;
}

/**
 * Check if we should stop collecting at this header.
 */
function shouldStopAtHeader(currentLevel: string, nextTag: string): boolean {
  if (currentLevel === 'H2' && nextTag === 'H2') return true;
  if (currentLevel === 'H3' && (nextTag === 'H2' || nextTag === 'H3')) return true;
  return false;
}

/**
 * Wrap section content in a container.
 */
function wrapSectionContent(
  _$: cheerio.CheerioAPI,
  content: Element[]
): cheerio.Cheerio<Element> {
  const wrapper = cheerio.load('<div class="section-content"></div>');
  content.forEach(el => {
    const htmlContent = cheerio.load(el).html();
    if (htmlContent) {
      wrapper('.section-content').append(htmlContent);
    }
  });
  return wrapper('.section-content') as cheerio.Cheerio<Element>;
}
