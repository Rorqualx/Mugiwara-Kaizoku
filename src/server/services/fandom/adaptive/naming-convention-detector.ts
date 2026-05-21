/**
 * Naming Convention Detector for Fandom Wikis
 *
 * Detects non-standard chapter naming conventions used by different manga/novels.
 * Examples: Stage (Evangelion), Mission (Spy x Family), Episode (manhwa), etc.
 *
 * This module provides Fandom-specific HTML detection logic.
 * Core naming convention definitions are imported from the shared patterns module.
 *
 * @module naming-convention-detector
 */

import { load } from 'cheerio';

import {
  type NamingConvention,
  NAMING_CONVENTIONS,
  CHAPTER_CONVENTION,
  createUniversalChapterRegex,
  cleanChapterTitle,
} from '@/server/parsers/patterns/naming-conventions';
import { logger } from '@/utils/logger';

// Re-export core naming conventions from shared location
export {
  type NamingConvention,
  NAMING_CONVENTIONS,
  CHAPTER_CONVENTION,
  createUniversalChapterRegex,
  cleanChapterTitle,
};

/**
 * Detection result with confidence scoring.
 */
export interface ConventionDetectionResult {
  /** Detected convention or null if standard 'chapter' */
  convention: NamingConvention | null;
  /** Confidence score 0-1 */
  confidence: number;
  /** Number of matches found */
  matchCount: number;
  /** The pattern that matched most */
  primaryPattern: RegExp | null;
}

/**
 * Counts matches for a convention in the given text.
 */
function countPatternMatches(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    const globalPattern = new RegExp(pattern.source, 'gi');
    const matches = text.match(globalPattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Detects naming convention from page HTML.
 *
 * Strategy:
 * 1. Check category links for convention hints
 * 2. Check link hrefs for URL patterns
 * 3. Count text matches for each convention
 * 4. Return highest-scoring convention above threshold
 */
export function detectNamingConvention(html: string): ConventionDetectionResult {
  const $ = load(html);
  const scores: Map<NamingConvention, number> = new Map();

  // Get all text content from main content area
  const $content = $('.mw-parser-output');
  const textContent = $content.text();

  // Get all links for URL analysis
  const links: string[] = [];
  $content.find('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) links.push(href);
  });
  const linkText = links.join(' ');

  // Get category links
  const categoryLinks: string[] = [];
  $('#catlinks a, .categories a').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text();
    categoryLinks.push(href + ' ' + text);
  });
  const categoryText = categoryLinks.join(' ');

  // Score each convention
  for (const convention of NAMING_CONVENTIONS) {
    let score = 0;

    // Category matches are strongest signal (weight: 10)
    const categoryMatches = countPatternMatches(categoryText, convention.categoryPatterns);
    score += categoryMatches * 10;

    // URL pattern matches (weight: 3)
    const urlMatches = countPatternMatches(linkText, convention.urlPatterns);
    score += urlMatches * 3;

    // Text pattern matches (weight: 1)
    const textMatches = countPatternMatches(textContent, convention.patterns);
    score += textMatches;

    if (score > 0) {
      scores.set(convention, score);
    }
  }

  // Also score standard chapter convention
  let chapterScore = 0;
  chapterScore += countPatternMatches(categoryText, CHAPTER_CONVENTION.categoryPatterns) * 10;
  chapterScore += countPatternMatches(linkText, CHAPTER_CONVENTION.urlPatterns) * 3;
  chapterScore += countPatternMatches(textContent, CHAPTER_CONVENTION.patterns);

  // Find highest-scoring non-chapter convention
  let bestConvention: NamingConvention | null = null;
  let bestScore = 0;

  for (const [convention, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestConvention = convention;
    }
  }

  // Only return non-chapter convention if it significantly outscores chapter convention
  // Threshold: non-chapter must have at least 5 matches AND score higher than chapter
  const useAlternativeConvention = bestConvention !== null &&
    bestScore >= 5 &&
    bestScore > chapterScore * 0.5; // Alternative needs to be at least 50% of chapter score

  if (useAlternativeConvention && bestConvention) {
    const confidence = Math.min(1, bestScore / 50); // Normalize to 0-1
    const primaryPattern = bestConvention.patterns[0] ?? null;

    logger.info(`[naming-convention] Detected: ${bestConvention.displayName} (score: ${bestScore}, confidence: ${confidence.toFixed(2)})`);

    return {
      convention: bestConvention,
      confidence,
      matchCount: bestScore,
      primaryPattern,
    };
  }

  // Default to chapter convention
  logger.debug(`[naming-convention] Using standard Chapter convention (chapter score: ${chapterScore})`);

  return {
    convention: null, // null means standard chapter
    confidence: 1,
    matchCount: chapterScore,
    primaryPattern: CHAPTER_CONVENTION.patterns[0] ?? null,
  };
}

