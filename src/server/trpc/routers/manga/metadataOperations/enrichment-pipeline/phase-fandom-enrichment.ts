/**
 * Phase 3: Fandom Post-Enrichment
 *
 * Discovers Fandom wiki and extracts chapter/volume data using a
 * priority-based fallback chain:
 *
 *   Priority 1: Adaptive Parser (10+ specialized parsers, URL discovery, caching)
 *   Priority 1b: Chapter Detail Fetcher (batch-fetch individual chapter pages for covers/descriptions)
 *   Priority 2: FandomEnhancedService scraper (legacy scraper, fills title gaps)
 *   Priority 3: MediaWiki API fallback (simple regex parsing)
 *
 * Updates DB chapters with enriched data, and stores provider metadata.
 */

import { prisma } from '@/server/db';
import { invalidateMangaCache } from '@/server/trpc/routers/manga/crud-operations/get-manga-cache';
import { logger } from '@/utils/logger';

import { tryAdaptiveParser, populateMapsFromAdaptiveResult } from './fandom-adaptive-bridge';
import { tryChapterDetailFetch } from './fandom-chapter-detail-fetch';
import { applyFandomDataToDb, assignOrphanedChapters, clearRedirectSentinels } from './fandom-db-persistence';
import { extractFromMediaWikiApi } from './fandom-mediawiki-fallback';
import { storeFandomProviderMetadata, storeChapterUrlTemplate, clearChapterUrlTemplate } from './fandom-provider-storage';
import { auditEnrichmentResult, isUnreliableVolumeMap } from './fandom-volume-helpers';
import { createEmptyEnrichmentMaps } from './types';
import { updateCachedFandomUrl } from './wiki-discovery';

import type { ChapterDetailFetchResult } from './fandom-chapter-detail-fetch';
import type { EnrichmentProgress, EnrichmentPipelineOptions, ChapterEnrichmentMaps, ChapterUrlTemplate } from './types';

/** Result from Phase 3 Fandom enrichment */
export interface FandomEnrichmentResult {
  /** True when Fandom's volume-to-chapter data was detected as unreliable (overlapping ranges) */
  volumeDataUnreliable: boolean;
}

/**
 * Run Phase 3: Fandom post-enrichment with priority-based data sources.
 */
