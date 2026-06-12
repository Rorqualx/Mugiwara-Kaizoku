/**
 * Metadata ComicVine Operations Router
 *
 * Handles ComicVine-specific metadata operations including:
 * - Fetching issues for volumes (API-first, instant)
 * - Scraping chapter data (FlareSolverr fallback for detailed chapters)
 * - Scraping volume URLs from series pages
 * - Testing provider connections
 *
 * API-First Strategy:
 * For manga, each ComicVine "issue" = 1 chapter. We generate chapters from
 * API data (instant, ms) instead of scraping (slow, 60s+ per page).
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { TRPCErrors } from '@/server/trpc/errors';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { unwrapResultAsync } from '@/server/trpc/unwrap-result';
import { logger } from '@/utils/logger';

import {
  extractVolumeIdFromUrl,
  fetchVolumeDataViaApi,
  generateChaptersFromApiData,
  scrapeVolumesWithConcurrency,
  logScrapingResults,
  testComicVineProvider,
  testAniListProvider
} from './metadata-comicvine-ops/index';

/** Scraped volume item type matching ScrapedVolumesItem from mutation-types */
interface ScrapedVolumeItem {
  volumeId?: string;
  volumeNumber: number;
  volumeTitle: string;
  volumeSummary?: string;
  coverImage?: string;
  chapters: Array<{ number: string; title: string; prefix?: string }>;
  totalChapters: number;
}

/** Mapped chapter type for tRPC responses */
interface MappedChapter {
  chapterNumber: number | string;
  title: string;
  url: string;
  prefix?: string;
}

/** Convert chapter number string to number or keep as string for special chapters */
function parseChapterNumber(numberStr: string): number | string {
  const numericChapter = parseFloat(numberStr);
  return isNaN(numericChapter) ? numberStr : numericChapter;
}

/** Map scraped chapter to tRPC response format */
function mapChapterToResponse(ch: { number: string; title: string; prefix?: string }): MappedChapter {
  const chapter: MappedChapter = {
    chapterNumber: parseChapterNumber(ch.number),
    title: ch.title,
    url: '',
  };
  if (ch.prefix) chapter.prefix = ch.prefix;
  return chapter;
}

/** Try to get chapters from API for a series URL (instant) */
async function tryGetChaptersFromApi(seriesUrl: string): Promise<{
  volumes: ScrapedVolumeItem[];
} | null> {
  const seriesId = extractVolumeIdFromUrl(seriesUrl);
  if (!seriesId) return null;

  const apiData = await fetchVolumeDataViaApi(seriesId);
  if (!apiData || apiData.volumes.length === 0) return null;

  const volumesData = generateChaptersFromApiData(apiData.volumes);
  logger.info(`[ComicVine] Generated ${volumesData.length} chapters from API (instant)`);
  return { volumes: volumesData as ScrapedVolumeItem[] };
}

/** Try to get volume URLs from API (instant) */
async function tryGetVolumeUrlsFromApi(seriesUrl: string): Promise<Array<{
  volumeNumber: number;
  url: string;
  coverImageUrl?: string;
  title?: string;
  summary?: string;
}> | null> {
  const seriesId = extractVolumeIdFromUrl(seriesUrl);
  if (!seriesId) return null;

  const apiData = await fetchVolumeDataViaApi(seriesId);
  if (!apiData || apiData.volumes.length === 0) return null;

  logger.info(`[ComicVine] API returned ${apiData.volumes.length} volumes with covers`);
  return apiData.volumes.map(vol => ({
    volumeNumber: vol.volumeNumber,
    url: vol.siteDetailUrl,
    coverImageUrl: vol.coverImage,
    title: vol.volumeTitle,
    summary: vol.volumeSummary
  }));
}

