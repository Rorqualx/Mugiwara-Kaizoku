/**
 * Fandom URL Parser Utilities
 *
 * Helper functions for parsing Fandom wiki pages to extract
 * volume and chapter information.
 *
 * Extracted from metadata-fandom-url-parser.ts to reduce:
 * - Function lines: 444 → 100 (max)
 * - Statements: 104 → 50 (max)
 * - Complexity: 56 → 20 (max)
 */


import { logger } from '@/utils/logger';

import { safeGet, isRecord } from './metadata-utils';

import type { CheerioAPI } from 'cheerio';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Options for parsing a Fandom URL
 */
export interface FandomParseOptions {
  url: string;
  forceRefresh?: boolean;
  fetchChapterCovers?: boolean;
  maxChaptersToFetch?: number;
}

/**
 * Chapter detail information
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
 * Volume detail information including chapters
 */
export interface FandomVolumeDetail {
  volumeNumber: number;
  title: string;
  chapterCount: number;
  coverImageUrl?: string;
  description?: string;
  chapters: FandomChapterDetail[];
}

/**
 * Result of parsing a Fandom URL
 */
export interface FandomParseResult {
  volumes: number;
  chapters: number;
  volumeDetails: FandomVolumeDetail[];
  gallery?: string[];
}

// ============================================================================
// URL Validation and Fetching
// ============================================================================

/**
 * Validate that URL is a Fandom wiki URL
 */
export function validateFandomUrl(url: string): boolean {
  return url.includes('fandom.com');
}

/**
 * Fetch a Fandom wiki page using MediaWiki API (bypasses Cloudflare)
 * Falls back to direct fetch if API fails
 */
export async function fetchFandomPage(url: string): Promise<string> {
  // Try MediaWiki API first (bypasses Cloudflare protection)
  const { fetchPageHtmlViaApi } = await import(
    '@/server/services/fandom/utils/mediaWikiApiFetch'
  );

  const apiResult = await fetchPageHtmlViaApi(url);
  if (apiResult) {
    logger.info('[fetchFandomPage] Successfully fetched via MediaWiki API', {
      url,
      htmlLength: apiResult.length,
    });
    return apiResult;
  }

  // Fallback to direct axios request (may fail on Cloudflare-protected wikis)
  logger.warn('[fetchFandomPage] MediaWiki API failed, trying direct fetch', { url });
  const axios = (await import('axios')).default;
  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    timeout: 30000,
  });
  return typeof response.data === 'string'
    ? response.data
    : String(response.data);
}

/**
 * Check for and follow a volumes/chapters list link
 * Supports multiple naming conventions used by different wikis,
 * including series-specific patterns like "List_of_Attack_on_Titan_chapters"
 */
