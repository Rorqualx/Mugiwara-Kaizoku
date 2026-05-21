/**
 * Provider Matcher Module
 * 
 * This module provides sophisticated title matching functionality across different manga providers.
 * It implements various matching strategies including exact matches, pattern matching,
 * Levenshtein distance calculations, and provider-specific title normalization rules.
 * 
 * @module providerMatcher
 */

import type { SearchResult } from '@/server/services/search/types';
import { logger } from '@/utils/logger';

import { searchProviderRegistry } from '../services/search/registerProviders';

/**
 * Configuration interface for the matching algorithm
 * 
 * @property {number} minScore - Minimum similarity score threshold (0.0 to 1.0)
 * @property {Object} weights - Weight factors for different matching strategies
 * @property {number} weights.exact - Weight for exact matches after normalization
 * @property {number} weights.partial - Weight for partial/containment matches
 * @property {number} weights.alternative - Weight for alternative title pattern matches
 * @property {number} weights.pattern - Weight for Levenshtein distance-based matches
 */
interface MatchConfig {
  minScore: number;
  weights: {
    exact: number;
    partial: number;
    alternative: number;
    pattern: number;
  };
}

/**
 * Represents a match result with similarity score
 * 
 * @property {string} id - Unique identifier from the provider
 * @property {string} title - The matched title
 * @property {number} score - Similarity score (0.0 to 1.0)
 */
interface MatchScore {
  id: string;
  title: string;
  score: number;
}

/**
 * Type guard for RegExp match with title capture group
 */
type TitleMatch = RegExpMatchArray & {
  [1]: string;
};

/**
 * Default configuration for the matching algorithm
 * Uses a lenient minimum score threshold and balanced weights
 */
const DEFAULT_CONFIG: MatchConfig = {
  minScore: 0.1, // Lowered from 0.6 to 0.1 (10%) to be more lenient with matches
  weights: {
    exact: 1.0,
    partial: 0.8,
    alternative: 0.7,
    pattern: 0.6
  }
};

/**
 * Provider-specific patterns for title normalization
 * Each provider has an array of RegExp patterns to clean titles
 *
 * @example
 * 'anilist': [
 *   /\s*\([^)]+\)\s*$/,  // Remove trailing parentheses content
 *   /\s*[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]+\s*$/ // Remove trailing Japanese text
 * ]
 */
const PROVIDER_PATTERNS = {
  'anilist': [
    /\s*\([^)]+\)\s*$/,  // Remove trailing parentheses content
    /\s*[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]+\s*$/ // Remove trailing Japanese text
  ],
  'comicvine': [
    /^The\s+/i,  // Remove leading "The"
    /\s*Vol\.\s*\d+\s*$/i,  // Remove volume numbers
    /\s*#\d+\s*$/  // Remove issue numbers
  ],
  'fandom': [
    /\s*\(manga\)\s*$/i,  // Remove "(manga)" suffix
    /\s*\(anime\)\s*$/i,  // Remove "(anime)" suffix
    /\s*\(series\)\s*$/i, // Remove "(series)" suffix
    /\s*wiki\s*$/i        // Remove "wiki" suffix
  ],
  'wikipedia': [
    /\s*\(manga\)\s*$/i,  // Remove "(manga)" suffix
    /\s*\(anime\)\s*$/i,  // Remove "(anime)" suffix
    /\s*\(series\)\s*$/i  // Remove "(series)" suffix
  ]
} as const;

type ProviderKey = keyof typeof PROVIDER_PATTERNS;

/**
 * Generate search variants for a title to improve matching
 * Lessons learned from ML training data analysis:
 * - Double-dash titles need prefix extraction with suffixes
 * - Numeric titles benefit from "(novel)", "(manga)" suffixes for Wikipedia
 * - Strip special characters for cleaner matching
 *
 * @param title - The original title
 * @param provider - The target provider (affects which variants are useful)
 * @returns Array of title variants to try
 */
