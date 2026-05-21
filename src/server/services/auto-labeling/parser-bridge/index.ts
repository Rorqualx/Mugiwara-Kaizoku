/**
 * Parser Bridge
 *
 * Bridges source-specific parsers (Fandom, Wikipedia, ComicVine) to the
 * auto-labeling system. Converts parser outputs to extracted entities.
 *
 * @module auto-labeling/parser-bridge
 */

import { adaptiveParse } from '@/server/services/fandom/adaptive/orchestrator';
import { analyzePageStructure } from '@/server/services/fandom/adaptive/static-analyzer';
import type { StaticAnalysisResult } from '@/server/services/fandom/adaptive/static-analyzer';
import { detectSourceType } from '@/server/shared/source-knowledge/source-detection';
import { createLogger } from '@/utils/logger';


import { extractFromComicVineHtml } from './comicvine-extractor';
import {
  convertParserResultToEntities,
  enhanceWithStaticAnalysis,
} from './fandom-extractor';
import {
  extractFromPortableInfobox,
  hasPortableInfobox,
} from './portable-infobox-extractor';
import { DEFAULT_OPTIONS } from './types';
import { mergeSourceSpecificEntities } from './utils';
import { extractFromWikipedia } from './wikipedia-extractor';

import type { ParserExtractionOptions, ParserExtractionResult } from './types';
import type { DiscoveredUrlType, ExtractedEntity, SampledPage } from '../types';

const logger = createLogger('auto-labeling:parser-bridge');

// ============================================================================
// Main Extraction
// ============================================================================

/**
 * Extract entities from a page using source-specific parsers.
 * Routes to appropriate parser based on URL:
 * - Wikipedia: Uses adaptiveExtract for comprehensive metadata
 * - ComicVine: Uses table metadata extractors for publisher/year/themes
 * - Fandom: Uses adaptiveParse with 14+ specialized parsers
 */
export async function extractWithParser(
  page: SampledPage,
  html: string,
  options?: ParserExtractionOptions
): Promise<ParserExtractionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  try {
    // Run static analysis if enabled
    let staticAnalysis: StaticAnalysisResult | null = null;
    if (opts.runStaticAnalysis) {
      staticAnalysis = analyzePageStructure(html);
    }

    // Route to source-specific extraction using unified source detection
    let sourceEntities: ExtractedEntity[] = [];
    const source = detectSourceType(page.url);

    switch (source) {
      case 'wikipedia':
        logger.info('Detected Wikipedia URL, using Wikipedia extractor', { url: page.url });
        sourceEntities = await extractFromWikipedia(page.url);
        break;
      case 'comicvine':
        logger.info('Detected ComicVine URL, using ComicVine extractor', { url: page.url });
        sourceEntities = extractFromComicVineHtml(html, page.url);
        break;
      default:
        // Fandom and other sources handled by adaptive parser below
        break;
    }

    // Run Fandom adaptive parser (works for Fandom and as fallback)
    const parserResult = await adaptiveParse(page.url, {
      extractionTimeoutMs: opts.timeoutMs,
      useCache: true,
      fallbackToLegacy: true,
    });

    // Convert parser data to entities
    const parserEntities = parserResult.success
      ? convertParserResultToEntities(parserResult, opts.minConfidence)
      : [];

    // If parser returned few entities, try portable infobox extraction as fallback
    let infoboxEntities: ExtractedEntity[] = [];
    if (parserEntities.length < 3 && hasPortableInfobox(html)) {
      logger.info('Parser returned few entities, trying portable infobox extraction', {
        url: page.url,
        parserEntityCount: parserEntities.length,
      });
      infoboxEntities = extractFromPortableInfobox(html, page.url);
    }

    // If all extractions failed, return failure
    if (!parserResult.success && sourceEntities.length === 0 && infoboxEntities.length === 0) {
      return {
        success: false,
        entities: [],
        staticAnalysis,
        parserResult,
        error: parserResult.error ?? 'Parser extraction failed',
        durationMs: Date.now() - startTime,
      };
    }

    // Merge all entities: parser + source-specific + infobox fallback
    let mergedEntities = mergeSourceSpecificEntities(parserEntities, sourceEntities);
    mergedEntities = mergeSourceSpecificEntities(mergedEntities, infoboxEntities);

    // Enhance with static analysis if available
    const enhancedEntities = staticAnalysis
      ? enhanceWithStaticAnalysis(mergedEntities, staticAnalysis)
      : mergedEntities;

    // Add PAGE_TYPE entity based on URL type and static analysis
    const pageTypeEntity = extractPageType(page.urlType, staticAnalysis);
    if (pageTypeEntity) {
      enhancedEntities.push(pageTypeEntity);
    }

    return {
      success: true,
      entities: enhancedEntities,
      staticAnalysis,
      parserResult,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Parser extraction error', error as Error);
    return {
      success: false,
      entities: [],
      staticAnalysis: null,
      parserResult: null,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Page Type Extraction
// ============================================================================

/**
 * Extract PAGE_TYPE entity based on URL type and static analysis.
 * This helps classify the page for appropriate ground truth comparison.
 */
function extractPageType(
  urlType: DiscoveredUrlType,
  staticAnalysis: StaticAnalysisResult | null
): ExtractedEntity | null {
  // Base confidence from URL type classification
  let confidence = 0.85;
  const detectedType = urlType;

  // Boost confidence if static analysis confirms the page type
  if (staticAnalysis) {
    const analysis = staticAnalysis;

    // Volume pages should have volume data
    if (urlType === 'VOLUMES' && analysis.tables.tablesWithVolumeData > 0) {
      confidence = 0.95;
    }

    // Chapter pages should have chapter links
    if (urlType === 'CHAPTERS' && analysis.tables.tablesWithChapterLinks > 0) {
      confidence = 0.95;
    }

    // Combined pages have both
    if (urlType === 'CHAPTERS_VOLUMES') {
      if (analysis.tables.tablesWithVolumeData > 0 && analysis.tables.tablesWithChapterLinks > 0) {
        confidence = 0.95;
      }
    }

    // If URL type says MANGA_PAGE but we see volume/chapter tables, it might be misclassified
    // Don't change the type, but note lower confidence
    if (urlType === 'MANGA_PAGE') {
      const hasVolumeTables = analysis.tables.tablesWithVolumeData > 0;
      const hasChapterTables = analysis.tables.tablesWithChapterLinks > 0;
      if (hasVolumeTables || hasChapterTables) {
        // Main manga pages can have volume/chapter sections
        confidence = 0.9;
      }
    }
  }

  return {
    type: 'PAGE_TYPE',
    value: detectedType,
    normalizedValue: detectedType.toLowerCase(),
    confidence,
    source: 'parser',
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export type { ParserExtractionOptions, ParserExtractionResult } from './types';
export { DEFAULT_OPTIONS } from './types';
export {
  normalizeEntityValue,
  normalizeStatusValue,
  mergeExtractions,
  mergeSourceSpecificEntities,
} from './utils';
export { staticAnalysisToLabels, enhanceWithStaticAnalysis } from './fandom-extractor';
export { extractFromWikipedia, isWikipediaUrl } from './wikipedia-extractor';
export { extractFromComicVineHtml, isComicVineUrl } from './comicvine-extractor';
export {
  extractFromPortableInfobox,
  hasPortableInfobox,
  isVolumeDetailPage,
  isChapterDetailPage,
} from './portable-infobox-extractor';