export async function followVolumesLink(
  $: CheerioAPI,
  wikiBaseUrl: string
): Promise<string | null> {
  // Phase 1: Try exact generic link selectors (most wikis)
  const genericSelectors = [
    'a[href*="/wiki/List_of_Volumes"]',
    'a[href*="/wiki/Chapters_and_Volumes"]',
    'a[href*="/wiki/Volumes_and_Chapters"]',
    'a[href*="/wiki/Volume_List"]',
    'a[href*="/wiki/Chapter_List"]',
    'a[href*="/wiki/Volumes"]',
    'a[href*="/wiki/List_of_Chapters"]',
    'a[title="List of Volumes"]',
    'a[title="Chapters and Volumes"]',
    'a[title="Volumes and Chapters"]',
  ];

  let volumesLink: string | undefined;
  for (const selector of genericSelectors) {
    volumesLink = $(selector).first().attr('href');
    if (volumesLink) break;
  }

  // Phase 2: Try series-specific patterns (e.g. "List_of_Attack_on_Titan_chapters")
  if (!volumesLink) {
    // Find links whose href contains "List_of_" AND "_chapters" or "_volumes"
    const seriesSpecificLinks = $('a[href*="/wiki/List_of_"]').filter((_i, el) => {
      const href = $(el).attr('href') ?? '';
      const hrefLower = href.toLowerCase();
      return hrefLower.includes('_chapters') || hrefLower.includes('_volumes');
    });
    volumesLink = seriesSpecificLinks.first().attr('href');
  }

  // Phase 3: Broad text-based search for links with chapter/volume keywords
  if (!volumesLink) {
    const broadLinks = $('a[href*="/wiki/"]').filter((_i, el) => {
      const href = $(el).attr('href') ?? '';
      const text = $(el).text().trim().toLowerCase();
      const hrefLower = href.toLowerCase();
      // Match links whose text or URL suggests chapter/volume listing
      return (
        (text.includes('chapter') && (text.includes('list') || text.includes('volume'))) ||
        (hrefLower.includes('chapter') && hrefLower.includes('volume'))
      );
    });
    volumesLink = broadLinks.first().attr('href');
  }

  if (!volumesLink) return null;

  // Validate the link points to a chapter/volume related page
  const hrefLower = volumesLink.toLowerCase();
  const isValidLink =
    hrefLower.includes('volume') ||
    hrefLower.includes('chapter') ||
    hrefLower.includes('list_of_');

  if (isValidLink) {
    const volumesUrl = volumesLink.startsWith('http')
      ? volumesLink
      : `${wikiBaseUrl}${volumesLink}`;

    logger.info(`Following link to volumes/chapters page: ${volumesUrl}`);
    return fetchFandomPage(volumesUrl);
  }

  return null;
}

// ============================================================================
// Volume Parsing and Processing
// ============================================================================

/**
 * Optional parsing hints from static analysis
 */
export interface ParsingHints {
  chapterConvention?: string | null;
  volumeSelectors?: string[];
  chapterSelectors?: string[];
  chapterUrlPattern?: string | null;
  checkCollapsible?: boolean;
  checkNestedLists?: boolean;
  hasJpEnTabs?: boolean;
  skipSelectors?: string[];
}

/**
 * Parse volume tables and remove duplicates
 * Uses adaptive parsing to select the best strategy based on page structure
 * @param html - HTML content to parse
 * @param parsingHints - Optional hints from static analysis
 * @param recommendedParser - Optional recommended parser type
 * @param wikiBaseUrl - Base URL of the wiki (e.g., https://dandadan.fandom.com)
 */
export async function parseAndDeduplicateVolumes(
  html: string,
  parsingHints?: ParsingHints,
  recommendedParser?: string,
  wikiBaseUrl?: string
): Promise<unknown[]> {
  const { parsePageAdaptive, parseVolumeTables } = await import(
    '@/server/services/metadata/utils/fandomTableParser'
  );

  // Log parsing hints if available
  if (parsingHints ?? recommendedParser ?? wikiBaseUrl) {
    logger.info('[parseAndDeduplicateVolumes] Using adaptive parsing with hints', {
      recommendedParser,
      wikiBaseUrl,
      hasVolumeSelectors: parsingHints?.volumeSelectors?.length ?? 0,
      hasChapterSelectors: parsingHints?.chapterSelectors?.length ?? 0,
      checkCollapsible: parsingHints?.checkCollapsible,
    });
  }

  // Use adaptive parser which detects structure and routes to best parser
  // Pass hints from static analyzer to inform parser selection
  // Pass wikiBaseUrl so chapter URLs have correct domain
  const { volumes } = parsePageAdaptive(html, parsingHints, recommendedParser, wikiBaseUrl);

  // If adaptive parser found nothing, fall back to basic parseVolumeTables
  const finalVolumes = volumes.length > 0 ? volumes : parseVolumeTables(html, wikiBaseUrl);

  // Remove duplicates
  return finalVolumes.filter(
    (vol: unknown, index: number, self: unknown[]) =>
      index ===
      self.findIndex(
        (v: unknown) =>
          isRecord(v) &&
          isRecord(vol) &&
          (safeGet(v, 'number') ?? safeGet(v, 'volumeNumber')) ===
            (safeGet(vol, 'number') ?? safeGet(vol, 'volumeNumber'))
      )
  );
}

