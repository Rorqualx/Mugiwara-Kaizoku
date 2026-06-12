/**
 * Unified Metadata Parser
 *
 * A single, comprehensive parser that consolidates all metadata extraction logic
 * from various providers (Fandom, Wikipedia, etc.) into a unified interface.
 * This eliminates code duplication and provides consistent parsing across all sources.
 */


import * as cheerio from 'cheerio';


import { FandomAdapter } from './adapters/FandomAdapter';
import { WikipediaAdapter } from './adapters/WikipediaAdapter';
import { ContentExtractor } from './core/ContentExtractor';
import { DataNormalizer, type NormalizedMangaData } from './core/DataNormalizer';
import { extractDescription } from './unified-metadata-parser/description-extractors';
import { ExtractionUtilities } from './unified-metadata-parser/extraction-utilities';
import {
  extractFandomCoverImage,
  extractWikipediaCoverImage,
  extractGenericCoverImage,
  extractAllImages
} from './unified-metadata-parser/image-extractors';
import { extractMetadataFromInfobox } from './unified-metadata-parser/infobox-extractors';
import { PatternLibrary } from './unified-metadata-parser/pattern-library';
import {
  parseTables,
  parseGalleries
} from './unified-metadata-parser/table-parsers';

import type {
  ParseOptions,
  ParsedContent,
  UIFormattedContent,
  VolumeInfo,
  ChapterInfo,
  ExtractedMetadata,
  TableData,
  InfoboxData
} from './unified-metadata-parser/types';
import type { CheerioAPI } from 'cheerio';

// Re-export types for backward compatibility
export type {
  ParseOptions,
  ParsedContent,
  UIFormattedContent,
  VolumeInfo,
  ChapterInfo,
  ExtractedMetadata,
  TableData,
  InfoboxData
};

// Re-export classes for backward compatibility
export { PatternLibrary, ExtractionUtilities };

// ============================================================================
// Unified Parser
// ============================================================================

export class UnifiedMetadataParser {
  private $: CheerioAPI | null = null;
  private contentExtractor: ContentExtractor;
  private dataNormalizer: DataNormalizer;
  private fandomAdapter: FandomAdapter;
  private wikipediaAdapter: WikipediaAdapter;
  constructor() {
    this.contentExtractor = new ContentExtractor();
    this.dataNormalizer = new DataNormalizer();
    this.fandomAdapter = new FandomAdapter();
    this.wikipediaAdapter = new WikipediaAdapter();
  }

  /**
   * Parse content using the new unified architecture
   * This is the recommended method for new implementations
   */
  async parseUnified(htmlOrUrl: string, options: ParseOptions & { isUrl?: boolean } = {}): Promise<NormalizedMangaData> {
    // If it's a URL, use adapters
    if (options.isUrl) {
      if (htmlOrUrl.includes('fandom.com')) {
        return this.fandomAdapter.extract(htmlOrUrl);
      } else if (htmlOrUrl.includes('wikipedia.org')) {
        return this.wikipediaAdapter.extract(htmlOrUrl);
      }
    }

    // Otherwise, parse HTML directly
    const content = await this.contentExtractor.extract(htmlOrUrl, {
      autoDetectFormat: true,
      extractTables: true,
      extractImages: true,
      extractMetadata: true,
      extractLinks: true,
      mergeData: true,
      cleanText: true
    });

    return this.dataNormalizer.normalize(content, {
      validateDates: true,
      validateNumbers: true,
      removeInvalid: true,
      deduplicateChapters: true,
      deduplicateVolumes: true,
      mergeVariants: true,
      inferMissingData: true,
      sortChapters: true,
      sortVolumes: true,
      normalizeText: true
    });
  }