// eslint-disable-next-line max-params -- public phase entrypoint; mangaId/title are required identifiers, the rest are optional pipeline hooks already optional in shape
export async function phaseFandomEnrichment(
  mangaId: number,
  title: string,
  onProgress?: EnrichmentProgress,
  options?: EnrichmentPipelineOptions,
  expectedVolumeCount?: number | undefined,
  expectedChapterCount?: number | undefined,
): Promise<FandomEnrichmentResult> {
  await onProgress?.('fandom_enrichment', `Scraping Fandom wiki for "${title}" chapter titles and covers...`);
  let volumeDataUnreliable = false;

  try {
    logger.info(`[enrichmentPipeline] Starting Fandom post-enrichment for manga ${mangaId}: "${title}"`);

    const fandomUrl = await discoverFandomWiki(mangaId, title);
    if (!fandomUrl) return { volumeDataUnreliable: false };

    const fandomScraperMod = await import('@/server/trpc/routers/manga/metadataOperations/refresh/fandom-chapter-scraper');
    const { scrapeFandomChapters, buildUpdatedProviderMetadata } = fandomScraperMod;

    const maps = createEmptyEnrichmentMaps();
    let fandomResult: { success: boolean; chapterEnrichmentMap: Record<string, unknown>; enrichedVolumes: unknown[]; fandomData?: unknown } = { success: false, chapterEnrichmentMap: {}, enrichedVolumes: [] };
    const sourcesUsed: string[] = [];

    const dbChapterCount = await prisma.chapter.count({ where: { mangaId } });

    // --- Priority 1: Adaptive Parser ---
    const adaptiveResult = await tryAdaptiveParser(fandomUrl);
    if (adaptiveResult) {
      populateMapsFromAdaptiveResult(adaptiveResult, maps);
      sourcesUsed.push('adaptive');
      logger.info(`[enrichmentPipeline] Adaptive parser: ${Object.keys(maps.chapterTitleMap).length} titles, ${Object.keys(maps.chapterVolumeMap).length} volume assignments`);
    }

    // --- Priority 1b: Batch-fetch individual chapter pages for covers/descriptions ---
    let bestTemplate = await runChapterDetailFetchPhase(
      { mangaId, dbChapterCount, fandomUrl },
      adaptiveResult, maps, onProgress, options, sourcesUsed,
    );

    const titleCount = Object.keys(maps.chapterTitleMap).length;
    const hasGaps = titleCount === 0 || titleCount < dbChapterCount * 0.9;

    // --- Priority 2: FandomEnhancedService scraper (fills title gaps + harvests gallery) ---
    // Run whenever there are gaps OR when forceRefresh is set so wiki gallery
    // images get refreshed on user-triggered re-identification.
    if (hasGaps || options?.forceRefresh === true) {
      logger.info(`[enrichmentPipeline] Running scraper (titles=${titleCount}/${dbChapterCount}, forceRefresh=${options?.forceRefresh === true})`);
      fandomResult = await scrapeFandomChapters(fandomUrl, {});
      if (fandomResult.success && Object.keys(fandomResult.chapterEnrichmentMap).length > 0) {
        mergeMapsFromScraper(fandomResult.chapterEnrichmentMap as Record<string, { title?: string; coverImage?: string; summary?: string; pages?: number; releaseDate?: string }>, maps);
        sourcesUsed.push('scraper');
      }
    }

    // --- Priority 3: MediaWiki API fallback (always runs) ---
    const titleCountBefore = Object.keys(maps.chapterTitleMap).length;
    const volumeCountBefore = Object.keys(maps.chapterVolumeMap).length;
    const mediawikiResult = await extractFromMediaWikiApi(fandomUrl, maps);
    if (Object.keys(maps.chapterTitleMap).length > titleCountBefore || Object.keys(maps.chapterVolumeMap).length > volumeCountBefore) {
      sourcesUsed.push('mediawiki-api');
    }
    // Prefer scraped-url template, fall back to redirect-discovered template
    if (!bestTemplate && mediawikiResult.discoveredTemplate) {
      bestTemplate = mediawikiResult.discoveredTemplate;
    }

    const enrichmentTitleCount = Object.keys(maps.chapterTitleMap).length;
    if (isCrossSeriesWiki(mangaId, title, enrichmentTitleCount, expectedChapterCount)) {
      return { volumeDataUnreliable: false };
    }

    const hasEnrichmentData = enrichmentTitleCount > 0 || Object.keys(maps.chapterVolumeMap).length > 0;
    if (hasEnrichmentData) {
      await applyEnrichmentData({ mangaId, maps, fandomResult, fandomUrl, sourcesUsed, buildUpdatedProviderMetadata: buildUpdatedProviderMetadata as (...args: unknown[]) => Record<string, unknown>, expectedVolumeCount });
      volumeDataUnreliable = isUnreliableVolumeMap(maps.chapterVolumeMap);
    } else {
      logger.warn(`[enrichmentPipeline] No data found from any Fandom source`);
    }

    // Always-run direct gallery harvest. Bypasses the chapter scraper so wikis
    // where it fails (Bleach, JJK, Berserk, etc.) still get gallery coverage
    // via the MediaWiki API images list against fandomUrl + common subpages.
    await harvestFandomGalleryDirect(mangaId, fandomUrl, title);

    // Persist best URL template for future enrichment runs
    if (bestTemplate) {
      await storeChapterUrlTemplate(mangaId, bestTemplate);
    }
  } catch (fandomError) {
    logger.warn(`[enrichmentPipeline] Fandom enrichment failed (non-critical):`, fandomError);
  }
  return { volumeDataUnreliable };
}

/** Context for applying enrichment data to DB */
interface ApplyEnrichmentCtx {
  mangaId: number;
  maps: ChapterEnrichmentMaps;
  fandomResult: { success: boolean; chapterEnrichmentMap: Record<string, unknown>; enrichedVolumes: unknown[]; fandomData?: unknown };
  fandomUrl: string;
  sourcesUsed: string[];
  buildUpdatedProviderMetadata: (...args: unknown[]) => Record<string, unknown>;
  expectedVolumeCount?: number | undefined;
}