/**
 * Extract chapter count from page text or calculate from volumes
 */
export function extractChapterCount(
  html: string,
  uniqueVolumes: unknown[]
): number {
  // Try to extract from page metadata first
  const chapterMatch =
    html.match(/(\d+)\s+chapters?/i) ??
    html.match(/has\s+(\d+)\s+chapters?/i);

  if (chapterMatch?.[1]) {
    const count = parseInt(chapterMatch[1], 10);
    logger.info(`Extracted chapter count from text: ${count}`);
    return count;
  }

  // Fallback to summing from volumes
  const sum = uniqueVolumes.reduce((total: number, vol: unknown) => {
    if (!isRecord(vol)) return total;
    const chapters = safeGet(vol, 'chapters');
    return total + (Array.isArray(chapters) ? chapters.length : 0);
  }, 0);

  logger.info(`Calculated chapter count from volumes: ${sum}`);
  return sum;
}

/**
 * Extract volume count from page text as fallback
 */
export function extractVolumeFallback(html: string): number | null {
  const volumeMatch =
    html.match(/(\d+)\s+volumes?\s+published/i) ??
    html.match(/has\s+(\d+)\s+volumes?/i);

  if (volumeMatch?.[1]) {
    const count = parseInt(volumeMatch[1], 10);
    logger.info(`Extracted volume count from text: ${count}`);
    return count;
  }

  return null;
}

// ============================================================================
// Volume Detail Transformation
// ============================================================================

/**
 * Transform parsed volumes to response format
 */
export function transformVolumeDetails(
  uniqueVolumes: unknown[]
): FandomVolumeDetail[] {
  return uniqueVolumes.map((vol: unknown): FandomVolumeDetail => {
    if (!isRecord(vol)) {
      return {
        volumeNumber: 0,
        title: 'Unknown',
        chapterCount: 0,
        chapters: [],
      };
    }

    const chapters = safeGet(vol, 'chapters');
    const chaptersArray = Array.isArray(chapters) ? chapters : [];

    const coverImage = safeGet(vol, 'coverImage') ?? safeGet(vol, 'coverImageUrl');

    const result: FandomVolumeDetail = {
      volumeNumber: Number(safeGet(vol, 'volumeNumber') ?? safeGet(vol, 'number') ?? 0),
      title: String(safeGet(vol, 'title') ?? 'Unknown'),
      chapterCount: chaptersArray.length,
      chapters: chaptersArray.map((ch: unknown): FandomChapterDetail => {
        if (!isRecord(ch)) {
          return { chapterNumber: '0', title: 'Unknown' };
        }

        const chCoverImage = safeGet(ch, 'coverImage') ?? safeGet(ch, 'coverImageUrl');
        const chUrl = safeGet(ch, 'url');

        // Get title with fallback for empty strings
        const rawTitle = safeGet(ch, 'title');
        const chapterTitle = (typeof rawTitle === 'string' && rawTitle.trim()) || 'Unknown';

        const chResult: FandomChapterDetail = {
          chapterNumber: String(
            safeGet(ch, 'chapterNumber') ?? safeGet(ch, 'number') ?? '0'
          ),
          title: chapterTitle,
        };

        if (typeof chUrl === 'string') {
          chResult.url = chUrl;
        }

        if (typeof chCoverImage === 'string') {
          chResult.coverImageUrl = chCoverImage;
        }

        return chResult;
      }),
    };

    if (typeof coverImage === 'string') {
      result.coverImageUrl = coverImage;
    }

    const description = safeGet(vol, 'description');
    if (typeof description === 'string') {
      result.description = description;
    }

    return result;
  });
}

/**
 * Count chapters that have URLs
 */