  /**
   * Parse HTML content and extract metadata (legacy method)
   */
  parseHTML(html: string, options: ParseOptions = {}): ParsedContent {
    this.$ = cheerio.load(html);
    const $ = this.$;

    const result: ParsedContent = {
      volumes: [],
      chapters: [],
      metadata: {},
      images: [],
      tables: [],
    };

    // Detect source if not specified
    const source = options.source ?? this.detectSource($);

    // Extract based on source
    switch (source) {
      case 'fandom':
        this.parseFandomContent($, result);
        break;
      case 'wikipedia':
        this.parseWikipediaContent($, result);
        break;
      default:
        // Try both approaches
        this.parseGenericContent($, result);
    }

    // Extract images if requested
    if (options.extractImages) {
      result.images = extractAllImages($);
    }

    // Clean URLs if requested
    if (options.cleanUrls) {
      result.coverImage = ExtractionUtilities.cleanImageUrl(result.coverImage);
      result.images = result.images.map(url => ExtractionUtilities.cleanImageUrl(url));
    }

    return result;
  }

  /**
   * Detect the source type from HTML
   */
  private detectSource($: CheerioAPI): 'fandom' | 'wikipedia' | 'unknown' {
    // Check for Fandom indicators
    if ($('.fandom-community-header').length > 0 ||
        $('meta[property="og:site_name"]').attr('content')?.includes('Fandom')) {
      return 'fandom';
    }

    // Check for Wikipedia indicators
    if ($('#mw-content-text').length > 0 ||
        $('meta[name="generator"]').attr('content')?.includes('MediaWiki')) {
      return 'wikipedia';
    }

    return 'unknown';
  }

  /**
   * Parse Fandom wiki content
   */
  private parseFandomContent($: CheerioAPI, result: ParsedContent): void {
    // Extract title from infobox
    const title = ExtractionUtilities.cleanText($('.portable-infobox .pi-title').first().text()) ||
                  ExtractionUtilities.cleanText($('h1.page-header__title').first().text());
    if (title) {
      Object.assign(result, { title });
    }

    // Extract infobox
    const infobox = this.parseInfobox($, '.portable-infobox');
    Object.assign(result, { infobox });

    // Extract metadata from infobox
    this.extractMetadataFromInfoboxLegacy(infobox, result.metadata);

    // Extract cover image
    Object.assign(result, { coverImage: extractFandomCoverImage($) });

    // Parse volume/chapter tables
    parseTables($, result);

    // Parse galleries if present
    parseGalleries($, result);

    // Extract description
    Object.assign(result, { description: extractDescription($, 'generic') });
  }

  /**
   * Parse Wikipedia content
   */
  private parseWikipediaContent($: CheerioAPI, result: ParsedContent): void {
    // Extract title from page
    const title = ExtractionUtilities.cleanText($('.infobox-title').first().text()) ||
                  ExtractionUtilities.cleanText($('#firstHeading').first().text()) ||
                  ExtractionUtilities.cleanText($('h1').first().text());
    if (title) {
      Object.assign(result, { title });
    }

    // Extract infobox
    const infobox = this.parseInfobox($, '.infobox');
    Object.assign(result, { infobox });

    // Extract metadata
    this.extractMetadataFromInfoboxLegacy(infobox, result.metadata);

    // Extract main image
    Object.assign(result, { coverImage: extractWikipediaCoverImage($) });

    // Parse tables
    parseTables($, result);

    // Extract description
    Object.assign(result, { description: extractDescription($, 'wikipedia') });
  }

  /**
   * Parse generic content (fallback)
   */
  private parseGenericContent($: CheerioAPI, result: ParsedContent): void {
    // Try to extract title from common selectors
    const title = ExtractionUtilities.cleanText($('.portable-infobox .pi-title').first().text()) ||
                  ExtractionUtilities.cleanText($('.infobox-title').first().text()) ||
                  ExtractionUtilities.cleanText($('#firstHeading').first().text()) ||
                  ExtractionUtilities.cleanText($('h1').first().text());
    if (title) {
      Object.assign(result, { title });
    }

    // Try both infobox selectors
    const infobox = this.parseInfobox($, '.portable-infobox, .infobox');
    Object.assign(result, { infobox });

    // Extract metadata
    this.extractMetadataFromInfoboxLegacy(infobox, result.metadata);

    // Try to find cover image
    Object.assign(result, { coverImage: extractGenericCoverImage($) });

    // Parse all tables
    parseTables($, result);

    // Extract description
    Object.assign(result, { description: extractDescription($, 'generic') });
  }

