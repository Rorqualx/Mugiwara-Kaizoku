// @file-size-justified: Static analyzer needs comprehensive pattern detection across 10+ wiki structures
/* eslint-disable max-lines -- Static analyzer needs comprehensive pattern detection across multiple wiki structures. Contains detection logic for 10+ parser types. */
/**
 * Static Analyzer for Fandom Wiki Pages
 *
 * Pre-processes raw HTML to identify structural patterns, naming conventions,
 * and content characteristics before parsing. Returns analysis metadata that
 * guides parsers to extract data accurately.
 *
 * @module static-analyzer
 */

import { load } from 'cheerio';

import { logger } from '@/utils/logger';

import { discoverPageStructure } from './dynamic-pattern-discovery';
import { detectNamingConvention } from './naming-convention-detector';

import type { DiscoveredStructure } from './dynamic-pattern-discovery';
import type { NamingConvention } from './naming-convention-detector';
import type { CheerioAPI } from 'cheerio';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Volume naming convention detected on the page.
 */
export interface VolumeNamingPattern {
  /** Primary pattern name */
  name: 'volume' | 'book' | 'tome' | 'tankōbon' | 'omnibus' | 'numbered';
  /** Regex patterns that match this convention */
  patterns: RegExp[];
  /** Number of matches found */
  matchCount: number;
  /** Examples found in content */
  examples: string[];
}

/**
 * Table structure analysis.
 */
export interface TableAnalysis {
  /** Total tables found */
  totalCount: number;
  /** Tables with wikitable class */
  wikitableCount: number;
  /** Plain tables without class */
  plainTableCount: number;
  /** Tables with # header (numbered pattern) */
  numberedTableCount: number;
  /** Tables with chapter links */
  tablesWithChapterLinks: number;
  /** Tables with volume data */
  tablesWithVolumeData: number;
  /** Collapsible tables */
  collapsibleTableCount: number;
  /** Nested table depth */
  maxNestingDepth: number;
  /** Dominant table structure */
  dominantStructure: 'wikitable' | 'plain' | 'numbered' | 'collapsible' | 'mixed';
}

/**
 * List structure analysis.
 */
export interface ListAnalysis {
  /** Total list elements */
  totalCount: number;
  /** Unordered lists with chapter content */
  bulletedWithChapters: number;
  /** Ordered lists with chapter content */
  numberedWithChapters: number;
  /** Nested list depth */
  maxNestingDepth: number;
  /** Lists following headers */
  listsFollowingHeaders: number;
  /** Dominant list pattern */
  dominantPattern: 'bulleted' | 'numbered' | 'nested' | 'none';
}

/**
 * Header structure analysis.
 */
export interface HeaderAnalysis {
  /** H2 headers count */
  h2Count: number;
  /** H3 headers count */
  h3Count: number;
  /** H4 headers count */
  h4Count: number;
  /** Headers containing volume keywords */
  volumeHeaders: number;
  /** Headers containing arc/saga keywords */
  arcHeaders: number;
  /** Headers containing chapter keywords */
  chapterHeaders: number;
  /** Header hierarchy pattern */
  hierarchyPattern: 'flat' | 'volume-based' | 'arc-based' | 'mixed';
}

/**
 * Link pattern analysis.
 */
export interface LinkAnalysis {
  /** Total internal wiki links */
  totalWikiLinks: number;
  /** Links to chapter pages */
  chapterLinks: number;
  /** Links to volume pages */
  volumeLinks: number;
  /** Links to character pages */
  characterLinks: number;
  /** Chapter link URL pattern */
  chapterLinkPattern: 'numeric' | 'titled' | 'mixed' | 'none';
  /** Example chapter URLs */
  chapterUrlExamples: string[];
  /** Volume link URL pattern */
  volumeLinkPattern: 'numeric' | 'titled' | 'mixed' | 'none';
}

/**
 * Content pattern analysis.
 */