/** Scrape series chapters via FlareSolverr with API-assisted volume discovery */
async function scrapeSeriesChaptersFallback(seriesUrl: string): Promise<Array<ScrapedVolumeItem | null>> {
  const { comicVineScraper } = await import('../../../services/comicvine/scrapingService');

  // Always use API-assisted approach for reliability:
  // 1. Get all volume URLs from API (complete and reliable)
  // 2. Scrape each volume page for chapter titles
  // This is more reliable than parsing volume links from HTML which can miss some
  const apiUrls = await tryGetVolumeUrlsFromApi(seriesUrl);

  if (apiUrls && apiUrls.length > 0) {
    logger.info(`[ComicVine] API found ${apiUrls.length} volumes, scraping each for chapters...`);

    // Scrape volumes using batch method (HTTP with cookies, FlareSolverr fallback)
    const volumeUrls = apiUrls.map(v => v.url);
    const scrapedVolumes = await comicVineScraper.scrapeMultipleVolumes(volumeUrls);

    logger.info(`[ComicVine] Successfully scraped ${scrapedVolumes.length}/${apiUrls.length} volumes`);

    // Merge API metadata (covers, summaries) with scraped chapters
    const mergedVolumes = scrapedVolumes.map(scraped => {
      const apiVol = apiUrls.find(v => v.volumeNumber === scraped.volumeNumber);
      // volumeTitle is always set by scraper; use API fallbacks only for optional fields
      return {
        ...scraped,
        coverImage: scraped.coverImage ?? apiVol?.coverImageUrl,
        volumeSummary: scraped.volumeSummary ?? apiVol?.summary,
        volumeTitle: scraped.volumeTitle,
      };
    });

    if (mergedVolumes.length > 0) {
      return mergedVolumes as Array<ScrapedVolumeItem | null>;
    }
  }

  // Fallback: try standard approach (parses volume links from series page HTML)
  logger.info('[ComicVine] API approach failed, trying HTML parsing fallback');
  const volumesData = await comicVineScraper.scrapeSeriesChapters(seriesUrl);

  if (volumesData.length > 0) {
    logger.info(`[ComicVine] HTML fallback found ${volumesData.length} volumes`);
    return volumesData as Array<ScrapedVolumeItem | null>;
  }

  logger.warn('[ComicVine] No chapters found from any source');
  return [];
}

/** Scrape volume URLs via FlareSolverr (fallback) */
async function scrapeVolumeUrlsFallback(seriesUrl: string): Promise<Array<{
  volumeNumber: number;
  url: string;
  coverImageUrl?: string;
}>> {
  const { comicVineScraper } = await import('../../../services/comicvine/scrapingService');
  const scrapedUrls = await comicVineScraper.scrapeSeriesVolumeUrls(seriesUrl);
  return scrapedUrls.map(v => {
    const result: { volumeNumber: number; url: string; coverImageUrl?: string } = {
      volumeNumber: v.volumeNumber,
      url: v.url,
    };
    if (v.coverUrl) result.coverImageUrl = v.coverUrl;
    return result;
  });
}

/** Scrape single volume chapters via FlareSolverr (fallback) */
async function scrapeVolumeChaptersFallback(volumeUrl: string): Promise<{
  volumeNumber: number;
  title: string;
  summary: string;
  coverUrl: string;
  chapters: MappedChapter[];
  totalChapters: number;
}> {
  const { comicVineScraper } = await import('../../../services/comicvine/scrapingService');
  const volumeData = await comicVineScraper.scrapeVolumeChapters(volumeUrl);

  if (!volumeData) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to scrape volume data' });
  }

  return {
    volumeNumber: typeof volumeData.volumeNumber === 'number' ? volumeData.volumeNumber : parseInt(String(volumeData.volumeNumber)),
    title: volumeData.volumeTitle,
    summary: volumeData.volumeSummary ?? '',
    coverUrl: volumeData.coverImage ?? '',
    chapters: volumeData.chapters.map(mapChapterToResponse),
    totalChapters: volumeData.totalChapters
  };
}

