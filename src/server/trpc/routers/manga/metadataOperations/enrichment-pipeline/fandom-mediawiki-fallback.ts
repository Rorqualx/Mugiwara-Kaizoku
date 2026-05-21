/**
 * Fandom MediaWiki API Fallback
 *
 * When the Fandom scraper returns zero chapters, this module
 * falls back to direct MediaWiki API parsing for chapter titles,
 * volume assignments, cover images, and descriptions.
 */

import { parseFandomUrl, fetchPageHtmlViaApi } from '@/server/services/fandom/utils/mediaWikiApiFetch';
import { logger } from '@/utils/logger';

import { extractAllChapterTitles } from './fandom-mediawiki-fallback/chapter-title-patterns';
import { extractTemplateFromRedirects } from './fandom-url-template';

import type { ChapterEnrichmentMaps, ChapterUrlTemplate } from './types';

/**
 * Extract chapter titles and metadata from Fandom via MediaWiki API.
 */

/** Result from MediaWiki API extraction */
export interface MediaWikiExtractionResult {
  /** URL template discovered from redirect resolution (if any) */
  discoveredTemplate: ChapterUrlTemplate | null;
}

// eslint-disable-next-line complexity, max-lines-per-function, max-statements -- Multi-source HTML extraction with redirect/disambiguation handling
export async function extractFromMediaWikiApi(
  fandomUrl: string,
  maps: ChapterEnrichmentMaps,
): Promise<MediaWikiExtractionResult> {
  const noResult: MediaWikiExtractionResult = { discoveredTemplate: null };
  const parsed = parseFandomUrl(fandomUrl);
  // Handle domain-only URLs (e.g., "https://attackontitan.fandom.com")
  const subdomain = parsed?.subdomain ?? extractSubdomain(fandomUrl);
  if (!subdomain) return noResult;

  let htmlToScan: string | null = null;
  let sourceUrl = fandomUrl;

  if (parsed) {
    // Full URL with /wiki/ path — try fetching it directly
    const mainHtml = await fetchPageHtmlViaApi(fandomUrl);
    if (mainHtml) {
      const contentPage = await resolveContentPage(mainHtml, subdomain, fandomUrl);
      const listPageUrl = discoverListPage(contentPage.html, subdomain);
      htmlToScan = listPageUrl
        ? (await fetchPageHtmlViaApi(listPageUrl)) ?? contentPage.html
        : contentPage.html;
      sourceUrl = listPageUrl ?? contentPage.url;
    }
  }

  // If no HTML yet (domain-only URL or page didn't exist), probe common list page patterns
  if (!htmlToScan) {
    const listPageUrl = await probeListPages(subdomain);
    if (listPageUrl) {
      htmlToScan = await fetchPageHtmlViaApi(listPageUrl);
      sourceUrl = listPageUrl;
    }
  }

  if (!htmlToScan) return noResult;

  logger.info(`[enrichmentPipeline] Parsing chapter titles from: ${sourceUrl}`);

  const { chapterTitleMap, chapterVolumeMap, chapterCoverMap, chapterDescriptionMap } = maps;

  const existingTitleCount = Object.keys(chapterTitleMap).length;
  const { titleMap, usedPadded, patternHits } = extractAllChapterTitles(htmlToScan);
  const fallbackTitleCount = Object.keys(titleMap).length;

  logger.info(
    `[enrichmentPipeline] MediaWiki fallback pattern hits: ${JSON.stringify(patternHits)}`,
  );

  // Merge fallback titles into existing map.
  // Never replace a real title with a generic "Chapter N" title — the fallback
  // often extracts page names (e.g., "Chapter 1") instead of real titles.
  const genericPattern = /^(?:Chapter|Episode|Ch\.?)\s+\d+$/i;
  const shouldOverride = fallbackTitleCount >= existingTitleCount;
  for (const [k, v] of Object.entries(titleMap)) {
    const num = Number(k);
    const existing = chapterTitleMap[num];
    const newIsGeneric = genericPattern.test(v);
    const existingIsGeneric = existing ? genericPattern.test(existing) : true;

    if (!existing) {
      // No existing title — always fill
      chapterTitleMap[num] = v;
    } else if (shouldOverride && !newIsGeneric) {
      // Fallback has more data AND new title is real — override
      chapterTitleMap[num] = v;
    } else if (newIsGeneric && !existingIsGeneric) {
      // Never replace a real title with a generic one
      continue;
    } else if (!newIsGeneric && existingIsGeneric) {
      // Always replace a generic title with a real one
      chapterTitleMap[num] = v;
    }
  }

  const volumeMap = extractVolumeAssignments(htmlToScan, titleMap, usedPadded);
  const existingVolumeCount = Object.keys(chapterVolumeMap).length;
  const fallbackVolumeCount = Object.keys(volumeMap).length;

  if (fallbackVolumeCount >= existingVolumeCount) {
    for (const [k, v] of Object.entries(volumeMap)) {
      chapterVolumeMap[Number(k)] = v;
    }
  } else {
    for (const [k, v] of Object.entries(volumeMap)) {
      const num = Number(k);
      if (!chapterVolumeMap[num]) chapterVolumeMap[num] = v;
    }
  }

  logger.info(
    `[enrichmentPipeline] Direct API fallback: ${fallbackTitleCount} titles (existing: ${existingTitleCount}), ${fallbackVolumeCount} volume assignments (existing: ${existingVolumeCount})`,
  );

  // Gap-fill: resolve missing chapter titles via Chapter_N redirect pages.
  // Many wikis have "Chapter N" pages that redirect to the real titled page
  // (e.g., "Chapter 1" → "To You, 2,000 Years From Now" on AoT).
  const { resolvedUrls, correctedNums, discoveredTemplate } = await fillMissingTitlesViaRedirects(subdomain, chapterTitleMap, chapterVolumeMap);

  // Fetch covers/descriptions for chapters that are missing covers OR had their
  // titles corrected (corrected chapters may have covers from the wrong page).
  const urlsToFetch = new Map<string, number>();
  for (const [url, num] of resolvedUrls) {
    if (!chapterCoverMap[num] || correctedNums.has(num)) urlsToFetch.set(url, num);
  }

  if (urlsToFetch.size > 0) {
    try {
      const { chapterDetailService } = await import('@/server/services/fandom/chapter-detail');
      const urls = [...urlsToFetch.keys()];
      logger.info(`[enrichmentPipeline] Fetching covers for ${urls.length} redirect-resolved chapters (${resolvedUrls.size} total redirects)`);
      const details = await chapterDetailService.batchFetchChapterDetails(urls, {
        batchSize: 10, delayMs: 100, maxRetries: 1,
      });
      let coversFetched = 0;
      for (const detail of details) {
        const chNum = urlsToFetch.get(detail.url);
        if (chNum === undefined) continue;
        const isCorrection = correctedNums.has(chNum);
        if (detail.coverImageUrl && (!chapterCoverMap[chNum] || isCorrection)) { chapterCoverMap[chNum] = detail.coverImageUrl; coversFetched++; }
        if (detail.description && (!chapterDescriptionMap[chNum] || isCorrection)) chapterDescriptionMap[chNum] = detail.description;
      }
      logger.info(`[enrichmentPipeline] Redirect cover fetch: ${coversFetched} covers from ${details.length} pages`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[enrichmentPipeline] Redirect chapter cover fetch failed (non-critical): ${msg}`);
    }
  }

  return { discoveredTemplate };
}

/**
 * Resolves the actual content page by following redirects and disambiguation pages.
 * Returns the final HTML content and URL of the resolved page.
 */
async function resolveContentPage(
  initialHtml: string,
  subdomain: string,
  initialUrl: string,
): Promise<{ html: string; url: string }> {
  let html = initialHtml;
  let url = initialUrl;

  // Follow up to 3 redirects to avoid loops
  for (let i = 0; i < 3; i++) {
    const redirectMatch = html.match(
      /class="redirectText"[^>]*>[\s\S]*?href="\/wiki\/([^"]+)"/,
    );
    if (!redirectMatch?.[1]) break;

    const redirectTarget = redirectMatch[1];
    const redirectUrl = `https://${subdomain}.fandom.com/wiki/${redirectTarget}`;
    logger.info(`[enrichmentPipeline] Following redirect: ${redirectUrl}`);

    // eslint-disable-next-line no-await-in-loop -- Sequential redirect following
    const redirectHtml = await fetchPageHtmlViaApi(redirectUrl);
    if (!redirectHtml) break;

    html = redirectHtml;
    url = redirectUrl;
  }

  // Check if we landed on a disambiguation page — look for (Manga) link
  const isDisambiguation = url.toLowerCase().includes('disambiguation') ||
    html.includes('disambiguation') ||
    (html.length < 5000 && /href="\/wiki\/[^"]*\(Manga\)"/i.test(html));

  if (isDisambiguation) {
    const mangaMatch = html.match(/href="\/wiki\/([^"]*\(Manga\)[^"]*)"/i);
    if (mangaMatch?.[1]) {
      const mangaUrl = `https://${subdomain}.fandom.com/wiki/${mangaMatch[1]}`;
      logger.info(`[enrichmentPipeline] Resolved disambiguation to: ${mangaUrl}`);
      const mangaHtml = await fetchPageHtmlViaApi(mangaUrl);
      if (mangaHtml) {
        return { html: mangaHtml, url: mangaUrl };
      }
    }
  }

  return { html, url };
}

/** Discover a dedicated list page (e.g., "Chapters_and_Volumes") from a resolved content page */
function discoverListPage(contentHtml: string, subdomain: string): string | null {
  // Look for dedicated list pages — must be a LIST page, not individual Volume_1 or Chapter_5
  // Match patterns like: Chapters_and_Volumes, List_of_Chapters, Volumes_&_Chapters
  // Exclude: Volume_1, Chapter_5, etc. (individual pages)
  // Also match URL-encoded & (%26) — e.g., Jujutsu Kaisen uses "Volumes_%26_Chapters"
  // Also match "List_of_X_chapters" (e.g., "List_of_Attack_on_Titan_chapters")
  const listPagePattern = /href="\/wiki\/([^"]*(?:Chapters_and_Volumes|Volumes_and_Chapters|List_of_[^"]*(?:chapters|volumes)|(?:Chapters|Volumes)_(?:&|%26|and)_|Releases_\(Manga\)|Releases_\(manga\))[^"]*)"/i;
  const listMatch = listPagePattern.exec(contentHtml);
  if (listMatch?.[1]) {
    return `https://${subdomain}.fandom.com/wiki/${listMatch[1]}`;
  }

  // Fallback: match "Chapters", "Volumes", or "Releases" in page title but NOT followed by _N (individual pages)
  const broadPattern = /href="\/wiki\/([^"]*(?:Chapters|Volumes|Releases)[^"]*)"/gi;
  let match;
  while ((match = broadPattern.exec(contentHtml)) !== null) {
    const title = match[1];
    if (!title) continue;
    // Skip individual volume/chapter pages like Volume_1, Chapter_5
    if (/(?:Volume|Chapter)[_\s]\d/i.test(title)) continue;
    // Skip disambiguation and category pages
    if (/Disambiguation|Category:/i.test(title)) continue;
    return `https://${subdomain}.fandom.com/wiki/${title}`;
  }

  return null;
}

/** Extract volume-to-chapter mapping from HTML */
function extractVolumeAssignments(
  html: string,
  titleMap: Record<number, string>,
  usedPadded: boolean,
): Record<number, number> {
  const volumeMap: Record<number, number> = {};
  const volPositions: Array<[number, number]> = [];
  const volHeaderPattern = /Volume\s+(\d+)/gi;
  let volMatch;
  while ((volMatch = volHeaderPattern.exec(html)) !== null) {
    volPositions.push([volMatch.index, Number(volMatch[1])]);
  }

  // Match chapter positions for ALL supported patterns
  const digitRange = usedPadded ? '\\d{2,4}' : '\\d{1,4}';
  // Patterns where number is outside the link: N. <a>title</a>, N. "<a>title</a>"
  const chPosPatternA = new RegExp(`(${digitRange})\\.\\s*(?:"?<a[^>]*>(?:<b>)?[^<]+(?:<\\/b>)?<\\/a>"?|<b><a[^>]*>[^<]+<\\/a><\\/b>)`, 'g');
  // Pattern where number is inside the link: <a>N. title</a>
  const chPosPatternB = /<a[^>]*>(\d{1,4})\.\s*[^<]+<\/a>/g;
  // Pattern: <a>N - Title</a> (dash-separated)
  const chPosPatternC = /<a[^>]*>(\d{1,4})\s*[-\u2013\u2014]\s*[^<]+<\/a>/g;
  // Pattern: <a>Chapter N: Title</a> or <a>Chapter N</a>
  const chPosPatternD = /<a[^>]*>(?:Chapter|Ch\.?)\s*(\d{1,4})[^<]*<\/a>/gi;
  // Pattern: <a title="Chapter N">Title</a>
  const chPosPatternE = /<a[^>]*title="(?:Chapter|Ch\.?)\s*(\d+)[^"]*"[^>]*>[^<]+<\/a>/gi;

  for (const chPosPattern of [chPosPatternA, chPosPatternB, chPosPatternC, chPosPatternD, chPosPatternE]) {
    let chPosMatch;
    while ((chPosMatch = chPosPattern.exec(html)) !== null) {
      const chNum = Number(chPosMatch[1]);
      if (isNaN(chNum) || !titleMap[chNum]) continue;
      const bestVol = findEnclosingVolume(chPosMatch.index, volPositions);
      if (bestVol !== undefined && bestVol > 0 && !volumeMap[chNum]) {
        volumeMap[chNum] = bestVol;
      }
    }
  }

  // For ordered-list chapters (no number prefix), locate <li><a> within volume sections
  for (const [chNum] of Object.entries(titleMap)) {
    const num = Number(chNum);
    if (volumeMap[num]) continue; // Already assigned
    // Find position of this title in HTML (substring raw title first, then escape for regex)
    const rawTitle = titleMap[num];
    if (!rawTitle) continue;
    const truncated = rawTitle.substring(0, 30);
    const escapedTitle = truncated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const titlePos = html.search(new RegExp(escapedTitle));
    if (titlePos > 0) {
      const bestVol = findEnclosingVolume(titlePos, volPositions);
      if (bestVol !== undefined && bestVol > 0) {
        volumeMap[num] = bestVol;
      }
    }
  }

  return volumeMap;
}

