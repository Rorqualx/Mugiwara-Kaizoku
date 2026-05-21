/**
 * Fandom Chapter Scraper
 *
 * Handles PHASE 3 of refreshMetaData - Fandom chapter scraping and enrichment.
 * Scrapes Fandom wiki pages for chapter metadata and merges with ComicVine titles.
 *
 * Extracted from: metadataOperations.ts (lines 923-1240)
 */

import { isSuccess, isError, type AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import {
  safeGet,
  safeGetNumber,
  safeGetStringOptional,
  isRecord,
} from '../utils';

import type { FandomData } from '../utils';

// ============================================================================
// Types
// ============================================================================

/** Chapter enrichment data from Fandom */
export interface ChapterEnrichment {
  summary?: string;
  coverImage?: string;
  pages?: number;
  releaseDate?: string;
  url?: string;
  title?: string;
  alternativeTitles?: string[];
}

/** Chapter enrichment map keyed by chapter number */
export type ChapterEnrichmentMap = Record<number, ChapterEnrichment>;

/** Options for Fandom scraping */
export interface FandomScrapingOptions {
  volumesListUrl?: string;
  chaptersListUrl?: string;
}

/** Result of Fandom scraping */
export interface FandomScrapingResult {
  success: boolean;
  fandomData?: FandomData;
  chapterEnrichmentMap: ChapterEnrichmentMap;
  enrichedVolumes: unknown[];
}

// ============================================================================
// URL Extraction Helpers
// ============================================================================

/**
 * Extract Fandom URL from manga metadata
 */
export function extractFandomUrl(mangaMetadata: unknown): string | undefined {
  if (!mangaMetadata) return undefined;

  const metadata: unknown = typeof mangaMetadata === 'string'
    ? JSON.parse(mangaMetadata) as unknown
    : mangaMetadata;

  // Try urls array
  const urls: unknown = safeGet(metadata, 'urls');
  if (Array.isArray(urls)) {
    const url: unknown = urls.find((u: unknown) => typeof u === 'string' && u.includes('.fandom.com'));
    if (typeof url === 'string') return url;
  }

  // Try externalLinks array
  const externalLinks = safeGet(metadata, 'externalLinks');
  if (Array.isArray(externalLinks)) {
    for (const link of externalLinks) {
      if (typeof link === 'string' && link.includes('.fandom.com')) return link;
      if (isRecord(link)) {
        const url = safeGet(link, 'url');
        if (typeof url === 'string' && url.includes('.fandom.com')) return url;
      }
    }
  }

  return undefined;
}

/**
 * Extract Fandom base URL from provider metadata chapter URLs
 */
export function extractFandomBaseUrl(providerMetadata: unknown): string | undefined {
  const fandomData = safeGet(providerMetadata, 'fandom');
  if (!isRecord(fandomData)) return undefined;

  const volumeData = safeGet(fandomData, 'volumeData');
  if (!Array.isArray(volumeData) || volumeData.length === 0) return undefined;

  const firstVol: unknown = volumeData[0];
  if (!isRecord(firstVol)) return undefined;

  const chapters = safeGet(firstVol, 'chapters');
  if (!Array.isArray(chapters) || chapters.length === 0) return undefined;

  const firstCh: unknown = chapters[0];
  if (!isRecord(firstCh)) return undefined;

  const chapterUrl = safeGet(firstCh, 'url');
  if (typeof chapterUrl === 'string' && chapterUrl.includes('.fandom.com')) {
    try {
      const url = new URL(chapterUrl);
      return `${url.protocol}//${url.hostname}`;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Extract Fandom URL from stored provider binding ID (e.g. "attackontitan" or "attackontitan:mw-2405")
 */
export function extractFandomUrlFromBinding(providerMetadata: unknown): string | undefined {
  const fandomData = safeGet(providerMetadata, 'fandom') ?? safeGet(providerMetadata, 'FANDOM');
  if (!isRecord(fandomData)) return undefined;

  const providerId = fandomData['providerId'] ?? fandomData['id'];
  if (typeof providerId !== 'string' || !providerId) return undefined;

  // Handle "attackontitan:mw-2405" format → extract wiki name
  const wikiName = providerId.includes(':') ? providerId.split(':')[0] : providerId;
  if (!wikiName) return undefined;

  return `https://${wikiName}.fandom.com/`;
}

// ============================================================================
// Chapter Enrichment Functions
// ============================================================================

/**
 * Build chapter enrichment map from Fandom data
 */
export function buildChapterEnrichmentMap(fandomData: FandomData): ChapterEnrichmentMap {
  const enrichmentMap: ChapterEnrichmentMap = {};

  // Primary: standalone chapters array
  const chapters = safeGet(fandomData, 'chapters');
  if (Array.isArray(chapters)) {
    for (const ch of chapters) {
      if (!isRecord(ch)) continue;
      const num = parseChapterNumber(ch['number']);
      if (num !== null) enrichmentMap[num] = extractChapterEnrichment(ch);
    }
  }

  // Fallback: volume chapters
  const volumes = safeGet(fandomData, 'volumes');
  if (Array.isArray(volumes)) {
    for (const vol of volumes) {
      if (!isRecord(vol)) continue;
      const volChapters = safeGet(vol, 'chapters');
      if (!Array.isArray(volChapters)) continue;
      for (const ch of volChapters) {
        if (!isRecord(ch)) continue;
        const num = parseChapterNumber(ch['number']);
        if (num !== null && !enrichmentMap[num]) {
          enrichmentMap[num] = extractChapterEnrichment(ch);
        }
      }
    }
  }

  return enrichmentMap;
}

function parseChapterNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  return isNaN(num) ? null : num;
}

function extractChapterEnrichment(ch: Record<string, unknown>): ChapterEnrichment {
  const result: ChapterEnrichment = {};
  const setIfString = (key: string, target: keyof ChapterEnrichment): void => {
    const val = safeGet(ch, key);
    if (typeof val === 'string') (result as Record<string, unknown>)[target] = val;
  };
  const setIfNumber = (key: string, target: keyof ChapterEnrichment): void => {
    const val = safeGet(ch, key);
    if (typeof val === 'number') (result as Record<string, unknown>)[target] = val;
  };

  setIfString('summary', 'summary');
  setIfString('coverImage', 'coverImage');
  setIfNumber('pages', 'pages');
  setIfString('releaseDate', 'releaseDate');
  setIfString('url', 'url');
  setIfString('title', 'title');

  const altTitles = safeGet(ch, 'alternativeTitles');
  if (Array.isArray(altTitles)) {
    result.alternativeTitles = altTitles.filter((t): t is string => typeof t === 'string');
  }

  return result;
}

// ============================================================================
// Volume Enrichment Functions
// ============================================================================

/**
 * Extract ComicVine volume titles from raw provider data
 */
export function extractComicVineTitles(rawProviderData: unknown): Record<number, string> {
  const titles: Record<number, string> = {};
  try {
    const rawData: unknown = typeof rawProviderData === 'string' ? JSON.parse(rawProviderData) as unknown : rawProviderData;
    const volumes: unknown = safeGet(rawData, 'volumes');
    if (!Array.isArray(volumes)) return titles;

    for (const vol of volumes) {
      // Use || for "first non-zero" since safeGetNumber returns number (default 0)
      const num = safeGetNumber(vol, 'volumeNumber') || safeGetNumber(vol, 'number');
      const title = safeGetStringOptional(vol, 'title') ?? safeGetStringOptional(vol, 'name');
      // num is always a number (defaults to 0), title is string | undefined
      if (num !== 0 && title !== undefined) {
        titles[num] = title;
      }
    }
  } catch (error: unknown) {
    logger.error('[fandom-chapter-scraper] Error extracting ComicVine titles:', error);
  }
  return titles;
}

/**
 * Enrich Fandom volumes with ComicVine titles
 */
export function enrichFandomVolumesWithComicVineTitles(
  fandomVolumes: unknown[],
  comicVineTitles: Record<number, string>
): unknown[] {
  const enriched = [...fandomVolumes];
  for (const vol of enriched) {
    if (!isRecord(vol)) continue;
    const num = safeGet(vol, 'number');
    if (typeof num === 'number' && comicVineTitles[num]) {
      vol['title'] = comicVineTitles[num];
      logger.debug(`[fandom-chapter-scraper] Enriched Vol ${num}: ${comicVineTitles[num]}`);
    }
  }
  return enriched;
}

// ============================================================================
// Main Scraping Function
// ============================================================================

/**
 * Scrape Fandom chapters and build enrichment data
 */
export async function scrapeFandomChapters(
  fandomUrl: string,
  options: FandomScrapingOptions
): Promise<FandomScrapingResult> {
  const { volumesListUrl, chaptersListUrl } = options;

  try {
    const { FandomEnhancedService } = await import(
      '@/server/services/fandom/dynamic/FandomEnhancedService'
    );
    const fandomService = new FandomEnhancedService();

    let fandomResult: AsyncResult<FandomData> | null = null;

    // Try volumes list URL first
    if (volumesListUrl !== undefined) {
      logger.info(`[fandom-chapter-scraper] Trying volumes page: ${volumesListUrl}`);
      const parseResult: unknown = await fandomService.parseVolumesPage(volumesListUrl);
      fandomResult = parseResult as AsyncResult<FandomData>;
      if (isSuccess(fandomResult)) {
        const vols: unknown = safeGet(fandomResult.data, 'volumes');
        logger.info(`[fandom-chapter-scraper] Volumes page SUCCESS: ${Array.isArray(vols) ? vols.length : 0} volumes`);
      } else {
        logger.warn(`[fandom-chapter-scraper] Volumes page FAILED`, {
          error: isError(fandomResult) ? fandomResult.error : undefined,
        });
        fandomResult = null;
      }
    }

    // Try chapters list URL if volumes failed
    if (fandomResult === null && chaptersListUrl !== undefined) {
      logger.info(`[fandom-chapter-scraper] Trying chapters page: ${chaptersListUrl}`);
      const parseResult: unknown = await fandomService.parseVolumesPage(chaptersListUrl);
      const chaptersResult: AsyncResult<FandomData> = parseResult as AsyncResult<FandomData>;
      if (isSuccess(chaptersResult)) {
        const vols: unknown = safeGet(chaptersResult.data, 'volumes');
        logger.info(`[fandom-chapter-scraper] Chapters page SUCCESS: ${Array.isArray(vols) ? vols.length : 0} volumes`);
        fandomResult = chaptersResult;
      } else {
        logger.warn(`[fandom-chapter-scraper] Chapters page FAILED`, {
          error: isError(chaptersResult) ? chaptersResult.error : undefined,
        });
      }
    }

    // Try main page as fallback
    if (fandomResult === null) {
      logger.info(`[fandom-chapter-scraper] Trying main page: ${fandomUrl}`);
      const metadataResult: unknown = await fandomService.getEnhancedMetadata(fandomUrl, {
        followLinks: true,
        extractSummaries: true,
        cacheResults: false,
      });
      fandomResult = metadataResult as AsyncResult<FandomData>;
      if (isSuccess(fandomResult)) {
        const vols: unknown = safeGet(fandomResult.data, 'volumes');
        logger.info(`[fandom-chapter-scraper] Main page SUCCESS: ${Array.isArray(vols) ? vols.length : 0} volumes`);
      } else {
        logger.warn(`[fandom-chapter-scraper] Main page FAILED`, {
          error: isError(fandomResult) ? fandomResult.error : undefined,
        });
      }
    }

    // Process successful result
    if (isSuccess(fandomResult)) {
      const fandomData: FandomData = fandomResult.data;
      const chapterEnrichmentMap: ChapterEnrichmentMap = buildChapterEnrichmentMap(fandomData);
      const volumes: unknown = safeGet(fandomData, 'volumes');
      const enrichedVolumes: unknown[] = Array.isArray(volumes) ? [...volumes as unknown[]] : [];

      logger.info(`[fandom-chapter-scraper] Built enrichment map with ${Object.keys(chapterEnrichmentMap).length} chapters`);

      return { success: true, fandomData, chapterEnrichmentMap, enrichedVolumes };
    }

    return { success: false, chapterEnrichmentMap: {}, enrichedVolumes: [] };
  } catch (error: unknown) {
    logger.error(`[fandom-chapter-scraper] Scraping error: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, chapterEnrichmentMap: {}, enrichedVolumes: [] };
  }
}

// ============================================================================
// Provider Metadata Update
// ============================================================================

/**
 * Build updated provider metadata with Fandom enrichment
 */
export function buildUpdatedProviderMetadata(
  existingMetadata: unknown,
  fandomData: FandomData,
  chapterEnrichmentMap: ChapterEnrichmentMap,
  enrichedVolumes: unknown[]
): Record<string, unknown> {
  const metadata = isRecord(existingMetadata) ? existingMetadata : {};
  const stats = safeGet(fandomData, 'stats');

  return {
    ...metadata,
    fandom: {
      chapterEnrichment: chapterEnrichmentMap,
      metadata: safeGet(fandomData, 'metadata'),
      volumeData: enrichedVolumes,
      chapters: safeGet(fandomData, 'chapters'),
      gallery: safeGet(fandomData, 'gallery'),
      stats: {
        totalVolumes: isRecord(stats) ? safeGet(stats, 'totalVolumes') : undefined,
        totalChapters: isRecord(stats) ? safeGet(stats, 'totalChapters') : undefined,
      },
      lastFetch: new Date().toISOString(),
    },
  };
}
