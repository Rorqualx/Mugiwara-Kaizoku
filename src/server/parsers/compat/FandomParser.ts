/**
 * Fandom Parser Compatibility Module
 *
 * @deprecated Use unified parser from 'src/server/parsers/unified' instead
 * This module provides backward compatibility for legacy code.
 */

import { logger } from '@/utils/logger';

import { parseHTML, type ParsedContent } from '../unified';

import type { NormalizedMangaData } from '../core/DataNormalizer';

interface FandomParserResult {
  title: string;
  chapters: Array<unknown>;
  volumes: Array<unknown>;
  metadata: Record<string, unknown>;
}

/**
 * Legacy FandomParser class for backward compatibility
 * @deprecated Use unified parser instead
 */
export class FandomParser {
  private logDeprecationWarning(): void {
    logger.warn('FandomParser is deprecated. Use unified parser from src/server/parsers/unified instead.');
  }

  /**
   * Parse HTML content
   * @deprecated Use parseHTML from unified parser
   */
  parse(html: string): FandomParserResult {
    this.logDeprecationWarning();

    try {
      const result = parseHTML(html, { source: 'fandom' });
      return this.convertParsedContentToLegacyFormat(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('FandomParser parse failed', errorMessage);
      return {
        title: '',
        chapters: [],
        volumes: [],
        metadata: {}
      };
    }
  }

  /**
   * Parse Fandom wiki URL
   * @deprecated Use parseURL from unified parser
   */
  async parseFandomWiki(url: string): Promise<FandomParserResult> {
    this.logDeprecationWarning();

    try {
      const { parseURL } = await import('../unified');
      const result = await parseURL(url, { source: 'fandom' });
      return this.convertNormalizedDataToLegacyFormat(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('FandomParser parseFandomWiki failed', errorMessage);
      return {
        title: '',
        chapters: [],
        volumes: [],
        metadata: {}
      };
    }
  }

  /**
   * Extract metadata from HTML
   * @deprecated Use parseHTML from unified parser
   */
  extractMetadata(html: string): Record<string, unknown> {
    this.logDeprecationWarning();

    try {
      const result = parseHTML(html, { source: 'fandom' });
      const metadata = result.metadata;
      return metadata as Record<string, unknown>;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('FandomParser extractMetadata failed', errorMessage);
      return {};
    }
  }

  /**
   * Parse volumes from HTML
   * @deprecated Use parseHTML from unified parser
   */
  parseVolumes(html: string): Array<unknown> {
    this.logDeprecationWarning();

    try {
      const result = parseHTML(html, { source: 'fandom' });
      const volumes = result["volumes"];
      return Array.isArray(volumes) ? volumes : [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('FandomParser parseVolumes failed', errorMessage);
      return [];
    }
  }

  /**
   * Parse chapters from HTML
   * @deprecated Use parseHTML from unified parser
   */
  parseChapters(html: string): Array<unknown> {
    this.logDeprecationWarning();

    try {
      const result = parseHTML(html, { source: 'fandom' });
      const chapters = result["chapters"];
      return Array.isArray(chapters) ? chapters : [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('FandomParser parseChapters failed', errorMessage);
      return [];
    }
  }

  /**
   * Convert ParsedContent result to legacy format
   */
  private convertParsedContentToLegacyFormat(result: ParsedContent): FandomParserResult {
    return {
      title: result.title ?? '',
      chapters: result.chapters,
      volumes: result.volumes,
      metadata: {
        ...result.metadata,
        ...(result.description !== undefined ? { description: result.description } : {}),
        ...(result.coverImage !== undefined ? { coverImage: result.coverImage } : {}),
        images: result.images,
        tables: result.tables,
        ...(result.infobox !== undefined ? { infobox: result.infobox } : {})
      }
    };
  }

  /**
   * Convert NormalizedMangaData result to legacy format
   */
  private convertNormalizedDataToLegacyFormat(result: NormalizedMangaData): FandomParserResult {
    return {
      title: result.title,
      chapters: result.chapters,
      volumes: result.volumes,
      metadata: {
        ...(result.description !== undefined ? { description: result.description } : {}),
        ...(result.coverImage !== undefined ? { coverImage: result.coverImage } : {}),
        ...(result.images !== undefined ? { images: result.images } : {}),
        ...(result.author !== undefined ? { author: result.author } : {}),
        ...(result.artist !== undefined ? { artist: result.artist } : {}),
        ...(result.publisher !== undefined ? { publisher: result.publisher } : {}),
        ...(result.genres !== undefined ? { genres: result.genres } : {}),
        status: result.status
      }
    };
  }
}

// Export singleton instance for compatibility
export const fandomParser = new FandomParser();

// Default export
export default FandomParser;