export interface ContentAnalysis {
  /** Date formats detected */
  dateFormats: string[];
  /** ISBN patterns found */
  hasIsbn: boolean;
  /** Page count patterns */
  hasPageCounts: boolean;
  /** Japanese text presence */
  hasJapaneseText: boolean;
  /** Romanization patterns */
  hasRomanization: boolean;
  /** Release date columns */
  hasReleaseDates: boolean;
}

/**
 * Image and gallery analysis.
 */
export interface ImageAnalysis {
  /** Total images */
  totalImages: number;
  /** Lazy-loaded images */
  lazyLoadedImages: number;
  /** Gallery sections */
  gallerySections: number;
  /** Cover images detected */
  coverImages: number;
  /** Tabbed image sections (JP/EN) */
  tabbedSections: number;
}

/**
 * Category page analysis.
 */
export interface CategoryAnalysis {
  /** Is this a category page */
  isCategoryPage: boolean;
  /** Category member count */
  memberCount: number;
  /** Has alphabetical grouping */
  hasAlphabeticalGrouping: boolean;
  /** Category type */
  categoryType: 'volumes' | 'chapters' | 'characters' | 'other' | 'none';
}

/**
 * Complete static analysis result.
 */
export interface StaticAnalysisResult {
  /** Analysis timestamp */
  analyzedAt: Date;
  /** Time taken in ms */
  analysisTimeMs: number;

  // === Naming Conventions ===
  /** Chapter naming convention */
  chapterNaming: {
    convention: NamingConvention | null;
    confidence: number;
    matchCount: number;
  };
  /** Volume naming convention */
  volumeNaming: VolumeNamingPattern;

  // === Structure Analysis ===
  /** Table structure */
  tables: TableAnalysis;
  /** List structure */
  lists: ListAnalysis;
  /** Header structure */
  headers: HeaderAnalysis;
  /** Link patterns */
  links: LinkAnalysis;

  // === Content Analysis ===
  /** Content patterns */
  content: ContentAnalysis;
  /** Image/gallery analysis */
  images: ImageAnalysis;
  /** Category page analysis */
  category: CategoryAnalysis;

  // === Dynamic Discovery ===
  /** Dynamically discovered patterns (for novel/unknown structures) */
  dynamicDiscovery: DiscoveredStructure | null;

  // === Recommendations ===
  /** Recommended parser strategy */
  recommendedParser: ParserRecommendation;
  /** Parsing hints for the selected parser */
  parsingHints: ParsingHints;
}

/**
 * Parser recommendation based on analysis.
 */
export interface ParserRecommendation {
  /** Primary parser to use */
  primary: ParserType;
  /** Fallback parsers in order */
  fallbacks: ParserType[];
  /** Confidence in recommendation (0-1) */
  confidence: number;
  /** Reason for recommendation */
  reason: string;
}

/**
 * Available parser types.
 */
export type ParserType =
  | 'table-adaptive'
  | 'plain-table'
  | 'numbered-table'
  | 'bulleted-list'
  | 'arc-based'
  | 'category-page'
  | 'alternating-row'
  | 'numbered-row'
  | 'per-volume'
  | 'hybrid';

/**
 * Hints to guide the selected parser.
 */
export interface ParsingHints {
  /** Chapter naming convention to use */
  chapterConvention: NamingConvention | null;
  /** CSS selectors for volume containers */
  volumeSelectors: string[];
  /** CSS selectors for chapter links */
  chapterSelectors: string[];
  /** Expected chapter link URL pattern */
  chapterUrlPattern: RegExp | null;
  /** Whether to look in collapsible sections */
  checkCollapsible: boolean;
  /** Whether to check nested lists */
  checkNestedLists: boolean;
  /** Whether page has JP/EN tabs */
  hasJpEnTabs: boolean;
  /** Skip these selectors (navbox, toc, etc.) */
  skipSelectors: string[];
}

// ============================================================================
// Volume Naming Detection
// ============================================================================

