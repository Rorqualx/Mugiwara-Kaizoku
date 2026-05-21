/**
 * Fandom Chapter URL Builder
 *
 * Constructs chapter detail URLs by probing common patterns and building
 * URLs for all chapters once a working pattern is confirmed.
 *
 * Used when the adaptive parser found chapter titles/numbers but no
 * per-chapter URLs (e.g., when data came from a category page or volume pages).
 *
 * @module enrichment-pipeline/fandom-chapter-url-builder
 */

import { logger } from '@/utils/logger';

/** Maximum URLs to construct per run to avoid excessive fetching */
const MAX_URLS_PER_RUN = 200;

/** Validate that a URL is a legitimate Fandom wiki URL */
function isValidFandomBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.fandom.com') && parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Probe whether a URL returns a valid page (HTTP 200).
 * Uses HEAD request for efficiency.
 */
async function probeUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/** Build URL map from Chapter_N pattern for all needed chapters */
function buildChapterPatternUrls(
  baseUrl: string,
  needed: number[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const n of needed) {
    map.set(`${baseUrl}/wiki/Chapter_${n}`, n);
  }
  return map;
}

/** Build URL map from title-based URLs for chapters with titles */
function buildTitleBasedUrls(
  baseUrl: string,
  chapters: number[],
  titleMap: Record<number, string>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const n of chapters) {
    const title = titleMap[n];
    if (title) {
      map.set(`${baseUrl}/wiki/${title.replace(/ /g, '_')}`, n);
    }
  }
  return map;
}

/**
 * Construct chapter detail URLs using probe-then-trust pattern.
 *
 * 1. Try `{baseUrl}/wiki/Chapter_{N}` — probe first 2 integer chapters
 * 2. If 200 → construct all URLs using Chapter_N pattern
 * 3. If 404 → try title-based URLs from titleMap
 * 4. Cap at MAX_URLS_PER_RUN
 *
 * @param baseUrl - Wiki base URL (e.g., "https://monster.fandom.com")
 * @param chapterNumbers - Chapter numbers to build URLs for
 * @param titleMap - Map of chapter number → title (for title-based URL fallback)
 * @param existingCoverMap - Already-covered chapters (skip these)
 * @returns Map of URL → chapter number
 */
export async function constructChapterDetailUrls(
  baseUrl: string,
  chapterNumbers: number[],
  titleMap: Record<number, string>,
  existingCoverMap: Record<number, string>,
): Promise<Map<string, number>> {
  if (!isValidFandomBaseUrl(baseUrl)) return new Map();

  const needed = chapterNumbers
    .filter((n) => !existingCoverMap[n])
    .slice(0, MAX_URLS_PER_RUN);

  if (needed.length === 0) return new Map();

  // Strategy 1: Try Chapter_N pattern (most common)
  const probeNumbers = needed.filter((n) => n >= 1 && Number.isInteger(n)).slice(0, 2);
  if (probeNumbers.length > 0) {
    const probeResults = await Promise.all(
      probeNumbers.map(async (n) => probeUrl(`${baseUrl}/wiki/Chapter_${n}`)),
    );
    const successCount = probeResults.filter(Boolean).length;

    if (successCount > 0) {
      logger.info(`[chapterUrlBuilder] Chapter_N pattern works — constructing ${needed.length} URLs`);
      return buildChapterPatternUrls(baseUrl, needed);
    }
  }

  // Strategy 2: Try title-based URLs
  const titledChapters = needed.filter((n) => titleMap[n]);
  if (titledChapters.length > 0) {
    const firstTitle = titleMap[titledChapters[0] as number] as string;
    const titleWorks = await probeUrl(`${baseUrl}/wiki/${firstTitle.replace(/ /g, '_')}`);

    if (titleWorks) {
      logger.info(`[chapterUrlBuilder] Title-based URLs work — constructing ${titledChapters.length} URLs`);
      return buildTitleBasedUrls(baseUrl, titledChapters, titleMap);
    }
  }

  logger.debug(`[chapterUrlBuilder] No working URL pattern found for ${baseUrl}`);
  return new Map();
}
