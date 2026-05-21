/**
 * Enhanced Provider Matcher with Confidence Scores
 *
 * This is a modified version of ProviderMatcher that returns both the ID
 * and confidence score for debugging and metrics tracking.
 */

import type { SearchResult } from '@/server/services/search/types';
import { logger } from '@/utils/logger';
import { searchProviderRegistry } from '@/server/services/search/registerProviders';

interface MatchConfig {
  minScore: number;
  weights: {
    exact: number;
    partial: number;
    alternative: number;
    pattern: number;
  };
}

interface MatchScore {
  id: string;
  title: string;
  score: number;
}

interface EnhancedMatchResult {
  id: string | null;
  title: string | null;
  score: number;
  allMatches: MatchScore[];
}

type TitleMatch = RegExpMatchArray & {
  [1]: string;
};

const DEFAULT_CONFIG: MatchConfig = {
  minScore: 0.1,
  weights: {
    exact: 1.0,
    partial: 0.8,
    alternative: 0.7,
    pattern: 0.6
  }
};

const PROVIDER_PATTERNS = {
  'anilist': [
    /\s*\([^)]+\)\s*$/,
    /\s*[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]+\s*$/
  ],
  'comicvine': [
    /^The\s+/i,
    /\s*Vol\.\s*\d+\s*$/i,
    /\s*#\d+\s*$/
  ],
  'fandom': [
    /\s*\(manga\)\s*$/i,
    /\s*\(anime\)\s*$/i,
    /\s*\(series\)\s*$/i,
    /\s*wiki\s*$/i
  ],
  'wikipedia': [
    /\s*\(manga\)\s*$/i,
    /\s*\(anime\)\s*$/i,
    /\s*\(series\)\s*$/i
  ]
} as const;

type ProviderKey = keyof typeof PROVIDER_PATTERNS;

function addDashVariants(title: string, provider: string, variants: string[]): void {
  if (!title.includes('--')) return;

  const prefix = title.split('--')[0]?.trim();
  if (prefix) {
    variants.push(prefix);
    if (provider === 'wikipedia') {
      variants.push(prefix + ' (novel series)');
      variants.push(prefix + ' (manga)');
      variants.push(prefix + ' (novel)');
    }
  }

  const suffix = title.split('--')[1]?.trim();
  if (suffix) {
    variants.push(suffix);
    variants.push(suffix.replace(/-/g, ' '));
  }
}

function addNumericVariants(title: string, provider: string, variants: string[]): void {
  if (provider !== 'wikipedia' || !/^\d+/.test(title)) return;

  variants.push(title + ' (manga)');
  variants.push(title + ' (novel)');
}