const VOLUME_NAMING_PATTERNS: Record<string, RegExp[]> = {
  volume: [
    /Volume\s*(\d+)/gi,
    /Vol\.\s*(\d+)/gi,
    /Vol\s*(\d+)/gi,
  ],
  book: [
    /Book\s*(\d+)/gi,
  ],
  tome: [
    /Tome\s*(\d+)/gi,
  ],
  'tankōbon': [
    /Tankōbon\s*(\d+)/gi,
    /Tankobon\s*(\d+)/gi,
  ],
  omnibus: [
    /Omnibus\s*(\d+)/gi,
    /3-in-1\s*(\d+)/gi,
  ],
  numbered: [
    /^#\s*(\d+)/gm,
  ],
};

function detectVolumeNaming(text: string): VolumeNamingPattern {
  let bestMatch: VolumeNamingPattern = {
    name: 'volume',
    patterns: VOLUME_NAMING_PATTERNS['volume'] ?? [],
    matchCount: 0,
    examples: [],
  };

  for (const [name, patterns] of Object.entries(VOLUME_NAMING_PATTERNS)) {
    let totalMatches = 0;
    const examples: string[] = [];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        totalMatches += matches.length;
        examples.push(...matches.slice(0, 3));
      }
    }

    if (totalMatches > bestMatch.matchCount) {
      bestMatch = {
        name: name as VolumeNamingPattern['name'],
        patterns,
        matchCount: totalMatches,
        examples: examples.slice(0, 5),
      };
    }
  }

  return bestMatch;
}

// ============================================================================
// Table Analysis
// ============================================================================

function analyzeTableStructure($: CheerioAPI): TableAnalysis {
  const $content = $('.mw-parser-output');
  const $allTables = $content.find('table').not('.navbox').not('.toc');

  let wikitableCount = 0;
  let plainTableCount = 0;
  let numberedTableCount = 0;
  let tablesWithChapterLinks = 0;
  let tablesWithVolumeData = 0;
  let collapsibleTableCount = 0;
  let maxNestingDepth = 0;

  $allTables.each((_, table) => {
    const $table = $(table);
    const classes = $table.attr('class') ?? '';
    const text = $table.text();

    // Classify table type
    if (classes.includes('wikitable')) {
      wikitableCount++;
    } else {
      plainTableCount++;
    }

    // Check for numbered pattern (# header)
    const headerText = $table.find('tr').first().text();
    if (/^#\s/m.test(headerText) || /\s#\s/.test(headerText)) {
      numberedTableCount++;
    }

    // Check for chapter links
    if ($table.find('a[href*="Chapter"], a[href*="chapter"]').length > 0) {
      tablesWithChapterLinks++;
    }

    // Check for volume data
    if (/Volume\s*\d+/i.test(text)) {
      tablesWithVolumeData++;
    }

    // Check for collapsible
    if (classes.includes('collapsible') || classes.includes('mw-collapsible')) {
      collapsibleTableCount++;
    }

    // Check nesting depth
    const depth = $table.parents('table').length;
    maxNestingDepth = Math.max(maxNestingDepth, depth);
  });

  // Determine dominant structure
  let dominantStructure: TableAnalysis['dominantStructure'] = 'mixed';
  const total = $allTables.length;

  if (numberedTableCount > total * 0.5) {
    dominantStructure = 'numbered';
  } else if (wikitableCount > total * 0.5) {
    dominantStructure = 'wikitable';
  } else if (plainTableCount > total * 0.5) {
    dominantStructure = 'plain';
  } else if (collapsibleTableCount > total * 0.3) {
    dominantStructure = 'collapsible';
  }

  return {
    totalCount: total,
    wikitableCount,
    plainTableCount,
    numberedTableCount,
    tablesWithChapterLinks,
    tablesWithVolumeData,
    collapsibleTableCount,
    maxNestingDepth,
    dominantStructure,
  };
}

// ============================================================================
// List Analysis
// ============================================================================

