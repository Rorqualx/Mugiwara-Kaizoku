/**
 * Dynamic Pattern Discovery for Fandom Wikis
 *
 * Discovers novel/unknown naming conventions and page structures by analyzing:
 * - Link text patterns (finds repeating numbered patterns)
 * - Header patterns (identifies volume/chapter groupings)
 * - Table column headers (understands data structure)
 * - URL patterns (extracts naming from hrefs)
 *
 * Unlike the hardcoded naming-convention-detector, this module can discover
 * completely unknown patterns like "Part X", "Section X", "Fragment X", etc.
 *
 * @module dynamic-pattern-discovery
 */

import { load } from 'cheerio';

import { logger } from '@/utils/logger';

import type { CheerioAPI } from 'cheerio';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * A discovered naming pattern with examples and confidence.
 */
export interface DiscoveredPattern {
  /** The pattern prefix (e.g., "Part", "Section", "Fragment") */
  prefix: string;
  /** Regex to extract numbers from this pattern */
  regex: RegExp;
  /** Number of occurrences found */
  count: number;
  /** Example matches */
  examples: string[];
  /** Confidence score 0-1 based on consistency */
  confidence: number;
  /** Whether this appears to be a chapter-level pattern */
  isChapterLevel: boolean;
  /** Whether this appears to be a volume-level pattern */
  isVolumeLevel: boolean;
}

/**
 * Discovered page structure from dynamic analysis.
 */
export interface DiscoveredStructure {
  /** Primary chapter naming pattern discovered */
  chapterPattern: DiscoveredPattern | null;
  /** Primary volume naming pattern discovered */
  volumePattern: DiscoveredPattern | null;
  /** All patterns discovered (sorted by count) */
  allPatterns: DiscoveredPattern[];
  /** Table column headers found */
  tableHeaders: string[][];
  /** Header hierarchy detected */
  headerHierarchy: HeaderNode[];
  /** Link patterns in URLs */
  urlPatterns: UrlPattern[];
  /** Overall confidence in discovery */
  confidence: number;
}

/**
 * Header hierarchy node for understanding page structure.
 */
export interface HeaderNode {
  level: number;
  text: string;
  pattern: DiscoveredPattern | null;
  children: HeaderNode[];
}

/**
 * URL pattern discovered from links.
 */
export interface UrlPattern {
  /** Base URL pattern */
  pattern: string;
  /** Regex to match */
  regex: RegExp;
  /** Number of matching URLs */
  count: number;
  /** Example URLs */
  examples: string[];
}

// ============================================================================
// Pattern Discovery from Text
// ============================================================================

/**
 * Discovers patterns from a collection of text strings.
 * Looks for "Word Number" or "Word.Number" or "Word_Number" patterns.
 */
function discoverPatternsFromTexts(texts: string[]): DiscoveredPattern[] {
  // Pattern to find "Word + Number" combinations
  // Matches: "Part 1", "Section.5", "Fragment_3", "第5章", etc.
  const wordNumberPatterns = new Map<string, { count: number; examples: string[]; numbers: number[] }>();

  for (const text of texts) {
    // Match Western patterns: Word followed by number
    const westernMatches = text.matchAll(/\b([A-Z][a-z]+)[\s._-]*(\d+(?:\.\d+)?)\b/g);
    for (const match of westernMatches) {
      const prefix = match[1];
      const number = parseFloat(match[2] ?? '0');
      if (!prefix) continue;

      const existing = wordNumberPatterns.get(prefix) ?? { count: 0, examples: [], numbers: [] };
      existing.count++;
      if (existing.examples.length < 5) {
        existing.examples.push(match[0]);
      }
      existing.numbers.push(number);
      wordNumberPatterns.set(prefix, existing);
    }

    // Match Japanese patterns: 第X章, 第X話, 第X巻, etc.
    const japaneseMatches = text.matchAll(/第(\d+)([章話巻編部節回])/g);
    for (const match of japaneseMatches) {
      const suffix = match[2];
      const number = parseInt(match[1] ?? '0', 10);
      const prefix = `第X${suffix}`;

      const existing = wordNumberPatterns.get(prefix) ?? { count: 0, examples: [], numbers: [] };
      existing.count++;
      if (existing.examples.length < 5) {
        existing.examples.push(match[0]);
      }
      existing.numbers.push(number);
      wordNumberPatterns.set(prefix, existing);
    }

    // Match Korean patterns: 제X화, 제X권, etc.
    const koreanMatches = text.matchAll(/제(\d+)([화권장편부])/g);
    for (const match of koreanMatches) {
      const suffix = match[2];
      const number = parseInt(match[1] ?? '0', 10);
      const prefix = `제X${suffix}`;

      const existing = wordNumberPatterns.get(prefix) ?? { count: 0, examples: [], numbers: [] };
      existing.count++;
      if (existing.examples.length < 5) {
        existing.examples.push(match[0]);
      }
      existing.numbers.push(number);
      wordNumberPatterns.set(prefix, existing);
    }
  }

  // Convert to DiscoveredPattern array
  const patterns: DiscoveredPattern[] = [];

  for (const [prefix, data] of wordNumberPatterns) {
    if (data.count < 3) continue; // Need at least 3 occurrences

    // Check if numbers are sequential/consistent
    const sortedNumbers = [...data.numbers].sort((a, b) => a - b);
    const hasSequence = checkSequentiality(sortedNumbers);

    // Build regex for this pattern
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('X', '');
    const regex = new RegExp(`${escapedPrefix}[\\s._-]*(\\d+(?:\\.\\d+)?)`, 'gi');

    // Determine if chapter or volume level
    const isChapterLevel = isChapterLevelPattern(prefix);
    const isVolumeLevel = isVolumeLevelPattern(prefix);

    // Calculate confidence
    const confidence = calculatePatternConfidence(data.count, hasSequence, sortedNumbers);

    patterns.push({
      prefix,
      regex,
      count: data.count,
      examples: data.examples,
      confidence,
      isChapterLevel,
      isVolumeLevel,
    });
  }

  // Sort by count (most common first)
  return patterns.sort((a, b) => b.count - a.count);
}

