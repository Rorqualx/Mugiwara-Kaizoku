// @file-size-justified: Orchestrator coordinates multiple parsers with complex interdependencies - splitting would create circular deps
/* eslint-disable max-lines, max-depth -- Orchestrator coordinates multiple parsers with complex interdependencies. The nested try-catch blocks for parser fallbacks create depth >4 but are essential for robust error handling. */
/**
 * Adaptive Parser Orchestrator
 *
 * Main coordination layer that combines URL discovery, structure detection,
 * data extraction, and pattern caching for robust Fandom wiki parsing.
 *
 * @module orchestrator
 */

import * as cheerio from 'cheerio';

import { parsePageAdaptive } from '@/server/services/metadata/utils/fandom-table-parser';
import type { ChapterData, VolumeData } from '@/server/services/metadata/utils/fandom-table-parser/fandom-types';
import { logger } from '@/utils/logger';

import { detectStructureType, extractStructureMetadata } from '../dynamic/dynamic-wiki-parser/structure-analyzer';
import { StructureType } from '../dynamic/dynamic-wiki-parser/types';

import { isAlternatingRowStructure, parseAlternatingRowStructure } from './alternating-row-parser';
import { isArcBasedStructure, parseArcBasedStructure } from './arc-based-parser';
import { hasStandaloneVolumeTables, hasTableListChapters, isBulletedListStructure, parseBulletedListEnhanced, parseBulletedListStructure } from './bulleted-list-parser';
import { discoverChaptersViaCategory, enrichChapterListTitlesFromWikitext } from './category-chapter-discovery';
import { isCategoryPageStructure, parseCategoryPage } from './category-page-parser';
import { isCollapsibleTableStructure, parseCollapsibleTables } from './collapsible-table-parser';
import { isIdVolumeTableStructure, parseIdVolumeTableStructure } from './id-volume-table-parser';
import { isJoJoStructure, parseJoJoStructure } from './jojo-parser';
import { fetchMainPageMetadata, fetchPageMetadata } from './metadata-fetcher';
import { isNumberedRowStructure, parseNumberedRowStructure } from './numbered-row-parser';
import {
  buildMangaData,
  createFailureResult,
  mergeChapterTitlesFromNumberedList,
  mergeMetadataIntoMangaData,
} from './orchestrator/data-builders';
import {
  convertAlternatingRowToStandard,
  convertArcBasedToStandard,
  convertBulletedToStandard,
  convertCategoryPageToStandard,
  convertCollapsibleTableToStandard,
  convertIdVolumeTableToStandard,
  convertJoJoToStandard,
  convertNumberedRowToStandard,
  convertParagraphLinkToStandard,
  convertPerVolumeChaptersToStandard,
  convertPlainTableToStandard,
  convertShiftedColumnToStandard,
  type StandardParsedData,
} from './orchestrator/result-converters';
import { isParagraphLinkStructure, parseParagraphLinkStructureEnhanced } from './paragraph-link-parser';
import { getPatternCache } from './pattern-cache';
import { iterateVolumePages, fetchVolumeZeroIfExists } from './per-volume-iterator';
import { isPlainTableStructure, parsePlainTableStructure } from './plain-table-parser';
import { isShiftedColumnStructure, parseShiftedColumnStructure } from './shifted-column-parser';
import { analyzePageStructure } from './static-analyzer';
import { DEFAULT_PARSER_OPTIONS, URL_PROBE_PATTERNS } from './types';
import { discoverBestChapterVolumeUrl, extractDomainFromUrl, isFandomDomain, probeUrl } from './url-discoverer';

import type { StaticAnalysisResult } from './static-analyzer';
import type { AdaptiveParseResult, AdaptiveParserOptions, CachedPattern, MetadataFetchResult } from './types';
import type { PageStructure } from '../dynamic/dynamic-wiki-parser/types';

/**
 * Fetches HTML content from a Fandom URL.
 * Uses MediaWiki API (bypasses Cloudflare) for Fandom wiki pages,
 * falls back to direct fetch for non-Fandom URLs.
 */
