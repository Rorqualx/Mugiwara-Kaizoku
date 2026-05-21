/**
 * AniList Adult Content Filter Module
 *
 * Filters adult content from AniList search results.
 * Checks genres, tags, and metadata for adult indicators.
 *
 * Extracted from: AniListProvider.ts (lines 95-179)
 */

import { logger } from '@/utils/logger';

import type { SearchResult } from './anilist-provider-types';

// ============================================================================
// Adult Content Filter
// ============================================================================

export class AniListAdultFilter {
  /**
   * Filter adult content from search results
   */
  static filter(results: SearchResult[]): SearchResult[] {
    const beforeCount = results.length;
    logger.debug(`Applying adult content filtering, results count before: ${beforeCount}`);

    const filteredResults = results.filter(result => {
      return !this.isAdultContent(result);
    });

    if (beforeCount !== filteredResults.length) {
      logger.info(`Filtered ${beforeCount - filteredResults.length} adult results. Remaining: ${filteredResults.length}`);
    }

    return filteredResults;
  }

  /**
   * Check if a result contains adult content
   */
  private static isAdultContent(result: SearchResult): boolean {
    // Check for adult genres
    const hasAdultGenre = this.hasAdultGenre(result);

    // Check for adult tags
    const hasAdultTag = this.hasAdultTag(result);

    // Check if marked as adult in metadata
    const isAdultInMetadata = this.isAdultInMetadata(result);

    // Filter out if any adult indicator is found
    const shouldFilter = hasAdultGenre || hasAdultTag || isAdultInMetadata;

    if (shouldFilter) {
      this.logAdultContentDetection(result, { hasAdultGenre, hasAdultTag, isAdultInMetadata });
    } else {
      this.logNoAdultContent(result);
    }

    return shouldFilter;
  }

  /**
   * Check for adult genres
   */
  private static hasAdultGenre(result: SearchResult): boolean {
    const genres = result["genres"] ?? [];

    if (genres.length > 0) {
      logger.debug(`Checking genres for "${result["title"]}": ${genres.join(', ')}`);
    }

    return genres.some((genre: string) => {
      const lowerGenre = genre.toLowerCase();
      const isAdult = (
        lowerGenre === 'hentai' ||
        lowerGenre === 'adult' ||
        lowerGenre.includes('hentai') ||
        lowerGenre.includes('adult') ||
        lowerGenre.includes('erotic') ||
        lowerGenre.includes('sexual')
      );

      if (isAdult) {
        logger.debug(`Found adult genre "${genre}" in "${result["title"]}"`);
      }

      return isAdult;
    });
  }

  /**
   * Check for adult tags
   */
  private static hasAdultTag(result: SearchResult): boolean {
    const resultWithTags = result as SearchResult & { tags?: string[]; metadata?: Record<string, unknown> };
    const tags = resultWithTags.tags ?? [];

    if (tags.length > 0) {
      logger.debug(`Checking tags for "${result["title"]}": ${tags.join(', ')}`);
    }

    return tags.some((tag: string) => {
      const lowerTag = tag.toLowerCase();
      const isAdultTag = (
        lowerTag.includes('hentai') ||
        lowerTag.includes('adult content') ||
        lowerTag.includes('sexual content') ||
        lowerTag.includes('erotic') ||
        lowerTag.includes('explicit') ||
        lowerTag.includes('mature') ||
        lowerTag.includes('nsfw') ||
        (lowerTag.includes('adult') && !lowerTag.includes('primarily adult cast')) || // Exclude "primarily adult cast"
        lowerTag.includes('sexual')
      );

      if (isAdultTag) {
        logger.debug(`Found adult tag "${tag}" in "${result["title"]}"`);
      }

      return isAdultTag;
    });
  }

  /**
   * Check if marked as adult in metadata
   */
  private static isAdultInMetadata(result: SearchResult): boolean {
    const resultWithMetadata = result as SearchResult & { metadata?: Record<string, unknown> };
    const metadata = resultWithMetadata.metadata;
    const isAdult = metadata && typeof metadata === 'object' && metadata["isAdult"] === true;

    if (isAdult) {
      logger.debug(`Found isAdult=true in metadata for "${result["title"]}"`);
    }

    return !!isAdult;
  }

  /**
   * Log adult content detection details
   */
  private static logAdultContentDetection(
    result: SearchResult,
     
    _indicators: { hasAdultGenre: boolean; hasAdultTag: boolean; isAdultInMetadata: boolean }
  ): void {
    const genres = result["genres"] ?? [];
    const resultWithTags = result as SearchResult & { tags?: string[] };
    const tags = resultWithTags.tags ?? [];

    logger.info(`Filtering out adult content: "${result["title"]}" (genres: ${genres.join(', ')}, tags: ${tags.join(', ')})`);
  }

  /**
   * Log when no adult content is detected
   */
  private static logNoAdultContent(result: SearchResult): void {
    const genres = result["genres"] ?? [];
    const resultWithTags = result as SearchResult & { tags?: string[]; metadata?: Record<string, unknown> };
    const tags = resultWithTags.tags ?? [];
    const metadata = resultWithTags.metadata;
    const isAdult = metadata && typeof metadata === 'object' && metadata["isAdult"] === true;

    logger.debug(`No adult content detected in "${result["title"]}" - genres: ${genres.join(', ')}, tags: ${tags.join(', ')}, isAdult: ${isAdult}`);
  }
}