/**
 * Checks if a series of numbers appears sequential.
 */
function checkSequentiality(numbers: number[]): boolean {
  if (numbers.length < 3) return false;

  let sequentialCount = 0;
  for (let i = 1; i < numbers.length; i++) {
    const prev = numbers[i - 1];
    const curr = numbers[i];
    if (prev !== undefined && curr !== undefined && curr - prev === 1) {
      sequentialCount++;
    }
  }

  return sequentialCount >= numbers.length * 0.5;
}

/**
 * Determines if a prefix likely represents chapters.
 */
function isChapterLevelPattern(prefix: string): boolean {
  const chapterIndicators = [
    'chapter', 'ch', 'episode', 'ep', 'part', 'section', 'stage',
    'mission', 'case', 'file', 'round', 'night', 'act', 'scene',
    'track', 'lesson', 'log', 'tale', 'story', 'entry', 'record',
    '章', '話', '话', '回', '節', '편', '화',
  ];
  const lower = prefix.toLowerCase();
  return chapterIndicators.some((ind) => lower.includes(ind) || lower === `第x${ind}`);
}

/**
 * Determines if a prefix likely represents volumes.
 */
function isVolumeLevelPattern(prefix: string): boolean {
  const volumeIndicators = [
    'volume', 'vol', 'book', 'tome', 'tankōbon', 'tankobon', 'omnibus',
    'arc', 'saga', 'season', 'series',
    '巻', '권', '部', '편',
  ];
  const lower = prefix.toLowerCase();
  return volumeIndicators.some((ind) => lower.includes(ind) || lower === `第x${ind}`);
}

/**
 * Calculates confidence score for a discovered pattern.
 */
function calculatePatternConfidence(count: number, hasSequence: boolean, numbers: number[]): number {
  let confidence = 0;

  // Base confidence from count
  if (count >= 50) confidence += 0.4;
  else if (count >= 20) confidence += 0.3;
  else if (count >= 10) confidence += 0.2;
  else if (count >= 5) confidence += 0.1;

  // Bonus for sequential numbers
  if (hasSequence) confidence += 0.3;

  // Bonus for starting near 1
  const minNumber = Math.min(...numbers);
  if (minNumber <= 1) confidence += 0.2;
  else if (minNumber <= 5) confidence += 0.1;

  // Bonus for reasonable range
  const maxNumber = Math.max(...numbers);
  if (maxNumber <= 500 && maxNumber >= 5) confidence += 0.1;

  return Math.min(confidence, 1.0);
}

// ============================================================================
// URL Pattern Discovery
// ============================================================================

/**
 * Discovers patterns from URLs in links.
 */