/**
 * Extracts chapter number from text using detected or provided convention.
 * This is the Fandom-specific version that also checks href and title attributes.
 */
export function extractChapterNumber(
  text: string,
  href: string,
  title: string,
  convention?: NamingConvention | null
): number | null {
  // Special handling for Volume 0 prequel format: "0-1", "000-1", "Chapter 0-1" → 0.1, 0.2, etc.
  // Must be checked before convention patterns since this is a structural format
  // Patterns handle: "000-1", "000-1.", "000-1. Title", "Chapter 0-1", etc.
  const zeroChapterPatterns = [
    { source: href, regex: /Chapter[_\s]*0+-(\d+)/i },
    { source: title, regex: /Chapter\s*0+-(\d+)/i },
    { source: text, regex: /^0+-(\d+)(?:\.|$|\s)/ },  // "000-1", "000-1.", "000-1 Title"
    { source: text, regex: /Chapter\s*0+-(\d+)/i },
    { source: text, regex: /\b0+-(\d+)\b/ },  // "000-1" anywhere in text with word boundaries
  ];
  for (const { source, regex } of zeroChapterPatterns) {
    const match = source.match(regex);
    if (match?.[1]) {
      // Convert "0-1" to 0.1, "0-2" to 0.2, etc.
      return parseFloat(`0.${match[1]}`);
    }
  }

  // Use provided convention or try all conventions
  const conventions = convention
    ? [convention, CHAPTER_CONVENTION]
    : [CHAPTER_CONVENTION, ...NAMING_CONVENTIONS];

  for (const conv of conventions) {
    // Try text patterns
    for (const pattern of conv.patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return parseFloat(match[1]);
      }
    }

    // Try URL patterns on href
    for (const pattern of conv.urlPatterns) {
      const match = href.match(pattern);
      if (match?.[1]) {
        return parseFloat(match[1]);
      }
    }

    // Try patterns on title
    for (const pattern of conv.patterns) {
      const match = title.match(pattern);
      if (match?.[1]) {
        return parseFloat(match[1]);
      }
    }
  }

  // Fallback: try bare number
  const bareNumber = text.match(/^(\d+(?:\.\d+)?)$/);
  if (bareNumber?.[1]) {
    return parseFloat(bareNumber[1]);
  }

  return null;
}

/**
 * Gets all patterns for a convention (for use in selectors).
 * This is Fandom-specific for building CSS selectors.
 */
export function getConventionLinkSelectors(convention: NamingConvention | null): string[] {
  const conv = convention ?? CHAPTER_CONVENTION;
  const selectors: string[] = [];

  // Build CSS selectors for links matching this convention
  for (const pattern of conv.urlPatterns) {
    // Extract the base word from pattern (e.g., "Stage" from /Stage[_\s]?(\d+)/i)
    const match = pattern.source.match(/^(\w+)/);
    if (match?.[1]) {
      const word = match[1];
      selectors.push(`a[href*="/${word}"]`);
      selectors.push(`a[href*="${word}_"]`);
      selectors.push(`a[title*="${word}"]`);
    }
  }

  return selectors;
}