export function countChaptersWithUrls(uniqueVolumes: unknown[]): number {
  return uniqueVolumes.reduce((sum: number, vol: unknown) => {
    if (!isRecord(vol)) return sum;
    const chapters = safeGet(vol, 'chapters');
    if (!Array.isArray(chapters)) return sum;
    return (
      sum +
      chapters.filter((ch: unknown) => isRecord(ch) && safeGet(ch, 'url'))
        .length
    );
  }, 0);
}

// ============================================================================
// Chapter Detail Fetching
// ============================================================================

/**
 * Collect chapter URLs for fetching details
 */
export function collectChapterUrls(
  volumeDetails: FandomVolumeDetail[],
  wikiBaseUrl: string,
  maxToFetch: number
): string[] {
  const chaptersToFetch: string[] = [];
  let chaptersCollected = 0;

  // Debug: Log Volume 0 chapters specifically
  const vol0 = volumeDetails.find(v => v.volumeNumber === 0);
  if (vol0) {
    logger.info(`[collectChapterUrls] Volume 0 found with ${vol0.chapters.length} chapters`);
    vol0.chapters.forEach((ch, i) => {
      logger.info(`[collectChapterUrls] Vol0 ch${i}: num=${ch.chapterNumber}, hasUrl=${!!ch.url}, url=${ch.url ?? 'NONE'}`);
    });
  }

  for (const vol of volumeDetails) {
    if (chaptersCollected >= maxToFetch) break;

    for (const ch of vol.chapters) {
      if (ch.url && chaptersCollected < maxToFetch) {
        const absoluteUrl = ch.url.startsWith('http')
          ? ch.url
          : `${wikiBaseUrl}${ch.url}`;
        chaptersToFetch.push(absoluteUrl);
        chaptersCollected++;
      }
    }
  }

  return chaptersToFetch;
}

/**
 * Fetch chapter details in batches
 */
export async function fetchChapterDetailsForVolumes(
  chaptersToFetch: string[]
): Promise<unknown[]> {
  const { ChapterDetailService } = await import(
    '@/server/services/fandom/chapter-detail'
  );
  const chapterService = new ChapterDetailService();

  const batchSize = Math.min(chaptersToFetch.length, 20);
  const chapterDetails = await chapterService.batchFetchChapterDetails(
    chaptersToFetch,
    {
      batchSize,
      delayMs: 150,
      maxRetries: 2,
      onProgress: (completed: number, total: number) => {
        logger.info(`Chapter detail progress: ${completed}/${total}`);
      },
    }
  );

  return chapterDetails;
}

/**
 * Map fetched chapter details back to volume details
 */
export function mapChapterDetailsToVolumes(
  volumeDetails: FandomVolumeDetail[],
  chapterDetails: unknown[],
  wikiBaseUrl: string
): void {
  logger.info('[mapChapterDetailsToVolumes] Starting mapping', {
    volumeCount: volumeDetails.length,
    chapterDetailsCount: Array.isArray(chapterDetails) ? chapterDetails.length : 0,
    wikiBaseUrl,
    sampleDetail: Array.isArray(chapterDetails) && chapterDetails[0]
      ? JSON.stringify(chapterDetails[0]).substring(0, 300)
      : 'none'
  });

  if (!Array.isArray(chapterDetails)) {
    logger.warn('[mapChapterDetailsToVolumes] chapterDetails is not an array');
    return;
  }

  const detailsMap = new Map(
    chapterDetails.map((d) => {
      if (!isRecord(d)) return ['', d];
      return [safeGet(d, 'url') as string, d];
    })
  );

  logger.info('[mapChapterDetailsToVolumes] Created detailsMap with', {
    mapSize: detailsMap.size,
    sampleKeys: Array.from(detailsMap.keys()).slice(0, 3)
  });

  // Collect all chapters from all volumes into flat array for processing
  const allChapters = volumeDetails.flatMap(vol => vol.chapters);
  let mappedCount = 0;

  for (const ch of allChapters) {
    if (!ch.url) continue;

    const absoluteUrl = ch.url.startsWith('http') ? ch.url : `${wikiBaseUrl}${ch.url}`;
    const details = detailsMap.get(absoluteUrl);

    if (!details || !isRecord(details)) continue;

    const detailTitle = safeGet(details, 'title') as string | undefined;
    if (detailTitle && !detailTitle.match(/^Chapter\s+\d+$/i)) {
      ch.title = detailTitle;
    }

    const coverUrl = safeGet(details, 'coverImageUrl');
    if (typeof coverUrl === 'string') {
      ch.coverImageUrl = coverUrl;
      mappedCount++;
    }

    ch.detailsFetched = true;

    const desc = safeGet(details, 'description');
    if (typeof desc === 'string') ch.description = desc;

    const syn = safeGet(details, 'synopsis');
    if (typeof syn === 'string') ch.synopsis = syn;

    const relDate = safeGet(details, 'releaseDate');
    if (typeof relDate === 'string') ch.releaseDate = relDate;

    const pages = safeGet(details, 'pageCount');
    if (typeof pages === 'number') ch.pageCount = pages;
  }

  logger.info('[mapChapterDetailsToVolumes] Mapping complete', {
    totalChapters: allChapters.length,
    mappedCovers: mappedCount,
    detailsMapSize: detailsMap.size
  });
}

