/**
 * Statistical Feature Extraction Module
 *
 * Extracts statistical properties from DOM elements: entropy, densities,
 * ratios, and pattern scores. Uses calculation helpers for all computations.
 *
 * Extracted from: FeatureEngineering.ts (lines 116-135)
 */

import {
  calculateEntropy,
  calculateTextDensity,
  calculateNumericDensity,
  calculatePunctuationDensity,
  calculateCapitalRatio,
  calculateAverageWordLength,
  calculateUniqueWordRatio,
  calculatePatternScore
} from './calculation-helpers';

import type { Element, CheerioAPI, StatisticalFeatures } from './types';

/**
 * Extract statistical features from a DOM element
 *
 * Analyzes text content to compute:
 * - Word counts and averages
 * - Entropy (character distribution randomness)
 * - Densities (text, numeric, punctuation)
 * - Ratios (capital letters, unique words)
 * - Pattern matching score
 *
 * @param element - DOM element to extract features from
 * @param $ - Cheerio API instance for DOM manipulation
 * @param hasDateFn - Function to detect date patterns (passed to avoid circular dependency)
 * @returns Statistical features object with all computed metrics
 *
 * @example
 * const features = extractStatisticalFeatures(element, $, hasDate);
 * console.log(features.entropy); // 3.42
 * console.log(features.patternScore); // 0.65
 */
export function extractStatisticalFeatures(
  element: Element,
  $: CheerioAPI,
  hasDateFn: (text: string) => boolean
): StatisticalFeatures {
  const $el = $(element);
  const text = $el.text().trim();
  const words = text.split(/\s+/).filter(Boolean);

  return {
    wordCount: words.length,
    avgWordLength: calculateAverageWordLength(text),
    sentenceCount: 0,
    avgSentenceLength: 0,
    paragraphCount: 0,
    entropy: calculateEntropy(text),
    textDensity: calculateTextDensity(element, $),
    numericDensity: calculateNumericDensity(text),
    punctuationDensity: calculatePunctuationDensity(text),
    capitalLetterRatio: calculateCapitalRatio(text),
    averageWordLength: calculateAverageWordLength(text),
    uniqueWordRatio: calculateUniqueWordRatio(text),
    patternScore: calculatePatternScore(text, hasDateFn)
  };
}