function discoverUrlPatterns($: CheerioAPI): UrlPattern[] {
  const urlCounts = new Map<string, { count: number; examples: string[] }>();

  $('a[href*="/wiki/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    // Extract the page name part
    const match = href.match(/\/wiki\/([^#?]+)/);
    if (!match?.[1]) return;

    const pageName = decodeURIComponent(match[1]);

    // Find pattern by replacing numbers with placeholder
    const pattern = pageName.replace(/\d+/g, 'N');

    // Only track patterns that have numbers
    if (pattern === pageName) return;

    const existing = urlCounts.get(pattern) ?? { count: 0, examples: [] };
    existing.count++;
    if (existing.examples.length < 5) {
      existing.examples.push(pageName);
    }
    urlCounts.set(pattern, existing);
  });

  // Convert to UrlPattern array
  const patterns: UrlPattern[] = [];

  for (const [pattern, data] of urlCounts) {
    if (data.count < 3) continue;

    // Build regex from pattern
    const regexStr = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/N/g, '(\\d+)');
    const regex = new RegExp(regexStr, 'i');

    patterns.push({
      pattern,
      regex,
      count: data.count,
      examples: data.examples,
    });
  }

  return patterns.sort((a, b) => b.count - a.count);
}

// ============================================================================
// Table Header Analysis
// ============================================================================

/**
 * Extracts column headers from all tables on the page.
 */
function extractTableHeaders($: CheerioAPI): string[][] {
  const allHeaders: string[][] = [];

  $('table').each((_, table) => {
    const $table = $(table);
    const headers: string[] = [];

    // Check first row for headers
    $table.find('tr').first().find('th, td').each((_, cell) => {
      const text = $(cell).text().trim();
      if (text) headers.push(text);
    });

    if (headers.length > 0) {
      allHeaders.push(headers);
    }
  });

  return allHeaders;
}

// ============================================================================
// Header Hierarchy Analysis
// ============================================================================

/**
 * Builds a hierarchy of headers to understand page structure.
 */
function buildHeaderHierarchy($: CheerioAPI, patterns: DiscoveredPattern[]): HeaderNode[] {
  const headers: { level: number; text: string }[] = [];

  // Collect all headers
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName.toLowerCase();
    const level = parseInt(tagName.charAt(1), 10);
    const text = $el.text().trim();

    // Skip empty or edit section headers
    if (!text || text === 'Edit') return;

    headers.push({ level, text });
  });

  // Build hierarchy
  const root: HeaderNode[] = [];
  const stack: { node: HeaderNode; level: number }[] = [];

  for (const header of headers) {
    // Find matching pattern for this header
    let matchedPattern: DiscoveredPattern | null = null;
    for (const pattern of patterns) {
      if (pattern.regex.test(header.text)) {
        matchedPattern = pattern;
        break;
      }
    }

    const node: HeaderNode = {
      level: header.level,
      text: header.text,
      pattern: matchedPattern,
      children: [],
    };

    // Find parent
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top && top.level < header.level) {
        top.node.children.push(node);
        break;
      }
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    }

    stack.push({ node, level: header.level });
  }

  return root;
}

// ============================================================================
// Main Discovery Function
// ============================================================================

/**
 * Discovers novel patterns and structures from a wiki page.
 *
 * This function analyzes the page dynamically without relying on hardcoded patterns,
 * allowing it to discover completely unknown naming conventions.
 *
 * @param html - Raw HTML content
 * @returns Discovered structure with patterns and confidence
 */