// ============================================================================
// Gallery Image Extraction
// ============================================================================

// Volume cover patterns to EXCLUDE (match filename)
const VOLUME_PATTERNS = [
  /^volume(?:_|\s|%20|-)?\d+\./i,           // Volume_1.png
  /^vol(?:_|\.|\s|%20|-)?\d+\./i,           // Vol_1.png
  /^fire(?:_|\s|%20|-)?force(?:_|\s|%20|-)?\d+\./i,  // FIRE_FORCE_01.png
];

// Magazine/promotional patterns to INCLUDE (priority)
const MAGAZINE_PATTERNS = [
  /issue/i,       // Issue_52.png
  /wsm/i,         // WSM_Issue_24.png
  /fbof/i,        // FBOF_on_WSM_cover.png
  /magazine/i,    // Magazine covers
  /promo/i,       // Promotional art
];

/** Extract filename from Fandom image URL */
function getFilenameFromUrl(imgUrl: string): string {
  const match = imgUrl.match(/\/images\/[a-f0-9]\/[a-f0-9]{2}\/([^/]+)\//i);
  if (match?.[1]) return decodeURIComponent(match[1]);
  const lastSlash = imgUrl.lastIndexOf('/');
  const queryStart = imgUrl.indexOf('?', lastSlash);
  return queryStart > 0 ? imgUrl.substring(lastSlash + 1, queryStart) : imgUrl.substring(lastSlash + 1);
}

/** Normalize image URL to full resolution */
function normalizeImageUrl(url: string): string {
  let fullUrl = url;
  if (fullUrl.includes('/smart/width/')) {
    fullUrl = fullUrl.replace(/\/smart\/width\/\d+\/height\/\d+/, '/scale-to-width-down/1000');
  }
  if (!fullUrl.includes('/revision/')) {
    fullUrl = fullUrl + '/revision/latest';
  }
  return fullUrl;
}

/** Check if filename should be included (magazine) or excluded (volume cover) */
function shouldIncludeImage(filename: string): boolean {
  const isMagazine = MAGAZINE_PATTERNS.some(p => p.test(filename));
  const isVolume = VOLUME_PATTERNS.some(p => p.test(filename));
  return isMagazine || !isVolume;
}

/** Extract images from <a class="image"> anchor links (Strategy 1) */
function extractImagesFromAnchorLinks($: CheerioAPI, seenUrls: Set<string>): string[] {
  const images: string[] = [];

  $('a.image').each((_, anchor) => {
    const href = $(anchor).attr('href');
    if (!href) return;

    const fileMatch = href.match(/\/wiki\/File:([^?#]+)/i);
    if (!fileMatch?.[1]) return;

    const filename = decodeURIComponent(fileMatch[1]);
    if (seenUrls.has(filename)) return;
    seenUrls.add(filename);

    if (!shouldIncludeImage(filename)) {
      logger.info(`[extractGalleryImages] SKIPPED volume cover: ${filename}`);
      return;
    }

    const img = $(anchor).find('img');
    const dataSrc = img.attr('data-src') ?? '';
    const src = img.attr('src') ?? '';
    let fullUrl = '';

    if (dataSrc.includes('/images/')) {
      fullUrl = dataSrc;
    } else if (src.includes('/images/')) {
      fullUrl = src;
    } else {
      const dataImageKey = img.attr('data-image-key');
      if (dataImageKey) {
        logger.info(`[extractGalleryImages] Skipping UUID thumbnail, filename: ${filename}`);
        return;
      }
    }

    if (fullUrl) {
      images.push(normalizeImageUrl(fullUrl));
      logger.info(`[extractGalleryImages] ADDED from <a.image>: ${filename}`);
    }
  });

  return images;
}

/** Extract images from various img selectors (Strategy 2) */
function extractImagesFromSelectors($: CheerioAPI, seenUrls: Set<string>): string[] {
  const images: string[] = [];
  const imageSelectors = [
    'img[src*="/images/"]', 'img[src*="static.wikia.nocookie.net"]',
    '.wikia-gallery img', '.wikia-gallery-item img', '.gallery img', '.gallerybox img',
    '.mw-gallery-traditional img', '.mw-gallery-packed img',
    '.article-thumb img', '.pi-image-collection img', '.thumb img', '.thumbinner img',
    'img[data-image-name]', 'img[data-image-key]'
  ];

  $(imageSelectors.join(', ')).each((_, img) => {
    const dataSrc = $(img).attr('data-src') ?? '';
    const src = $(img).attr('src') ?? '';
    const dataImageName = $(img).attr('data-image-name') ?? '';
    const dataImageKey = $(img).attr('data-image-key') ?? '';
    const isDataSrcPlaceholder = dataSrc.startsWith('data:');

    let imgUrl = '', filename = '';

    if (src.includes('/images/') && src.includes('static.wikia.nocookie.net')) {
      imgUrl = src;
      filename = getFilenameFromUrl(imgUrl);
    } else if (dataSrc.includes('/images/') && !isDataSrcPlaceholder) {
      imgUrl = dataSrc;
      filename = getFilenameFromUrl(imgUrl);
    } else if (dataImageName || dataImageKey) {
      filename = decodeURIComponent(dataImageName || dataImageKey);
      const parentAnchor = $(img).closest('a.image, a[href*="/wiki/File:"]');
      if (parentAnchor.attr('href')?.includes('/wiki/File:')) {
        imgUrl = dataSrc || src;
      }
    }

    if (!filename || seenUrls.has(filename)) return;
    seenUrls.add(filename);

    if (!imgUrl.includes('static.wikia.nocookie.net')) return;

    if (shouldIncludeImage(filename)) {
      images.push(normalizeImageUrl(imgUrl));
      logger.info(`[extractGalleryImages] ADDED from img selector: ${filename}`);
    }
  });

  return images;
}

/**
 * Extract gallery images from a Fandom page
 * NOTE: Volume covers are extracted separately via volumeDetails.
 */
export function extractGalleryImages($: CheerioAPI, url: string): string[] {
  const seenUrls = new Set<string>();
  logger.info(`[extractGalleryImages] Searching for images on Fandom page: ${url}`);

  // Use both strategies to collect images
  const anchorImages = extractImagesFromAnchorLinks($, seenUrls);
  const selectorImages = extractImagesFromSelectors($, seenUrls);

  const gallery = [...anchorImages, ...selectorImages];
  logger.info(`[extractGalleryImages] Extracted ${gallery.length} gallery images (excluding volume covers)`);
  return gallery;
}
