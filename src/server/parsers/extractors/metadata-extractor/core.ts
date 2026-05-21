/**
 * Metadata Extractor Core
 *
 * Main MetadataExtractor class that orchestrates extraction from multiple
 * sources (schema.org, infobox, meta tags, content).
 *
 * Extracted from: MetadataExtractor.ts (lines 78-587)
 */

import { extractFromMetaTags, extractFromContent } from './content-extractor';
import { extractFromInfobox } from './infobox-extractor';
import { extractFromSchema } from './schema-extractor';
import {
  normalizeStatus,
  normalizeGenres,
  extractNumberRange,
  validateMetadata,
  isValidDate,
  isValidStatus,
  extractNumber,
  cleanText,
  parseOriginalRun,
} from './utils';

import type { ExtractedMetadata, MetadataExtractionOptions } from './types';
import type { CheerioAPI } from 'cheerio';


/**
 * Orchestrates metadata extraction from multiple sources
 * with priority-based merging and post-processing
 */
export class MetadataExtractor {
  /**
   * Extract metadata from page using multiple sources
   *
   * @param $ - Cheerio API instance
   * @param options - Extraction options
   * @returns Extracted and processed metadata
   */
  extractMetadata($: CheerioAPI, options: MetadataExtractionOptions = {}): ExtractedMetadata {
    const metadata: ExtractedMetadata = {};

    // Extract from multiple sources
    const schemaData = options.preferSchema ? extractFromSchema($) : {};
    const infoboxData = extractFromInfobox($, options);
    const metaTagData = extractFromMetaTags($);
    const contentData = options.extractPlot ? extractFromContent($) : {};

    // Merge data with priority (schema > infobox > meta > content)
    this.mergeMetadata(metadata, [
      { data: schemaData, priority: 1 },
      { data: infoboxData, priority: 2 },
      { data: metaTagData, priority: 3 },
      { data: contentData, priority: 4 },
    ]);

    // Post-process and validate
    this.postProcessMetadata(metadata, options);

    return metadata;
  }

  /**
   * Merge metadata from multiple sources
   * Lower priority number = higher priority
   */
  private mergeMetadata(
    target: ExtractedMetadata,
    sources: Array<{ data: Partial<ExtractedMetadata>; priority: number }>
  ): void {
    // Sort by priority (lower number = higher priority)
    sources.sort((a, b) => a.priority - b.priority);
    const typedTarget = target as Record<string, unknown>;

    for (const source of sources) {
      for (const [key, value] of Object.entries(source.data)) {
        // Only set if not already set or if array, merge
        if (!(key in target)) {
          typedTarget[key] = value;
        } else if (Array.isArray(value) && Array.isArray(typedTarget[key])) {
          // Merge arrays with proper typing
          const targetArray = typedTarget[key] as unknown[];
          typedTarget[key] = [...new Set([...targetArray, ...value])];
        }
      }
    }
  }

  /**
   * Post-process metadata
   * Cleans text, ensures unique arrays, validates status, and parses dates
   */
  private postProcessMetadata(
    metadata: ExtractedMetadata,
    options: MetadataExtractionOptions
  ): void {
    /* eslint-disable no-param-reassign */
    // Clean text fields if requested
    if (options.cleanText) {
      if (metadata.title) metadata.title = cleanText(metadata.title);
      if (metadata.description) metadata.description = cleanText(metadata.description);
      if (metadata.plot) metadata.plot = cleanText(metadata.plot);
    }

    // Ensure arrays are unique
    if (metadata.author) metadata.author = [...new Set(metadata.author)];
    if (metadata.artist) metadata.artist = [...new Set(metadata.artist)];
    if (metadata.genres) metadata.genres = [...new Set(metadata.genres)];
    if (metadata.themes) metadata.themes = [...new Set(metadata.themes)];
    if (metadata.alternativeTitles) {
      metadata.alternativeTitles = [...new Set(metadata.alternativeTitles)];
    }

    // Validate status
    if (metadata.status && !isValidStatus(metadata.status)) {
      const normalized = normalizeStatus(metadata.status);
      if (normalized !== undefined) {
        metadata.status = normalized;
      }
    }

    // Parse dates from original run if start/end not set
    if (metadata.originalRun && (!metadata.startDate || !metadata.endDate)) {
      const dates = parseOriginalRun(metadata.originalRun);
      if (dates.start && !metadata.startDate) metadata.startDate = dates.start;
      if (dates.end && !metadata.endDate) metadata.endDate = dates.end;
    }
    /* eslint-enable no-param-reassign */
  }

  // ====== Public Methods for Tests ======

  /**
   * Extract metadata from schema.org structured data
   */
  public extractFromSchema($: CheerioAPI): Partial<ExtractedMetadata> {
    return extractFromSchema($);
  }

  /**
   * Extract metadata from wiki infobox
   */
  public extractFromInfobox(
    $: CheerioAPI,
    options?: MetadataExtractionOptions
  ): Partial<ExtractedMetadata> {
    return extractFromInfobox($, options);
  }

  /**
   * Determine status from text
   */
  public determineStatus(text: string): ExtractedMetadata['status'] | undefined {
    return normalizeStatus(text);
  }

  /**
   * Normalize genres to standard format
   */
  public normalizeGenres(genres: string[]): string[] {
    return normalizeGenres(genres);
  }

  /**
   * Extract number range from text
   */
  public extractNumberRange(text: string): { start: number; end: number } | null {
    return extractNumberRange(text);
  }

  /**
   * Validate metadata object
   */
  public validateMetadata(metadata: unknown): ExtractedMetadata {
    return validateMetadata(metadata);
  }

  /**
   * Check if date string is valid
   */
  public isValidDate(date: string): boolean {
    return isValidDate(date);
  }

  /**
   * Extract number from value
   */
  public extractNumber(value: string): number | undefined {
    return extractNumber(value);
  }
}