/** Extract wiki-scraped gallery URLs from fandomData (which is typed as unknown).
 *  Accepts both `string[]` and `Array<{url: string}>` shapes (the post-scrape
 *  data is the latter — `GalleryImage` objects with url/caption/type fields). */
function extractWikiGalleryUrls(fandomData: unknown): string[] | undefined {
  if (typeof fandomData !== 'object' || fandomData === null) return undefined;
  const data = fandomData as { gallery?: unknown; coverArt?: { gallery?: unknown } };
  const urls: string[] = [];
  const collect = (arr: unknown): void => {
    if (!Array.isArray(arr)) return;
    for (const item of arr as unknown[]) {
      if (typeof item === 'string' && item.length > 0) {
        urls.push(item);
      } else if (item && typeof item === 'object' && 'url' in (item as Record<string, unknown>)) {
        const u = (item as { url?: unknown }).url;
        if (typeof u === 'string' && u.length > 0) urls.push(u);
      }
    }
  };
  collect(data.gallery);
  collect(data.coverArt?.gallery);
  return urls.length > 0 ? urls : undefined;
}

/**
 * Reject Fandom site-furniture images: logos, wordmarks, favicons, navbar
 * sprites, social-media glyphs, edit/star buttons, etc.
 *
 * URL paths look like `.../images/<a>/<bb>/<filename>/revision/latest?cb=...`,
 * so the basename comes from the segment BEFORE `/revision/`, not the path tail.
 */
function isContentImage(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes('/site-logo')) return false;
  if (u.includes('site_logo')) return false;
  if (u.includes('wiki-background')) return false;
  if (u.includes('/avatar')) return false;
  if (u.includes('/favicon')) return false;
  // Extract the actual filename from the wiki path (before /revision/)
  const m = /\/images\/[a-f0-9]\/[a-f0-9]{2}\/([^/?]+)(?:\/revision\/|$|\?)/i.exec(u);
  const fname = m?.[1] ?? url.split('/').pop() ?? '';
  if (fname.length < 4) return false;
  if (/^(?:checkmark|button|icon|sprite|emoji|emoticon|wordmark|favicon|spoiler|tab|tabber|info|edit|menu|nav|logo)\b/i.test(fname)) return false;
  if (/site_logo|wiki-background|font_awesome/i.test(fname)) return false;
  return true;
}

/**
 * Harvest gallery image URLs directly from the canonical Fandom URL + common
 * gallery subpages, regardless of whether the chapter scraper succeeded.
 *
 * This is the iter-2 change: many wikis fail the chapter scrape (Bleach, JJK,
 * Berserk, Dragon Ball, Vinland, Tokyo Ghoul, Fire Force) but still have rich
 * image lists reachable via the MediaWiki `generator=images` API. We probe the
 * main page + `/Gallery`, `/Image_Gallery`, `/Volumes`, `/Manga` subpages, then
 * union with whatever the scraper already wrote into providerMetadata.fandom.gallery.
 */
