/**
 * MangaDex Search Result Validator
 *
 * Validates and transforms raw MangaDex API responses into standardized
 * SearchResult objects. Follows the same pattern as other provider validators.
 *
 * @module server/services/search/providers/search-result-validator/mangadex-validator
 */

import type { SearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

import { cleanHtmlDescription } from './utils';

// Use string literal until migration is run
const MANGADEX_PROVIDER = 'MANGADEX';

const log = logger.child('MangaDexValidator');

/**
 * MangaDex-specific field extraction and transformation utilities
 */
export class MangaDexValidator {
  /**
   * Create a validated SearchResult from MangaDex data
   *
   * @param baseResult - Base result with common fields already extracted
   * @param obj - Raw MangaDex response object
   * @returns Complete SearchResult with MangaDex-specific fields
   */
  static createResult(
    baseResult: SearchResult,
    obj: Record<string, unknown>
  ): SearchResult {
    try {
      const attributes = obj['attributes'] as Record<string, unknown> | undefined;
      const relationships = obj['relationships'] as Array<{
        id: string;
        type: string;
        attributes?: Record<string, unknown>;
      }> | undefined;

      if (!attributes) {
        return baseResult;
      }

      // Extract title with priority: en > ja-ro > ja > first available
      const title = this.extractLocalizedTitle(attributes['title'] as Record<string, string> | undefined);

      // Extract description
      const description = this.extractLocalizedDescription(
        attributes['description'] as Record<string, string> | undefined
      );

      // Extract cover image URL from relationships
      const coverImage = this.extractCoverImage(obj['id'] as string, relationships);

      // Extract authors and artists from relationships
      const { authors, artists } = this.extractCreators(relationships);

      // Extract genres and themes from tags
      const { genres, themes } = this.extractTagsFromAttributes(
        attributes['tags'] as Array<{ id: string; attributes: { name: Record<string, string>; group: string } }> | undefined
      );

      // Map status
      const status = this.mapStatus(attributes['status'] as string | undefined);

      // Extract alternative titles
      const alternativeTitles = this.extractAlternativeTitles(
        attributes['altTitles'] as Array<Record<string, string>> | undefined
      );

      // Parse chapter/volume counts
      const chapters = this.parseChapterCount(attributes['lastChapter'] as string | undefined);
      const volumes = this.parseVolumeCount(attributes['lastVolume'] as string | undefined);

      // Build base result object with required fields
      const result: SearchResult = {
        ...baseResult,
        id: (obj['id'] as string | undefined) ?? baseResult.id,
        title: title ?? baseResult.title,
        genres,
        themes,
        authors,
        artists,
        alternativeTitles,
        provider: MANGADEX_PROVIDER,
        providerUrl: `https://mangadex.org/title/${obj['id']}`,
        // Store MangaDex-specific metadata
        metadata: {
          ...((baseResult.metadata ?? {}) as Record<string, unknown>),
          mangadexId: obj['id'],
          contentRating: attributes['contentRating'],
          demographic: attributes['publicationDemographic'],
          originalLanguage: attributes['originalLanguage'],
          availableTranslatedLanguages: attributes['availableTranslatedLanguages'],
          lastChapter: attributes['lastChapter'],
          lastVolume: attributes['lastVolume'],
          links: attributes['links']
        }
      };

      // Add optional fields only if they have values
      if (status) {
        result.status = status;
      }
      if (description) {
        result.description = description;
      }
      if (coverImage) {
        result.cover = coverImage;
        result.coverImage = coverImage;
      }
      if (chapters !== null) {
        result.chapters = chapters;
      }
      if (volumes !== null) {
        result.volumes = volumes;
      }
      if (attributes['year']) {
        result.year = attributes['year'] as number;
      }

      return result;
    } catch (error) {
      log.error('Failed to create MangaDex result', {
        error: error instanceof Error ? error.message : String(error)
      });
      return baseResult;
    }
  }

  /**
   * Extract localized title with priority order
   */
  private static extractLocalizedTitle(
    titles: Record<string, string> | undefined
  ): string | undefined {
    if (!titles) return undefined;

    // Priority: en > ja-ro > ja > first available
    if (titles['en']) return titles['en'];
    if (titles['ja-ro']) return titles['ja-ro'];
    if (titles['ja']) return titles['ja'];

    // Return first available
    const firstTitle = Object.values(titles).find(t => t !== '');
    return firstTitle;
  }

  /**
   * Extract localized description with HTML cleaning
   */
  private static extractLocalizedDescription(
    descriptions: Record<string, string> | undefined
  ): string | undefined {
    if (!descriptions) return undefined;

    const rawDescription = descriptions['en']
      ?? descriptions['ja-ro']
      ?? descriptions['ja']
      ?? Object.values(descriptions).find(d => d !== '');

    if (!rawDescription) return undefined;

    return cleanHtmlDescription(rawDescription);
  }

  /**
   * Extract cover image URL from relationships
   */
  private static extractCoverImage(
    mangaId: string | undefined,
    relationships: Array<{ id: string; type: string; attributes?: Record<string, unknown> }> | undefined
  ): string | undefined {
    if (!mangaId || !relationships) return undefined;

    const coverRel = relationships.find(rel => rel.type === 'cover_art');
    if (!coverRel?.attributes) return undefined;

    const fileName = coverRel.attributes['fileName'] as string | undefined;
    if (!fileName) return undefined;

    // Return 512px thumbnail by default
    return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}.512.jpg`;
  }

  /**
   * Extract authors and artists from relationships
   */
  private static extractCreators(
    relationships: Array<{ id: string; type: string; attributes?: Record<string, unknown> }> | undefined
  ): { authors: string[]; artists: string[] } {
    const authors: string[] = [];
    const artists: string[] = [];

    if (!relationships) return { authors, artists };

    for (const rel of relationships) {
      const name = rel.attributes?.['name'] as string | undefined;
      if (!name) continue;

      if (rel.type === 'author') {
        authors.push(name);
      } else if (rel.type === 'artist') {
        artists.push(name);
      }
    }

    return { authors, artists };
  }

  /**
   * Extract genres and themes from tags
   */
  private static extractTagsFromAttributes(
    tags: Array<{ id: string; attributes: { name: Record<string, string>; group: string } }> | undefined
  ): { genres: string[]; themes: string[] } {
    const genres: string[] = [];
    const themes: string[] = [];

    if (!tags) return { genres, themes };

    for (const tag of tags) {
      const name = tag.attributes.name['en']
        ?? Object.values(tag.attributes.name)[0];

      if (!name) continue;

      if (tag.attributes.group === 'genre') {
        genres.push(name);
      } else if (tag.attributes.group === 'theme') {
        themes.push(name);
      }
    }

    return { genres, themes };
  }

  /**
   * Extract alternative titles
   */
  private static extractAlternativeTitles(
    altTitles: Array<Record<string, string>> | undefined
  ): string[] {
    if (!altTitles) return [];

    return altTitles
      .flatMap(obj => Object.values(obj))
      .filter((title): title is string => title !== '');
  }

  /**
   * Map MangaDex status to internal status
   */
  private static mapStatus(status: string | undefined): string | undefined {
    if (!status) return undefined;

    switch (status) {
      case 'ongoing':
        return 'RELEASING';
      case 'completed':
        return 'FINISHED';
      case 'hiatus':
        return 'HIATUS';
      case 'cancelled':
        return 'CANCELLED';
      default:
        return status.toUpperCase();
    }
  }

  /**
   * Parse chapter count from string
   */
  private static parseChapterCount(lastChapter: string | undefined): number | null {
    if (!lastChapter) return null;
    const parsed = parseFloat(lastChapter);
    return Number.isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse volume count from string
   */
  private static parseVolumeCount(lastVolume: string | undefined): number | null {
    if (!lastVolume) return null;
    const parsed = parseInt(lastVolume, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
}