async function fetchHtml(url: string, timeoutMs: number, userAgent?: string): Promise<string> {
  // Use MediaWiki API for Fandom URLs (bypasses Cloudflare)
  if (url.includes('.fandom.com/wiki/')) {
    const { fetchPageHtmlViaApi } = await import('@/server/services/fandom/utils/mediaWikiApiFetch');
    const html = await fetchPageHtmlViaApi(url);
    if (html) return html;
    // Fall through to direct fetch if API fails
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent ?? 'Mozilla/5.0 (compatible; MuggiwaraBot/1.0)',
        Accept: 'text/html',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Builds PageStructure from analysis results.
 */
function buildPageStructure(
  $: cheerio.CheerioAPI,
  structureType: ReturnType<typeof detectStructureType>
): PageStructure {
  const metadata = extractStructureMetadata($);

  return {
    type: structureType,
    metadata,
    selectors: {
      content: [],
      fallbacks: [],
      contextual: new Map(),
    },
    patterns: {
      volumePattern: /Volume\s*(\d+)|Vol\.\s*(\d+)/gi,
      chapterPattern: /Chapter\s*(\d+(?:\.\d+)?)|Ch\.\s*(\d+(?:\.\d+)?)/gi,
      datePattern: /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\w+\s+\d{1,2},?\s+\d{4})/gi,
      numberPattern: /\d+(?:\.\d+)?/g,
      linkPattern: /https?:\/\/[^\s]+/gi,
    },
    confidence: metadata.hasVolumes || metadata.hasChapters ? 0.8 : 0.5,
  };
}

/**
 * Parses using cached pattern without re-discovery.
 */
async function parseWithCachedPattern(
  cachedPattern: CachedPattern,
  options: AdaptiveParserOptions
): Promise<AdaptiveParseResult> {
  const startTime = Date.now();
  const domain = cachedPattern.canonicalDomain ?? cachedPattern.domain;
  const url = `https://${domain}${cachedPattern.urlPath}`;
  const baseUrl = `https://${domain}`;

  try {
    const html = await fetchHtml(url, options.extractionTimeoutMs, options.userAgent);
    const parsedData = parsePageAdaptive(html, undefined, undefined, baseUrl);

    const hasData = parsedData.volumes.length > 0 || parsedData.chapters.length > 0;
    if (!hasData) {
      getPatternCache().recordFailure(cachedPattern.domain);
      return createFailureResult(domain, url, startTime, 'No data extracted from cached pattern', true);
    }

    // Merge chapter titles from numbered list items (handles wikis like Fire Force
    // where chapters have numeric-only titles that need to be replaced with real titles)
    parsedData.chapters = mergeChapterTitlesFromNumberedList(html, parsedData.chapters);

    getPatternCache().recordSuccess(cachedPattern.domain);

    return {
      success: true,
      data: buildMangaData(parsedData, url),
      structureType: cachedPattern.structureType,
      parsedUrl: url,
      domain,
      durationMs: Date.now() - startTime,
      usedCache: true,
      usedLegacyFallback: false,
      confidence: 0.9,
    };
  } catch (error) {
    getPatternCache().recordFailure(cachedPattern.domain);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createFailureResult(domain, url, startTime, message, true);
  }
}

/**
 * Result of attempting to extract data from a URL.
 */
interface ExtractionAttempt {
  success: boolean;
  url: string;
  html?: string;
  parsedData?: ReturnType<typeof parsePageAdaptive>;
  structureType?: ReturnType<typeof detectStructureType>;
  pageStructure?: PageStructure;
}

/**
 * Uses static analysis result to run the recommended parser.
 * Returns parsed data if successful, null if the recommended parser fails.
 */
// eslint-disable-next-line complexity -- Parser dispatch logic with confidence-based fallbacks
function tryRecommendedParser(
  html: string,
  analysis: StaticAnalysisResult,
  bestVolumes: VolumeData[],
  baseUrl?: string
): ReturnType<typeof parsePageAdaptive> | null {
  const parserType = analysis.recommendedParser.primary;
  const confidence = analysis.recommendedParser.confidence;

  // Only use static analysis recommendation if confidence is high enough
  if (confidence < 0.6) {
    logger.debug(`[staticAnalysis] Confidence too low (${confidence}), falling back to trial-and-error`);
    return null;
  }

  logger.info(`[staticAnalysis] Using recommended parser: ${parserType} (${Math.round(confidence * 100)}% confidence)`);

  // Log naming convention if detected
  if (analysis.chapterNaming.convention) {
    logger.info(`[staticAnalysis] Detected naming convention: ${analysis.chapterNaming.convention.displayName}`);
  }

  let parsedData: ReturnType<typeof parsePageAdaptive> | null = null;

  switch (parserType) {
    case 'numbered-table':
    case 'plain-table':
      if (isPlainTableStructure(html)) {
        const result = parsePlainTableStructure(html);
        if (result.success && (result.chapters.length > 0 || result.volumes.length > 0)) {
          parsedData = convertPlainTableToStandard(result);
        }
      }
      break;

    case 'bulleted-list':
      // Always run enhanced parser - it has multiple fallbacks for different page structures
      // (standard bulleted lists, table lists, links, plain text, and numbered lists like Death Note)
      {
        const result = parseBulletedListEnhanced(html);
        if (result.success && (result.chapters.length > 0 || result.volumes.length > 0)) {
          parsedData = convertBulletedToStandard(result);
        }
      }
      break;

    case 'arc-based':
      if (isArcBasedStructure(html)) {
        const result = parseArcBasedStructure(html);
        if (result.success) {
          parsedData = convertArcBasedToStandard(result);
        }
      }
      break;

    case 'alternating-row':
      if (isAlternatingRowStructure(html)) {
        const result = parseAlternatingRowStructure(html, baseUrl);
        if (result.success && result.chapters.length > 0) {
          parsedData = convertAlternatingRowToStandard(result);
        }
      }
      break;

    case 'numbered-row':
      if (isNumberedRowStructure(html)) {
        const result = parseNumberedRowStructure(html, baseUrl);
        if (result.success && result.chapters.length > 0) {
          parsedData = convertNumberedRowToStandard(result);
        }
      }
      break;

    case 'table-adaptive':
    default:
      // Default to table parser
      parsedData = parsePageAdaptive(html, undefined, undefined, baseUrl);
      break;
  }

  if (parsedData) {
    // Merge with best volumes if we found chapters but no volumes
    if (parsedData.chapters.length > 0 && parsedData.volumes.length === 0 && bestVolumes.length > 0) {
      logger.debug(`[staticAnalysis] Merging ${bestVolumes.length} volumes with ${parsedData.chapters.length} chapters`);
      parsedData.volumes = bestVolumes;
    }

    const volumeCount = parsedData.volumes.length;
    const chapterCount = parsedData.chapters.length;
    logger.info(`[staticAnalysis] Parser result: ${volumeCount} volumes, ${chapterCount} chapters`);

    // Consider success if we got meaningful data
    if (volumeCount > 0 || chapterCount > 0) {
      return parsedData;
    }
  }

  logger.debug(`[staticAnalysis] Recommended parser ${parserType} returned no data`);
  return null;
}

/**
 * Tries to extract data from a URL.
 * Returns success/failure with parsed data if successful.
 * Uses static analysis first, then falls back to trial-and-error parsers.
 */
// eslint-disable-next-line complexity, max-statements, max-lines-per-function -- Multi-parser orchestration with fallback chains
async function tryExtractFromUrl(
  url: string,
  options: AdaptiveParserOptions
): Promise<ExtractionAttempt> {
  try {
    // Extract base URL for building absolute chapter URLs
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    const html = await fetchHtml(url, options.extractionTimeoutMs, options.userAgent);
    const $ = cheerio.load(html);

    const metadata = extractStructureMetadata($);
    const structureType = detectStructureType($, metadata);
    const pageStructure = buildPageStructure($, structureType);

    // Check for id-based volume table structure FIRST (One Piece style - high priority)
    if (isIdVolumeTableStructure(html)) {
      logger.debug(`[tryExtractFromUrl] Detected id-volume table structure for ${url}`);
      const idVolumeResult = parseIdVolumeTableStructure(html);
      if (idVolumeResult.success && idVolumeResult.chapters.length >= 50) {
        const parsedData = convertIdVolumeTableToStandard(idVolumeResult);
        logger.info(`[tryExtractFromUrl] ID-volume table parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
        return { success: true, url, html, parsedData, structureType, pageStructure };
      }
    }

    // Check for JoJo structure (Volume N: tables - high priority)
    if (isJoJoStructure(html)) {
      logger.debug(`[tryExtractFromUrl] Detected JoJo structure for ${url}`);
      const jojoResult = parseJoJoStructure(html);
      if (jojoResult.success && jojoResult.chapters.length >= 50) {
        const parsedData = convertJoJoToStandard(jojoResult);
        logger.info(`[tryExtractFromUrl] JoJo parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
        return { success: true, url, html, parsedData, structureType, pageStructure };
      }
    }

    // Run static analysis to guide parser selection
    const staticAnalysis = analyzePageStructure(html);
    logger.debug(`[staticAnalysis] Analysis complete: recommended ${staticAnalysis.recommendedParser.primary} (${Math.round(staticAnalysis.recommendedParser.confidence * 100)}%)`);

    // Try recommended parser first based on static analysis
    const staticResult = tryRecommendedParser(html, staticAnalysis, [], baseUrl);
    // Only return early if we have BOTH volumes AND chapters (having just one means we should try other parsers)
    const hasStaticVolumes = staticResult && staticResult.volumes.length >= 3;
    const hasStaticChapters = staticResult && staticResult.chapters.length >= 5;
    // Only use static analysis early return when chapter/volume density is reasonable.
    // Prevents returning 10ch/35vol (density 0.3) for Detective Conan when parseChapterTables
    // would find 172 chapters via Strategy 1e (dash-separated list items).
    const staticDensityOk = !hasStaticVolumes ||
      staticResult.chapters.length / staticResult.volumes.length >= 3;
    if (hasStaticVolumes && hasStaticChapters && staticDensityOk) {
      // Merge chapter titles from numbered list items if chapters lack titles
      staticResult.chapters = mergeChapterTitlesFromNumberedList(html, staticResult.chapters);
      logger.info(`[tryExtractFromUrl] Static analysis parser succeeded: ${staticResult.volumes.length} vols, ${staticResult.chapters.length} chaps`);
      return { success: true, url, html, parsedData: staticResult, structureType, pageStructure };
    }

    // Try table parser first
    let parsedData = parsePageAdaptive(html, undefined, undefined, baseUrl);

    // Merge in volumes from static analysis if we found more there
    if (staticResult && staticResult.volumes.length > parsedData.volumes.length) {
      parsedData.volumes = staticResult.volumes;
    }

    // Merge in chapters from static analysis if we found more there (Kingdom pattern: chapters but no volumes)
    // Also prefer static result when counts are close (within 5%) but static has significantly more real titles
    // (FMA pattern: old table parser gets 109 chapter numbers, bulleted-list parser gets 108 with real titles)
    if (staticResult && staticResult.chapters.length > 0) {
      if (staticResult.chapters.length > parsedData.chapters.length) {
        parsedData.chapters = staticResult.chapters;
      } else {
        const staticTitles = staticResult.chapters.filter(ch => ch.title && !/^Chapter\s*\d+$/i.test(ch.title)).length;
        const currentTitles = parsedData.chapters.filter(ch => ch.title && !/^Chapter\s*\d+$/i.test(ch.title)).length;
        const countDiff = Math.abs(staticResult.chapters.length - parsedData.chapters.length);
        const closeEnough = countDiff <= Math.max(3, Math.ceil(parsedData.chapters.length * 0.05));
        if (closeEnough && staticTitles > currentTitles * 2 && staticTitles > 5) {
          logger.info(`[tryExtractFromUrl] Preferring static chapters (${staticTitles} real titles vs ${currentTitles}, counts ${staticResult.chapters.length} vs ${parsedData.chapters.length})`);
          parsedData.chapters = staticResult.chapters;
        }
      }
    }

    let hasData = parsedData.volumes.length > 0 || parsedData.chapters.length > 0;
    const hasChapters = parsedData.chapters.length > 0;
    // Check if chapter count is suspiciously low relative to volumes (e.g., 8 vols but only 2 chaps)
    const suspiciouslyLowChapters = parsedData.volumes.length >= 3 && parsedData.chapters.length < parsedData.volumes.length * 5;

    // Try alternative parsers if:
    // 1. No data at all, OR
    // 2. Have volumes but no chapters, OR
    // 3. Have chapters but no volumes (structure may have been misparsed), OR
    // 4. Chapter count is suspiciously low relative to volumes
    const needsAlternativeParsers = !hasData || !hasChapters || parsedData.volumes.length === 0 || suspiciouslyLowChapters;
    if (needsAlternativeParsers) {
      // Track best volumes found so far, updated as we try different parsers
      let bestVolumes = [...parsedData.volumes];

      // Try id-based volume table parser FIRST (One Piece style - tables with id="Volume_N")
      // Check for JoJo structure (Volume N: tables with chapter lists)
      if (isJoJoStructure(html)) {
        logger.debug(`[tryExtractFromUrl] Trying JoJo parser for ${url}`);
        const jojoResult = parseJoJoStructure(html);

        if (jojoResult.success && jojoResult.chapters.length > parsedData.chapters.length) {
          parsedData = convertJoJoToStandard(jojoResult);
          hasData = true;
          if (parsedData.volumes.length > bestVolumes.length) {
            bestVolumes = [...parsedData.volumes];
          }
          logger.info(`[tryExtractFromUrl] JoJo parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
        }
      }

      if (isIdVolumeTableStructure(html)) {
        logger.debug(`[tryExtractFromUrl] Trying id-volume table parser for ${url}`);
        const idVolumeResult = parseIdVolumeTableStructure(html);

        if (idVolumeResult.success && idVolumeResult.chapters.length > parsedData.chapters.length) {
          parsedData = convertIdVolumeTableToStandard(idVolumeResult);
          hasData = true;
          if (parsedData.volumes.length > bestVolumes.length) {
            bestVolumes = [...parsedData.volumes];
          }
          logger.info(`[tryExtractFromUrl] ID-volume table parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
        }
      }

      // Try alternating row parser EARLY (Naruto, Haikyuu style - volume row + chapter row)
      // This parser finds BOTH volumes AND chapters together, so try it before bulleted list
      if (isAlternatingRowStructure(html)) {
        logger.debug(`[tryExtractFromUrl] Trying alternating row parser (early) for ${url}`);
        const alternatingRowResult = parseAlternatingRowStructure(html, baseUrl);

        if (alternatingRowResult.success && alternatingRowResult.chapters.length > parsedData.chapters.length) {
          parsedData = convertAlternatingRowToStandard(alternatingRowResult);
          hasData = true;
          if (parsedData.volumes.length > bestVolumes.length) {
            bestVolumes = [...parsedData.volumes];
          }
          logger.info(`[tryExtractFromUrl] Alternating row parser (early) succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
        } else if (alternatingRowResult.success && alternatingRowResult.volumes.length > bestVolumes.length) {
          // Even if another parser found more chapters, keep the volume data
          // (covers, titles, chapter ranges) — it will be merged with the best chapter list
          const converted = convertAlternatingRowToStandard(alternatingRowResult);
          bestVolumes = [...converted.volumes];
          logger.info(`[tryExtractFromUrl] Alternating row parser: kept ${converted.volumes.length} volumes (another parser has more chapters)`);
        }
      }

      // Try bulleted list parser (Mob Psycho 100, Bleach style)
      // Also try when chapter count is suspiciously low — parseBulletedListStructure
      // also handles standalone volume tables (Kuroko pattern) even without H3+ul structure.
      // Keep isBulletedListStructure gate for chapters===0 to prevent false positives (Fruits Basket).
      if ((isBulletedListStructure(html) && parsedData.chapters.length === 0) || suspiciouslyLowChapters) {
        logger.debug(`[tryExtractFromUrl] Trying bulleted list parser for ${url}`);
        const bulletedResult = parseBulletedListStructure(html);

        if (bulletedResult.success && bulletedResult.chapters.length > parsedData.chapters.length) {
          // If we had volumes but no chapters, and this parser found chapters, merge
          if (bestVolumes.length > 0 && bulletedResult.volumes.length === 0) {
            parsedData = { volumes: bestVolumes, chapters: convertBulletedToStandard(bulletedResult).chapters };
          } else {
            parsedData = convertBulletedToStandard(bulletedResult);
          }
          hasData = true;
          // Update bestVolumes if we found more
          if (parsedData.volumes.length > bestVolumes.length) {
            bestVolumes = [...parsedData.volumes];
          }
          logger.info(`[tryExtractFromUrl] Bulleted list parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
        }
      }

      // Try standalone volume tables parser (Kuroko no Basket style - each table is a volume)
      const noChaptersYet = !hasData || parsedData.chapters.length === 0;
      if (noChaptersYet && hasStandaloneVolumeTables(html)) {
        logger.debug(`[tryExtractFromUrl] Trying standalone volume tables parser for ${url}`);
        const standaloneResult = parseBulletedListEnhanced(html);

        if (standaloneResult.success && standaloneResult.chapters.length > 0) {
          if (bestVolumes.length > 0 && standaloneResult.volumes.length === 0) {
            parsedData = { volumes: bestVolumes, chapters: convertBulletedToStandard(standaloneResult).chapters };
          } else {
            parsedData = convertBulletedToStandard(standaloneResult);
          }
          hasData = true;
          if (parsedData.volumes.length > bestVolumes.length) {
            bestVolumes = [...parsedData.volumes];
          }
          logger.info(`[tryExtractFromUrl] Standalone volume tables parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
        }
      }

      // Try table list chapters parser (Kingdom style - chapter links in table cells)
      const stillNoChapters = !hasData || parsedData.chapters.length === 0;
      if (stillNoChapters && hasTableListChapters(html)) {
        logger.debug(`[tryExtractFromUrl] Trying table list chapters parser for ${url}`);
        const tableListResult = parseBulletedListEnhanced(html);

        if (tableListResult.success && tableListResult.chapters.length > 0) {
          if (bestVolumes.length > 0 && tableListResult.volumes.length === 0) {
            parsedData = { volumes: bestVolumes, chapters: convertBulletedToStandard(tableListResult).chapters };
          } else {
            parsedData = convertBulletedToStandard(tableListResult);
          }
          hasData = true;
          if (parsedData.volumes.length > bestVolumes.length) {
            bestVolumes = [...parsedData.volumes];
          }
          logger.info(`[tryExtractFromUrl] Table list chapters parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
        }
      }

      // Try plain table parser (One Piece style - tables without .wikitable class)
      const needsMoreParsers = !hasData || parsedData.chapters.length === 0;
      if (needsMoreParsers && isPlainTableStructure(html)) {
        logger.debug(`[tryExtractFromUrl] Trying plain table parser for ${url}`);
        const plainTableResult = parsePlainTableStructure(html);

        if (plainTableResult.success && (plainTableResult.chapters.length > parsedData.chapters.length || plainTableResult.volumes.length > bestVolumes.length)) {
          if (bestVolumes.length > 0 && plainTableResult.volumes.length === 0) {
            parsedData = { volumes: bestVolumes, chapters: convertPlainTableToStandard(plainTableResult).chapters };
          } else {
            parsedData = convertPlainTableToStandard(plainTableResult);
          }
          hasData = true;
          // Update bestVolumes if we found more
          if (parsedData.volumes.length > bestVolumes.length) {
            bestVolumes = [...parsedData.volumes];
          }
          logger.info(`[tryExtractFromUrl] Plain table parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
        }
      }

      // Try shifted column parser (Boruto style - header columns don't match data positions)
      const needsShiftedColumn = !hasData || parsedData.chapters.length === 0;
      if (needsShiftedColumn && isShiftedColumnStructure(html)) {
        logger.debug(`[tryExtractFromUrl] Trying shifted column parser for ${url}`);
        const shiftedResult = parseShiftedColumnStructure(html);

        if (shiftedResult.success && shiftedResult.chapters.length > 0) {
          if (bestVolumes.length > 0 && shiftedResult.volumes.length === 0) {
            parsedData = { volumes: bestVolumes, chapters: convertShiftedColumnToStandard(shiftedResult).chapters };
          } else {
            parsedData = convertShiftedColumnToStandard(shiftedResult);
          }
          hasData = true;
          if (parsedData.volumes.length > bestVolumes.length) {
            bestVolumes = [...parsedData.volumes];
          }
          logger.info(`[tryExtractFromUrl] Shifted column parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
        }
      }

      // Try arc-based parser (Re:Zero style - arc → volume → chapter hierarchy)
      const stillNeedsChapters = parsedData.chapters.length === 0;
      if (stillNeedsChapters && isArcBasedStructure(html)) {
        logger.debug(`[tryExtractFromUrl] Trying arc-based parser for ${url}`);
        const arcResult = parseArcBasedStructure(html);

        if (arcResult.success) {
          parsedData = convertArcBasedToStandard(arcResult);
          hasData = true;
          logger.info(`[tryExtractFromUrl] Arc-based parser succeeded: ${arcResult.arcs.length} arcs, ${arcResult.totalVolumes} vols`);
        }
      }

      // Try numbered row parser (Bleach style - "Chapters list:" format)
      if (parsedData.chapters.length === 0 && isNumberedRowStructure(html)) {
        logger.debug(`[tryExtractFromUrl] Trying numbered row parser for ${url}`);
        const numberedRowResult = parseNumberedRowStructure(html, baseUrl);

        if (numberedRowResult.success && numberedRowResult.chapters.length > 0) {
          if (bestVolumes.length > 0 && numberedRowResult.volumes.length === 0) {
            parsedData = { volumes: bestVolumes, chapters: convertNumberedRowToStandard(numberedRowResult).chapters };
          } else {
            parsedData = convertNumberedRowToStandard(numberedRowResult);
          }
          hasData = true;
          logger.info(`[tryExtractFromUrl] Numbered row parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
        }
      }

      // Note: Alternating row parser is now tried EARLY (before bulleted list) at line ~367

      // Try category page parser (Blue Lock, Sakamoto Days style - Category:Volumes/Chapters pages)
      if (parsedData.chapters.length === 0 && isCategoryPageStructure(html)) {
        logger.debug(`[tryExtractFromUrl] Trying category page parser for ${url}`);
        const categoryResult = parseCategoryPage(html, baseUrl);

        if (categoryResult.success) {
          const converted = convertCategoryPageToStandard(categoryResult);
          if (converted.chapters.length > 0 || converted.volumes.length > bestVolumes.length) {
            if (bestVolumes.length > 0 && converted.volumes.length === 0) {
              parsedData = { volumes: bestVolumes, chapters: converted.chapters };
            } else {
              parsedData = converted;
            }
            hasData = true;
            if (parsedData.volumes.length > bestVolumes.length) {
              bestVolumes = [...parsedData.volumes];
            }
            logger.info(`[tryExtractFromUrl] Category page parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
          }
        }
      }

      // Try collapsible table parser (FMA style - separate collapsible tables per volume)
      // Also try if we have chapters but no volumes - this suggests the structure wasn't parsed correctly
      const shouldTryCollapsible = (parsedData.chapters.length === 0 || parsedData.volumes.length === 0) && isCollapsibleTableStructure(html);
      if (shouldTryCollapsible) {
        logger.debug(`[tryExtractFromUrl] Trying collapsible table parser for ${url}`);
        const collapsibleResult = parseCollapsibleTables(html);

        if (collapsibleResult.success && collapsibleResult.chapters.length > 0) {
          const converted = convertCollapsibleTableToStandard(collapsibleResult);
          // Use collapsible result if it has more data than current
          const collapsibleBetter = converted.chapters.length > parsedData.chapters.length || converted.volumes.length > parsedData.volumes.length;
          if (collapsibleBetter) {
            if (bestVolumes.length > 0 && converted.volumes.length === 0) {
              parsedData = { volumes: bestVolumes, chapters: converted.chapters };
            } else {
              parsedData = converted;
            }
            hasData = true;
            if (parsedData.volumes.length > bestVolumes.length) {
              bestVolumes = [...parsedData.volumes];
            }
            logger.info(`[tryExtractFromUrl] Collapsible table parser succeeded: ${parsedData.volumes.length} vols, ${parsedData.chapters.length} chaps`);
          }
        }
      }

      // Final fallback: try enhanced parser for table list chapters (Blue Lock, Demon Slayer style)
      if (parsedData.chapters.length === 0 && hasTableListChapters(html)) {
        logger.debug(`[tryExtractFromUrl] Trying enhanced table list parser for ${url}`);
        const enhancedResult = parseBulletedListEnhanced(html);

        if (enhancedResult.chapters.length > 0) {
          if (bestVolumes.length > 0) {
            parsedData = { volumes: bestVolumes, chapters: convertBulletedToStandard(enhancedResult).chapters };
          } else {
            parsedData = convertBulletedToStandard(enhancedResult);
          }
          hasData = true;
          logger.info(`[tryExtractFromUrl] Enhanced table list parser found ${parsedData.chapters.length} chapters`);
        }
      }

      // Final merge: if we have chapters but no volumes, use bestVolumes from any parser
      // (e.g., alternating-row found 29 volumes but legacy parser had more chapters)
      if (parsedData.chapters.length > 0 && parsedData.volumes.length === 0 && bestVolumes.length > 0) {
        parsedData.volumes = bestVolumes;
        logger.info(`[tryExtractFromUrl] Merged ${bestVolumes.length} volumes from bestVolumes into final result`);
      }
    }

    // Require minimum data threshold to consider extraction successful
    const volumeCount = parsedData.volumes.length;
    const chapterCount = parsedData.chapters.length;

    // Accept data if we have:
    // 1. At least 3 volumes, OR
    // 2. At least 5 chapters AND at least 1 volume, OR
    // 3. Both volumes and chapters (any count >= 1), OR
    // 4. Many chapters (>= 20) even without volumes (Blue Exorcist pattern - can get volumes later)
    // Exception: Suspiciously low chapter/volume ratio (e.g., 8 vols but 2 chaps) triggers fallback
    // But volumes-only results (0 chapters) are valid for some wikis (86-EIGHTY-SIX pattern)
    const hasSuspiciouslyLowRatio = volumeCount >= 3 && chapterCount > 0 && chapterCount < volumeCount * 5;
    const isSubstantialData =
      !hasSuspiciouslyLowRatio && (
        (volumeCount >= 3) ||
        (chapterCount >= 5 && volumeCount >= 1) ||
        (volumeCount >= 1 && chapterCount >= 1) ||
        (chapterCount >= 20) // Accept many chapters even without volumes
      );

    if (hasData && isSubstantialData) {
      // If static analysis found many more chapters than our current parser, use those
      // (Death Note: table parser finds 2 chapters, but enhanced bulleted-list parser finds 109)
      if (staticResult && staticResult.chapters.length > chapterCount * 5 && staticResult.chapters.length >= 30) {
        logger.info(`[tryExtractFromUrl] Using ${staticResult.chapters.length} chapters from static analysis (current parser found ${chapterCount})`);
        parsedData.chapters = staticResult.chapters;
      }

      // If static analysis found similar chapter count but significantly more real titles, use those
      // (FMA: old table parser gets 109 chapters with 2 titles, bulleted-list gets 108 with 108 titles)
      if (staticResult && staticResult.chapters.length > 0) {
        const staticTitles = staticResult.chapters.filter(ch => ch.title && !/^Chapter\s*\d+$/i.test(ch.title)).length;
        const currentTitles = parsedData.chapters.filter(ch => ch.title && !/^Chapter\s*\d+$/i.test(ch.title)).length;
        const countDiff = Math.abs(staticResult.chapters.length - parsedData.chapters.length);
        const closeEnough = countDiff <= Math.max(3, Math.ceil(parsedData.chapters.length * 0.05));
        if (closeEnough && staticTitles > currentTitles * 2 && staticTitles > 5) {
          logger.info(`[tryExtractFromUrl] Preferring static chapters for titles (${staticTitles} real titles vs ${currentTitles}, counts ${staticResult.chapters.length} vs ${parsedData.chapters.length})`);
          parsedData.chapters = staticResult.chapters;
        }
      }

      // Try to merge chapter titles from numbered list items if chapters lack titles
      if (html) {
        parsedData.chapters = mergeChapterTitlesFromNumberedList(html, parsedData.chapters);
      }
      return { success: true, url, html, parsedData, structureType, pageStructure };
    }

    // Found some data but not enough or suspicious ratio - try alternative parsers
    if (hasData && !isSubstantialData) {
      logger.debug(`[tryExtractFromUrl] Insufficient data (${volumeCount} vols, ${chapterCount} chaps), trying alternatives`);

      // Try bulleted list parser if we haven't yet (may detect volumes from H3/H4 headers)
      if (isBulletedListStructure(html)) {
        logger.debug(`[tryExtractFromUrl] Retrying with bulleted list parser for ${url}`);
        const bulletedResult = parseBulletedListStructure(html);

        if (bulletedResult.success && bulletedResult.volumes.length > volumeCount) {
          parsedData = convertBulletedToStandard(bulletedResult);
          const newVolumeCount = parsedData.volumes.length;
          const newChapterCount = parsedData.chapters.length;
          logger.info(`[tryExtractFromUrl] Bulleted list parser found more volumes: ${newVolumeCount} vols, ${newChapterCount} chaps`);

          if (newVolumeCount >= 3 || (newVolumeCount > 0 && newChapterCount > 0)) {
            if (html) {
              parsedData.chapters = mergeChapterTitlesFromNumberedList(html, parsedData.chapters);
            }
            return { success: true, url, html, parsedData, structureType, pageStructure };
          }
        }
      }

      // Last resort: try enhanced parser for table list chapters (Blue Lock, Demon Slayer style)
      if (parsedData.chapters.length === 0 && hasTableListChapters(html)) {
        logger.debug(`[tryExtractFromUrl] Trying enhanced table list parser for ${url}`);
        const enhancedResult = parseBulletedListEnhanced(html);

        if (enhancedResult.chapters.length > 0) {
          parsedData = {
            volumes: parsedData.volumes.length > 0 ? parsedData.volumes : convertBulletedToStandard(enhancedResult).volumes,
            chapters: convertBulletedToStandard(enhancedResult).chapters,
          };
          if (html) {
            parsedData.chapters = mergeChapterTitlesFromNumberedList(html, parsedData.chapters);
          }
          logger.info(`[tryExtractFromUrl] Enhanced table list parser found ${parsedData.chapters.length} chapters`);
          return { success: true, url, html, parsedData, structureType, pageStructure };
        }
      }

      // Try paragraph link parser (Erased/Boku Machi style - chapters as links in paragraphs)
      // Also try when chapter count is suspiciously low relative to volumes (e.g., 8 vols but 2 chaps)
      const suspiciouslyLowChapters = parsedData.volumes.length >= 3 && parsedData.chapters.length < parsedData.volumes.length * 5;
      if ((parsedData.chapters.length === 0 || suspiciouslyLowChapters) && isParagraphLinkStructure(html)) {
        logger.debug(`[tryExtractFromUrl] Trying paragraph link parser for ${url}`);
        const paragraphResult = parseParagraphLinkStructureEnhanced(html);

        if (paragraphResult.success && paragraphResult.chapters.length > parsedData.chapters.length) {
          const converted = convertParagraphLinkToStandard(paragraphResult);
          parsedData = {
            volumes: parsedData.volumes.length > 0 ? parsedData.volumes : converted.volumes,
            chapters: converted.chapters,
          };
          logger.info(`[tryExtractFromUrl] Paragraph link parser found ${parsedData.chapters.length} chapters`);
          return { success: true, url, html, parsedData, structureType, pageStructure };
        }
      }

      // Try gallery extraction for manga volumes (86-EIGHTY-SIX style)
      if (parsedData.volumes.length === 0) {
        const galleryVolumes = extractVolumesFromGallery(html);
        if (galleryVolumes.length > 0) {
          parsedData = { volumes: galleryVolumes, chapters: parsedData.chapters };
          logger.info(`[tryExtractFromUrl] Gallery extraction found ${galleryVolumes.length} manga volumes`);
          return { success: true, url, html, parsedData, structureType, pageStructure };
        }
      }
    }

    // Last fallback: Try gallery extraction when no data found at all
    if (!hasData && html) {
      const galleryVolumes = extractVolumesFromGallery(html);
      if (galleryVolumes.length > 0) {
        parsedData = { volumes: galleryVolumes, chapters: [] };
        logger.info(`[tryExtractFromUrl] Final fallback: Gallery found ${galleryVolumes.length} manga volumes`);
        return { success: true, url, html, parsedData, structureType, pageStructure };
      }
    }

    // Return with parsedData even on failure so chapters can be merged later
    return { success: false, url, parsedData, structureType, pageStructure };
  } catch {
    return { success: false, url };
  }
}

/**
 * Generates alternative URLs to try based on the discovered URL.
 * For example, if /wiki/Chapters_and_Volumes has no data, try /wiki/Chapters_and_Volumes/Volumes.
 */
function generateAlternativeUrls(baseUrl: string, triedUrl: string): string[] {
  const alternatives: string[] = [];
  const pathname = new URL(triedUrl).pathname;

  // Try subpage patterns if the tried URL might be a hub page
  if (pathname.includes('Chapters_and_Volumes') && !pathname.includes('/Volumes')) {
    alternatives.push(`${triedUrl}/Volumes`);
    alternatives.push(`${triedUrl}/Chapters`);
  }

  // Try other patterns from URL_PROBE_PATTERNS that weren't the original discovery
  for (const pattern of URL_PROBE_PATTERNS) {
    const altUrl = `${baseUrl}${pattern}`;
    if (altUrl !== triedUrl && !alternatives.includes(altUrl)) {
      alternatives.push(altUrl);
    }
  }

  return alternatives;
}

/**
 * Result from alternative URL attempts, including partial data.
 */
interface AlternativeBatchResult {
  successfulExtraction: { extraction: ExtractionAttempt; url: string } | null;
  bestPartialVolumes: { volumes: ReturnType<typeof parsePageAdaptive>['volumes']; url: string } | null;
}

/**
 * Updates best partial volumes if the extraction has more volumes.
 */
function updateBestPartialVolumes(
  extraction: ExtractionAttempt,
  altUrl: string,
  current: AlternativeBatchResult['bestPartialVolumes']
): AlternativeBatchResult['bestPartialVolumes'] {
  const extractedVolumes = extraction.parsedData?.volumes;
  if (!extractedVolumes || extractedVolumes.length === 0) {
    return current;
  }
  const currentBest = current?.volumes.length ?? 0;
  if (extractedVolumes.length > currentBest) {
    return { volumes: extractedVolumes, url: altUrl };
  }
  return current;
}

/**
 * Tries extraction on a batch of alternative URLs.
 * Returns the first successful extraction, and also tracks best partial results.
 */
async function tryAlternativeBatch(
  batch: string[],
  options: AdaptiveParserOptions,
  existingPartialVolumes: AlternativeBatchResult['bestPartialVolumes']
): Promise<AlternativeBatchResult> {
  const result: AlternativeBatchResult = {
    successfulExtraction: null,
    bestPartialVolumes: existingPartialVolumes,
  };

  const probeResults = await Promise.all(
    batch.map((url) => probeUrl(url, { probeTimeoutMs: options.probeTimeoutMs }))
  );

  for (let j = 0; j < probeResults.length; j++) {
    const probeResult = probeResults[j];
    const batchUrl = batch[j];
    if (!probeResult || !batchUrl || !probeResult.exists) continue;

    const altUrl = probeResult.redirectedTo ?? batchUrl;
    // eslint-disable-next-line no-await-in-loop -- Intentional: sequential extraction with early return on success
    const extraction = await tryExtractFromUrl(altUrl, options);

    if (extraction.success) {
      const chapterCount = extraction.parsedData?.chapters.length ?? 0;
      const volumeCount = extraction.parsedData?.volumes.length ?? 0;

      // Quality threshold: return immediately only if data is substantial
      // Otherwise keep searching for better alternatives
      const isSubstantial = chapterCount >= 10 || volumeCount >= 3;
      if (isSubstantial || !result.successfulExtraction) {
        result.successfulExtraction = { extraction, url: altUrl };
      }

      // Return early only if we have substantial data
      if (isSubstantial) {
        return result;
      }
    }

    result.bestPartialVolumes = updateBestPartialVolumes(extraction, altUrl, result.bestPartialVolumes);
  }

  return result;
}

/**
 * Result from trying alternative URLs.
 */
interface AlternativeUrlsResult {
  successfulExtraction: { extraction: ExtractionAttempt; url: string } | null;
  bestPartialVolumes: { volumes: ReturnType<typeof parsePageAdaptive>['volumes']; url: string } | null;
}

/**
 * Tries alternative URLs when the primary URL yields no data.
 * Returns both successful extraction and best partial volumes found across all alternatives.
 */
async function tryAlternativeUrls(
  baseUrl: string,
  primaryUrl: string,
  options: AdaptiveParserOptions
): Promise<AlternativeUrlsResult> {
  const alternatives = generateAlternativeUrls(baseUrl, primaryUrl);
  const maxAlternatives = 15;

  let bestPartialVolumes: AlternativeBatchResult['bestPartialVolumes'] = null;

  let bestExtraction: AlternativeUrlsResult['successfulExtraction'] = null;

  for (let i = 0; i < Math.min(alternatives.length, maxAlternatives); i += 3) {
    const batch = alternatives.slice(i, i + 3);
    // eslint-disable-next-line no-await-in-loop -- Intentional: sequential batches with early return
    const result = await tryAlternativeBatch(batch, options, bestPartialVolumes);

    if (result.successfulExtraction) {
      const chapterCount = result.successfulExtraction.extraction.parsedData?.chapters.length ?? 0;
      const volumeCount = result.successfulExtraction.extraction.parsedData?.volumes.length ?? 0;
      const isSubstantial = chapterCount >= 10 || volumeCount >= 3;

      // Update best extraction if this one is better
      if (!bestExtraction) {
        bestExtraction = result.successfulExtraction;
      } else {
        const prevChapters = bestExtraction.extraction.parsedData?.chapters.length ?? 0;
        if (chapterCount > prevChapters) {
          bestExtraction = result.successfulExtraction;
        }
      }

      // Return early only if substantial data found
      if (isSubstantial) {
        return { successfulExtraction: bestExtraction, bestPartialVolumes: result.bestPartialVolumes };
      }
    }

    // Track best partial volumes across batches
    bestPartialVolumes = result.bestPartialVolumes;
  }

  return {
    successfulExtraction: bestExtraction,
    bestPartialVolumes,
  };
}

/**
 * Attempts to fetch and parse Category:Volumes for additional volume data.
 * Returns array of volumes if successful, null otherwise.
 */
async function tryFetchCategoryVolumes(
  url: string,
  options: AdaptiveParserOptions
): Promise<VolumeData[] | null> {
  try {
    // Extract base URL for building absolute chapter URLs
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    const html = await fetchHtml(url, options.probeTimeoutMs, options.userAgent);
    if (!isCategoryPageStructure(html)) return null;

    const result = parseCategoryPage(html, baseUrl);
    if (!result.success || result.volumes.length === 0) return null;

    // Convert to VolumeData format
    return result.volumes.map((v) => {
      const vol: VolumeData = { number: v.number };
      if (v.title) vol.title = v.title;
      if (v.coverImage) vol.coverImage = v.coverImage;
      return vol;
    });
  } catch {
    return null;
  }
}

/**
 * Discovers volume count by probing Volume_N pages until 404.
 */
async function discoverVolumeCount(
  domain: string,
  options: AdaptiveParserOptions
): Promise<number> {
  const baseUrl = `https://${domain}`;
  let count = 0;

  // Binary search would be faster but for simplicity, linear probe with early exit
  for (let volNum = 1; volNum <= 50; volNum++) {
    const url = `${baseUrl}/wiki/Volume_${volNum}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // eslint-disable-next-line no-await-in-loop -- Sequential HEAD requests needed for volume counting
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': options.userAgent ?? 'Mozilla/5.0' },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        count = volNum;
      } else {
        // Stop at first 404
        break;
      }
    } catch {
      break;
    }
  }

  return count;
}

/** Result from fetching per-volume page data */
interface PerVolumePageResult {
  chapters: ChapterData[];
  volumeDescriptions: Map<number, string>;
  volumeCovers: Map<number, string>;
  volumePageCounts: Map<number, number>;
}

/**
 * Attempts to fetch chapters and volume descriptions by iterating through individual volume pages.
 * Use when the main page has volumes but chapters/descriptions are on separate Volume_N pages.
 *
 * Module-level implementation. `adaptiveParse` shadows this name with a parse-local
 * memoizing closure so a domain that fails once is not re-probed by the other 7
 * conditional call sites in the same parse.
 */
async function tryFetchFromVolumePagesImpl(
  domain: string,
  knownVolumeCount: number,
  options: AdaptiveParserOptions
): Promise<PerVolumePageResult | null> {
  try {
    logger.info(`[perVolumeIterator] Fetching from volume pages for ${domain} (${knownVolumeCount} volumes)`);

    const iteratorOptions: { timeoutMs: number; concurrency: number; userAgent?: string } = {
      timeoutMs: options.probeTimeoutMs,
      concurrency: 3,
    };
    if (options.userAgent) iteratorOptions.userAgent = options.userAgent;

    const result = await iterateVolumePages(domain, knownVolumeCount, iteratorOptions);

    if (!result.success || result.volumes.length === 0) {
      logger.debug(`[perVolumeIterator] No data found from volume pages`);
      return null;
    }

    const chapters = convertPerVolumeChaptersToStandard(result);

    // Extract volume descriptions, covers, and page counts from per-volume pages
    const volumeDescriptions = new Map<number, string>();
    const volumeCovers = new Map<number, string>();
    const volumePageCounts = new Map<number, number>();
    for (const vol of result.volumes) {
      if (vol.description) {
        volumeDescriptions.set(vol.volumeNumber, vol.description);
      }
      if (vol.coverImage) {
        volumeCovers.set(vol.volumeNumber, vol.coverImage);
      }
      if (vol.pageCount !== undefined) {
        volumePageCounts.set(vol.volumeNumber, vol.pageCount);
      }
    }

    logger.info(`[perVolumeIterator] Found ${chapters.length} chapters, ${volumeDescriptions.size} descriptions, ${volumeCovers.size} covers, ${volumePageCounts.size} pageCounts`);
    return { chapters, volumeDescriptions, volumeCovers, volumePageCounts };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[perVolumeIterator] Failed to fetch from volume pages: ${message}`);
    return null;
  }
}

/**
 * Merges volume descriptions from per-volume pages into existing volumes array.
 * Modifies volumes in place.
 */
function mergeVolumeDescriptions(
  volumes: VolumeData[],
  descriptions: Map<number, string>
): void {
  for (const volume of volumes) {
    const description = descriptions.get(volume.number);
    if (description && !volume.description) {
      volume.description = description;
    }
  }
}

/**
 * Merges volume cover images from per-volume pages into existing volumes array.
 * Modifies volumes in place. Only fills missing covers (won't overwrite existing).
 */
function mergeVolumeCovers(
  volumes: VolumeData[],
  covers: Map<number, string>
): void {
  for (const volume of volumes) {
    const coverImage = covers.get(volume.number);
    if (coverImage && !volume.coverImage) {
      volume.coverImage = coverImage;
    }
  }
}

/**
 * Merges volume page counts from per-volume pages into existing volumes array.
 * Modifies volumes in place. Only fills missing counts (won't overwrite existing).
 */
function mergeVolumePageCounts(
  volumes: VolumeData[],
  pageCounts: Map<number, number>
): void {
  for (const volume of volumes) {
    const pageCount = pageCounts.get(volume.number);
    if (pageCount !== undefined && volume.pageCount === undefined) {
      volume.pageCount = pageCount;
    }
  }
}

/**
 * Probes /wiki/Volume_0 once and merges metadata + chapters into the parsed
 * data when the page exists. Vol 0 is unreachable through the regular
 * per-volume iteration paths (every loop and probe starts at Vol 1), so this
 * is the only place that can recover prequel-volume data like HxH "Kurapika's
 * Memories" or JJK 0.
 */
type Vol0Like = {
  title?: string; description?: string; coverImage?: string;
  releaseDate?: string; pageCount?: number;
  chapters: Array<{ number: number; title?: string; url?: string }>;
};

function buildVolumeFromVol0(vol0: Vol0Like): VolumeData {
  const v: VolumeData = { number: 0 };
  for (const [k, val] of Object.entries(vol0) as Array<[keyof Vol0Like, unknown]>) {
    if (k === 'chapters' || val === undefined) continue;
    (v as unknown as Record<string, unknown>)[k] = val;
  }
  return v;
}

function mergeIntoExistingVol0(target: VolumeData, vol0: Vol0Like): void {
  const patch: Record<string, unknown> = {};
  for (const k of ['title', 'description', 'coverImage', 'releaseDate', 'pageCount'] as const) {
    const val = vol0[k];
    if (val !== undefined && (target as unknown as Record<string, unknown>)[k] === undefined) {
      patch[k] = val;
    }
  }
  Object.assign(target, patch);
}

function buildNewVol0Chapters(vol0: Vol0Like, existingNums: Set<number>): ChapterData[] {
  const out: ChapterData[] = [];
  for (const c of vol0.chapters) {
    if (existingNums.has(c.number)) continue;
    const d: ChapterData = { number: c.number, volume: 0 };
    if (c.title !== undefined) d.title = c.title;
    if (c.url !== undefined) d.url = c.url;
    out.push(d);
  }
  return out;
}

async function mergeVolumeZeroIfPresent(
  domain: string,
  parsedData: { volumes: VolumeData[]; chapters: ChapterData[] },
  options: AdaptiveParserOptions,
): Promise<void> {
  const existingVol0 = parsedData.volumes.find(v => v.number === 0);
  if (existingVol0 && Array.isArray(existingVol0.chapters) && existingVol0.chapters.length > 0) return;

  const vol0Data = await fetchVolumeZeroIfExists(domain, { timeoutMs: options.probeTimeoutMs });
  if (!vol0Data) return;

  if (existingVol0) {
    mergeIntoExistingVol0(existingVol0, vol0Data);
  } else {
    parsedData.volumes.unshift(buildVolumeFromVol0(vol0Data));
  }

  if (vol0Data.chapters.length === 0) return;
  const existingNums = new Set(parsedData.chapters.map(c => c.number));
  const newChapters = buildNewVol0Chapters(vol0Data, existingNums);
  if (newChapters.length > 0) {
    parsedData.chapters.push(...newChapters);
    logger.info(`[adaptiveParse] Vol 0 merged: +${newChapters.length} chapters from /wiki/Volume_0`);
  }
}

/**
 * Builds enrichment inputs from VolumeData — extracts URLs and chapter numbers.
 */
function buildVolumeEnrichmentInputs(volumes: VolumeData[]): VolumeEnrichmentInput[] {
  const inputs: VolumeEnrichmentInput[] = [];
  for (const vol of volumes) {
    if (!vol.url) continue;
    const chapterNumbers = (vol.chapters as Array<{ number?: number }> | undefined)
      ?.map(ch => ch.number)
      .filter((n): n is number => typeof n === 'number') ?? [];
    if (chapterNumbers.length === 0) continue;
    inputs.push({ number: vol.number, url: vol.url, chapterNumbers });
  }
  return inputs;
}

/** Chapter data scraped from volume pages */
interface VolumePageEnrichedChapter {
  number: number;
  url?: string;
  coverImage?: string;
  summary?: string;
}

/**
 * Fetches a single volume page (with Cloudflare bypass) and extracts chapter covers/descriptions.
 */
async function fetchSingleVolumePageChapters(
  volNum: number,
  url: string,
  knownChapterNumbers: number[],
  options: AdaptiveParserOptions
): Promise<VolumePageEnrichedChapter[]> {
  try {
    const html = await fetchHtml(url, options.probeTimeoutMs, options.userAgent);
    const perVolumeModule = await import('./per-volume-iterator');
    // Build chapters from known chapter numbers (from numbered-row-parser), not from page links.
    // Page links pick up nav elements with wrong numbers (e.g., Ch 1-7 instead of Ch 179-187).
    type VPC = import('./per-volume-iterator').VolumePageChapter;
    const chapters: VPC[] = knownChapterNumbers.map(num => ({ number: num, volumeNumber: volNum }));
    perVolumeModule.extractChapterSectionsFromVolumePage(html, chapters);
    return chapters.filter(ch => ch.coverImage ?? ch.summary);
  } catch (err) {
    logger.debug(`[chapterCoverEnrichment] Vol ${volNum} fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/** Volume data needed for chapter cover enrichment */
interface VolumeEnrichmentInput {
  number: number;
  url: string;
  chapterNumbers: number[];
}

/**
 * Fetches volume pages by explicit URLs and extracts per-chapter covers and descriptions.
 */
async function fetchChapterCoversFromVolumeUrls(
  volumeInputs: VolumeEnrichmentInput[],
  options: AdaptiveParserOptions
): Promise<VolumePageEnrichedChapter[] | null> {
  try {
    const enrichedChapters: VolumePageEnrichedChapter[] = [];

    logger.info(`[chapterCoverEnrichment] Fetching ${volumeInputs.length} volume pages for chapter covers`);

    for (let i = 0; i < volumeInputs.length; i += 2) {
      const batch = volumeInputs.slice(i, i + 2);
      // eslint-disable-next-line no-await-in-loop -- Batched parallel processing requires sequential batch awaits
      const results = await Promise.all(
        batch.map(vol => fetchSingleVolumePageChapters(vol.number, vol.url, vol.chapterNumbers, options))
      );
      for (const chapterList of results) {
        enrichedChapters.push(...chapterList);
      }
    }

    const coverCount = enrichedChapters.filter(c => c.coverImage).length;
    const descCount = enrichedChapters.filter(c => c.summary).length;
    logger.info(`[chapterCoverEnrichment] Found ${coverCount} covers, ${descCount} descriptions`);
    return enrichedChapters.length > 0 ? enrichedChapters : null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[chapterCoverEnrichment] Failed: ${msg}`);
    return null;
  }
}

/**
 * Merges scraped chapter data (URLs, covers, descriptions) from volume pages
 * into existing chapter data. Only fills gaps — never overwrites existing data.
 */
/** Scrape chapter URLs from the parsed page HTML for chapters that lack them.
 *  Matches <a href="/wiki/..."> links to chapter numbers from their text content. */
// eslint-disable-next-line complexity -- complexity 33: tries 2 distinct link patterns ("N. <a>Title</a>" + "<a>Chapter N</a>"), then 3 chapter-number-extraction strategies (URL path, link text "Chapter N", explicit number prefix), each with type guards. Refactor candidate (could split into per-pattern helpers).
function scrapeChapterUrlsFromHtml(
  mangaData: ReturnType<typeof buildMangaData>,
  html: string,
  domain: string,
): void {
  const chapters = mangaData.chapterList ?? [];
  const needUrls = chapters.filter(ch => !ch['url'] && typeof ch['number'] === 'number' && ch['number'] > 0);
  if (needUrls.length === 0) return;

  // Extract chapter wiki links from HTML using two patterns:
  // 1. "N. <a href=...>Title</a>" — numbered chapter lists (Deadman Wonderland style)
  // 2. "<a>Chapter N</a>" — explicit chapter links
  const chapterLinks = new Map<number, string>();

  // Pattern 1: numbered items before links (e.g., "1. <a href=...")
  const numberedPattern = /(\d+)\.\s*<a[^>]*href="(\/wiki\/[^"#]+)"[^>]*>([^<]*)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = numberedPattern.exec(html)) !== null) {
    const num = parseInt(match[1] ?? '0', 10);
    const href = match[2];
    if (num > 0 && href && !chapterLinks.has(num)) {
      chapterLinks.set(num, `https://${domain}${href}`);
    }
  }

  // Pattern 2: links with "Chapter N" text
  const chapterPattern = /<a[^>]*href="(\/wiki\/[^"#]+)"[^>]*>(?:Chapter|Ch\.?)\s*(\d+)[^<]*<\/a>/gi;
  while ((match = chapterPattern.exec(html)) !== null) {
    const href = match[1];
    const num = parseInt(match[2] ?? '0', 10);
    if (num > 0 && href && !chapterLinks.has(num)) {
      chapterLinks.set(num, `https://${domain}${href}`);
    }
  }

  // Pattern 3: /wiki/Chapter_N href pattern (extract number from URL)
  const hrefPattern = /<a[^>]*href="(\/wiki\/Chapter[_ ](\d+))"/gi;
  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1];
    const num = parseInt(match[2] ?? '0', 10);
    if (num > 0 && href && !chapterLinks.has(num)) {
      chapterLinks.set(num, `https://${domain}${href}`);
    }
  }

  // Pattern 4: links where text starts with a number (e.g., "01 - Title", "001. Title")
  const textNumPattern = /<a[^>]*href="(\/wiki\/[^"#]+)"[^>]*>(\d{1,4})\s*[-–—.]\s*[^<]+<\/a>/gi;
  while ((match = textNumPattern.exec(html)) !== null) {
    const href = match[1];
    const num = parseInt(match[2] ?? '0', 10);
    if (num > 0 && href && !chapterLinks.has(num)) {
      chapterLinks.set(num, `https://${domain}${href}`);
    }
  }

  // Pattern 5: series-prefixed chapter URLs (e.g., /wiki/Made_in_Abyss_Chapter_001, /wiki/Solo_Leveling_Chapter_1)
  const seriesPrefixPattern = /<a[^>]*href="(\/wiki\/[^"#]*?[_-]Chapter[_-](\d+)[^"#]*)"[^>]*>/gi;
  while ((match = seriesPrefixPattern.exec(html)) !== null) {
    const href = match[1];
    const num = parseInt(match[2] ?? '0', 10);
    if (num > 0 && href && !chapterLinks.has(num)) {
      chapterLinks.set(num, `https://${domain}${href}`);
    }
  }

  if (chapterLinks.size === 0) return;

  let assigned = 0;
  for (const ch of needUrls) {
    const num = typeof ch['number'] === 'number' ? ch['number'] : 0;
    const url = chapterLinks.get(num);
    if (url) { ch['url'] = url; assigned++; }
  }

  if (assigned > 0) {
    logger.info(`[adaptiveParse] Scraped ${assigned} chapter URLs from HTML on ${domain}`);
  }
}

/** Fetch covers/descriptions from individual chapter pages using scraped URLs */
// eslint-disable-next-line complexity -- complexity 27: 4-stage pipeline (scrape URLs, normalize relative→absolute, dedupe, fetch+merge details across 5 fields); each merge condition guards against overwriting existing data
async function enrichChapterDetailsFromPages(
  mangaData: ReturnType<typeof buildMangaData>,
  domain: string,
  parsedPageUrl?: string,
): Promise<void> {
  const chapters = mangaData.chapterList ?? [];
  if (chapters.length === 0) return;

  // Scrape chapter URLs from the parsed page HTML if chapters lack URLs
  const needUrls = chapters.filter(ch => !ch['url']);
  if (needUrls.length > 0 && parsedPageUrl) {
    try {
      const { fetchPageHtmlViaApi } = await import('@/server/services/fandom/utils/mediaWikiApiFetch');
      const html = await fetchPageHtmlViaApi(parsedPageUrl);
      if (html) scrapeChapterUrlsFromHtml(mangaData, html, domain);
    } catch { /* scraping failed — continue without URLs */ }
  }

  // Fetch for chapters that have URLs but lack covers (cap at 500 to avoid long hangs)
  // Normalize relative URLs to absolute
  for (const ch of chapters) {
    const url = ch['url'];
    if (typeof url === 'string' && url.startsWith('/wiki/')) {
      ch['url'] = `https://${domain}${url}`;
    }
  }

  // Deduplicate by chapter number before enrichment
  const seenNums = new Set<number>();
  const uniqueChapters = chapters.filter(ch => {
    const num = typeof ch['number'] === 'number' ? ch['number'] : 0;
    if (num <= 0 || seenNums.has(num)) return false;
    seenNums.add(num);
    return true;
  });
  const needCovers = uniqueChapters.filter(ch => ch['url'] && !ch['coverImage']);
  if (needCovers.length === 0) return;

  try {
    const { chapterDetailService } = await import('@/server/services/fandom/chapter-detail');
    const urls = needCovers.map(ch => ch.url).filter((u): u is string => Boolean(u));
    logger.info(`[adaptiveParse] Fetching chapter details for ${urls.length} chapters on ${domain}`);
    const details = await chapterDetailService.fetchMultipleChapterDetails(urls);
    const detailMap = new Map(details.map(d => [d.url, d]));

    for (const ch of needCovers) {
      if (!ch.url) continue;
      const detail = detailMap.get(ch.url);
      if (!detail) continue;
      if (detail.coverImageUrl && !ch.coverImage) ch.coverImage = detail.coverImageUrl;
      if (detail.releaseDate && !ch['releaseDate']) ch['releaseDate'] = detail.releaseDate;
      if (detail.title && !ch['title']) ch['title'] = detail.title;
      if (detail.pageCount !== undefined && ch.pages === undefined) ch.pages = detail.pageCount;
      if (!ch.summary) {
        const desc = detail.description ?? detail.synopsis;
        if (desc) ch.summary = desc;
      }
    }
    logger.info(`[adaptiveParse] Enriched ${details.length}/${needCovers.length} chapters with covers/descriptions`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[adaptiveParse] Chapter detail fetch failed: ${msg}`);
  }
}

/** Merge chapter detail data (covers, descriptions, dates) into parsed data */
function mergeChapterDetails(
  parsedData: StandardParsedData,
  details: Array<{ url: string; coverImageUrl?: string; description?: string; synopsis?: string; releaseDate?: string; pageCount?: number }>,
): void {
  const detailMap = new Map<string, typeof details[number]>();
  for (const d of details) detailMap.set(d.url, d);

  for (const chapter of parsedData.chapters) {
    if (!chapter.url) continue;
    const detail = detailMap.get(chapter.url);
    if (!detail) continue;
    if (detail.coverImageUrl && !chapter.coverImage) chapter.coverImage = detail.coverImageUrl;
    const desc = detail.description ?? detail.synopsis;
    if (desc && !chapter.summary) chapter.summary = desc;
    if (detail.pageCount !== undefined && chapter.pageCount === undefined) chapter.pageCount = detail.pageCount;
  }
}

function mergeChapterCoversFromVolumePages(
  parsedData: StandardParsedData,
  enrichedChapters: VolumePageEnrichedChapter[]
): void {
  const enrichmentMap = new Map<number, VolumePageEnrichedChapter>();
  for (const ch of enrichedChapters) {
    enrichmentMap.set(ch.number, ch);
  }

  for (const chapter of parsedData.chapters) {
    const enrichment = enrichmentMap.get(chapter.number);
    if (!enrichment) continue;
    if (enrichment.url && !chapter.url) chapter.url = enrichment.url;
    if (enrichment.coverImage && !chapter.coverImage) chapter.coverImage = enrichment.coverImage;
    if ('summary' in enrichment && enrichment.summary && !chapter.summary) chapter.summary = enrichment.summary as string;
  }
}

/**
 * Extracts volumes from "Volume N Chapters:" pattern in HTML.
 * Used as fallback when chapters found but volumes not detected.
 */
function extractVolumesFromChapterLabels(html: string): VolumeData[] {
  const volumes: VolumeData[] = [];
  const seenVolumes = new Set<number>();

  // Match patterns like "Volume 1 Chapters:" or "Volume 7 Chapters:"
  const regex = /Volume\s+(\d+)\s+Chapters?:/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const captured = match[1];
    if (!captured) continue;
    const volNum = parseInt(captured, 10);
    if (!Number.isNaN(volNum) && volNum > 0 && volNum < 200 && !seenVolumes.has(volNum)) {
      seenVolumes.add(volNum);
      volumes.push({ number: volNum });
    }
  }

  volumes.sort((a, b) => a.number - b.number);
  return volumes;
}

/**
 * Extracts volumes from wikia-gallery elements.
 * Looks for volume links in lightbox-caption divs like:
 * <a href="/wiki/Manga_Volume_1">Volume 1</a>
 */
function extractVolumesFromGallery(html: string): VolumeData[] {
  const $ = cheerio.load(html);
  const volumes: VolumeData[] = [];
  const seenVolumes = new Set<number>();

  // Find all gallery items with volume links
  $('.wikia-gallery-item .lightbox-caption a, .wikia-gallery .lightbox-caption a').each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    if (!href) return;

    // Match "Volume N" patterns
    const match = text.match(/^Volume\s+(\d+)$/i) ?? href.match(/Volume[_-]?(\d+)/i);
    if (!match?.[1]) return;

    const volNum = parseInt(match[1], 10);
    if (Number.isNaN(volNum) || volNum < 1 || volNum > 200 || seenVolumes.has(volNum)) return;

    // Check if this is manga volume (not light novel)
    const isMangaVolume = href.toLowerCase().includes('manga') ||
      $(el).closest('.wikia-gallery').prev('p').text().toLowerCase().includes('manga');

    if (!isMangaVolume) return;

    seenVolumes.add(volNum);
    volumes.push({ number: volNum });
  });

  volumes.sort((a, b) => a.number - b.number);
  return volumes;
}

/**
 * Multi-page URL patterns for wikis that split data across multiple pages.
 */
const MULTI_PAGE_WIKIS: Record<string, string[]> = {
  'jojo.fandom.com': [
    '/wiki/List_of_JoJo%27s_Bizarre_Adventure_chapters/Volume_51_to_100',
    '/wiki/List_of_JoJo%27s_Bizarre_Adventure_chapters/Volume_101_to_Current',
  ],
};

/**
 * Merges extraction data into existing volumes/chapters sets.
 */
function mergeExtractionData(
  extraction: ExtractionAttempt,
  allVolumes: VolumeData[],
  allChapters: ChapterData[],
  seenVolumes: Set<number>,
  seenChapters: Set<number>
): void {
  if (!extraction.success || !extraction.parsedData) return;

  for (const vol of extraction.parsedData.volumes) {
    if (!seenVolumes.has(vol.number)) {
      seenVolumes.add(vol.number);
      allVolumes.push(vol);
    }
  }
  for (const ch of extraction.parsedData.chapters) {
    if (!seenChapters.has(ch.number)) {
      seenChapters.add(ch.number);
      allChapters.push(ch);
    }
  }
}

/**
 * Attempts to merge data from additional pages for multi-page wikis.
 */
async function tryMergeMultiPageData(
  domain: string,
  existingData: StandardParsedData,
  options: AdaptiveParserOptions
): Promise<StandardParsedData> {
  const additionalUrls = MULTI_PAGE_WIKIS[domain];
  if (!additionalUrls || additionalUrls.length === 0) {
    return existingData;
  }

  const baseUrl = `https://${domain}`;
  const allVolumes = [...existingData.volumes];
  const allChapters = [...existingData.chapters];
  const seenVolumes = new Set(allVolumes.map((v) => v.number));
  const seenChapters = new Set(allChapters.map((c) => c.number));

  for (const urlPath of additionalUrls) {
    const fullUrl = `${baseUrl}${urlPath}`;
    try {
      logger.debug(`[multiPageMerge] Fetching additional page: ${fullUrl}`);
      // eslint-disable-next-line no-await-in-loop -- Sequential page merging to avoid rate limiting
      const extraction = await tryExtractFromUrl(fullUrl, options);
      mergeExtractionData(extraction, allVolumes, allChapters, seenVolumes, seenChapters);
      if (extraction.success && extraction.parsedData) {
        logger.info(`[multiPageMerge] Merged from ${urlPath}: ${extraction.parsedData.volumes.length} vols, ${extraction.parsedData.chapters.length} chaps`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`[multiPageMerge] Failed to fetch ${urlPath}: ${msg}`);
    }
  }

  allVolumes.sort((a, b) => a.number - b.number);
  allChapters.sort((a, b) => a.number - b.number);
  logger.info(`[multiPageMerge] Total after merge: ${allVolumes.length} vols, ${allChapters.length} chaps`);
  return { volumes: allVolumes, chapters: allChapters };
}

/**
 * Main adaptive parse function.
 *
 * Coordinates URL discovery, structure detection, data extraction, and caching.
 *
 * @param input - Either a domain (e.g., "mob-psycho-100.fandom.com") or full URL
 * @param options - Parser options
 * @returns Adaptive parse result with extracted data or error
 */
// eslint-disable-next-line complexity, max-statements, max-lines-per-function -- 502-line coordinated parsing strategy with multi-page detection; future split candidate (extract per-strategy phases)
export async function adaptiveParse(
  input: string,
  options: Partial<AdaptiveParserOptions> = {}
): Promise<AdaptiveParseResult> {
  const mergedOptions = { ...DEFAULT_PARSER_OPTIONS, ...options };
  const startTime = Date.now();

  // Determine if input is URL or domain
  const isUrl = input.startsWith('http');
  const domain = isUrl ? extractDomainFromUrl(input) : input;

  if (!isFandomDomain(domain)) {
    return createFailureResult(domain, input, startTime, `Not a Fandom domain: ${domain}`);
  }

  logger.info(`Starting adaptive parse for: ${domain}`);

  // Per-parse memo of domains where per-volume iteration already returned null.
  // Eight conditional branches below independently invoke tryFetchFromVolumePages;
  // without this guard, a no-pattern wiki re-runs the full URL probe on every branch
  // (~20s × 5+ branches = 100+s wasted before fandom-fetch timeout fires).
  const failedVolumePageDomains = new Set<string>();
  const tryFetchFromVolumePages = async (
    targetDomain: string,
    knownVolumeCount: number,
    opts: AdaptiveParserOptions,
  ): Promise<PerVolumePageResult | null> => {
    if (failedVolumePageDomains.has(targetDomain)) {
      logger.debug(`[perVolumeIterator] Skipping ${targetDomain} — already failed in this parse`);
      return null;
    }
    const result = await tryFetchFromVolumePagesImpl(targetDomain, knownVolumeCount, opts);
    if (result === null) failedVolumePageDomains.add(targetDomain);
    return result;
  };

  // Check cache first
  if (mergedOptions.useCache) {
    const cachedPattern = getPatternCache().get(domain);
    if (cachedPattern) {
      logger.debug(`Using cached pattern for ${domain}`);
      return parseWithCachedPattern(cachedPattern, mergedOptions);
    }
  }

  // Start metadata fetch in parallel with URL discovery (non-blocking)
  const metadataPromise = fetchMainPageMetadata(domain, {
    timeoutMs: mergedOptions.probeTimeoutMs,
  }).catch((error): MetadataFetchResult => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Metadata fetch failed for ${domain}: ${message}`);
    return { success: false, error: message, durationMs: 0 };
  });

  // Discover URL if not provided
  let targetUrl = isUrl ? input : null;
  let canonicalDomain = domain;

  if (!targetUrl) {
    // Try series-specific pages first when a seriesTitle is provided
    // (handles franchise wikis like jojos.fandom.com where generic discovery
    // would find the all-series chapter list instead of the part-specific one)
    if (mergedOptions.seriesTitle) {
      const seriesSlug = mergedOptions.seriesTitle.replace(/[^a-zA-Z0-9]+/g, '_');
      const seriesPatterns = [
        `/wiki/${seriesSlug}_Chapters`,
        `/wiki/List_of_${seriesSlug}_chapters`,
        `/wiki/${seriesSlug}_Chapter_List`,
        `/wiki/${seriesSlug}`,
      ];
      for (const pattern of seriesPatterns) {
        const seriesUrl = `https://${domain}${pattern}`;
        // eslint-disable-next-line no-await-in-loop -- Sequential probe with early return
        const probed = await probeUrl(seriesUrl, { probeTimeoutMs: mergedOptions.probeTimeoutMs });
        if (probed.exists) {
          logger.info(`[adaptiveParse] Series-specific URL found: ${seriesUrl}`);
          targetUrl = seriesUrl;
          break;
        }
      }
    }

    // Fall back to generic best-scoring discovery
    if (!targetUrl) {
      const discovery = await discoverBestChapterVolumeUrl(domain, {
        probeTimeoutMs: mergedOptions.probeTimeoutMs,
      });

      if (!discovery.foundUrl) {
        return createFailureResult(domain, '', startTime, 'No chapter/volume URL found');
      }

      targetUrl = discovery.foundUrl;
      canonicalDomain = discovery.canonicalDomain;

      // Log content score if available (helps debugging URL selection)
      if (discovery.contentScore) {
        logger.debug(`[adaptiveParse] Selected URL with content score: ${discovery.contentScore.score}`, {
          url: discovery.foundUrl,
          chapters: discovery.contentScore.chapterIndicators,
          volumes: discovery.contentScore.volumeIndicators,
        });
      }
    }
  }

  // Try to extract data from the discovered URL
  const baseUrl = `https://${canonicalDomain}`;
  let extraction = await tryExtractFromUrl(targetUrl, mergedOptions);
  let finalUrl = targetUrl;

  // Store partial data for potential merging
  let partialChapters: ReturnType<typeof parsePageAdaptive>['chapters'] | null = null;
  let partialVolumes: ReturnType<typeof parsePageAdaptive>['volumes'] | null = null;

  // If no data extracted, try alternative URLs
  if (!extraction.success) {
    logger.info(`No data from ${targetUrl}, trying alternative URLs...`);

    // Store chapters from failed extraction for potential merging
    // (e.g., primary URL has chapters but no volumes, alternative has volumes)
    if (extraction.parsedData && extraction.parsedData.chapters.length > 50) {
      partialChapters = extraction.parsedData.chapters;
      logger.debug(`Saved ${partialChapters.length} chapters from primary URL for potential merge`);
    }

    // Store volumes from failed extraction for potential merging
    // (e.g., primary URL has volumes but no chapters, alternative has chapters - Punpun pattern)
    if (extraction.parsedData && extraction.parsedData.volumes.length >= 5) {
      partialVolumes = extraction.parsedData.volumes;
      logger.debug(`Saved ${partialVolumes.length} volumes from primary URL for potential merge`);
    }

    const altResult = await tryAlternativeUrls(baseUrl, targetUrl, mergedOptions);

    if (altResult.successfulExtraction) {
      logger.info(`Found data at alternative URL: ${altResult.successfulExtraction.url}`);
      extraction = altResult.successfulExtraction.extraction;
      finalUrl = altResult.successfulExtraction.url;

      // Merge chapters from primary URL if alternative has volumes but no chapters
      if (
        extraction.success &&
        extraction.parsedData &&
        partialChapters &&
        extraction.parsedData.volumes.length > 0 &&
        extraction.parsedData.chapters.length === 0
      ) {
        logger.info(`Merging ${partialChapters.length} chapters from primary URL with ${extraction.parsedData.volumes.length} volumes from alternative`);
        extraction.parsedData.chapters = partialChapters;
      }

      // Merge volumes from primary URL if alternative has chapters but no/few volumes (Punpun pattern)
      if (
        extraction.success &&
        extraction.parsedData &&
        partialVolumes &&
        extraction.parsedData.chapters.length > 0 &&
        extraction.parsedData.volumes.length < partialVolumes.length
      ) {
        logger.info(`Merging ${partialVolumes.length} volumes from primary URL with ${extraction.parsedData.chapters.length} chapters from alternative`);
        extraction.parsedData.volumes = partialVolumes;
      }
    }

    // Even if no URL returned "success", check if we can merge partial data
    // to create a valid result (e.g., chapters from primary + volumes from alternative)
    if (!extraction.success && partialChapters && partialChapters.length >= 5) {
      // Use volumes from primary URL if available, otherwise use best from alternatives
      const alternativeVolumes = partialVolumes ?? altResult.bestPartialVolumes?.volumes ?? [];

      if (alternativeVolumes.length > 0) {
        const volumeSourceUrl = altResult.bestPartialVolumes?.url ?? finalUrl;
        logger.info(`Creating merged result: ${partialChapters.length} chapters + ${alternativeVolumes.length} volumes from separate URLs`);
        const mergedExtraction: ExtractionAttempt = {
          success: true,
          url: volumeSourceUrl,
          parsedData: {
            volumes: alternativeVolumes,
            chapters: partialChapters,
          },
          structureType: extraction.structureType ?? StructureType.UNKNOWN,
        };
        // Only add pageStructure if it exists (avoid undefined with exactOptionalPropertyTypes)
        if (extraction.pageStructure) {
          mergedExtraction.pageStructure = extraction.pageStructure;
        }
        extraction = mergedExtraction;
        finalUrl = volumeSourceUrl;
      }
    }
  }

  // Build successful result
  if (extraction.success && extraction.parsedData && extraction.structureType && extraction.pageStructure) {
    // Enhancement: Multi-page merge for wikis like JoJo that split data across subpages
    if (MULTI_PAGE_WIKIS[canonicalDomain]) {
      const mergedData = await tryMergeMultiPageData(canonicalDomain, extraction.parsedData, mergedOptions);
      extraction.parsedData = mergedData;
    }

    // Enhancement: If we have many chapters but few volumes, try extracting from "Volume N Chapters:" labels
    let volumeCount = extraction.parsedData.volumes.length;
    let chapterCount = extraction.parsedData.chapters.length;
    if (chapterCount >= 10 && volumeCount < 3 && extraction.html) {
      const labelVolumes = extractVolumesFromChapterLabels(extraction.html);
      if (labelVolumes.length > volumeCount) {
        logger.info(`[adaptiveParse] Found ${labelVolumes.length} volumes from "Volume N Chapters:" labels`);
        extraction.parsedData.volumes = labelVolumes;
        volumeCount = labelVolumes.length;
      }
    }

    // Enhancement: If still few volumes, try Category:Volumes
    if (chapterCount >= 50 && volumeCount < 5) {
      const categoryVolumesUrl = `${baseUrl}/wiki/Category:Volumes`;
      const categoryVolumes = await tryFetchCategoryVolumes(categoryVolumesUrl, mergedOptions);
      if (categoryVolumes && categoryVolumes.length > volumeCount) {
        logger.info(`[adaptiveParse] Enhanced with ${categoryVolumes.length} volumes from Category:Volumes`);
        extraction.parsedData.volumes = categoryVolumes;
        volumeCount = categoryVolumes.length;
      }
    }

    // Enhancement: If we have many volumes but very few chapters, try per-volume iteration
    // This handles wikis like Black Clover where chapters are on individual Volume_N pages
    const chaptersPerVolumeRatio = chapterCount / Math.max(volumeCount, 1);
    if (volumeCount >= 5 && chaptersPerVolumeRatio < 3) {
      logger.info(`[adaptiveParse] Low chapter/volume ratio (${chaptersPerVolumeRatio.toFixed(1)}), trying per-volume iterator`);
      const volumePageData = await tryFetchFromVolumePages(canonicalDomain, volumeCount, mergedOptions);
      if (volumePageData) {
        if (volumePageData.chapters.length > chapterCount) {
          logger.info(`[adaptiveParse] Enhanced with ${volumePageData.chapters.length} chapters from volume pages`);
          // Preserve existing real titles when overwriting with per-volume chapters
          const existingTitles = new Map<number, string>();
          for (const ch of extraction.parsedData.chapters) {
            if (ch.title && !/^\d+$/.test(ch.title) && !/^(Chapter|Ch\.?)\s*\d+$/i.test(ch.title)) {
              existingTitles.set(ch.number, ch.title);
            }
          }
          extraction.parsedData.chapters = volumePageData.chapters;
          if (existingTitles.size > 0) {
            for (const ch of extraction.parsedData.chapters) {
              const existing = existingTitles.get(ch.number);
              if (existing && (!ch.title || /^\d+$/.test(ch.title) || /^(Chapter|Ch\.?)\s*\d+$/i.test(ch.title))) {
                ch.title = existing;
              }
            }
            logger.info(`[adaptiveParse] Preserved ${existingTitles.size} real titles during chapter overwrite`);
          }
          chapterCount = volumePageData.chapters.length;
        }
        // Merge volume descriptions and covers from per-volume pages
        if (volumePageData.volumeDescriptions.size > 0) {
          mergeVolumeDescriptions(extraction.parsedData.volumes, volumePageData.volumeDescriptions);
          logger.info(`[adaptiveParse] Merged ${volumePageData.volumeDescriptions.size} volume descriptions`);
        }
        if (volumePageData.volumeCovers.size > 0) {
          mergeVolumeCovers(extraction.parsedData.volumes, volumePageData.volumeCovers);
          logger.info(`[adaptiveParse] Merged ${volumePageData.volumeCovers.size} volume covers`);
        }
        if (volumePageData.volumePageCounts.size > 0) {
          mergeVolumePageCounts(extraction.parsedData.volumes, volumePageData.volumePageCounts);
          logger.info(`[adaptiveParse] Merged ${volumePageData.volumePageCounts.size} volume pageCounts`);
        }
      }
    }

    // Enhancement: If we have many chapters but very few volumes, try to discover volumes via per-volume pages
    // This handles wikis like Punpun where Category:Volumes is incomplete but Volume_N pages exist
    if (chapterCount >= 20 && volumeCount < 3) {
      logger.info(`[adaptiveParse] High chapters (${chapterCount}) but low volumes (${volumeCount}), discovering volume pages`);
      const discoveredVolumeCount = await discoverVolumeCount(canonicalDomain, mergedOptions);
      if (discoveredVolumeCount > volumeCount) {
        logger.info(`[adaptiveParse] Discovered ${discoveredVolumeCount} volumes via Volume_N pages`);

        // Fetch chapters and descriptions from all discovered volume pages
        const volumePageData = await tryFetchFromVolumePages(canonicalDomain, discoveredVolumeCount, mergedOptions);
        if (volumePageData && volumePageData.chapters.length > 0) {
          // Create volume entries with descriptions and covers
          const discoveredVolumes: VolumeData[] = Array.from({ length: discoveredVolumeCount }, (_, i) => {
            const vol: VolumeData = { number: i + 1 };
            const desc = volumePageData.volumeDescriptions.get(i + 1);
            if (desc) vol.description = desc;
            const cover = volumePageData.volumeCovers.get(i + 1);
            if (cover) vol.coverImage = cover;
            // Per-volume-iterator can be called repeatedly within a single parse
            // (8 conditional branches). Later calls hit MW API rate limits and
            // return 0 pageCounts. Preserve the value the prior call set on this
            // volume number so re-creation doesn't wipe good data.
            const pc = volumePageData.volumePageCounts.get(i + 1)
              ?? extraction.parsedData?.volumes.find(v => v.number === i + 1)?.pageCount;
            if (pc !== undefined) vol.pageCount = pc;
            return vol;
          });
          extraction.parsedData.volumes = discoveredVolumes;
          volumeCount = discoveredVolumeCount;

          // Use volume-page chapters if they have more data
          if (volumePageData.chapters.length > chapterCount) {
            extraction.parsedData.chapters = volumePageData.chapters;
            chapterCount = volumePageData.chapters.length;
          }
          logger.info(`[adaptiveParse] Enhanced: ${volumeCount} volumes, ${chapterCount} chapters from volume pages`);
        }
      }
    }

    // Enhancement: If parser extracted almost nothing (< 10 chapters), the main parser
    // failed on this page structure. Try per-volume iteration as a desperation fallback.
    // This handles wikis like Bleach where extraction scoring finds 690 chapters
    // but the static analyzer picks the wrong parser type.
    if (chapterCount < 10 && volumeCount < 5) {
      logger.info(`[adaptiveParse] Very few chapters (${chapterCount}), trying per-volume iterator as fallback`);
      // Call iterateVolumePages directly — it now has category-based discovery
      // which handles custom volume naming (e.g., Bleach: "THE_DEATH_AND_THE_STRAWBERRY_(Volume_1)")
      const volumePageData = await tryFetchFromVolumePages(canonicalDomain, 0, mergedOptions);
      if (volumePageData && volumePageData.chapters.length > chapterCount) {
        logger.info(`[adaptiveParse] Per-volume fallback found ${volumePageData.chapters.length} chapters`);
        extraction.parsedData.chapters = volumePageData.chapters;
        chapterCount = volumePageData.chapters.length;

        if (volumePageData.volumeDescriptions.size > 0 || volumePageData.volumeCovers.size > 0) {
          const maxVol = Math.max(...volumePageData.chapters.map((c) => c.volume ?? 0), 0);
          const discoveredVolumes: VolumeData[] = Array.from({ length: maxVol }, (_, i) => {
            const vol: VolumeData = { number: i + 1 };
            const desc = volumePageData.volumeDescriptions.get(i + 1);
            if (desc) vol.description = desc;
            const cover = volumePageData.volumeCovers.get(i + 1);
            if (cover) vol.coverImage = cover;
            // Per-volume-iterator can be called repeatedly within a single parse
            // (8 conditional branches). Later calls hit MW API rate limits and
            // return 0 pageCounts. Preserve the value the prior call set on this
            // volume number so re-creation doesn't wipe good data.
            const pc = volumePageData.volumePageCounts.get(i + 1)
              ?? extraction.parsedData?.volumes.find(v => v.number === i + 1)?.pageCount;
            if (pc !== undefined) vol.pageCount = pc;
            return vol;
          });
          extraction.parsedData.volumes = discoveredVolumes;
          volumeCount = maxVol;
        }
      }
    }

    // Enhancement: If few chapters after per-volume fallback, try category/allpages-based
    // chapter enumeration. Handles wikis like Detective Conan (Category:Chapters) and
    // Gantz/Kuroko (individual Chapter_N pages discoverable via allpages API).
    // Threshold: <50 chapters or very low density (< 3 chapters per volume)
    const lowChapterCount = chapterCount < 30;
    const veryLowDensity = volumeCount >= 5 && chapterCount < volumeCount * 4;
    // Skip category supplement if existing chapters already have real titles
    const earlyHasRealTitles = extraction.parsedData.chapters.some(
      (ch) => ch.title && !/^(Chapter|Ch\.?)\s*\d+$/i.test(ch.title) && /[a-zA-Z]/.test(ch.title)
    );
    if ((lowChapterCount || veryLowDensity) && !earlyHasRealTitles) {
      const categoryChapters = await discoverChaptersViaCategory(
        canonicalDomain,
        mergedOptions.probeTimeoutMs,
      );
      if (categoryChapters && categoryChapters.length > chapterCount) {
        logger.info(`[adaptiveParse] Category chapter discovery found ${categoryChapters.length} chapters`);
        extraction.parsedData.chapters = categoryChapters.map((ch) => ({
          number: ch.number,
          title: ch.title,
        }));
        chapterCount = categoryChapters.length;
      }
    }

    // Enhancement: After category discovery, check if per-volume iteration finds MORE chapters.
    // Handles wikis like Goodnight Punpun where category has 60/147 chapters but volume pages
    // contain all chapters as == Chapter N == section headings.
    // Trigger: URL is a Category page (inherently incomplete), or low chapter density.
    const parsedFromCategory = finalUrl.includes('Category:');
    const lowDensity = volumeCount >= 3 && chapterCount < volumeCount * 8;
    if (chapterCount > 0 && chapterCount < 200 && (parsedFromCategory || lowDensity)) {
      const volumePageData = await tryFetchFromVolumePages(canonicalDomain, 0, mergedOptions);
      if (volumePageData && volumePageData.chapters.length > chapterCount) {
        logger.info(`[adaptiveParse] Volume page supplement found ${volumePageData.chapters.length} chapters (was ${chapterCount} from category)`);
        // Merge: volume chapters as primary, existing chapters fill gaps.
        // IMPORTANT: preserve existing real titles over generic volume chapter titles.
        const byNumber = new Map<number, ChapterData>();
        for (const ch of volumePageData.chapters) byNumber.set(ch.number, ch);
        for (const ch of extraction.parsedData.chapters) {
          const existing = byNumber.get(ch.number);
          if (!existing) {
            byNumber.set(ch.number, ch);
          } else if (ch.title && !/^(Chapter|Ch\.?)\s*\d+$/i.test(ch.title) && (!existing.title || /^(Chapter|Ch\.?)\s*\d+$/i.test(existing.title))) {
            // Existing chapter has a real title but volume chapter doesn't — keep existing title
            existing.title = ch.title;
          }
        }
        extraction.parsedData.chapters = [...byNumber.values()].sort((a, b) => a.number - b.number);
        chapterCount = extraction.parsedData.chapters.length;

        if (volumePageData.volumeDescriptions.size > 0 || volumePageData.volumeCovers.size > 0) {
          const maxVol = Math.max(...volumePageData.chapters.map((c) => c.volume ?? 0), 0);
          const discoveredVolumes: VolumeData[] = Array.from({ length: maxVol }, (_, i) => {
            const vol: VolumeData = { number: i + 1 };
            const desc = volumePageData.volumeDescriptions.get(i + 1);
            if (desc) vol.description = desc;
            const cover = volumePageData.volumeCovers.get(i + 1);
            if (cover) vol.coverImage = cover;
            // Per-volume-iterator can be called repeatedly within a single parse
            // (8 conditional branches). Later calls hit MW API rate limits and
            // return 0 pageCounts. Preserve the value the prior call set on this
            // volume number so re-creation doesn't wipe good data.
            const pc = volumePageData.volumePageCounts.get(i + 1)
              ?? extraction.parsedData?.volumes.find(v => v.number === i + 1)?.pageCount;
            if (pc !== undefined) vol.pageCount = pc;
            return vol;
          });
          extraction.parsedData.volumes = discoveredVolumes;
          volumeCount = maxVol;
        }
      }
    }

    // Enhancement: If chapter count is suspiciously low for the volume count, supplement
    // from per-volume pages. Handles wikis like Goodnight Punpun where category discovery
    // finds 60/147 chapters but volume pages contain all chapters as == Chapter N == headings.
    // Normal manga: 7-12 chapters/volume. Below 8 suggests many chapters are missing.
    if (chapterCount > 0 && volumeCount >= 3 && chapterCount < volumeCount * 8) {
      logger.info(`[adaptiveParse] Low chapter density (${chapterCount}/${volumeCount} vols = ${(chapterCount / volumeCount).toFixed(1)} ch/vol), supplementing from volume pages`);
      const volumePageData = await tryFetchFromVolumePages(canonicalDomain, volumeCount, mergedOptions);
      if (volumePageData && volumePageData.chapters.length > chapterCount) {
        logger.info(`[adaptiveParse] Volume page supplement: ${volumePageData.chapters.length} chapters (was ${chapterCount})`);
        // Merge: volume chapters primary, existing chapters fill gaps.
        // Preserve existing real titles over generic volume chapter titles.
        const byNumber = new Map<number, ChapterData>();
        for (const ch of volumePageData.chapters) byNumber.set(ch.number, ch);
        for (const ch of extraction.parsedData.chapters) {
          const existing = byNumber.get(ch.number);
          if (!existing) {
            byNumber.set(ch.number, ch);
          } else if (ch.title && !/^(Chapter|Ch\.?)\s*\d+$/i.test(ch.title) && (!existing.title || /^(Chapter|Ch\.?)\s*\d+$/i.test(existing.title))) {
            existing.title = ch.title;
          }
        }
        extraction.parsedData.chapters = [...byNumber.values()].sort((a, b) => a.number - b.number);
        chapterCount = extraction.parsedData.chapters.length;
      }
    }

    // Enhancement: If we have volumes but no descriptions, fetch descriptions from volume pages
    // This handles wikis where main page has chapter/volume data but descriptions are on Volume_N pages
    const volumesWithDescriptions = extraction.parsedData.volumes.filter(v => v.description).length;
    if (volumeCount >= 3 && volumesWithDescriptions === 0) {
      logger.info(`[adaptiveParse] Volumes have no descriptions, trying per-volume iterator for descriptions`);
      const volumePageData = await tryFetchFromVolumePages(canonicalDomain, volumeCount, mergedOptions);
      if (volumePageData) {
        if (volumePageData.volumeDescriptions.size > 0) {
          mergeVolumeDescriptions(extraction.parsedData.volumes, volumePageData.volumeDescriptions);
          logger.info(`[adaptiveParse] Enhanced with ${volumePageData.volumeDescriptions.size} volume descriptions`);
        }
        if (volumePageData.volumeCovers.size > 0) {
          mergeVolumeCovers(extraction.parsedData.volumes, volumePageData.volumeCovers);
          logger.info(`[adaptiveParse] Enhanced with ${volumePageData.volumeCovers.size} volume covers`);
        }
        if (volumePageData.volumePageCounts.size > 0) {
          mergeVolumePageCounts(extraction.parsedData.volumes, volumePageData.volumePageCounts);
          logger.info(`[adaptiveParse] Enhanced with ${volumePageData.volumePageCounts.size} volume pageCounts`);
        }
      }
    }

    // Enhancement: If chapters have no covers AND we have volume URLs from numbered-row parser,
    // fetch volume pages to extract per-chapter cover images and descriptions
    const chaptersWithCovers = extraction.parsedData.chapters.filter(ch => ch.coverImage).length;
    if (volumeCount >= 3 && chaptersWithCovers === 0) {
      const volumeInputs = buildVolumeEnrichmentInputs(extraction.parsedData.volumes);
      if (volumeInputs.length > 0) {
        const enrichedData = await fetchChapterCoversFromVolumeUrls(volumeInputs, mergedOptions);
        if (enrichedData) {
          mergeChapterCoversFromVolumePages(extraction.parsedData, enrichedData);
        }
      }
    }

    // Enhancement: If volumes have no cover images, fetch them from per-volume pages
    // This handles wikis where the main page has volume/chapter data but no inline covers
    // (e.g., FMA Chapters_and_Volumes page has no volume cover <img> in its tables)
    const volumesWithCovers = extraction.parsedData.volumes.filter(v => v.coverImage).length;
    if (volumeCount >= 3 && volumesWithCovers === 0) {
      logger.info(`[adaptiveParse] Volumes have no covers, trying per-volume iterator for cover images`);
      const volumePageData = await tryFetchFromVolumePages(canonicalDomain, volumeCount, mergedOptions);
      if (volumePageData && volumePageData.volumeCovers.size > 0) {
        mergeVolumeCovers(extraction.parsedData.volumes, volumePageData.volumeCovers);
        logger.info(`[adaptiveParse] Enhanced with ${volumePageData.volumeCovers.size} volume covers from per-volume pages`);
      }
      if (volumePageData && volumePageData.volumePageCounts.size > 0) {
        mergeVolumePageCounts(extraction.parsedData.volumes, volumePageData.volumePageCounts);
        logger.info(`[adaptiveParse] Enhanced with ${volumePageData.volumePageCounts.size} volume pageCounts from per-volume pages`);
      }
    }

    // Vol 0 probe: published prequel volumes (HxH "Kurapika's Memories",
    // JJK 0) live at /wiki/Volume_0 but every per-volume iteration path in
    // this file starts at Vol 1 (findVolumeUrlPattern probes Vol_1/Vol_2,
    // processVolumesBatch starts at startVolume=1, discoverVolumeCount
    // loops 1..50). Always try once; merge metadata + chapters if present.
    await mergeVolumeZeroIfPresent(canonicalDomain, extraction.parsedData, mergedOptions);

    // Enhancement: Fetch individual chapter pages for covers and descriptions
    const chaptersNeedingCovers = extraction.parsedData.chapters.filter(ch => ch.url && !ch.coverImage);
    if (chaptersNeedingCovers.length > 0) {
      try {
        const { chapterDetailService } = await import('@/server/services/fandom/chapter-detail');
        const urls = chaptersNeedingCovers.map(ch => ch.url).filter((u): u is string => Boolean(u));
        logger.info(`[adaptiveParse] Fetching chapter details for ${urls.length} chapters`);
        const details = await chapterDetailService.fetchMultipleChapterDetails(urls);
        mergeChapterDetails(extraction.parsedData, details);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.debug(`[adaptiveParse] Chapter detail fetch failed: ${msg}`);
      }
    }

    if (mergedOptions.useCache) {
      const urlPath = new URL(finalUrl).pathname;
      getPatternCache().cacheDiscovery(domain, urlPath, extraction.structureType, extraction.pageStructure, canonicalDomain);
    }

    const hasVolumes = extraction.parsedData.volumes.length > 0;
    const hasChapters = extraction.parsedData.chapters.length > 0;

    // Try to get metadata from the page being parsed first (it may have an infobox)
    // This is more reliable than searching for a "main page" which can find episode pages
    let pageMetadataResult = await fetchPageMetadata(finalUrl, {
      timeoutMs: mergedOptions.probeTimeoutMs,
    });

    // Fall back to main page discovery if the parsed page doesn't have metadata
    if (!pageMetadataResult.success) {
      logger.debug(`No metadata from parsed page, trying main page discovery`);
      pageMetadataResult = await metadataPromise;
    }

    let mangaData = buildMangaData(extraction.parsedData, finalUrl);

    if (pageMetadataResult.success && pageMetadataResult.metadata) {
      mangaData = mergeMetadataIntoMangaData(mangaData, pageMetadataResult.metadata, pageMetadataResult.mainPageUrl);
      logger.info(`Merged metadata for ${domain}`, {
        title: mangaData.title,
        author: !!mangaData.author,
        synopsis: !!mangaData.synopsis,
        coverImage: !!mangaData.coverImage,
      });
    }

    // Late supplement: try allpages/category discovery when chapter data looks incomplete.
    // Triggers when: few chapters (<200), OR per-volume numbering detected (max chapter# < total/2,
    // e.g., Kuroko: 275 raw chapters but max#=99 because each volume restarts from 1).
    const uniqueChNums = new Set(extraction.parsedData.chapters.map((ch) => ch.number)).size;
    // Trigger late supplement when unique chapter count is low (<200).
    // Uses deduplicated count (not raw) to avoid false positives on pages with
    // many duplicate entries (e.g., TG's Story_Arcs: 2002 raw but 143 unique).
    // Skip late supplement if existing chapters already have real titles — category chapters
    // typically only have "Chapter N" names, so replacing would lose real title data.
    const existingHasRealTitles = extraction.parsedData.chapters.some(
      (ch) => ch.title && !/^(Chapter|Ch\.?)\s*\d+$/i.test(ch.title) && /[a-zA-Z]/.test(ch.title)
    );
    if (uniqueChNums < 200 && uniqueChNums > 0 && !existingHasRealTitles) {
      const lateCategoryChapters = await discoverChaptersViaCategory(canonicalDomain, mergedOptions.probeTimeoutMs);
      if (lateCategoryChapters && lateCategoryChapters.length > uniqueChNums * 1.5 && lateCategoryChapters.length > chapterCount) {
        logger.info(`[adaptiveParse] Late allpages supplement: ${lateCategoryChapters.length} chapters (was ${chapterCount})`);
        extraction.parsedData.chapters = lateCategoryChapters.map((ch) => ({
          number: ch.number,
          title: ch.title,
        }));
        chapterCount = extraction.parsedData.chapters.length;
        mangaData = buildMangaData(extraction.parsedData, finalUrl);
        if (pageMetadataResult.success && pageMetadataResult.metadata) {
          mangaData = mergeMetadataIntoMangaData(mangaData, pageMetadataResult.metadata, pageMetadataResult.mainPageUrl);
        }
      }
    }

    // v19: Enrich chapter titles from wikitext for chapters that arrived with generic
    // "Chapter N" titles but have a /wiki/<page> URL. Handles plain-table-parser path
    // (Quintessential Quintuplets, My Dress-Up Darling) where real titles live in
    // the chapter page infobox `| title = X` field.
    if (mangaData.chapterList) {
      await enrichChapterListTitlesFromWikitext(
        mangaData.chapterList as Array<{ number?: number; title?: string; url?: string }>,
        canonicalDomain,
        mergedOptions.probeTimeoutMs,
      );
    }

    // Scrape chapter URLs from page HTML + fetch chapter detail pages for covers/descriptions
    await enrichChapterDetailsFromPages(mangaData, canonicalDomain, finalUrl);

    return {
      success: true,
      data: mangaData,
      structureType: extraction.structureType,
      parsedUrl: finalUrl,
      domain: canonicalDomain,
      durationMs: Date.now() - startTime,
      usedCache: false,
      usedLegacyFallback: false,
      confidence: hasVolumes && hasChapters ? 0.95 : 0.7,
    };
  }

  // Last resort: try category-based chapter enumeration for wikis with individual chapter pages.
  // Threshold 5 (was 10) catches short/ongoing series like 86 Eighty Six (7 chapters)
  const categoryChapters = await discoverChaptersViaCategory(canonicalDomain, mergedOptions.probeTimeoutMs);
  if (categoryChapters && categoryChapters.length >= 5) {
    logger.info(`[adaptiveParse] Category chapter discovery found ${categoryChapters.length} chapters as last resort`);
    let chapterData: ChapterData[] = categoryChapters.map((ch) => ({
      number: ch.number,
      title: ch.title,
    }));
    let volumes: VolumeData[] = [];

    // Supplement: merge per-volume page chapters with category chapters (e.g., Goodnight Punpun
    // where category has 60 chapters and volume pages have 128 — union gives ~147)
    const volumePageData = await tryFetchFromVolumePages(canonicalDomain, 0, mergedOptions);
    if (volumePageData && volumePageData.chapters.length > 0) {
      // Merge: volume chapters are primary, category chapters fill gaps
      const byNumber = new Map<number, ChapterData>();
      for (const ch of volumePageData.chapters) byNumber.set(ch.number, ch);
      for (const ch of chapterData) { if (!byNumber.has(ch.number)) byNumber.set(ch.number, ch); }
      const merged = [...byNumber.values()].sort((a, b) => a.number - b.number);
      logger.info(`[adaptiveParse] Merged volume (${volumePageData.chapters.length}) + category (${chapterData.length}) = ${merged.length} chapters`);
      chapterData = merged;
      if (volumePageData.volumeDescriptions.size > 0 || volumePageData.volumeCovers.size > 0) {
        const maxVol = Math.max(...volumePageData.chapters.map((c) => c.volume ?? 0), 0);
        volumes = Array.from({ length: maxVol }, (_, i) => {
          const vol: VolumeData = { number: i + 1 };
          const desc = volumePageData.volumeDescriptions.get(i + 1);
          if (desc) vol.description = desc;
          const cover = volumePageData.volumeCovers.get(i + 1);
          if (cover) vol.coverImage = cover;
          const pc = volumePageData.volumePageCounts.get(i + 1);
          if (pc !== undefined) vol.pageCount = pc;
          return vol;
        });
      }
    }

    const mangaData = buildMangaData({ chapters: chapterData, volumes }, finalUrl);
    const pageMetadataResult = await metadataPromise;
    const mergedData = pageMetadataResult.success && pageMetadataResult.metadata
      ? mergeMetadataIntoMangaData(mangaData, pageMetadataResult.metadata, pageMetadataResult.mainPageUrl)
      : mangaData;

    // Scrape chapter URLs + fetch chapter details for covers/descriptions
    await enrichChapterDetailsFromPages(mergedData, canonicalDomain, finalUrl);

    return {
      success: true,
      data: mergedData,
      structureType: StructureType.UNKNOWN,
      parsedUrl: finalUrl,
      domain: canonicalDomain,
      durationMs: Date.now() - startTime,
      usedCache: false,
      usedLegacyFallback: false,
      confidence: volumes.length > 0 ? 0.85 : 0.6,
    };
  }

  // No data extracted from any URL
  if (mergedOptions.fallbackToLegacy) {
    logger.warn(`No data extracted for ${domain} after trying alternatives`);
  }

  return createFailureResult(canonicalDomain, finalUrl, startTime, 'No data extracted from any URL');
}

/**
 * Batch parse multiple wikis in parallel.
 *
 * @param domains - Array of wiki domains to parse
 * @param options - Parser options
 * @param concurrency - Maximum concurrent parses
 * @returns Array of results
 */
export async function batchAdaptiveParse(
  domains: string[],
  options: Partial<AdaptiveParserOptions> = {},
  concurrency = 3
): Promise<AdaptiveParseResult[]> {
  const results: AdaptiveParseResult[] = [];

  for (let i = 0; i < domains.length; i += concurrency) {
    const batch = domains.slice(i, i + concurrency);
    // eslint-disable-next-line no-await-in-loop -- Intentional: batch processing with controlled concurrency
    const batchResults = await Promise.all(batch.map((domain) => adaptiveParse(domain, options)));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Pre-warms the cache by discovering patterns for multiple wikis.
 *
 * @param domains - Array of wiki domains to warm
 * @param options - Parser options
 * @returns Number of successfully cached patterns
 */
export async function warmCache(
  domains: string[],
  options: Partial<AdaptiveParserOptions> = {}
): Promise<number> {
  logger.info(`Warming cache for ${domains.length} domains`);

  const results = await batchAdaptiveParse(domains, options);
  const successCount = results.filter((r) => r.success).length;

  logger.info(`Cache warmed: ${successCount}/${domains.length} successful`);
  return successCount;
}

// ============================================================================
// Type Converters - Bridge between adaptive system and router response format
// ============================================================================

/**
 * Chapter detail in router response format
 */
export interface FandomChapterDetail {
  chapterNumber: string;
  title: string;
  url?: string;
  coverImageUrl?: string;
  detailsFetched?: boolean;
  description?: string;
  synopsis?: string;
  releaseDate?: string;
  pageCount?: number;
}

/**
 * Volume detail in router response format
 */
export interface FandomVolumeDetail {
  volumeNumber: number;
  title: string;
  chapterCount: number;
  coverImageUrl?: string;
  description?: string;
  chapters: FandomChapterDetail[];
}

/** Chapter input type for conversion */
type ChapterInput = {
  chapterNumber?: string;
  number?: number | string;
  title?: string;
  url?: string;
  coverImage?: string;
  coverUrl?: string;
  summary?: string;
  releaseDate?: string;
  pages?: number;
  volume?: number;
  volumeNumber?: number;
};

/** Convert a chapter from adaptive format to router format */
function convertChapter(ch: ChapterInput): FandomChapterDetail {
  const chapter: FandomChapterDetail = {
    chapterNumber: String(ch.chapterNumber ?? ch.number ?? ''),
    title: ch.title ?? `Chapter ${ch.chapterNumber ?? ch.number ?? '?'}`,
  };
  if (ch.url) chapter.url = ch.url;
  if (ch.coverImage) chapter.coverImageUrl = ch.coverImage;
  if (ch.coverUrl) chapter.coverImageUrl = ch.coverUrl;
  if (ch.summary) chapter.synopsis = ch.summary;
  if (ch.releaseDate) chapter.releaseDate = ch.releaseDate;
  if (ch.pages) chapter.pageCount = ch.pages;
  return chapter;
}

/** Groups chapters by volume number from a flat chapter list */
function groupChaptersByVolume(chapterList: ChapterInput[]): Map<number, FandomChapterDetail[]> {
  const map = new Map<number, FandomChapterDetail[]>();
  for (const ch of chapterList) {
    const volNum = ch.volume ?? ch.volumeNumber ?? 0;
    const existing = map.get(volNum) ?? [];
    existing.push(convertChapter(ch));
    map.set(volNum, existing);
  }
  return map;
}

/** Volume input type from FandomMangaData.volumeList */
type VolumeInput = {
  volumeNumber?: number;
  number?: number;
  title?: string;
  coverUrl?: string;
  coverImage?: string;
  description?: string;
  chapters?: ChapterInput[];
};

/** Check if a chapter has a real title (not just a number or placeholder) */
function hasRealChapterTitle(ch: FandomChapterDetail): boolean {
  if (!ch.title || ch.title.length === 0) return false;
  // Title is just a number
  if (/^\d+$/.test(ch.title)) return false;
  // Title is "Chapter N" placeholder
  if (/^(Chapter|Ch\.?)\s*\d+$/i.test(ch.title)) return false;
  // Must have at least some alphabetic characters
  return /[a-zA-Z]/.test(ch.title);
}

/** Convert a volume from adaptive format using embedded or grouped chapters */
function convertVolume(
  volume: VolumeInput,
  chaptersByVolume: Map<number, FandomChapterDetail[]>,
  titleMap: Map<number, string>
): FandomVolumeDetail {
  const volumeNumber = volume.volumeNumber ?? volume.number ?? 0;

  // Get chapters from both sources
  let embeddedChapters = volume.chapters?.length
    ? volume.chapters.map(convertChapter)
    : [];
  const groupedChapters = chaptersByVolume.get(volumeNumber) ?? [];

  // Check which source has real titles
  const embeddedHasRealTitles = embeddedChapters.some(hasRealChapterTitle);
  const groupedHasRealTitles = groupedChapters.some(hasRealChapterTitle);

  // If embedded chapters lack real titles but we have a title map, enrich them
  if (!embeddedHasRealTitles && embeddedChapters.length > 0 && titleMap.size > 0) {
    embeddedChapters = embeddedChapters.map((ch) => {
      const chNum = parseInt(ch.chapterNumber, 10);
      if (!Number.isNaN(chNum) && titleMap.has(chNum)) {
        return { ...ch, title: titleMap.get(chNum) as string };
      }
      return ch;
    });
  }

  // Re-check after enrichment
  const enrichedHasRealTitles = embeddedChapters.some(hasRealChapterTitle);

  // Prefer the source with real titles, then the one with more chapters
  let chapters: FandomChapterDetail[];
  if (enrichedHasRealTitles) {
    chapters = embeddedChapters;
  } else if (groupedHasRealTitles && !embeddedHasRealTitles) {
    chapters = groupedChapters;
  } else if (embeddedChapters.length > 0) {
    chapters = embeddedChapters;
  } else {
    chapters = groupedChapters;
  }

  const coverUrl = volume.coverUrl ?? volume.coverImage;

  const vol: FandomVolumeDetail = {
    volumeNumber,
    title: volume.title ?? `Volume ${volumeNumber}`,
    chapterCount: chapters.length,
    chapters,
  };
  if (coverUrl) vol.coverImageUrl = coverUrl;
  if (volume.description) vol.description = volume.description;
  return vol;
}

/** Create volumes from grouped chapters when no volumeList exists */
function createVolumesFromChapters(chaptersByVolume: Map<number, FandomChapterDetail[]>): FandomVolumeDetail[] {
  const volumeNumbers = Array.from(chaptersByVolume.keys()).sort((a, b) => a - b);

  // If all chapters are volume 0, return single ungrouped volume
  if (volumeNumbers.length === 1 && volumeNumbers[0] === 0) {
    const chapters = chaptersByVolume.get(0) ?? [];
    return [{ volumeNumber: 0, title: 'Chapters', chapterCount: chapters.length, chapters }];
  }

  return volumeNumbers.map((volNum) => {
    const chapters = chaptersByVolume.get(volNum) ?? [];
    return { volumeNumber: volNum, title: `Volume ${volNum}`, chapterCount: chapters.length, chapters };
  });
}

/**
 * Converts adaptive parser result to router-compatible volume details format.
 * Handles chapters in volumeList[].chapters OR flat chapterList with volume refs.
 */
// eslint-disable-next-line complexity -- Conversion handles multiple data formats: embedded chapters, flat chapter lists, and volume references
export function toVolumeDetails(result: AdaptiveParseResult): FandomVolumeDetail[] {
  if (!result.success || !result.data) return [];

  const { volumeList, chapterList } = result.data;

  // Build a title map from the flat chapter list for enriching embedded chapters
  const titleMap = new Map<number, string>();
  if (chapterList?.length) {
    for (const ch of chapterList) {
      // Get chapter number, ensuring it's a number
      let chNum: number | undefined;
      if (typeof ch.number === 'number') {
        chNum = ch.number;
      } else if (typeof ch.number === 'string') {
        chNum = parseInt(ch.number, 10);
      } else if (ch.chapterNumber !== undefined) {
        chNum = parseInt(String(ch.chapterNumber), 10);
      }

      const title = ch.title;
      // Only add if we have a valid number and a real title (not just a number)
      if (chNum !== undefined && !Number.isNaN(chNum) && title && !/^\d+$/.test(title) && /[a-zA-Z]/.test(title)) {
        titleMap.set(chNum, title);
      }
    }
    logger.info(`[toVolumeDetails] Built title map with ${titleMap.size} titles from ${chapterList.length} flat chapters`);
    if (titleMap.size > 0) {
      const sampleTitles = Array.from(titleMap.entries()).slice(0, 3).map(([num, title]) => ({ num, title }));
      logger.info(`[toVolumeDetails] Title map sample: ${JSON.stringify(sampleTitles)}`);
    }
  }

  const chaptersByVolume: Map<number, FandomChapterDetail[]> = chapterList?.length
    ? groupChaptersByVolume(chapterList)
    : new Map<number, FandomChapterDetail[]>();

  if (volumeList?.length) {
    // Check if volumes have embedded chapters
    const volsWithChapters = volumeList.filter((v) => v.chapters?.length);
    logger.info(`[toVolumeDetails] ${volumeList.length} volumes, ${volsWithChapters.length} have embedded chapters`);
    const result = volumeList.map((v) => convertVolume(v, chaptersByVolume, titleMap));

    // Log Volume 0 specifically for debugging
    const vol0 = result.find(v => v.volumeNumber === 0);
    if (vol0) {
      logger.info(`[toVolumeDetails] Volume 0 found: ${vol0.chapters.length} chapters`);
      vol0.chapters.forEach((ch, i) => {
        logger.info(`[toVolumeDetails] Vol0 ch${i}: num=${ch.chapterNumber}, url=${ch.url ?? 'NO URL'}`);
      });
    }

    return result;
  }

  if (chaptersByVolume.size > 0) {
    return createVolumesFromChapters(chaptersByVolume);
  }

  return [];
}