  /**
   * Parse infobox data
   */
  private parseInfobox($: CheerioAPI, selector: string): InfoboxData {
    const infobox: InfoboxData = {};
    const $infobox = $(selector).first();

    if ($infobox.length === 0) return infobox;

    // Parse different infobox formats

    // Format 1: Portable infobox (Fandom)
    $infobox.find('.pi-item').each((_, item) => {
      const $item = $(item);
      const label = ExtractionUtilities.cleanText($item.find('.pi-data-label').text());
      const value = ExtractionUtilities.cleanText($item.find('.pi-data-value').text());
      if (label && value) {
        infobox[label.toLowerCase()] = value;
      }
    });

    // Format 2: Traditional infobox (Wikipedia)
    $infobox.find('tr').each((_, row) => {
      const $row = $(row);
      const $th = $row.find('th');
      const $td = $row.find('td');

      if ($th.length > 0 && $td.length > 0) {
        const label = ExtractionUtilities.cleanText($th.text());
        const value = ExtractionUtilities.cleanText($td.text());
        if (label && value) {
          infobox[label.toLowerCase()] = value;
        }
      }
    });

    return infobox;
  }

  /**
   * Extract metadata from infobox using the extracted module
   */
  private extractMetadataFromInfoboxLegacy(infobox: InfoboxData, metadata: ExtractedMetadata): void {
    // Use the extracted function and merge results
    const extracted = extractMetadataFromInfobox(infobox);

    // Assign all extracted values to metadata using Object.assign
    Object.assign(metadata, {
      ...(extracted.author && { author: extracted.author }),
      ...(extracted.artist && { artist: extracted.artist }),
      ...(extracted.publisher && { publisher: extracted.publisher }),
      ...(extracted.magazine && { magazine: extracted.magazine }),
      ...(extracted.demographic && { demographic: extracted.demographic }),
      ...(extracted.genres && { genres: extracted.genres }),
      ...(extracted.status && { status: extracted.status }),
      ...(extracted.originalRun && { originalRun: extracted.originalRun }),
      ...(extracted.volumes !== undefined && { volumes: extracted.volumes }),
      ...(extracted.chapters !== undefined && { chapters: extracted.chapters }),
    });
  }

  /**
   * Format parsed content for UI
   */
  formatForUI(parsed: ParsedContent): UIFormattedContent {
    return {
      // Required fields
      id: (parsed.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-')) ?? '',
      title: parsed.title ?? '',
      source: 'unified-parser',
      provider: 'unified',

      // Cover and images
      cover: parsed.coverImage ?? '',
      coverImage: parsed.coverImage ?? '',
      coverUrl: parsed.coverImage ?? '',
      // volumeCovers not in UIFormattedContent interface

      // Description
      description: parsed.description ?? '',

      // Status
      status: parsed.metadata.status ?? 'ONGOING',

      // Genres
      genres: parsed.metadata.genres ?? [],

      // Alternative titles
      alternativeTitles: parsed.metadata.alternativeTitles ?? [],

      // Authors
      authors: parsed.metadata.author ?? [],

      // Publisher
      publisher: parsed.metadata.publisher ?? '',

      // Volumes and chapters
      volumes: parsed.metadata.volumes ?? parsed.volumes.length,
      chapters: parsed.metadata.chapters ?? parsed.chapters.length,

      // Full metadata
      metadata: {
        ...parsed.metadata,
        volumeList: parsed.volumes,
        chapterList: parsed.chapters,
        images: parsed.images,
        tables: parsed.tables,
        infobox: parsed.infobox
      }
    };
  }
}

// Export singleton instance with ML patterns enabled via feature flag
export const unifiedParser = new UnifiedMetadataParser();