export async function harvestFandomGalleryDirect(mangaId: number, fandomUrl: string, title: string): Promise<void> {
  const { listPageImageUrlsViaApi } = await import('@/server/services/fandom/utils/mediaWikiApiFetch');
  const baseUrl = fandomUrl.replace(/\/$/, '');
  // The discovery sometimes returns a bare domain (https://foo.fandom.com)
  // without /wiki/. Build candidate URLs for both: the discovered URL itself
  // (may already include /wiki/<page>) and synthetic /wiki/<title> variants.
  const slug = title.replace(/\s+/g, '_');
  const root = /^https:\/\/[^/]+\/wiki\//.test(baseUrl)
    ? baseUrl.replace(/\/wiki\/.*$/, '')
    : baseUrl;
  const candidateUrls = new Set<string>([
    baseUrl,
    `${baseUrl}/Gallery`,
    `${baseUrl}/Image_Gallery`,
    `${baseUrl}/Volumes`,
    `${baseUrl}/Manga`,
    `${root}/wiki/${slug}`,
    `${root}/wiki/${slug}_(manga)`,
    `${root}/wiki/${slug}_(Manga)`,
    `${root}/wiki/${slug}/Gallery`,
    `${root}/wiki/${slug}_(manga)/Gallery`,
    `${root}/wiki/Gallery`,
    `${root}/wiki/Manga`,
    `${root}/wiki/Volumes`,
  ]);

  const collected = new Set<string>();
  for (const url of candidateUrls) {
    // eslint-disable-next-line no-await-in-loop -- sequential to keep API friendly
    const urls = await listPageImageUrlsViaApi(url);
    for (const u of urls) if (isContentImage(u)) collected.add(u);
  }
  if (collected.size === 0) return;

  const m = await prisma.manga.findUnique({ where: { id: mangaId }, select: { providerMetadata: true } });
  const pm = (m?.providerMetadata ?? {}) as Record<string, unknown>;
  const fandom = (pm['fandom'] ?? {}) as Record<string, unknown>;
  const existing = fandom['gallery'];
  const existingUrls: string[] = [];
  if (Array.isArray(existing)) {
    for (const item of existing) {
      if (typeof item === 'string') existingUrls.push(item);
      else if (item && typeof item === 'object' && 'url' in (item as Record<string, unknown>)) {
        const u = (item as { url?: unknown }).url;
        if (typeof u === 'string') existingUrls.push(u);
      }
    }
  }
  const merged = [...new Set([...existingUrls, ...collected])];
  fandom['gallery'] = merged;
  pm['fandom'] = fandom;
  await prisma.manga.update({ where: { id: mangaId }, data: { providerMetadata: pm as never } });
  logger.info(`[enrichmentPipeline] Direct gallery harvest: +${merged.length - existingUrls.length} URLs (now ${merged.length}) for manga ${mangaId}`);
}

/** Apply all enrichment data to DB and store provider metadata */
async function applyEnrichmentData(ctx: ApplyEnrichmentCtx): Promise<void> {
  const { mangaId, maps, fandomResult, fandomUrl, sourcesUsed, buildUpdatedProviderMetadata, expectedVolumeCount } = ctx;
  logger.info(`[enrichmentPipeline] Fandom sources: [${sourcesUsed.join(', ')}] — ${Object.keys(maps.chapterTitleMap).length} titles, ${Object.keys(maps.chapterVolumeMap).length} volumes`);
  const wikiGalleryUrls = extractWikiGalleryUrls(fandomResult.fandomData);
  await applyFandomDataToDb(mangaId, maps, expectedVolumeCount, wikiGalleryUrls);
  await clearRedirectSentinels(mangaId, maps.chapterVolumeMap);
  await assignOrphanedChapters(mangaId);
  await auditEnrichmentResult(mangaId);
  await updateCachedFandomUrl(mangaId, fandomUrl);
  await storeFandomProviderMetadata(
    mangaId, maps, fandomResult,
    buildUpdatedProviderMetadata,
    fandomUrl,
  );
  await invalidateMangaCache(mangaId);
}

/**
 * Discover the best Fandom wiki URL.
 *
 * Reuses the unified discovery from wiki-discovery.ts (which checks cached URLs,
 * direct domain probing with content validation, interwiki discovery via catalog
 * wikis, and Fandom search API).
 */
async function discoverFandomWiki(mangaId: number, title: string): Promise<string | null> {
  const { discoverFandomWikiUrl } = await import('./wiki-discovery');
  return discoverFandomWikiUrl(mangaId, title);
}

/** Cross-reference merge: scraper results override/supplement earlier source data */
function mergeMapsFromScraper(
  chapterEnrichmentMap: Record<string, {
    title?: string;
    coverImage?: string;
    summary?: string;
    pages?: number;
    releaseDate?: string;
  }>,
  maps: ChapterEnrichmentMaps,
): void {
  const { chapterTitleMap, chapterCoverMap, chapterDescriptionMap, chapterPagesMap, chapterReleaseDateMap } = maps;
  let mergedTitles = 0;
  for (const [numStr, enrichment] of Object.entries(chapterEnrichmentMap)) {
    const num = Number(numStr);
    if (isNaN(num)) continue;
    if (enrichment.title) { chapterTitleMap[num] = enrichment.title; mergedTitles++; }
    if (enrichment.coverImage && !chapterCoverMap[num]) chapterCoverMap[num] = enrichment.coverImage;
    if (enrichment.summary && !chapterDescriptionMap[num]) chapterDescriptionMap[num] = enrichment.summary;
    if (enrichment.pages && !chapterPagesMap[num]) chapterPagesMap[num] = enrichment.pages;
    if (enrichment.releaseDate && !chapterReleaseDateMap[num]) chapterReleaseDateMap[num] = enrichment.releaseDate;
  }
  logger.info(`[enrichmentPipeline] Scraper merge: ${mergedTitles} titles merged`);
}

