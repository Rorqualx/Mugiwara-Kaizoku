/**
 * Dynamic Wiki Parser - Main Aggregator
 *
 * Intelligent parser that analyzes and adapts to different wiki structures.
 * Aggregates functionality from decomposed modules.
 *
 * Architecture:
 * - dynamic-wiki-parser/types.ts - Types, interfaces, enums (173 lines)
 * - dynamic-wiki-parser/utils.ts - Helper functions (179 lines)
 * - dynamic-wiki-parser/structure-analyzer.ts - Structure detection (183 lines)
 * - dynamic-wiki-parser/table-extractor.ts - Table extraction (282 lines)
 * - dynamic-wiki-parser/tab-extractor.ts - Tab extraction (477 lines)
 * - dynamic-wiki-parser/other-extractors.ts - Other extractors (302 lines)
 * - dynamic-wiki-parser/selector-generators.ts - Selector generation (225 lines)
 *
 * Original: 1682 lines -> Refactored: ~350 lines (79% reduction)
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';

// Import from modules
import {
  extractFromDefinitionList,
  extractFromGallery,
  extractFromCollapsibles,
  extractFromCategory,
  extractWithFallbacks,
} from './dynamic-wiki-parser/other-extractors';
import {
  extractStructureMetadata,
  detectStructureType,
  generateDynamicSelectors,
  detectContentPatterns,
} from './dynamic-wiki-parser/structure-analyzer';
import { extractFromTabs } from './dynamic-wiki-parser/tab-extractor';
import { extractFromTables } from './dynamic-wiki-parser/table-extractor';
import {
  StructureType,
  type PageStructure,
  type WikiPage,
  type ExtractedData,
  type VolumeData,
  type ChapterData,
  isRecord,
  isVolumeData,
  isChapterData,
} from './dynamic-wiki-parser/types';
import { getCacheKey, calculateConfidence } from './dynamic-wiki-parser/utils';

// Re-export types for backward compatibility
export {
  StructureType,
  type PageStructure,
  type DynamicSelectors,
  type SelectorStrategy,
  type ContentPatterns,
  type StructureMetadata,
  type WikiPage,
  type ExtractedData,
  isRecord,
  isVolumeData,
  isChapterData,
} from './dynamic-wiki-parser/types';

export class DynamicWikiParser {
  private log = logger.child('DynamicWikiParser', { service: 'DynamicWikiParser' });
  private cache = new Map<string, PageStructure>();

  /**
   * Analyze page structure and detect the best extraction strategy
   */
  analyzePageStructure(html: string, url: string): Promise<PageStructure> {
    const $ = cheerio.load(html);

    // Check cache first
    const cacheKey = getCacheKey(url);
    const cachedStructure = this.cache.get(cacheKey);
    if (cachedStructure !== undefined) {
      return Promise.resolve(cachedStructure);
    }

    const metadata = extractStructureMetadata($);
    const type = detectStructureType($, metadata);
    const selectors = generateDynamicSelectors($, type, metadata);
    const patterns = detectContentPatterns($);

    const structure: PageStructure = {
      type,
      confidence: calculateConfidence(type, metadata, selectors),
      selectors,
      patterns,
      metadata
    };

    // Cache the structure
    this.cache.set(cacheKey, structure);

    return Promise.resolve(structure);
  }

  /**
   * Extract data from a wiki page using the detected structure
   */
  async extractData(page: WikiPage): Promise<ExtractedData> {
    const $ = cheerio.load(page.html);
    const structure = page.structure ?? await this.analyzePageStructure(page.html, page.url);

    try {
      let data: unknown;
      let extractionMethod: StructureType | string = structure.type;

      switch (structure.type) {
        case StructureType.TABLE_BASED:
          data = await extractFromTables($, structure);
          break;

        case StructureType.TABBED_INTERFACE:
          data = await extractFromTabs($, structure);
          break;

        case StructureType.HYBRID: {
          const tableData = await extractFromTables($, structure);
          const tabData = await extractFromTabs($, structure);
          data = this.mergeExtractedData(tableData, tabData);
          break;
        }

        case StructureType.DEFINITION_LIST:
          data = await extractFromDefinitionList($, structure);
          break;

        case StructureType.GALLERY_BASED:
          data = await extractFromGallery($, structure);
          break;

        case StructureType.COLLAPSIBLE_SECTIONS:
          data = await extractFromCollapsibles($, structure);
          break;

        case StructureType.CATEGORY_PAGE:
          data = await extractFromCategory($, structure);
          break;

        default:
          data = await extractWithFallbacks($, structure);
          extractionMethod = 'fallback';
      }

      return {
        success: true,
        type: this.detectDataType(data),
        data,
        confidence: structure.confidence,
        source: page.url,
        extractionMethod
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log.error('Extraction failed', {
        url: page.url,
        structureType: structure.type,
        error: errorMessage
      });

      const fallbackData = await extractWithFallbacks($, structure);

      return {
        success: !!fallbackData,
        type: 'manga',
        data: fallbackData,
        confidence: structure.confidence * 0.5,
        source: page.url,
        extractionMethod: 'fallback',
        errors: [errorMessage]
      };
    }
  }

  /**
   * Detect the type of data extracted
   */
  private detectDataType(data: unknown): 'manga' | 'chapters' | 'volumes' | 'character' {
    if (!data || !isRecord(data)) return 'manga';

    const volumes = getUnknownProperty(data, 'volumes');
    if (Array.isArray(volumes) && volumes.length > 0) {
      return 'manga';
    }

    const chapters = getUnknownProperty(data, 'chapters');
    if (Array.isArray(chapters) && chapters.length > 0) {
      return 'chapters';
    }

    const characters = getUnknownProperty(data, 'characters');
    if (Array.isArray(characters) && characters.length > 0) {
      return 'character';
    }

    return 'manga';
  }

  /**
   * Merge data extracted from multiple methods
   */
  private mergeExtractedData(...dataSets: unknown[]): Record<string, unknown> {
    const volumeMap = new Map<number, VolumeData>();
    const chapterMap = new Map<string, ChapterData>();
    const galleryMap = new Map<string, unknown>();

    // Process each dataset
    for (const data of dataSets) {
      if (!data || !isRecord(data)) continue;

      this.mergeVolumes(data, volumeMap);
      this.mergeChapters(data, chapterMap);
      this.mergeGallery(data, galleryMap);
    }

    // Convert maps to arrays
    const volumes = Array.from(volumeMap.values()).sort((a, b) => a.number - b.number);
    const chapters = Array.from(chapterMap.values()).sort((a, b) => {
      const aNum = parseFloat(a.number);
      const bNum = parseFloat(b.number);
      return aNum - bNum;
    });
    const gallery = Array.from(galleryMap.values());

    // Deduplicate chapters within volumes
    this.deduplicateVolumeChapters(volumes);

    if (gallery.length > 0) {
      this.log.info(`[GALLERY] Merged total gallery images: ${gallery.length}`);
    }

    return { volumes, chapters, gallery };
  }

  /**
   * Merge volumes from data into volume map
   */
  private mergeVolumes(data: Record<string, unknown>, volumeMap: Map<number, VolumeData>): void {
    const volumes = getUnknownProperty(data, 'volumes');
    if (!Array.isArray(volumes)) return;

    for (const volume of volumes) {
      if (!isVolumeData(volume)) continue;
      const key = volume.number;
      const existing = volumeMap.get(key);

      if (existing) {
        volumeMap.set(key, {
          ...existing,
          ...volume,
          chapters: [...existing.chapters, ...volume.chapters]
        });
      } else {
        volumeMap.set(key, volume);
      }
    }
  }

  /**
   * Merge chapters from data into chapter map
   */
  private mergeChapters(data: Record<string, unknown>, chapterMap: Map<string, ChapterData>): void {
    const chapters = getUnknownProperty(data, 'chapters');
    if (!Array.isArray(chapters)) return;

    for (const chapter of chapters) {
      if (!isChapterData(chapter)) continue;
      const key = `${chapter.volume ?? 'unknown'}-${chapter.number}`;
      if (!chapterMap.has(key)) {
        chapterMap.set(key, chapter);
      }
    }
  }

  /**
   * Merge gallery images from data into gallery map
   */
  private mergeGallery(data: Record<string, unknown>, galleryMap: Map<string, unknown>): void {
    const gallery = getUnknownProperty(data, 'gallery');
    if (!Array.isArray(gallery)) return;

    for (const image of gallery) {
      if (!isRecord(image)) continue;
      const url = image['url'];
      const caption = image['caption'];
      const key = (typeof url === 'string' ? url : '') ||
                  (typeof caption === 'string' ? caption : '') ||
                  Math.random().toString();
      if (!galleryMap.has(key)) {
        galleryMap.set(key, image);
      }
    }
  }

  /**
   * Deduplicate chapters within each volume
   */
  private deduplicateVolumeChapters(volumes: VolumeData[]): void {
    for (const volume of volumes) {
      if (!Array.isArray(volume.chapters)) continue;

      const uniqueChapters = new Map<string, ChapterData>();
      for (const chapter of volume.chapters) {
        if (!isChapterData(chapter)) continue;
        const chapterNum = typeof chapter.number === 'string'
          ? chapter.number
          : String(chapter.number);
        if (!uniqueChapters.has(chapterNum)) {
          uniqueChapters.set(chapterNum, chapter);
        }
      }
      volume.chapters = Array.from(uniqueChapters.values());
    }
  }
}