function analyzeListStructure($: CheerioAPI): ListAnalysis {
  const $content = $('.mw-parser-output');
  const $allLists = $content.find('ul, ol');

  let bulletedWithChapters = 0;
  let numberedWithChapters = 0;
  let listsFollowingHeaders = 0;
  let maxNestingDepth = 0;

  $allLists.each((_, list) => {
    const $list = $(list);
    const hasChapterLinks = $list.find('a[href*="Chapter"], a[href*="chapter"]').length > 0;
    const tagName = $(list).prop('tagName')?.toLowerCase();

    if (hasChapterLinks) {
      if (tagName === 'ul') {
        bulletedWithChapters++;
      } else {
        numberedWithChapters++;
      }
    }

    // Check if list follows a header
    const $prev = $list.prev();
    if ($prev.is('h2, h3, h4, h5')) {
      listsFollowingHeaders++;
    }

    // Check nesting
    const depth = $list.parents('ul, ol').length;
    maxNestingDepth = Math.max(maxNestingDepth, depth);
  });

  // Determine dominant pattern
  let dominantPattern: ListAnalysis['dominantPattern'] = 'none';
  if (bulletedWithChapters > 5 || numberedWithChapters > 5) {
    if (bulletedWithChapters > numberedWithChapters) {
      dominantPattern = maxNestingDepth > 1 ? 'nested' : 'bulleted';
    } else {
      dominantPattern = 'numbered';
    }
  }

  return {
    totalCount: $allLists.length,
    bulletedWithChapters,
    numberedWithChapters,
    maxNestingDepth,
    listsFollowingHeaders,
    dominantPattern,
  };
}

// ============================================================================
// Header Analysis
// ============================================================================

function analyzeHeaderStructure($: CheerioAPI): HeaderAnalysis {
  const $content = $('.mw-parser-output');

  const h2Count = $content.find('h2').length;
  const h3Count = $content.find('h3').length;
  const h4Count = $content.find('h4').length;

  let volumeHeaders = 0;
  let arcHeaders = 0;
  let chapterHeaders = 0;

  $content.find('h2, h3, h4').each((_, header) => {
    const text = $(header).text().toLowerCase();

    if (/volume|vol\.|tankōbon|book/i.test(text)) {
      volumeHeaders++;
    }
    if (/arc|saga|part|season/i.test(text)) {
      arcHeaders++;
    }
    if (/chapter|episode|stage|mission/i.test(text)) {
      chapterHeaders++;
    }
  });

  // Determine hierarchy pattern
  let hierarchyPattern: HeaderAnalysis['hierarchyPattern'] = 'flat';
  if (arcHeaders > 3) {
    hierarchyPattern = 'arc-based';
  } else if (volumeHeaders > 3) {
    hierarchyPattern = 'volume-based';
  } else if (h2Count > 0 && h3Count > h2Count * 2) {
    hierarchyPattern = 'mixed';
  }

  return {
    h2Count,
    h3Count,
    h4Count,
    volumeHeaders,
    arcHeaders,
    chapterHeaders,
    hierarchyPattern,
  };
}

// ============================================================================
// Link Analysis
// ============================================================================