/** Find the volume number that encloses a given position in the HTML */
function findEnclosingVolume(
  position: number,
  volPositions: Array<[number, number]>,
): number | undefined {
  let bestVol: number | undefined;
  for (const [vPos, vNum] of volPositions) {
    if (vPos < position) bestVol = vNum;
    else break;
  }
  return bestVol;
}

/** Extract subdomain from a domain-only Fandom URL (e.g., "https://bleach.fandom.com" → "bleach") */
function extractSubdomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    const match = hostname.match(/^([^.]+)\.fandom\.com$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Common chapter/volume list page patterns to probe via MediaWiki API */
const LIST_PAGE_CANDIDATES = [
  'Chapters_and_Volumes',
  'Volumes_%26_Chapters',
  'List_of_Chapters_and_Volumes',
  'Chapters',
  'Volumes_and_Chapters',
  'List_of_Volumes',
  'List_of_Chapters',
] as const;

/** Probe common list page patterns via MediaWiki API and return the first that exists */
async function probeListPages(subdomain: string): Promise<string | null> {
  const titles = LIST_PAGE_CANDIDATES.join('|');
  const apiUrl = `https://${subdomain}.fandom.com/api.php?action=query&titles=${titles}&format=json`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;

    const data = await response.json() as { query?: { pages?: Record<string, { title: string; missing?: string; pageid?: number }> } };
    const pages = data.query?.pages ?? {};

    // Find existing pages (have a pageid = page exists), prefer earlier candidates
    const existing = Object.values(pages)
      .filter(p => p.pageid !== undefined)
      .map(p => p.title);

    for (const candidate of LIST_PAGE_CANDIDATES) {
      const decoded = decodeURIComponent(candidate).replace(/_/g, ' ');
      const found = existing.find(t => t.replace(/ /g, '_') === candidate || t === decoded);
      if (found) {
        const pageUrl = `https://${subdomain}.fandom.com/wiki/${found.replace(/ /g, '_')}`;
        logger.info(`[enrichmentPipeline] MediaWiki fallback: discovered list page ${pageUrl}`);
        return pageUrl;
      }
    }

    // Also try title-specific list page (e.g., "List_of_Attack_on_Titan_chapters")
    const searchUrl = `https://${subdomain}.fandom.com/api.php?action=query&list=search&srsearch=List+of+chapters&srlimit=3&format=json`;
    const searchResp = await fetch(searchUrl, {
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
    });
    if (searchResp.ok) {
      const searchData = await searchResp.json() as { query?: { search?: Array<{ title: string }> } };
      const listResult = searchData.query?.search?.find(r => /list.*chapter/i.test(r.title));
      if (listResult) {
        const pageUrl = `https://${subdomain}.fandom.com/wiki/${listResult.title.replace(/ /g, '_')}`;
        logger.info(`[enrichmentPipeline] MediaWiki fallback: discovered list page via search ${pageUrl}`);
        return pageUrl;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Context for processing redirect batches */
interface RedirectBatchCtx {
  subdomain: string;
  chapterTitleMap: Record<number, string>;
  chapterVolumeMap?: Record<number, number> | undefined;
  resolvedUrls: Map<string, number>;
  correctedNums: Set<number>;
}

/** Process a batch of redirects, applying title corrections and tracking resolved URLs */
function processRedirectBatch(
  redirects: Array<{ from: string; to: string }>,
  ctx: RedirectBatchCtx,
): number {
  const { subdomain, chapterTitleMap, chapterVolumeMap, resolvedUrls, correctedNums } = ctx;
  let filled = 0;
  for (const redirect of redirects) {
    const match = redirect.from.match(/^Chapter\s+(\d+)$/i);
    if (!match?.[1]) continue;
    const num = parseInt(match[1], 10);
    const redirectTitle = redirect.to
      .replace(/\s*\((?:Chapter(?:\s+\d+)?|Manga|manga|Episode(?:\s+\d+)?)\)\s*$/i, '')
      .trim();
    if (!redirectTitle) continue;

    // Skip generic redirect targets (e.g., "Episode 1", "Chapter 1")
    if (/^(?:Episode|Chapter|Ch\.?)\s+\d+$/i.test(redirectTitle)) continue;

    const currentTitle = chapterTitleMap[num];
    if (!currentTitle || /^(?:Chapter|Episode)\s+\d+$/i.test(currentTitle)) {
      // Sentinel -1 tells applyFandomDataToDb to set volume=null, then assignOrphanedChapters infers from neighbors
      if (chapterVolumeMap) chapterVolumeMap[num] = -1;
      chapterTitleMap[num] = redirectTitle;
      correctedNums.add(num);
      filled++;
    }

    const pageUrl = `https://${subdomain}.fandom.com/wiki/${redirect.to.replace(/ /g, '_')}`;
    resolvedUrls.set(pageUrl, num);
  }
  return filled;
}

/**
 * Fill missing chapter titles by querying "Chapter_N" redirect pages on the wiki.
 * Many Fandom wikis have "Chapter N" pages that redirect to the real titled page
 * (e.g., "Chapter 1" → "To You, 2,000 Years From Now").
 * Queries in batches of 50 (MediaWiki API limit).
 */
async function fillMissingTitlesViaRedirects(
  subdomain: string,
  chapterTitleMap: Record<number, string>,
  chapterVolumeMap?: Record<number, number>,
): Promise<{ resolvedUrls: Map<string, number>; correctedNums: Set<number>; discoveredTemplate: ChapterUrlTemplate | null }> {
  const resolvedUrls = new Map<string, number>();
  const correctedNums = new Set<number>();
  const emptyResult = { resolvedUrls, correctedNums, discoveredTemplate: null as ChapterUrlTemplate | null };
  // Find chapter numbers that are missing titles or have generic "Chapter N" titles
  const existingNums = Object.keys(chapterTitleMap).map(Number).filter(n => !isNaN(n));
  if (existingNums.length === 0) return emptyResult;

  const maxChapter = Math.max(...existingNums);
  const numsToResolve: number[] = [];
  for (let i = 1; i <= maxChapter; i++) {
    numsToResolve.push(i);
  }

  if (numsToResolve.length === 0 || numsToResolve.length > 500) return emptyResult;

  try {
    let filled = 0;
    const BATCH_SIZE = 50;
    const allRedirects: Array<{ from: string; to: string }> = [];

    for (let i = 0; i < numsToResolve.length; i += BATCH_SIZE) {
      const batch = numsToResolve.slice(i, i + BATCH_SIZE);
      const titles = batch.map(n => `Chapter_${n}`).join('|');
      const apiUrl = `https://${subdomain}.fandom.com/api.php?action=query&titles=${titles}&redirects&format=json`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      // eslint-disable-next-line no-await-in-loop -- Sequential batches for API rate limiting
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
      });
      clearTimeout(timeout);
      if (!response.ok) continue;

      // eslint-disable-next-line no-await-in-loop -- Sequential batches
      const data = await response.json() as {
        query?: {
          redirects?: Array<{ from: string; to: string }>;
        };
      };

      const redirectList = data.query?.redirects ?? [];
      allRedirects.push(...redirectList);
      filled += processRedirectBatch(redirectList, { subdomain, chapterTitleMap, chapterVolumeMap, resolvedUrls, correctedNums });
    }

    if (filled > 0) {
      logger.info(`[enrichmentPipeline] Redirect gap-fill: resolved ${filled} chapter titles via Chapter_N redirects`);
    }

    // Extract URL template from redirect targets
    const discoveredTemplate = extractTemplateFromRedirects(allRedirects, subdomain);
    return { resolvedUrls, correctedNums, discoveredTemplate };
  } catch {
    // Non-critical — gap-fill is best-effort
  }
  return emptyResult;
}