export function discoverPageStructure(html: string): DiscoveredStructure {
  const $ = load(html);
  const $content = $('.mw-parser-output');

  // Collect all text sources for pattern discovery
  const linkTexts: string[] = [];
  const headerTexts: string[] = [];

  // Collect link texts
  $content.find('a').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 100) {
      linkTexts.push(text);
    }
  });

  // Collect header texts
  $content.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      headerTexts.push(text);
    }
  });

  // Discover patterns from links (likely chapters)
  const linkPatterns = discoverPatternsFromTexts(linkTexts);

  // Discover patterns from headers (likely volumes/arcs)
  const headerPatterns = discoverPatternsFromTexts(headerTexts);

  // Combine all patterns
  const allPatterns = [...linkPatterns, ...headerPatterns]
    .reduce((acc, pattern) => {
      // Merge duplicates
      const existing = acc.find((p) => p.prefix === pattern.prefix);
      if (existing) {
        existing.count += pattern.count;
        existing.confidence = Math.max(existing.confidence, pattern.confidence);
        existing.examples = [...new Set([...existing.examples, ...pattern.examples])].slice(0, 5);
      } else {
        acc.push({ ...pattern });
      }
      return acc;
    }, [] as DiscoveredPattern[])
    .sort((a, b) => b.count - a.count);

  // Identify primary chapter pattern (highest count chapter-level pattern)
  const chapterPattern = allPatterns.find((p) => p.isChapterLevel) ?? null;

  // Identify primary volume pattern (highest count volume-level pattern)
  const volumePattern = allPatterns.find((p) => p.isVolumeLevel) ?? null;

  // Discover URL patterns
  const urlPatterns = discoverUrlPatterns($);

  // Extract table headers
  const tableHeaders = extractTableHeaders($);

  // Build header hierarchy
  const headerHierarchy = buildHeaderHierarchy($, allPatterns);

  // Calculate overall confidence
  let confidence = 0;
  if (chapterPattern) confidence += chapterPattern.confidence * 0.5;
  if (volumePattern) confidence += volumePattern.confidence * 0.3;
  if (urlPatterns.length > 0) confidence += 0.1;
  if (tableHeaders.length > 0) confidence += 0.1;

  logger.info(`[dynamic-discovery] Discovered ${allPatterns.length} patterns, confidence: ${confidence.toFixed(2)}`);
  if (chapterPattern) {
    logger.info(`[dynamic-discovery] Chapter pattern: "${chapterPattern.prefix}" (${chapterPattern.count} occurrences)`);
  }
  if (volumePattern) {
    logger.info(`[dynamic-discovery] Volume pattern: "${volumePattern.prefix}" (${volumePattern.count} occurrences)`);
  }

  return {
    chapterPattern,
    volumePattern,
    allPatterns,
    tableHeaders,
    headerHierarchy,
    urlPatterns,
    confidence,
  };
}

/**
 * Creates a regex from a discovered pattern for use in extraction.
 */
export function patternToRegex(pattern: DiscoveredPattern): RegExp {
  return pattern.regex;
}

/**
 * Generates CSS selectors for links matching a discovered pattern.
 */
export function patternToLinkSelectors(pattern: DiscoveredPattern): string[] {
  const prefix = pattern.prefix.toLowerCase().replace(/\s+/g, '_');
  return [
    `a[href*="${prefix}"]`,
    `a[href*="${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}"]`,
    `a[title*="${pattern.prefix}"]`,
  ];
}

/**
 * Formats a discovery report for debugging.
 */
export function formatDiscoveryReport(discovery: DiscoveredStructure): string {
  const lines: string[] = [
    '=== Dynamic Pattern Discovery Report ===',
    `Overall Confidence: ${Math.round(discovery.confidence * 100)}%`,
    '',
  ];

  if (discovery.chapterPattern) {
    lines.push('--- Primary Chapter Pattern ---');
    lines.push(`  Prefix: ${discovery.chapterPattern.prefix}`);
    lines.push(`  Count: ${discovery.chapterPattern.count}`);
    lines.push(`  Examples: ${discovery.chapterPattern.examples.join(', ')}`);
    lines.push('');
  }

  if (discovery.volumePattern) {
    lines.push('--- Primary Volume Pattern ---');
    lines.push(`  Prefix: ${discovery.volumePattern.prefix}`);
    lines.push(`  Count: ${discovery.volumePattern.count}`);
    lines.push(`  Examples: ${discovery.volumePattern.examples.join(', ')}`);
    lines.push('');
  }

  if (discovery.allPatterns.length > 0) {
    lines.push('--- All Discovered Patterns ---');
    for (const p of discovery.allPatterns.slice(0, 10)) {
      const type = p.isVolumeLevel ? '[VOL]' : p.isChapterLevel ? '[CH]' : '[?]';
      lines.push(`  ${type} ${p.prefix}: ${p.count} occurrences (${Math.round(p.confidence * 100)}%)`);
    }
    lines.push('');
  }

  if (discovery.urlPatterns.length > 0) {
    lines.push('--- URL Patterns ---');
    for (const p of discovery.urlPatterns.slice(0, 5)) {
      lines.push(`  ${p.pattern}: ${p.count} URLs`);
    }
    lines.push('');
  }

  if (discovery.tableHeaders.length > 0) {
    lines.push('--- Table Headers ---');
    for (const headers of discovery.tableHeaders.slice(0, 3)) {
      lines.push(`  [${headers.join(' | ')}]`);
    }
  }

  return lines.join('\n');
}