function analyzeLinkPatterns($: CheerioAPI): LinkAnalysis {
  const $content = $('.mw-parser-output');
  const $wikiLinks = $content.find('a[href^="/wiki/"]');

  let chapterLinks = 0;
  let volumeLinks = 0;
  let characterLinks = 0;
  const chapterUrlExamples: string[] = [];
  let numericChapterLinks = 0;
  let titledChapterLinks = 0;
  let numericVolumeLinks = 0;
  let titledVolumeLinks = 0;

  $wikiLinks.each((_, link) => {
    const href = $(link).attr('href') ?? '';
    const hrefLower = href.toLowerCase();

    if (hrefLower.includes('chapter') || hrefLower.includes('episode') || hrefLower.includes('stage')) {
      chapterLinks++;
      if (chapterUrlExamples.length < 5) {
        chapterUrlExamples.push(href);
      }

      // Check if numeric or titled
      if (/chapter[_\s]?\d+/i.test(href)) {
        numericChapterLinks++;
      } else {
        titledChapterLinks++;
      }
    }

    if (hrefLower.includes('volume')) {
      volumeLinks++;
      if (/volume[_\s]?\d+/i.test(href)) {
        numericVolumeLinks++;
      } else {
        titledVolumeLinks++;
      }
    }

    if (hrefLower.includes('character') || hrefLower.includes('(character)')) {
      characterLinks++;
    }
  });

  // Determine link patterns
  let chapterLinkPattern: LinkAnalysis['chapterLinkPattern'] = 'none';
  if (numericChapterLinks > titledChapterLinks * 2) {
    chapterLinkPattern = 'numeric';
  } else if (titledChapterLinks > numericChapterLinks * 2) {
    chapterLinkPattern = 'titled';
  } else if (chapterLinks > 0) {
    chapterLinkPattern = 'mixed';
  }

  let volumeLinkPattern: LinkAnalysis['volumeLinkPattern'] = 'none';
  if (numericVolumeLinks > titledVolumeLinks * 2) {
    volumeLinkPattern = 'numeric';
  } else if (titledVolumeLinks > numericVolumeLinks * 2) {
    volumeLinkPattern = 'titled';
  } else if (volumeLinks > 0) {
    volumeLinkPattern = 'mixed';
  }

  return {
    totalWikiLinks: $wikiLinks.length,
    chapterLinks,
    volumeLinks,
    characterLinks,
    chapterLinkPattern,
    chapterUrlExamples,
    volumeLinkPattern,
  };
}

// ============================================================================
// Content Analysis
// ============================================================================

function analyzeContentPatterns($: CheerioAPI): ContentAnalysis {
  const text = $('.mw-parser-output').text();

  // Detect date formats
  const dateFormats: string[] = [];
  if (/\w+\s+\d{1,2},?\s+\d{4}/.test(text)) dateFormats.push('Month DD, YYYY');
  if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text)) dateFormats.push('YYYY-MM-DD');
  if (/\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(text)) dateFormats.push('DD/MM/YYYY');

  // Check for ISBN
  const hasIsbn = /ISBN[-:\s]*(978[-\s]?\d)/i.test(text);

  // Check for page counts
  const hasPageCounts = /\d+\s*pages?/i.test(text) || /pages?:\s*\d+/i.test(text);

  // Check for Japanese text
  const hasJapaneseText = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);

  // Check for romanization
  const hasRomanization = /[Rr]omaji|[Rr]ōmaji|[Hh]epburn/.test(text);

  // Check for release date columns
  const hasReleaseDates = /release\s*date/i.test(text) || /発売日/.test(text);

  return {
    dateFormats,
    hasIsbn,
    hasPageCounts,
    hasJapaneseText,
    hasRomanization,
    hasReleaseDates,
  };
}

// ============================================================================
// Image Analysis
// ============================================================================

function analyzeImages($: CheerioAPI): ImageAnalysis {
  const $content = $('.mw-parser-output');

  const $images = $content.find('img');
  const lazyLoadedImages = $content.find('img[data-src], noscript img').length;
  const gallerySections = $content.find('.wikia-gallery, .gallery, .gallerybox').length;
  const tabbedSections = $content.find('.tabber, .wds-tabs, .pi-tab-link').length;

  // Count likely cover images
  let coverImages = 0;
  $images.each((_, img) => {
    const src = $(img).attr('src') ?? $(img).attr('data-src') ?? '';
    const alt = $(img).attr('alt') ?? '';
    if (/cover|volume|vol/i.test(src) || /cover|volume|vol/i.test(alt)) {
      coverImages++;
    }
  });

  return {
    totalImages: $images.length,
    lazyLoadedImages,
    gallerySections,
    coverImages,
    tabbedSections,
  };
}

// ============================================================================
// Category Analysis
// ============================================================================