/**
 * Run Priority 1b (chapter detail fetch) and clear any stale URL template that
 * produced no covers. Returns the freshly discovered template (caller may
 * overwrite from later sources).
 */
// eslint-disable-next-line max-params -- ctx already groups 3 manga identifiers; remaining 5 are distinct phase inputs (parser result, accumulator maps, callbacks, options, telemetry) used positionally
async function runChapterDetailFetchPhase(
  ctx: { mangaId: number; dbChapterCount: number; fandomUrl: string },
  adaptiveResult: Awaited<ReturnType<typeof tryAdaptiveParser>>,
  maps: ChapterEnrichmentMaps,
  onProgress: EnrichmentProgress | undefined,
  options: EnrichmentPipelineOptions | undefined,
  sourcesUsed: string[],
): Promise<ChapterUrlTemplate | null> {
  const skipDetailFetch = !options?.forceRefresh && await isAlreadyEnriched(ctx.mangaId, ctx.dbChapterCount);
  let result: ChapterDetailFetchResult = { fetched: false, discoveredTemplate: null, storedTemplateFailed: false };
  if (skipDetailFetch) {
    logger.info(`[enrichmentPipeline] 95%+ chapters already enriched — skipping detail fetch`);
  } else {
    result = await tryChapterDetailFetch(ctx, adaptiveResult, maps, onProgress, options);
    if (result.fetched) sourcesUsed.push('chapter-detail');
  }
  if (result.storedTemplateFailed) {
    await clearChapterUrlTemplate(ctx.mangaId);
  }
  return result.discoveredTemplate;
}

/**
 * Multi-series wiki gate (matches the Phase 1 gate in phase-provider-fetch).
 * Two tiers, most precise first:
 *   1. AniList comparison: wiki chapters >2× AL.chapters (AL≥2) catches
 *      spin-offs bound to main-series wikis (Naruto Shinden → 700 chapters
 *      from naruto.fandom.com when AL has 10).
 *   2. Sub-series pattern + absolute 200 cap: fallback when AL unavailable.
 */
function isCrossSeriesWiki(
  mangaId: number,
  title: string,
  enrichmentTitleCount: number,
  expectedChapterCount: number | undefined,
): boolean {
  if (expectedChapterCount !== undefined && expectedChapterCount >= 2
      && enrichmentTitleCount > expectedChapterCount * 2) {
    logger.warn(`[enrichmentPipeline] Skipping Fandom enrichment apply for manga ${mangaId} — ${enrichmentTitleCount} chapters scraped exceeds 2× AniList (${expectedChapterCount}); likely cross-series wiki`);
    return true;
  }
  if (/\b(part|vol|volume|season|book|arc)\s*\d+/i.test(title) && enrichmentTitleCount > 200) {
    logger.warn(`[enrichmentPipeline] Skipping Fandom enrichment apply for sub-series manga ${mangaId} — ${enrichmentTitleCount} chapters scraped (cap 200) suggests cross-series wiki`);
    return true;
  }
  return false;
}

/** Check if 95%+ of a manga's chapters already have title + cover (i.e., enriched) */
async function isAlreadyEnriched(mangaId: number, dbChapterCount: number): Promise<boolean> {
  if (dbChapterCount === 0) return false;

  // title is non-nullable (String), coverImage is nullable (String?)
  const enrichedCount = await prisma.chapter.count({
    where: {
      mangaId,
      coverImage: { not: null },
      title: { not: '' },
    },
  });

  return enrichedCount >= dbChapterCount * 0.95;
}
