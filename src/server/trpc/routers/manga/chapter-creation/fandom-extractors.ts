/**
 * Fandom Chapter Extractors
 *
 * Functions for extracting chapters from Fandom data structures.
 */

import crypto from 'crypto';

import { logger } from '@/utils/logger';

import { safeGet, safeGetString, parseNumber, isRecord, truncateString } from './helpers';

// Database column limits (VARCHAR(255))
const MAX_TITLE_LENGTH = 255;
const MAX_FILENAME_LENGTH = 255;

import type { ChapterToCreate } from './types';

/**
 * Domains that need to be proxied (have hotlink protection or slow CDNs)
 */
const PROXY_DOMAINS = [
  'static.wikia.nocookie.net',
  'fandom.com',
  'comicvine.gamespot.com',
];

/**
 * Convert an image URL to a proxied URL for caching and faster loading.
 * Proxies external images through /api/image-proxy to cache them locally.
 *
 * IMPORTANT: Uses MD5 hash for proxy path to match fandom-chapter/url-processing.ts
 * This ensures cache consistency - images fetched during initial Fandom parse
 * will be found in cache when chapters are created.
 */
function proxyImageUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const needsProxy = PROXY_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );

    if (!needsProxy) return url;

    // Use MD5 hash for consistent proxy path (matches url-processing.ts)
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const proxyPath = hash.substring(0, 16);
    return `/api/image-proxy/${proxyPath}?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

/**
 * Extract chapters from Fandom volume data structure
 */
export function extractChaptersFromFandomVolumes(
  volumeData: unknown[],
  mangaId: number
): ChapterToCreate[] {
  logger.info(`Found ${volumeData.length} volumes in FANDOM volumeData`);
  const chaptersToCreate: ChapterToCreate[] = [];
  let totalChaptersFound = 0;

  for (const volume of volumeData) {
    if (!isRecord(volume)) {
      logger.warn(`Volume is not a record, skipping`);
      continue;
    }

    const volumeNumberRaw = safeGet(volume, 'volumeNumber') ?? safeGet(volume, 'number');
    const volumeNumber = parseNumber(volumeNumberRaw, 1);
    const volumeChapters = safeGet(volume, 'chapters');

    logger.info(`Processing volume ${volumeNumber}: ${Array.isArray(volumeChapters) ? volumeChapters.length : 0} chapters`);

    if (Array.isArray(volumeChapters)) {
      for (const chapter of volumeChapters) {
        if (!isRecord(chapter)) {
          logger.warn(`Chapter in volume ${volumeNumber} is not a record, skipping`);
          continue;
        }

        const chapterNumRaw = safeGet(chapter, 'chapterNumber') ?? safeGet(chapter, 'number');
        const chapterNum = parseNumber(chapterNumRaw, 0);

        // Proxy cover image URL for caching and faster loading
        const rawCoverUrl = safeGetString(chapter, 'coverImageUrl') || null;
        const proxiedCoverUrl = proxyImageUrl(rawCoverUrl);

        // Get title with fallback for empty strings
        const rawChapterTitle = safeGetString(chapter, 'title', '');
        const chapterTitle = rawChapterTitle || `Chapter ${chapterNum}`;

        const fileName = `v${volumeNumber.toString().padStart(2, '0')}-c${chapterNum.toString().padStart(3, '0')}.cbz`;
        chaptersToCreate.push({
          mangaId: mangaId,
          title: truncateString(chapterTitle, MAX_TITLE_LENGTH),
          alternativeTitles: [],
          index: chapterNum,
          chapterNumber: chapterNum,
          fileName: truncateString(fileName, MAX_FILENAME_LENGTH),
          size: 0,
          downloadStatus: 'PENDING' as const,
          volume: volumeNumber,
          downloadUrl: safeGetString(chapter, 'url') ? safeGetString(chapter, 'url') : null,
          coverImage: proxiedCoverUrl,
          description: safeGetString(chapter, 'description') ? safeGetString(chapter, 'description') : null,
          releaseDate: null,
          pageCount: null,
          monitored: true,
          updatedAt: new Date()
        });
        totalChaptersFound++;
      }
    } else {
      logger.warn(`Volume ${volumeNumber} chapters is not an array:`, {
        type: typeof volumeChapters,
        value: volumeChapters
      });
    }
  }

  logger.info(`Prepared ${chaptersToCreate.length} chapters from volumeData (found ${totalChaptersFound} total)`);
  return chaptersToCreate;
}

/**
 * Extract chapters from flat Fandom chapters array
 */
export function extractChaptersFromFandomArray(
  chapters: unknown[],
  mangaId: number
): ChapterToCreate[] {
  logger.info(`Found ${chapters.length} chapters in FANDOM data`);
  const chaptersToCreate: ChapterToCreate[] = [];

  for (const chapter of chapters) {
    if (!isRecord(chapter)) continue;

    const chapterNumRaw = safeGet(chapter, 'number') ?? safeGet(chapter, 'chapterNumber');
    const chapterNum = parseNumber(chapterNumRaw, 0);

    // Use the volume number directly from the chapter data
    const volumeRaw = safeGet(chapter, 'volume');
    let volumeNumber = parseNumber(volumeRaw, 0);

    // Fallback if volume is not set in chapter data (allow Volume 0 for prequels like JJK 0)
    if (volumeNumber < 0) {
      volumeNumber = -1;
      logger.warn(`Chapter ${chapterNum} has no volume set in FANDOM data, marking as unassigned (volume=-1)`);
    } else {
      logger.info(`Chapter ${chapterNum} has volume ${volumeNumber} from FANDOM data`);
    }

    logger.info(`Creating chapter ${chapterNum} with volume ${volumeNumber}`);

    // Proxy cover image URL for caching and faster loading
    const rawCoverUrl = safeGetString(chapter, 'coverImageUrl') || null;
    const proxiedCoverUrl = proxyImageUrl(rawCoverUrl);

    // Get title with fallback for empty strings
    const chapterTitle = safeGetString(chapter, 'title', '') || `Chapter ${chapterNum}`;

    const fileName = `v${volumeNumber.toString().padStart(2, '0')}-c${chapterNum.toString().padStart(3, '0')}.cbz`;
    chaptersToCreate.push({
      mangaId: mangaId,
      title: truncateString(chapterTitle, MAX_TITLE_LENGTH),
      alternativeTitles: [],
      index: chapterNum,
      chapterNumber: chapterNum,
      fileName: truncateString(fileName, MAX_FILENAME_LENGTH),
      size: 0,
      downloadStatus: 'PENDING' as const,
      volume: volumeNumber,
      downloadUrl: safeGetString(chapter, 'url') ? safeGetString(chapter, 'url') : null,
      coverImage: proxiedCoverUrl,
      description: safeGetString(chapter, 'description') ? safeGetString(chapter, 'description') : null,
      releaseDate: null,
      pageCount: null,
      monitored: true,
      updatedAt: new Date()
    });
  }

  // Sort chapters by index to ensure proper order
  chaptersToCreate.sort((a, b) => Number(a.index) - Number(b.index));

  logger.info(`Prepared ${chaptersToCreate.length} chapters for creation`);
  return chaptersToCreate;
}