function analyzeCategoryPage($: CheerioAPI): CategoryAnalysis {
  const isCategoryPage = $('.category-page, .category-page__members').length > 0;

  if (!isCategoryPage) {
    return {
      isCategoryPage: false,
      memberCount: 0,
      hasAlphabeticalGrouping: false,
      categoryType: 'none',
    };
  }

  const memberCount = $('.category-page__member, .category-page__member-link').length;
  const hasAlphabeticalGrouping = $('.category-page__first-char').length > 0;

  // Determine category type from title/content
  const pageTitle = $('h1').first().text().toLowerCase();
  let categoryType: CategoryAnalysis['categoryType'] = 'other';

  if (/volumes?/i.test(pageTitle)) {
    categoryType = 'volumes';
  } else if (/chapters?/i.test(pageTitle)) {
    categoryType = 'chapters';
  } else if (/characters?/i.test(pageTitle)) {
    categoryType = 'characters';
  }

  return {
    isCategoryPage,
    memberCount,
    hasAlphabeticalGrouping,
    categoryType,
  };
}

// ============================================================================
// Parser Recommendation
// ============================================================================

function generateRecommendation(
  tables: TableAnalysis,
  lists: ListAnalysis,
  headers: HeaderAnalysis,
  category: CategoryAnalysis,
  chapterConvention: NamingConvention | null
): ParserRecommendation {
  const fallbacks: ParserType[] = [];
  let primary: ParserType = 'table-adaptive';
  let confidence = 0.5;
  let reason = 'Default table parser';

  // Category page takes priority
  if (category.isCategoryPage) {
    return {
      primary: 'category-page',
      fallbacks: ['table-adaptive'],
      confidence: 0.95,
      reason: 'Detected category page structure',
    };
  }

  // Numbered table pattern (Demon Slayer style)
  if (tables.numberedTableCount > 5) {
    primary = 'numbered-table';
    confidence = 0.9;
    reason = `Found ${tables.numberedTableCount} numbered tables with # pattern`;
    fallbacks.push('plain-table', 'table-adaptive');
  }
  // Arc-based structure (Re:Zero, Vinland Saga style)
  else if (headers.hierarchyPattern === 'arc-based') {
    primary = 'arc-based';
    confidence = 0.85;
    reason = `Found ${headers.arcHeaders} arc headers`;
    fallbacks.push('table-adaptive', 'bulleted-list');
  }
  // Bulleted list structure (Mob Psycho style)
  else if (lists.dominantPattern === 'bulleted' || lists.dominantPattern === 'nested') {
    primary = 'bulleted-list';
    confidence = 0.85;
    reason = `Found ${lists.bulletedWithChapters} bulleted lists with chapters`;
    fallbacks.push('table-adaptive');
  }
  // Plain table structure (One Piece style)
  else if (tables.dominantStructure === 'plain' && tables.tablesWithVolumeData > 3) {
    primary = 'plain-table';
    confidence = 0.85;
    reason = `Found ${tables.tablesWithVolumeData} plain tables with volume data`;
    fallbacks.push('table-adaptive', 'bulleted-list');
  }
  // Collapsible structure
  else if (tables.collapsibleTableCount > 3) {
    primary = 'table-adaptive';
    confidence = 0.8;
    reason = `Found ${tables.collapsibleTableCount} collapsible tables`;
    fallbacks.push('bulleted-list');
  }
  // Default to table-adaptive
  else if (tables.tablesWithChapterLinks > 0) {
    primary = 'table-adaptive';
    confidence = 0.7;
    reason = `Found ${tables.tablesWithChapterLinks} tables with chapter links`;
    fallbacks.push('bulleted-list', 'plain-table');
  }

  // Boost confidence if we have a naming convention match
  if (chapterConvention) {
    confidence = Math.min(confidence + 0.1, 0.98);
  }

  return { primary, fallbacks, confidence, reason };
}

// ============================================================================
// Parsing Hints Generation
// ============================================================================

