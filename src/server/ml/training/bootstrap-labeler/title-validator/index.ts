/**
 * Title Validation Module
 *
 * Validates extracted titles against training data to reduce false positives.
 */

import { TRAINING_TITLES } from '@/server/ml/training/training-titles';

import { combinedSimilarity } from './fuzzy-matcher';

export interface TitleValidationResult {
  isValid: boolean;
  confidence: number;
  matchedTitle: string | null;
  matchType: 'exact' | 'fuzzy' | 'alternative' | 'none';
  suggestions: string[];
}

// Pre-computed lookup structures for fast matching
let titleIndex: Map<string, string> | null = null;
let altTitleIndex: Map<string, string> | null = null;
let initialized = false;

/**
 * Normalize a title for comparison
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Initialize the title index for fast lookups
 * Called lazily on first validation
 */
export function initializeTitleIndex(): void {
  if (initialized) return;

  titleIndex = new Map();
  altTitleIndex = new Map();

  for (const manga of TRAINING_TITLES) {
    const normalizedTitle = normalizeTitle(manga.title);
    titleIndex.set(normalizedTitle, manga.title);

    for (const alt of manga.alternativeTitles) {
      const normalizedAlt = normalizeTitle(alt);
      altTitleIndex.set(normalizedAlt, manga.title);
    }
  }

  initialized = true;
}

/**
 * Find an exact match in the title index
 */
function findExactMatch(normalized: string): { title: string; type: 'exact' | 'alternative' } | null {
  initializeTitleIndex();

  const exactMatch = titleIndex?.get(normalized);
  if (exactMatch) {
    return { title: exactMatch, type: 'exact' };
  }

  const altMatch = altTitleIndex?.get(normalized);
  if (altMatch) {
    return { title: altMatch, type: 'alternative' };
  }

  return null;
}

/**
 * Find the best fuzzy match above a threshold
 */
function findFuzzyMatch(
  normalized: string,
  threshold: number = 0.8
): { title: string; score: number } | null {
  initializeTitleIndex();

  let bestMatch: { title: string; score: number } | null = null;

  for (const manga of TRAINING_TITLES) {
    const score = combinedSimilarity(normalized, normalizeTitle(manga.title));
    if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { title: manga.title, score };
    }

    // Also check alternative titles
    for (const alt of manga.alternativeTitles) {
      const altScore = combinedSimilarity(normalized, normalizeTitle(alt));
      if (altScore >= threshold && (!bestMatch || altScore > bestMatch.score)) {
        bestMatch = { title: manga.title, score: altScore };
      }
    }
  }

  return bestMatch;
}

/**
 * Get suggestions for similar titles
 */
function getSuggestions(normalized: string, limit: number = 3): string[] {
  const scored: Array<{ title: string; score: number }> = [];

  for (const manga of TRAINING_TITLES) {
    const score = combinedSimilarity(normalized, normalizeTitle(manga.title));
    scored.push({ title: manga.title, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.title);
}

/**
 * Validate an extracted title against known manga titles
 */
export function validateTitle(extractedTitle: string): TitleValidationResult {
  const normalized = normalizeTitle(extractedTitle);

  // Try exact match first
  const exactMatch = findExactMatch(normalized);
  if (exactMatch) {
    return {
      isValid: true,
      confidence: 1.0,
      matchedTitle: exactMatch.title,
      matchType: exactMatch.type,
      suggestions: [],
    };
  }

  // Try fuzzy match
  const fuzzyMatch = findFuzzyMatch(normalized, 0.85);
  if (fuzzyMatch) {
    return {
      isValid: true,
      confidence: fuzzyMatch.score,
      matchedTitle: fuzzyMatch.title,
      matchType: 'fuzzy',
      suggestions: [],
    };
  }

  // No match found - get suggestions
  const suggestions = getSuggestions(normalized);

  return {
    isValid: false,
    confidence: 0,
    matchedTitle: null,
    matchType: 'none',
    suggestions,
  };
}

/**
 * Check if a title is likely valid (quick check without full validation)
 * Returns true if it looks like a manga title based on heuristics
 */
export function isLikelyMangaTitle(title: string): boolean {
  // Very short titles are suspicious
  if (title.length < 2) return false;

  // Very long titles are suspicious (most manga titles are under 100 chars)
  if (title.length > 150) return false;

  // Check for common non-title patterns
  const nonTitlePatterns = [
    /^(chapter|volume|episode|part)\s*\d+/i,
    /^(prev|next|back|forward|home|menu)/i,
    /^(read|download|watch|buy|subscribe)/i,
    /^https?:\/\//i,
    /^\d+$/,
  ];

  for (const pattern of nonTitlePatterns) {
    if (pattern.test(title)) return false;
  }

  return true;
}
