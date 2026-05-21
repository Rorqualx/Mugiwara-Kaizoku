/**
 * AniList Format Content Filter Module
 *
 * Filters content by format (webtoons) and country of origin (Korean manhwa).
 * These are experimental filters that can be enabled in AniList settings.
 *
 * Formats detected:
 * - WEBTOON: Long vertical scroll format comics
 * - Korean Manhwa: Content with countryOfOrigin = 'KR'
 */

import { logger } from '@/utils/logger';

import type { SearchResult } from './anilist-provider-types';

// ============================================================================
// Types
// ============================================================================

export interface FormatFilterConfig {
  filterWebtoons: boolean;
  filterKoreanManhwa: boolean;
}

interface ResultMetadata {
  format?: string;
  countryOfOrigin?: string;
  [key: string]: unknown;
}

// ============================================================================
// Format Content Filter
// ============================================================================

export class AniListFormatFilter {
  /**
   * Filter content based on format and country of origin settings
   */
  static filter(results: SearchResult[], config: FormatFilterConfig): SearchResult[] {
    // Skip filtering if both options are disabled
    if (!config.filterWebtoons && !config.filterKoreanManhwa) {
      return results;
    }

    const beforeCount = results.length;
    logger.debug(`Applying format content filtering (webtoons: ${config.filterWebtoons}, koreanManhwa: ${config.filterKoreanManhwa}), results count before: ${beforeCount}`);

    const filteredResults = results.filter(result => {
      return !this.shouldFilterResult(result, config);
    });

    if (beforeCount !== filteredResults.length) {
      logger.info(`Format filter removed ${beforeCount - filteredResults.length} results. Remaining: ${filteredResults.length}`);
    }

    return filteredResults;
  }

  /**
   * Check if a result should be filtered based on format/country settings
   */
  private static shouldFilterResult(result: SearchResult, config: FormatFilterConfig): boolean {
    const metadata = this.extractMetadata(result);

    // Check for webtoon format
    if (config.filterWebtoons && this.isWebtoon(result, metadata)) {
      logger.debug(`Filtering webtoon: "${result.title}" (format: ${metadata.format ?? result.format})`);
      return true;
    }

    // Check for Korean manhwa
    if (config.filterKoreanManhwa && this.isKoreanManhwa(result, metadata)) {
      logger.debug(`Filtering Korean manhwa: "${result.title}" (countryOfOrigin: ${metadata.countryOfOrigin})`);
      return true;
    }

    return false;
  }

  /**
   * Extract metadata from result
   */
  private static extractMetadata(result: SearchResult): ResultMetadata {
    const resultWithMetadata = result as SearchResult & { metadata?: Record<string, unknown> };
    const metadata = resultWithMetadata.metadata;

    if (metadata && typeof metadata === 'object') {
      return metadata as ResultMetadata;
    }

    return {};
  }

  /**
   * Check if the result is a webtoon format
   */
  private static isWebtoon(result: SearchResult, metadata: ResultMetadata): boolean {
    // Check format field directly on result
    const resultFormat = result.format?.toUpperCase();
    if (resultFormat === 'WEBTOON') {
      return true;
    }

    // Check format in metadata
    const metadataFormat = metadata.format?.toUpperCase();
    if (metadataFormat === 'WEBTOON') {
      return true;
    }

    return false;
  }

  /**
   * Check if the result is Korean manhwa (by country of origin)
   */
  private static isKoreanManhwa(result: SearchResult, metadata: ResultMetadata): boolean {
    // Check countryOfOrigin in metadata
    const countryOfOrigin = metadata.countryOfOrigin?.toUpperCase();
    if (countryOfOrigin === 'KR') {
      return true;
    }

    // Also check if format explicitly says MANHWA (Korean-specific format)
    const resultFormat = result.format?.toUpperCase();
    const metadataFormat = metadata.format?.toUpperCase();

    if (resultFormat === 'MANHWA' || metadataFormat === 'MANHWA') {
      return true;
    }

    return false;
  }
}