function addCleanedVariant(title: string, variants: string[]): void {
  const cleaned = title
    .replace(/[#-]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned !== title && cleaned.length > 2) {
    variants.push(cleaned);
  }
}

function addBaseTitleVariant(title: string, variants: string[]): void {
  if (!title.includes(' - ') || title.length <= 40) return;

  const baseTitle = title.split(' - ')[0]?.trim();
  if (baseTitle && baseTitle.length > 3) {
    variants.push(baseTitle);
  }
}

function addColonVariants(title: string, variants: string[]): void {
  if (!title.includes(':')) return;

  const parts = title.split(':');
  const seriesName = parts[0]?.trim();
  const subtitle = parts.slice(1).join(':').trim();

  if (seriesName && seriesName.length > 3) {
    variants.push(seriesName);
  }
  if (subtitle && subtitle.length > 5) {
    variants.push(subtitle);
  }
}

function generateTitleVariants(title: string, provider: string): string[] {
  const variants: string[] = [title];

  addDashVariants(title, provider, variants);
  addNumericVariants(title, provider, variants);
  addCleanedVariant(title, variants);
  addBaseTitleVariant(title, variants);
  addColonVariants(title, variants);

  return [...new Set(variants)].filter(v => v.length > 0);
}

function createEmptyResult(): EnhancedMatchResult {
  return { id: null, title: null, score: 0, allMatches: [] };
}

function filterValidResults(results: SearchResult[]): SearchResult[] {
  return results.filter((result): result is SearchResult & { id: string } => typeof result.id === 'string');
}

function buildMatchResult(scores: MatchScore[], minScore: number): EnhancedMatchResult {
  scores.sort((a, b) => b.score - a.score);

  const bestMatch = scores[0];

  if (bestMatch && bestMatch.score >= minScore) {
    return {
      id: bestMatch.id,
      title: bestMatch.title,
      score: bestMatch.score,
      allMatches: scores
    };
  }

  return {
    id: null,
    title: bestMatch?.title ?? null,
    score: bestMatch?.score ?? 0,
    allMatches: scores
  };
}

export class EnhancedProviderMatcher {
  private config: MatchConfig;

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

  private normalizeTitle(title: string, provider?: string): string {
    let normalized = title
      .toLowerCase()
      .normalize('NFKC')
      .replace(/×/g, 'x')
      .replace(/—|–|‐/g, '-')
      .replace(/'/g, "'")
      .replace(/"/g, '"')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (provider && Object.prototype.hasOwnProperty.call(PROVIDER_PATTERNS, provider)) {
      const patterns = PROVIDER_PATTERNS[provider as ProviderKey];
      for (const pattern of patterns) {
        normalized = normalized.replace(pattern, '');
      }
    }

    return normalized;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const row: number[] = Array.from({ length: n + 1 }, (_, j) => j);
    let prevRow: number[] = Array.from({ length: n + 1 }, () => 0);

    for (let i = 1; i <= m; i++) {
      prevRow = [...row];
      row[0] = i;

      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const prevRowJ = prevRow[j] ?? 0;
        const rowJMinus1 = row[j - 1] ?? 0;
        const prevRowJMinus1 = prevRow[j - 1] ?? 0;
        row[j] = Math.min(prevRowJ + 1, rowJMinus1 + 1, prevRowJMinus1 + cost);
      }
    }

    return row[n] ?? 0;
  }

  private isTitleMatch(match: RegExpMatchArray | null): match is TitleMatch {
    return match !== null && typeof match[1] === 'string';
  }

  private checkAlternativeTitlePatterns(str1: string, str2: string): number {
    const patterns = [
      /^(.+?)\s*[(（](.+?)[)）]/,
      /^(.+?)\s*[-–—]\s*(.+)/,
      /^(.+?)\s*(?:season|part)\s*\d+/i
    ] as const;

    for (const pattern of patterns) {
      const match1 = str1.match(pattern);
      const match2 = str2.match(pattern);

      if (match1 ?? match2) {
        const title1 = this.isTitleMatch(match1) ? match1[1] : str1;
        const title2 = this.isTitleMatch(match2) ? match2[1] : str2;

        if (this.normalizeTitle(title1) === this.normalizeTitle(title2)) {
          return 0.9;
        }
      }
    }

    return 0;
  }

  private calculateJaccardSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 1));
    const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 1));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private calculateSimilarity(str1: string, str2: string, provider?: string): number {
    const a = this.normalizeTitle(str1, provider);
    const b = this.normalizeTitle(str2, provider);

    if (!a.length || !b.length) return 0;
    if (a === b) return this.config.weights.exact;

    const altScore = this.checkAlternativeTitlePatterns(a, b);
    if (altScore > 0) return altScore * this.config.weights.alternative;

    if (a.includes(b) || b.includes(a)) {
      const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
      return (0.7 + (ratio * 0.3)) * this.config.weights.partial;
    }

    const jaccardScore = this.calculateJaccardSimilarity(a, b);
    const maxLen = Math.max(a.length, b.length);
    const distance = this.levenshteinDistance(a, b);
    const levenshteinScore = Math.max(0, (maxLen - distance) / maxLen);

    const baseScore = Math.max(jaccardScore, levenshteinScore);
    const lengthRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    const lengthPenalty = lengthRatio < 0.4 ? 0.6 : lengthRatio < 0.6 ? 0.8 : 1.0;

    return baseScore * this.config.weights.pattern * lengthPenalty;
  }

  private async searchWithVariants(
    title: string,
    provider: string,
    providerInstance: { search: (query: string) => Promise<unknown[]> }
  ): Promise<SearchResult[]> {
    const titleVariants = generateTitleVariants(title, provider);
    logger.warn('[EnhancedMatcher] Searching for "' + title + '" on ' + provider + ' with ' + titleVariants.length + ' variants');

    for (const variant of titleVariants) {
      try {
        logger.warn('[EnhancedMatcher] Trying variant: "' + variant + '"');
        const results = await providerInstance.search(variant);
        logger.warn('[EnhancedMatcher] Got ' + results.length + ' results');
        if (Array.isArray(results) && results.length > 0) {
          return results as SearchResult[];
        }
      } catch (error) {
        logger.error('[EnhancedMatcher] Error searching variant "' + variant + '": ' + (error instanceof Error ? error.message : String(error)));
      }
    }

    logger.warn('[EnhancedMatcher] No results found for any variant of "' + title + '"');
    return [];
  }

  private calculateAltScore(title: string, provider: string, altTitle: unknown): number {
    if (typeof altTitle !== 'string') return 0;
    return this.calculateSimilarity(title, altTitle, provider);
  }

  private calculateBestScore(title: string, provider: string, result: SearchResult): number {
    const titleStr = typeof result.title === 'string' ? result.title : 'Unknown';
    let bestScore = this.calculateSimilarity(title, titleStr, provider);

    if (!result.alternativeTitles || !Array.isArray(result.alternativeTitles)) {
      return bestScore;
    }

    const altScores = result.alternativeTitles
      .map(alt => this.calculateAltScore(title, provider, alt))
      .filter(score => score > 0);

    return Math.max(bestScore, ...altScores);
  }

  private calculateAllScores(title: string, provider: string, results: SearchResult[]): MatchScore[] {
    return results.map(result => {
      const titleStr = typeof result.title === 'string' ? result.title : 'Unknown';
      const bestScore = this.calculateBestScore(title, provider, result);

      return {
        id: result.id,
        title: titleStr,
        score: bestScore
      };
    });
  }

  private processSearchResults(title: string, provider: string, searchResults: SearchResult[]): EnhancedMatchResult {
    if (searchResults.length === 0) {
      return createEmptyResult();
    }

    const validResults = filterValidResults(searchResults);

    if (validResults.length === 0) {
      return createEmptyResult();
    }

    const scores = this.calculateAllScores(title, provider, validResults);
    return buildMatchResult(scores, this.config.minScore);
  }

  async findMatchWithScore(title: string, provider: string): Promise<EnhancedMatchResult> {
    try {
      logger.warn('[EnhancedMatcher] Getting provider: ' + provider);
      const providerInstance = searchProviderRegistry.get(provider);
      logger.warn('[EnhancedMatcher] Got provider: ' + (providerInstance?.name || 'null'));
      if (!providerInstance) {
        logger.warn('[EnhancedMatcher] Provider instance is null, returning empty result');
        return createEmptyResult();
      }

      const searchResults = await this.searchWithVariants(title, provider, providerInstance);
      return this.processSearchResults(title, provider, searchResults);
    } catch (error) {
      logger.error('[EnhancedMatcher] Error in findMatchWithScore: ' + (error instanceof Error ? error.message : String(error)));
      return createEmptyResult();
    }
  }
}