// eslint-disable-next-line max-params -- Hint generation requires all analysis results
function generateParsingHints(
  $: CheerioAPI,
  tables: TableAnalysis,
  lists: ListAnalysis,
  links: LinkAnalysis,
  images: ImageAnalysis,
  chapterConvention: NamingConvention | null
): ParsingHints {
  // Build volume selectors based on detected patterns
  const volumeSelectors: string[] = ['table:not(.navbox)', '.wikitable'];
  if (tables.numberedTableCount > 0) {
    volumeSelectors.push('table td:first-child');
  }

  // Build chapter selectors
  const chapterSelectors: string[] = [];
  if (chapterConvention) {
    // Add selectors based on convention
    const baseName = chapterConvention.name;
    chapterSelectors.push(
      `a[href*="${baseName}"]`,
      `a[title*="${baseName}"]`
    );
  }
  chapterSelectors.push(
    'a[href*="Chapter"]',
    'a[href*="chapter"]',
    'a[title*="Chapter"]'
  );

  // Build chapter URL pattern
  let chapterUrlPattern: RegExp | null = null;
  const firstExample = links.chapterUrlExamples[0];
  if (firstExample) {
    if (/Chapter[_\s]?\d+/i.test(firstExample)) {
      chapterUrlPattern = /Chapter[_\s]?(\d+)/i;
    } else if (/Stage[_\s]?\d+/i.test(firstExample)) {
      chapterUrlPattern = /Stage[_\s]?(\d+)/i;
    } else if (/Episode[_\s]?\d+/i.test(firstExample)) {
      chapterUrlPattern = /Episode[_\s]?(\d+)/i;
    }
  }

  return {
    chapterConvention,
    volumeSelectors,
    chapterSelectors,
    chapterUrlPattern,
    checkCollapsible: tables.collapsibleTableCount > 0,
    checkNestedLists: lists.maxNestingDepth > 1,
    hasJpEnTabs: images.tabbedSections > 0,
    skipSelectors: ['.navbox', '.toc', '.mbox', '.ambox', '.references'],
  };
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Performs comprehensive static analysis on HTML content.
 *
 * @param html - Raw HTML content to analyze
 * @returns Complete analysis result with recommendations
 */
export function analyzePageStructure(html: string): StaticAnalysisResult {
  const startTime = Date.now();
  const $ = load(html);
  const text = $('.mw-parser-output').text();

  // Run all analyses
  const chapterNamingResult = detectNamingConvention(html);
  const volumeNaming = detectVolumeNaming(text);
  const tables = analyzeTableStructure($);
  const lists = analyzeListStructure($);
  const headers = analyzeHeaderStructure($);
  const links = analyzeLinkPatterns($);
  const content = analyzeContentPatterns($);
  const images = analyzeImages($);
  const category = analyzeCategoryPage($);

  // Run dynamic discovery if no strong hardcoded pattern found
  let dynamicDiscovery: DiscoveredStructure | null = null;
  if (chapterNamingResult.confidence < 0.5 || chapterNamingResult.matchCount < 10) {
    logger.debug('[static-analyzer] Running dynamic pattern discovery (no strong hardcoded pattern)');
    dynamicDiscovery = discoverPageStructure(html);

    // If dynamic discovery found a strong pattern, log it
    if (dynamicDiscovery.chapterPattern && dynamicDiscovery.chapterPattern.confidence > 0.5) {
      logger.info(
        `[static-analyzer] Dynamic discovery found: "${dynamicDiscovery.chapterPattern.prefix}" ` +
        `(${dynamicDiscovery.chapterPattern.count} occurrences, ${Math.round(dynamicDiscovery.chapterPattern.confidence * 100)}% confidence)`
      );
    }
  }

  // Generate recommendations
  const recommendedParser = generateRecommendation(
    tables,
    lists,
    headers,
    category,
    chapterNamingResult.convention
  );

  const parsingHints = generateParsingHints(
    $,
    tables,
    lists,
    links,
    images,
    chapterNamingResult.convention
  );

  const analysisTimeMs = Date.now() - startTime;

  logger.info(
    `[static-analyzer] Analysis complete in ${analysisTimeMs}ms. ` +
    `Recommended: ${recommendedParser.primary} (${(recommendedParser.confidence * 100).toFixed(0)}% confidence)`
  );

  return {
    analyzedAt: new Date(),
    analysisTimeMs,
    chapterNaming: {
      convention: chapterNamingResult.convention,
      confidence: chapterNamingResult.confidence,
      matchCount: chapterNamingResult.matchCount,
    },
    volumeNaming,
    tables,
    lists,
    headers,
    links,
    content,
    images,
    category,
    dynamicDiscovery,
    recommendedParser,
    parsingHints,
  };
}

/**
 * Quick analysis for parser selection only.
 * Faster than full analysis when you only need parser recommendation.
 */
export function quickAnalyze(html: string): {
  parser: ParserType;
  fallbacks: ParserType[];
  hints: ParsingHints;
} {
  const $ = load(html);
  // Note: text extraction reserved for future content analysis
  const _text = $('.mw-parser-output').text();

  const chapterNaming = detectNamingConvention(html);
  const tables = analyzeTableStructure($);
  const lists = analyzeListStructure($);
  const headers = analyzeHeaderStructure($);
  const links = analyzeLinkPatterns($);
  const images = analyzeImages($);
  const category = analyzeCategoryPage($);

  const recommendation = generateRecommendation(
    tables,
    lists,
    headers,
    category,
    chapterNaming.convention
  );

  const hints = generateParsingHints(
    $,
    tables,
    lists,
    links,
    images,
    chapterNaming.convention
  );

  return {
    parser: recommendation.primary,
    fallbacks: recommendation.fallbacks,
    hints,
  };
}

/**
 * Formats analysis result as a readable report.
 */
export function formatAnalysisReport(result: StaticAnalysisResult): string {
  const lines: string[] = [
    '=== Static Analysis Report ===',
    `Analyzed: ${result.analyzedAt.toISOString()}`,
    `Duration: ${result.analysisTimeMs}ms`,
    '',
    '--- Chapter Naming ---',
    `Convention: ${result.chapterNaming.convention?.displayName ?? 'Standard (Chapter)'}`,
    `Confidence: ${(result.chapterNaming.confidence * 100).toFixed(0)}%`,
    `Matches: ${result.chapterNaming.matchCount}`,
    '',
    '--- Volume Naming ---',
    `Pattern: ${result.volumeNaming.name}`,
    `Matches: ${result.volumeNaming.matchCount}`,
    `Examples: ${result.volumeNaming.examples.slice(0, 3).join(', ')}`,
    '',
    '--- Table Structure ---',
    `Total: ${result.tables.totalCount}`,
    `Wikitable: ${result.tables.wikitableCount}`,
    `Plain: ${result.tables.plainTableCount}`,
    `Numbered (#): ${result.tables.numberedTableCount}`,
    `With chapters: ${result.tables.tablesWithChapterLinks}`,
    `Dominant: ${result.tables.dominantStructure}`,
    '',
    '--- List Structure ---',
    `Bulleted with chapters: ${result.lists.bulletedWithChapters}`,
    `Dominant: ${result.lists.dominantPattern}`,
    '',
    '--- Headers ---',
    `Hierarchy: ${result.headers.hierarchyPattern}`,
    `Volume headers: ${result.headers.volumeHeaders}`,
    `Arc headers: ${result.headers.arcHeaders}`,
    '',
    '--- Links ---',
    `Chapter links: ${result.links.chapterLinks}`,
    `Pattern: ${result.links.chapterLinkPattern}`,
    '',
    '--- Recommendation ---',
    `Parser: ${result.recommendedParser.primary}`,
    `Confidence: ${(result.recommendedParser.confidence * 100).toFixed(0)}%`,
    `Reason: ${result.recommendedParser.reason}`,
    `Fallbacks: ${result.recommendedParser.fallbacks.join(', ')}`,
  ];

  return lines.join('\n');
}
