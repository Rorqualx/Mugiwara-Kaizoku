/**
 * Statistical Calculation Helpers Module
 *
 * Provides core mathematical and statistical calculation functions used
 * throughout the feature engineering system. These functions compute various
 * metrics like entropy, densities, ratios, and pattern scores.
 *
 * Extracted from: FeatureEngineering.ts (lines 322-381)
 */

import type { Element, CheerioAPI } from './types';

// ============================================================================
// Entropy & Information Theory
// ============================================================================

/**
 * Calculates Shannon entropy of text
 *
 * Measures the randomness/unpredictability of character distribution.
 * Higher entropy indicates more varied character usage.
 *
 * @param text - Input text to analyze
 * @returns Entropy value in bits (0 = uniform, higher = more random)
 *
 * @example
 * calculateEntropy('aaaa') // Low entropy (repetitive)
 * calculateEntropy('abcd') // High entropy (varied)
 */
export function calculateEntropy(text: string): number {
  if (!text) return 0;
  const frequencies = new Map<string, number>();
  for (const char of text) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  const length = text.length;
  // Convert iterator to array to avoid downlevelIteration requirement
  for (const count of Array.from(frequencies.values())) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

// ============================================================================
// Density Calculations
// ============================================================================

/**
 * Calculates text density of a DOM element
 *
 * Measures the ratio of visible text to HTML markup. Higher values
 * indicate content-heavy elements, lower values indicate structure-heavy.
 *
 * @param element - DOM element to analyze
 * @param $ - Cheerio API instance
 * @returns Ratio of text length to HTML length (0-1)
 */
export function calculateTextDensity(element: Element, $: CheerioAPI): number {
  const $el = $(element);
  const text = $el.text().trim().length;
  const html = $el.html()?.length ?? 0;
  return html > 0 ? text / html : 0;
}

/**
 * Calculates numeric character density
 *
 * Measures the proportion of digits in text. Useful for detecting
 * fields containing dates, ISBNs, page numbers, or prices.
 *
 * @param text - Input text to analyze
 * @returns Ratio of digits to total characters (0-1)
 */
export function calculateNumericDensity(text: string): number {
  if (!text) return 0;
  const numbers = text.match(/\d/g) ?? [];
  return numbers.length / text.length;
}

/**
 * Calculates punctuation density
 *
 * Measures the proportion of punctuation characters. High density may
 * indicate structured data (ISBNs, dates) or heavily formatted text.
 *
 * **Fixed**: Removed unnecessary escape `\[` → `[` in regex
 *
 * @param text - Input text to analyze
 * @returns Ratio of punctuation to total characters (0-1)
 */
export function calculatePunctuationDensity(text: string): number {
  if (!text) return 0;
  // ✅ FIXED: Removed useless escape from \[ → [
  const punctuation = text.match(/[.,;:!?'"()[\]{}-]/g) ?? [];
  return punctuation.length / text.length;
}

// ============================================================================
// Text Analysis Ratios
// ============================================================================

/**
 * Calculates capital letter ratio
 *
 * Measures the proportion of uppercase letters among all letters.
 * Useful for detecting titles, acronyms, or all-caps text.
 *
 * @param text - Input text to analyze
 * @returns Ratio of capital letters to total letters (0-1)
 */
export function calculateCapitalRatio(text: string): number {
  if (!text) return 0;
  const capitals = text.match(/[A-Z]/g) ?? [];
  const letters = text.match(/[a-zA-Z]/g) ?? [];
  return letters.length > 0 ? capitals.length / letters.length : 0;
}

/**
 * Calculates average word length
 *
 * Computes the mean length of words in the text. Longer average
 * word length may indicate technical or formal content.
 *
 * @param text - Input text to analyze
 * @returns Average number of characters per word
 */
export function calculateAverageWordLength(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const totalLength = words.reduce((sum, word) => sum + word.length, 0);
  return totalLength / words.length;
}

/**
 * Calculates unique word ratio
 *
 * Measures vocabulary diversity by comparing unique words to total words.
 * Higher ratio indicates more varied vocabulary.
 *
 * @param text - Input text to analyze
 * @returns Ratio of unique words to total words (0-1)
 */
export function calculateUniqueWordRatio(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const uniqueWords = new Set(words);
  return uniqueWords.size / words.length;
}

// ============================================================================
// Pattern Scoring
// ============================================================================

/**
 * Calculates pattern matching score
 *
 * Scores text based on presence of common metadata patterns:
 * - Volume/Chapter numbers (+0.2 each)
 * - ISBN (+0.15)
 * - Dates (+0.15)
 * - Page counts (+0.1)
 * - Author attribution (+0.1)
 * - Prices (+0.1)
 *
 * @param text - Input text to analyze
 * @param hasDate - Function to detect date patterns
 * @returns Cumulative pattern score (0-1, capped at 1.0)
 */
export function calculatePatternScore(
  text: string,
  hasDate: (text: string) => boolean
): number {
  // Score based on presence of common patterns
  let score = 0;
  if (/volume\s*\d+/i.test(text)) score += 0.2;
  if (/chapter\s*\d+/i.test(text)) score += 0.2;
  if (/ISBN/i.test(text)) score += 0.15;
  if (hasDate(text)) score += 0.15;
  if (/\d+\s*pages?/i.test(text)) score += 0.1;
  if (/by\s+[A-Z][a-z]+/i.test(text)) score += 0.1;
  if (/\$\d+\.?\d*/i.test(text)) score += 0.1;
  return Math.min(score, 1.0);
}