export const metadataComicvineOpsRouter = router({
  fetchComicVineIssues: publicProcedure
    .input(z.object({ volumeId: z.string() }))
    .mutation(async ({ input }) => {
      const { volumeId } = input;
      logger.info(`Fetching ComicVine issues for volume ${volumeId}`);
      const comicvineService = await import('../../../services/comicvine/service');
      const issues = await comicvineService.comicvineService.getVolumeIssues(parseInt(volumeId, 10));
      logger.info(`Fetched ${issues.length} issues for ComicVine volume ${volumeId}`);
      return { volumeId, issues };
    }),

  enrichComicvine: publicProcedure
    .input(z.object({
      result: z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        coverImage: z.string().optional(),
        url: z.string().optional(),
        metadata: z.any().optional()
      })
    }))
    .mutation(({ input }) => ({ ...input.result, enhancedWithWikipedia: false, wikipediaData: null })),

  scrapeComicVineChapters: publicProcedure
    .input(z.object({ volumeUrls: z.array(z.string()).optional(), seriesUrl: z.string().optional() }))
    .mutation(async ({ input }): Promise<{ volumes: Array<ScrapedVolumeItem | null> }> => {
      const { volumeUrls, seriesUrl } = input;
      logger.info('[ComicVine scrapeComicVineChapters] Called', { volumeUrlsCount: volumeUrls?.length ?? 0, hasSeriesUrl: !!seriesUrl });

      if (seriesUrl) {
        // For chapter titles, we MUST scrape - the API only has volume-level data (Vol. 1, Vol. 2)
        // but not actual chapter names like "Spell 1: Caiman", "Chapter 1: The Beginning", etc.
        // The scraper parses chapter titles from the volume pages
        logger.info('[ComicVine] Scraping series for actual chapter titles');
        const volumesData = await scrapeSeriesChaptersFallback(seriesUrl);
        return { volumes: volumesData };
      }

      if (volumeUrls && volumeUrls.length > 0) {
        logger.info(`Scraping ${volumeUrls.length} ComicVine volume(s)`);
        const results = await scrapeVolumesWithConcurrency(volumeUrls, 5);
        logScrapingResults(results, volumeUrls.length);
        return { volumes: results as Array<ScrapedVolumeItem | null> };
      }

      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Either volumeUrls or seriesUrl must be provided' });
    }),

  scrapeComicVineVolumeUrls: publicProcedure
    .input(z.object({ seriesUrl: z.string() }))
    .mutation(async ({ input }): Promise<{
      volumeUrls: Array<{ volumeNumber: number; url: string; coverImageUrl?: string; title?: string; summary?: string }>;
      fromApi?: boolean;
    }> => {
      const { seriesUrl } = input;
      logger.info(`[ComicVine scrapeComicVineVolumeUrls] Called with URL: ${seriesUrl}`);

      const apiUrls = await tryGetVolumeUrlsFromApi(seriesUrl);
      if (apiUrls) return { volumeUrls: apiUrls, fromApi: true };

      const volumeUrls = await scrapeVolumeUrlsFallback(seriesUrl);
      return { volumeUrls, fromApi: false };
    }),

  scrapeComicVineVolume: publicProcedure
    .input(z.object({ volumeUrl: z.string().url() }))
    .mutation(async ({ input }): Promise<{
      volumeDetails: Array<{ volumeNumber: number; title: string; summary: string; coverUrl: string; chapters: MappedChapter[] }>;
      totalChapters: number;
    }> => {
      const { volumeUrl } = input;
      logger.info(`[ComicVine scrapeComicVineVolume] Called with URL: ${volumeUrl}`);

      if (!volumeUrl.includes('comicvine.gamespot.com')) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid ComicVine URL' });
      }

      const apiResult = await tryGetChaptersFromApi(volumeUrl);
      if (apiResult) {
        const volumeDetails = apiResult.volumes.map(vol => ({
          volumeNumber: vol.volumeNumber,
          title: vol.volumeTitle,
          summary: vol.volumeSummary ?? '',
          coverUrl: vol.coverImage ?? '',
          chapters: vol.chapters.map(mapChapterToResponse)
        }));
        const totalChapters = apiResult.volumes.reduce((sum, vol) => sum + vol.totalChapters, 0);
        return { volumeDetails, totalChapters };
      }

      const scraped = await scrapeVolumeChaptersFallback(volumeUrl);
      return { volumeDetails: [scraped], totalChapters: scraped.totalChapters };
    }),

  warmupFlareSolverr: publicProcedure
    .input(z.object({ volumeId: z.string().optional() }))
    .mutation(async ({ input }): Promise<{ warmedUp: boolean; message: string }> => {
      logger.info('[FlareSolverr Warmup] Starting warmup for ComicVine scraping');
      const { protectedFetch } = await import('../../../services/shared/protectedFetch');
      const warmupUrl = input.volumeId ? `https://comicvine.gamespot.com/volume/4050-${input.volumeId}/` : 'https://comicvine.gamespot.com/';

      const result = await protectedFetch(warmupUrl, { timeout: 60000, sessionName: 'comicvine' });

      if (result.success) {
        logger.info('[FlareSolverr Warmup] Warmup successful', { usedFlareSolverr: result.usedFlareSolverr });
        return { warmedUp: true, message: result.usedFlareSolverr ? 'FlareSolverr bypass complete' : 'Already had cached cookies' };
      }
      return { warmedUp: false, message: `Warmup failed: ${result.error ?? 'Unknown error'}` };
    }),

  testProvider: publicProcedure
    .input(z.object({ provider: z.string(), config: z.record(z.any()).optional() }))
    .mutation(async ({ input }): Promise<boolean> => {
      logger.info(`Testing provider connection: ${input.provider}`);
      const provider = input.provider.toLowerCase();

      if (provider === 'comicvine') {
        const apiKey: unknown = input.config?.['apiKey'];
        if (!apiKey || typeof apiKey !== 'string') throw TRPCErrors.badRequest('API key is required');
        return unwrapResultAsync(testComicVineProvider(apiKey));
      }
      if (provider === 'anilist') return unwrapResultAsync(testAniListProvider());
      if (provider === 'fandom' || provider === 'wikipedia') {
        logger.info(`${input.provider} provider test successful (no auth required)`);
        return true;
      }
      throw TRPCErrors.badRequest(`Unknown provider: ${input.provider}`);
    })
});
