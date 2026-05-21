/**
 * Content Extraction Engine
 *
 * Main orchestrator that coordinates all extraction modules.
 * Refactored from monolithic 595-line file into focused modules.
 *
 * Architecture:
 * - content-extractor/types.ts - Type definitions (193 lines)
 * - content-extractor/table-processor.ts - Table processing (138 lines)
 * - content-extractor/chapter-manager.ts - Chapter management (88 lines)
 * - content-extractor/metadata-enhancer.ts - Metadata enhancement (59 lines)
 * - content-extractor/image-processor.ts - Image processing (60 lines)
 * - content-extractor/link-processor.ts - Link extraction (83 lines)
 * - content-extractor/utils.ts - Utilities (47 lines)
 *
 * Original: 595 lines, complexity 22
 * Refactored: 8 modules, max complexity 6
 *
 * Date: 2025-11-21
 */

import * as cheerio from 'cheerio';

import { ImageExtractor } from '../extractors/ImageExtractor';
import { MetadataExtractor } from '../extractors/MetadataExtractor';
import { TableExtractor } from '../extractors/TableExtractor';
import { PatternLibrary } from '../patterns/PatternLibrary';
import { StreamingParser } from '../streaming/StreamingParser';

import { mergeChapters, assignChaptersToVolumes } from './content-extractor/chapter-manager';
import { addCoverImages } from './content-extractor/image-processor';
import { extractLinks } from './content-extractor/link-processor';
import { enhanceWithMetadata } from './content-extractor/metadata-enhancer';
import { processTableData } from './content-extractor/table-processor';
import { normalizeUrl, createDefaultFormat } from './content-extractor/utils';
import { FormatDetector } from './FormatDetector';

import type { StreamingOptions, ParsedChunk } from '../streaming/StreamingParser';
import type { ExtractedContent, ContentExtractionOptions } from './content-extractor/types';

// Export types
export type {
  ExtractedContent,
  ExtractedLinks,
  Gallery,
  StoryArc,
  TabbedContent,
  Conflict,
  ValidationResult,
  VolumeData,
  ChapterData,
  ExtractedLink,
  ContentExtractionOptions,
} from './content-extractor/types';

export class ContentExtractor {
  private formatDetector: FormatDetector;
  private tableExtractor: TableExtractor;
  private imageExtractor: ImageExtractor;
  private metadataExtractor: MetadataExtractor;
  private patterns: PatternLibrary;

  constructor() {
    this.formatDetector = new FormatDetector();
    this.tableExtractor = new TableExtractor();
    this.imageExtractor = new ImageExtractor();
    this.metadataExtractor = new MetadataExtractor();
    this.patterns = new PatternLibrary();
  }

  /**
   * Extract content from HTML
   */
  async extract(html: string, options: ContentExtractionOptions = {}): Promise<ExtractedContent> {
    const $ = cheerio.load(html);

    // Detect format
    const format = options.autoDetectFormat !== false ?
      this.formatDetector.detectFormat(html, $) :
      createDefaultFormat(options.formatHint);

    // Get extraction hints based on format
    const hints = this.formatDetector.getExtractionHints(format);

    // Extract components
    const metadata = options.extractMetadata !== false ?
      this.metadataExtractor.extractMetadata($, {
        ...(options.includeRaw && { includeRaw: options.includeRaw }),
        ...(options.cleanText && { cleanText: options.cleanText })
      }) : {};

    const tables = options.extractTables !== false ?
      await this.tableExtractor.extractTables($, {
        handleRowspan: true,
        ...(options.mergeData && { mergeRelated: options.mergeData })
      }) : [];

    const images = options.extractImages !== false ?
      this.imageExtractor.extractImages($, {
        cleanUrls: true,
        includeInlineImages: false,
        preferredTypes: ['cover', 'gallery']
      }) : [];

    const links = options.extractLinks !== false ?
      extractLinks($, hints, normalizeUrl) : [];

    // Process table data into volumes and chapters
    const { volumes, chapters: tableChapters } = processTableData(tables);

    // Merge duplicate chapters
    const mergedChapters = mergeChapters(tableChapters);

    // Assign orphan chapters to volumes
    assignChaptersToVolumes(volumes, mergedChapters);

    // Enhance with metadata
    const enhancedMetadata = enhanceWithMetadata(volumes, mergedChapters, metadata);

    // Add cover images
    addCoverImages(volumes, images, this.patterns);

    const result: ExtractedContent = {
      format,
      metadata: enhancedMetadata,
      tables,
      images,
      volumes,
      chapters: mergedChapters,
      links
    };

    // Include raw content if requested
    if (options.includeRaw) {
      result.raw = {
        html: html.substring(0, 10000),
        text: $.text().substring(0, 5000)
      };
    }

    return result;
  }

  /**
   * Extract specific content type
   */
  async extractSpecific(
    html: string,
    type: 'metadata' | 'tables' | 'images' | 'links',
    options: ContentExtractionOptions = {}
  ): Promise<unknown> {
    const $ = cheerio.load(html);

    switch (type) {
      case 'metadata':
        return this.metadataExtractor.extractMetadata($, {
          ...(options.includeRaw && { includeRaw: options.includeRaw }),
          ...(options.cleanText && { cleanText: options.cleanText })
        });

      case 'tables':
        return this.tableExtractor.extractTables($, {
          handleRowspan: true,
          ...(options.mergeData && { mergeRelated: options.mergeData })
        });

      case 'images':
        return this.imageExtractor.extractImages($, {
          cleanUrls: true,
          includeInlineImages: false
        });

      case 'links': {
        const format = this.formatDetector.detectFormat(html, $);
        const hints = this.formatDetector.getExtractionHints(format);
        return extractLinks($, hints, normalizeUrl);
      }

      default:
        throw new Error(`Unknown extraction type: ${type as string}`);
    }
  }

  /**
   * Extract content from large HTML documents using streaming
   */
  async extractStream(
    html: string,
    options: StreamingOptions & { onChunk?: (chunk: ParsedChunk) => void } = {}
  ): Promise<void> {
    const parser = new StreamingParser({
      chunkSize: options.chunkSize ?? 64 * 1024,
      maxBufferSize: options.maxBufferSize ?? 1024 * 1024,
      parseTimeout: options.parseTimeout ?? 5000,
      enableBackpressure: options.enableBackpressure ?? true,
      progressInterval: options.progressInterval ?? 1000
    });

    // Set up chunk handler
    if (options.onChunk) {
      parser.on('chunk', options.onChunk);
    }

    // Parse the HTML stream
    await parser.parseStream(html);
  }
}