// eslint-disable-next-line complexity -- Title variant generation handles multiple patterns: double-dash, numeric, special characters, and provider-specific suffixes
function generateTitleVariants(title: string, provider: string): string[] {
  const variants: string[] = [title];

  // Handle double-dash pattern (e.g., "86--EIGHTY-SIX")
  // Wikipedia article is "86 (novel series)", not "86--EIGHTY-SIX"
  if (title.includes('--')) {
    const prefix = title.split('--')[0]?.trim();
    if (prefix) {
      variants.push(prefix);
      // For Wikipedia, try with media type suffixes
      if (provider === 'wikipedia') {
        variants.push(`${prefix} (novel series)`);
        variants.push(`${prefix} (manga)`);
        variants.push(`${prefix} (novel)`);
      }
    }
    // Also try the part after "--"
    const suffix = title.split('--')[1]?.trim();
    if (suffix) {
      variants.push(suffix);
      variants.push(suffix.replace(/-/g, ' ')); // "EIGHTY-SIX" -> "EIGHTY SIX"
    }
  }

  // Handle titles starting with numbers (for Wikipedia)
  // e.g., "100-man no Inochi" might be listed as "100-man no Inochi (manga)"
  if (provider === 'wikipedia' && /^\d+/.test(title)) {
    variants.push(`${title} (manga)`);
    variants.push(`${title} (novel)`);
  }

  // Strip special characters for cleaner search
  const cleaned = title
    .replace(/[#-]+/g, ' ')      // Replace # and - with space
    .replace(/[^\w\s]/g, ' ')    // Remove other special chars
    .replace(/\s+/g, ' ')        // Normalize spaces
    .trim();
  if (cleaned !== title && cleaned.length > 2) {
    variants.push(cleaned);
  }

  // For long titles with " - " subtitle pattern, try base title
  if (title.includes(' - ') && title.length > 40) {
    const baseTitle = title.split(' - ')[0]?.trim();
    if (baseTitle && baseTitle.length > 3) {
      variants.push(baseTitle);
    }
  }

  // Handle colon-separated titles (e.g., "Ascendance of a Bookworm: Hannelore's Fifth Year")
  // Extract both the series name and the subtitle for searching
  if (title.includes(':')) {
    const parts = title.split(':');
    const seriesName = parts[0]?.trim();
    const subtitle = parts.slice(1).join(':').trim();

    // Add series name (e.g., "Ascendance of a Bookworm")
    if (seriesName && seriesName.length > 3) {
      variants.push(seriesName);
    }

    // Add subtitle (e.g., "Hannelore's Fifth Year at the Royal Academy")
    // This helps Fandom find specific pages within a wiki
    if (subtitle && subtitle.length > 5) {
      variants.push(subtitle);
    }
  }

  // Remove duplicates and empty strings
  return [...new Set(variants)].filter(v => v.length > 0);
}

/**
 * Enhanced utility class for matching manga titles across different providers
 * 
 * This class implements sophisticated title matching algorithms to find corresponding
 * manga entries across different providers. It handles various title formats,
 * alternative titles, and provider-specific patterns.
 * 
 * @example
 * const matcher = new ProviderMatcher({ minScore: 0.2 });
 * const matchId = await matcher.findMatch("One Piece", "anilist");
 */
export class ProviderMatcher {
  private config: MatchConfig;

  /**
   * Creates a new ProviderMatcher instance
   * 
   * @param {Partial<MatchConfig>} config - Optional configuration overrides
   */
  constructor(config: Partial<MatchConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      weights: {
        ...DEFAULT_CONFIG.weights,
        ...(config.weights ?? {})
      }
    };
  }

  /**
   * Normalizes a manga title with provider-specific patterns
   * Includes Unicode normalization for common character variants
   *
   * @param {string} title - The title to normalize
   * @param {string} [provider] - Optional provider name for specific patterns
   * @returns {string} Normalized title
   *
   * @example
   * matcher.normalizeTitle("Spy × Family") // Returns "spy x family"
   * matcher.normalizeTitle("One Piece (manga)") // Returns "one piece"
   */
  private normalizeTitle(title: string, provider?: string): string {
    // Basic normalization with Unicode handling
    let normalized = title
      .toLowerCase()
      .normalize('NFKC')  // Normalize Unicode characters
      // Handle common Unicode variants (from ML training data analysis)
      .replace(/×/g, 'x')        // Multiplication sign → x (Spy × Family)
      .replace(/—|–|‐/g, '-')    // Various dashes → hyphen
      .replace(/'/g, "'")        // Fancy apostrophe → regular
      .replace(/"/g, '"')        // Fancy quotes → regular
      .replace(/[^\w\s-]/g, ' ') // Replace special chars with space
      .replace(/\s+/g, ' ')      // Normalize spaces
      .trim();

    // Apply provider-specific patterns
    if (provider && Object.prototype.hasOwnProperty.call(PROVIDER_PATTERNS, provider)) {
      const patterns = PROVIDER_PATTERNS[provider as ProviderKey];
      for (const pattern of patterns) {
        normalized = normalized.replace(pattern, '');
      }
    }

    return normalized;
  }

  /**
   * Calculates Levenshtein distance between two strings
   * Uses a memory-efficient single-row approach
   * 
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Handle edge cases
    if (m === 0) return n;
    if (n === 0) return m;

    // Create a single row and initialize it
    const row: number[] = Array.from({ length: n + 1 }, (_, j) => j);

    // Use a temporary array to store the previous row
    let prevRow: number[] = Array.from({ length: n + 1 }, () => 0);

    // Fill the matrix
    for (let i = 1; i <= m; i++) {
      // Copy current row to previous row
      prevRow = [...row];
      
      // Initialize first column
      row[0] = i;

      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const prevRowJ: number = prevRow[j] ?? 0;
        const rowJMinus1: number = row[j - 1] ?? 0;
        const prevRowJMinus1: number = prevRow[j - 1] ?? 0;
        row[j] = Math.min(
          prevRowJ + 1,           // deletion
          rowJMinus1 + 1,         // insertion
          prevRowJMinus1 + cost   // substitution
        );
      }
    }

    return row[n] ?? 0;
  }

  /**
   * Type guard for RegExpMatchArray with title capture
   * 
   * @param {RegExpMatchArray | null} match - The match result to check
   * @returns {boolean} True if match has a first capture group
   */
  private isTitleMatch(match: RegExpMatchArray | null): match is TitleMatch {
    return match !== null && typeof match[1] === 'string';
  }

  /**
   * Checks for common alternative title patterns
   * 
   * @param {string} str1 - First title
   * @param {string} str2 - Second title
   * @returns {number} Similarity score for alternative patterns
   */
  private checkAlternativeTitlePatterns(str1: string, str2: string): number {
    const patterns = [
      /^(.+?)\s*[(（](.+?)[)）]/,  // Japanese title in parentheses
      /^(.+?)\s*[-–—]\s*(.+)/,      // Title with dash separator
      /^(.+?)\s*(?:season|part)\s*\d+/i  // Season/Part indicators
    ] as const;

    for (const pattern of patterns) {
      const match1 = str1.match(pattern);
      const match2 = str2.match(pattern);

      if (match1 ?? match2) {
        const title1 = this.isTitleMatch(match1) ? match1[1] : str1;
        const title2 = this.isTitleMatch(match2) ? match2[1] : str2;

        if (this.normalizeTitle(title1) === this.normalizeTitle(title2)) {
          return 0.9; // High confidence for pattern matches
        }
      }
    }

    return 0;
  }

  /**
   * Calculate Jaccard similarity between word sets
   */
  private calculateJaccardSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 1));
    const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 1));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Calculates similarity between two strings with enhanced matching
   * Uses multiple strategies: exact, containment, Jaccard, and Levenshtein
   *
   * @param {string} str1 - First string to compare
   * @param {string} str2 - Second string to compare
   * @param {string} [provider] - Optional provider for specific normalization
   * @returns {number} Similarity score between 0 and 1
   */
  private calculateSimilarity(str1: string, str2: string, provider?: string): number {
    const a = this.normalizeTitle(str1, provider);
    const b = this.normalizeTitle(str2, provider);

    // Empty string check
    if (!a.length || !b.length) return 0;

    // Exact match after normalization
    if (a === b) return this.config.weights.exact;

    // Check for alternative titles pattern matches
    const altScore = this.checkAlternativeTitlePatterns(a, b);
    if (altScore > 0) return altScore * this.config.weights.alternative;

    // Containment check with length ratio penalty
    if (a.includes(b) || b.includes(a)) {
      const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
      return (0.7 + (ratio * 0.3)) * this.config.weights.partial;
    }

    // Calculate both Jaccard and Levenshtein, use the better one
    const jaccardScore = this.calculateJaccardSimilarity(a, b);
    const maxLen = Math.max(a.length, b.length);
    const distance = this.levenshteinDistance(a, b);
    const levenshteinScore = Math.max(0, (maxLen - distance) / maxLen);

    // Use the higher score, weighted
    const baseScore = Math.max(jaccardScore, levenshteinScore);

    // Apply length ratio penalty to avoid false positives
    // (e.g., "11 of Me" matching "A-11 offense")
    const lengthRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    const lengthPenalty = lengthRatio < 0.4 ? 0.6 : lengthRatio < 0.6 ? 0.8 : 1.0;

    return baseScore * this.config.weights.pattern * lengthPenalty;
  }

  /**
   * Finds matching manga on a provider with enhanced matching
   * 
   * This method searches for a manga title on the specified provider and returns
   * the ID of the best match if one is found above the minimum score threshold.
   * 
   * @param {string} title - The manga title to search for
   * @param {string} provider - The provider to search on
   * @returns {Promise<string | null>} The ID of the best match or null if no match found
   * 
   * @example
   * try {
   *   const matchId = await matcher.findMatch("One Piece", "anilist");
   *   if (matchId) {
   *     logger.info("Found match:", matchId);
   *   }
   * } catch (error) {
   *   console.error("Error finding match:", error);
   * }
   */
  /**
   * Search provider with title variants until results are found
   */
  private async searchWithVariants(
    title: string,
    provider: string,
    providerInstance: { search: (query: string) => Promise<unknown[]> }
  ): Promise<SearchResult[]> {
    const titleVariants = generateTitleVariants(title, provider);
    logger.warn(`[providerMatcher] Searching ${provider} with ${titleVariants.length} variants for "${title}"`);

    for (const variant of titleVariants) {
      // eslint-disable-next-line no-await-in-loop -- Sequential search with early exit on first results
      const results = await this.trySearchVariant(variant, provider, providerInstance);
      if (results.length > 0) {
        return results;
      }
    }

    return [];
  }

  /**
   * Try searching with a single variant
   */
  private async trySearchVariant(
    variant: string,
    provider: string,
    providerInstance: { search: (query: string) => Promise<unknown[]> }
  ): Promise<SearchResult[]> {
    try {
      const results = await providerInstance.search(variant);
      if (Array.isArray(results) && results.length > 0) {
        logger.warn(`[providerMatcher] ${provider} returned ${results.length} results for variant "${variant}"`);
        return results as SearchResult[];
      }
    } catch (error: unknown) {
      logger.error(`[providerMatcher] Error searching "${variant}" on ${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return [];
  }

  async findMatch(title: string, provider: string): Promise<string | null> {
    try {
      // Get provider instance
      const providerInstance = searchProviderRegistry.get(provider);
      if (!providerInstance) {
        logger.warn(`[providerMatcher] Provider ${provider} not found in registry`);
        return null;
      }

      // Search with title variants for better matching
      const searchResults = await this.searchWithVariants(title, provider, providerInstance);

      if (searchResults.length === 0) {
        logger.warn(`[providerMatcher] No results found on ${provider} for: ${title}`);
        return null;
      }

      // Filter out results without an ID and process alternative titles
      const validResults = searchResults.filter((result): result is SearchResult & { id: string } =>
        typeof result.id === 'string'
      );

      if (validResults.length === 0) {
        logger.info(`No valid results found on ${provider} for title: ${title}`);
        return null;
      }

      // Calculate similarity scores with enhanced matching
      const scores: MatchScore[] = validResults.map(result => {
        const titleStr = typeof result["title"] === 'string' ? result["title"] : 'Unknown';
        let bestScore = this.calculateSimilarity(title, titleStr, provider);

        if (result["alternativeTitles"] && Array.isArray(result["alternativeTitles"])) {
          for (const altTitle of result["alternativeTitles"]) {
            if (typeof altTitle === 'string') {
              const altScore = this.calculateSimilarity(title, altTitle, provider);
              bestScore = Math.max(bestScore, altScore);
            }
          }
        }

        return {
          id: result["id"],
          title: titleStr,
          score: bestScore
        };
      });

      // Sort by similarity score
      scores.sort((a, b) => b.score - a.score);

      // Log the best matches
      logger.warn(`[providerMatcher] Best matches for "${title}" on ${provider}:`);
      const maxToLog = Math.min(scores.length, 3);
      for (let i = 0; i < maxToLog; i++) {
        const score = scores[i];
        if (score) {
          logger.warn(`[providerMatcher]   ${i + 1}. "${score["title"]}" (ID: ${score["id"]}, Score: ${score.score.toFixed(2)})`);
        }
      }

      // Return the ID of the best match if it's above threshold
      const bestMatch = scores[0];
      if (bestMatch && bestMatch.score >= this.config.minScore) {
        logger.warn(`[providerMatcher] ${provider}: Best match "${bestMatch["title"]}" (score: ${bestMatch.score.toFixed(2)}) ACCEPTED (threshold: ${this.config.minScore})`);
        return bestMatch["id"];
      }

      logger.warn(`[providerMatcher] ${provider}: Best match "${bestMatch?.["title"] ?? 'none'}" (score: ${bestMatch?.score.toFixed(2) ?? 'N/A'}) REJECTED (below threshold: ${this.config.minScore})`);
      return null;
    } catch (error: unknown) {
  logger.error(`Error finding match on ${provider}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
