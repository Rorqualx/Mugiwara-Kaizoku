/**
 * Semantic Feature Extraction
 *
 * Extracts text meaning, entities, language, semantic types.
 * Focuses on understanding WHAT the text represents rather than HOW it's structured.
 *
 * Extracted from: FeatureEngineering.ts (lines 91-112, 239-263)
 */

import {
  getTextEmbeddings,
  extractNamedEntities,
  detectLanguage
} from './text-helpers';

import type { Element, CheerioAPI, SemanticFeatures } from './types';

/**
 * Extract semantic features from an element's text content
 *
 * @param element - DOM element to extract features from
 * @param $ - Cheerio instance for DOM traversal
 * @param embeddingDimension - Dimension for text embeddings
 * @param embeddingsCache - Cache for computed embeddings
 * @returns Semantic features including content analysis and metadata
 *
 * @remarks
 * Extracts:
 * - Text content and basic statistics (length, word count)
 * - Boolean flags (hasNumbers, hasDate, hasISBN)
 * - Semantic type classification (volume, chapter, title, etc.)
 * - Text embeddings for similarity comparison
 * - Named entities (names, numbers with units)
 * - Language detection
 */
export function extractSemanticFeatures(
  element: Element,
  $: CheerioAPI,
  embeddingDimension: number,
  embeddingsCache: Map<string, number[]>
): SemanticFeatures {
  const $el = $(element);
  const text = $el.text().trim();
  const words = text.split(/\s+/);
  const semType = detectSemanticType(text, element, $);

  return {
    keywordDensity: {},
    topicDistribution: {},
    sentimentScore: 0,
    readabilityScore: 0,
    textContent: text,
    textLength: text.length,
    wordCount: words.length,
    hasNumbers: /\d/.test(text),
    hasDate: hasDate(text),
    hasISBN: hasISBN(text),
    ...(semType ? { semanticType: semType } : {}),
    embeddings: getTextEmbeddings(text, embeddingDimension, embeddingsCache),
    namedEntities: extractNamedEntities(text),
    languageCode: detectLanguage(text)
  };
}

/**
 * Check if text contains date patterns
 *
 * @param text - Text to analyze
 * @returns True if any date pattern is found
 *
 * @remarks
 * Detects common date formats:
 * - ISO format: 2024-01-15, 2024/01/15
 * - US format: 01-15-2024, 01/15/2024
 * - Full month: January 15, 2024
 * - Abbreviated month: 15 Jan 2024
 */
export function hasDate(text: string): boolean {
  const datePatterns = [
    /\d{4}[-/]\d{1,2}[-/]\d{1,2}/,
    /\d{1,2}[-/]\d{1,2}[-/]\d{4}/,
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
    /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i
  ];
  return datePatterns.some(pattern => pattern.test(text));
}

/**
 * Check if text contains ISBN patterns
 *
 * @param text - Text to analyze
 * @returns True if ISBN pattern is found
 *
 * @remarks
 * Detects ISBN-10 and ISBN-13 formats with hyphens or spaces.
 */
export function hasISBN(text: string): boolean {
  return /ISBN[\s:]*[\d-]{10,17}/i.test(text);
}

/**
 * Detect the semantic type of text content
 *
 * @param text - Text to analyze
 * @param element - DOM element for context
 * @param $ - Cheerio instance for DOM queries
 * @returns Semantic type classification or undefined if no match
 *
 * @remarks
 * Classification priority (checked in order):
 * 1. Volume identifier (e.g., "Volume 1", "Vol. 2")
 * 2. Chapter identifier (e.g., "Chapter 1", "Ch. 5")
 * 3. Title (based on heading tags or title class)
 * 4. Author (prefixed with "by", "author", "written by")
 * 5. Date (using date pattern detection)
 * 6. Description (long text in paragraph tags)
 * 7. Metadata (contained in infobox or metadata containers)
 */
function detectSemanticType(
  text: string,
  element: Element,
  $: CheerioAPI
): SemanticFeatures['semanticType'] {
  const lowerText = text.toLowerCase();
  const $el = $(element);

  // Check for specific patterns
  if (/^(volume|vol\.?)\s*\d+/i.test(text)) return 'volume';
  if (/^(chapter|ch\.?)\s*\d+/i.test(text)) return 'chapter';
  if ($el.is('h1, h2, h3') || $el.hasClass('title')) return 'title';
  if (/^(by|author|written by)/i.test(lowerText)) return 'author';
  if (hasDate(text)) return 'date';
  if (text.length > 100 && $el.is('p')) return 'description';
  if ($el.closest('.infobox, .metadata').length > 0) return 'metadata';

  return undefined;
}
