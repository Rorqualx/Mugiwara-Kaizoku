/**
 * ComicVine Volume Scraper
 *
 * Re-fetches detailed volume/chapter data from ComicVine by scraping
 * individual volume pages for chapter details not available via API.
 *
 * PHASE 2 of refreshMetaData operation.
 * Extracted from: metadataOperations.ts (lines 673-921)
 */

import { comicVineScraper } from '@/server/services/comicvine/scrapingService';
import type { ComicVineVolumeChapters } from '@/server/services/comicvine/types';
import { logger } from '@/utils/logger';

import { safeGet, isRecord, isProviderMetadataRecord } from '../utils';

import type { Prisma, PrismaClient } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface VolumeUrl {
  volumeNumber: number;
  url: string;
}

interface EnrichedVolume {
  volumeNumber: number;
  number: number;
  title: string;
  name: string | undefined;
  coverImageUrl: string;
  description: string;
  releaseDate: string;
  publisher: string;
  chapters: unknown[];
}

interface VolumeCover {
  volumeNumber: number;
  url: string;
  volumeName: string;
}

export interface ComicVineScraperResult {
  updatedProviderMetadata: Record<string, unknown>;
  enrichedVolumes: EnrichedVolume[];
  volumeCovers: VolumeCover[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractSeriesUrl(comicvineData: unknown, metadata: unknown): string | undefined {
  // Priority 1: Check Metadata.externalLinks/urls — most trustworthy since they come from
  // user-verified "Find in Providers" selections and are less likely to be stale/wrong
  const metaUrl = findComicVineUrlInMetadata(metadata);
  if (metaUrl) return metaUrl;

  // Priority 2: Stored provider data fields
  if (isRecord(comicvineData)) {
    const cvMetadata = isProviderMetadataRecord(comicvineData['metadata'])
      ? (comicvineData['metadata'] as Record<string, unknown>)
      : undefined;

    const storedUrl =
      (comicvineData['siteDetailUrl'] as string | undefined) ??
      (comicvineData['site_detail_url'] as string | undefined) ??
      (comicvineData['url'] as string | undefined) ??
      (cvMetadata?.['site_detail_url'] as string | undefined);

    if (storedUrl) return storedUrl;
  }

  // Priority 3: Construct URL from stored provider binding ID (e.g. "4050-49866")
  if (isRecord(comicvineData)) {
    const rawId = comicvineData['providerId'] ?? comicvineData['comicvineId'] ?? comicvineData['id'];
    if (rawId !== undefined && rawId !== null) {
      const idStr = String(rawId);
      const normalized = /^\d+-\d+$/.test(idStr) ? idStr : `4050-${idStr}`;
      return `https://comicvine.gamespot.com/volume/${normalized}/`;
    }
  }

  return undefined;
}

/** Search Metadata.externalLinks and urls arrays for a ComicVine URL. */
function findComicVineUrlInMetadata(metadata: unknown): string | undefined {
  if (!isRecord(metadata)) return undefined;
  for (const field of ['externalLinks', 'urls']) {
    const arr = metadata[field];
    if (!Array.isArray(arr)) continue;
    const found = arr.find(
      (url) => typeof url === 'string' && url.includes('comicvine.gamespot.com')
    ) as string | undefined;
    if (found) return found;
  }
  return undefined;
}

function filterVolumesToScrape(volumeUrls: VolumeUrl[], selectedVolumes: unknown): VolumeUrl[] {
  if (!Array.isArray(selectedVolumes) || selectedVolumes.length === 0) {
    return volumeUrls;
  }

  const volumeNumbers = selectedVolumes
    .map((v) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const match = v.match(/(\d+)$/);
        return match?.[1] ? parseInt(match[1], 10) : NaN;
      }
      return NaN;
    })
    .filter((n) => !isNaN(n));

  const selectedSet = new Set(volumeNumbers);
  return volumeUrls.filter((v) => selectedSet.has(v.volumeNumber));
}

function transformToEnrichedVolumes(
  volumesData: ComicVineVolumeChapters[],
  existingRawDataObj: Record<string, unknown>
): EnrichedVolume[] {
  return volumesData.map((vol, index) => {
    const volumeNumber = vol.volumeNumber;
    const volumeTitle = vol.volumeTitle;
    const subtitleMatch = typeof volumeTitle === 'string' ? volumeTitle.match(/#\d+:\s*(.+?)(?:\n|$)/) : null;
    const subtitle = subtitleMatch?.[1] ?? volumeTitle;
    const formattedTitle = subtitle ? `#${volumeNumber}: ${subtitle}` : `Issue #${volumeNumber}`;

    // Preserve wizard-imported chapter data if it exists
    const existingProviderMeta = safeGet(existingRawDataObj, 'providerMetadata');
    const existingComicVine = isRecord(existingProviderMeta) ? safeGet(existingProviderMeta, 'comicvine') : undefined;
    const existingVolumeDataArray = isRecord(existingComicVine) ? safeGet(existingComicVine, 'volumeData') : undefined;
    const existingVolumeData = Array.isArray(existingVolumeDataArray)
      ? (existingVolumeDataArray[index] as unknown)
      : undefined;
    const existingChapters = isRecord(existingVolumeData) ? safeGet(existingVolumeData, 'chapters') : undefined;
    const chaptersToUse = Array.isArray(existingChapters) && existingChapters.length > 0
      ? existingChapters
      : vol.chapters;

    if (Array.isArray(existingChapters) && existingChapters.length > 0) {
      logger.info(`[comicvine-volume-scraper] Preserving ${existingChapters.length} wizard chapters for volume ${volumeNumber}`);
    }

    return {
      volumeNumber,
      number: volumeNumber,
      title: formattedTitle,
      name: subtitle,
      coverImageUrl: vol.coverImage ?? '',
      description: vol.volumeSummary ?? '',
      releaseDate: '',
      publisher: '',
      chapters: chaptersToUse,
    };
  });
}

function parseRawProviderData(rawProviderData: unknown): Record<string, unknown> {
  if (!rawProviderData) return {};
  if (typeof rawProviderData === 'string') {
    const parsed: unknown = JSON.parse(rawProviderData);
    return isRecord(parsed) ? parsed : {};
  }
  return isRecord(rawProviderData) ? rawProviderData : {};
}

// ============================================================================
// Main Functions
// ============================================================================

export async function scrapeComicVineVolumes(
  prisma: PrismaClient,
  mangaId: number,
  providerMetadata: Record<string, unknown>,
  metadata: unknown
): Promise<ComicVineScraperResult | null> {
  const comicvineData = providerMetadata['comicvine'] ?? providerMetadata['comicvine_volumes'] ?? providerMetadata['comicvine_chapters'];
  const seriesUrl = extractSeriesUrl(comicvineData, metadata);

  if (!seriesUrl) {
    logger.warn(`[comicvine-volume-scraper] No ComicVine series URL found for manga ${mangaId}`);
    return null;
  }

  logger.info(`[comicvine-volume-scraper] Found series URL: ${seriesUrl}`);

  // Get all volume URLs from series page
  const volumeUrls = await comicVineScraper.scrapeSeriesVolumeUrls(seriesUrl);
  if (volumeUrls.length === 0) {
    logger.warn(`[comicvine-volume-scraper] No volume URLs found on series page`);
    return null;
  }

  logger.info(`[comicvine-volume-scraper] Found ${volumeUrls.length} volume URLs`);

  // Get existing raw data to determine which volumes to scrape
  const existingRawData = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { rawProviderData: true },
  });

  const existingRawDataObj = parseRawProviderData(existingRawData?.rawProviderData);
  const selectedVolumes = existingRawDataObj['selectedVolumes'];
  const volumesToScrape = filterVolumesToScrape(volumeUrls, selectedVolumes);

  if (Array.isArray(selectedVolumes) && selectedVolumes.length > 0) {
    logger.info(`[comicvine-volume-scraper] Filtering to ${volumesToScrape.length} selected volumes`);
  }

  // Scrape each volume for detailed chapter data
  logger.info(`[comicvine-volume-scraper] Scraping ${volumesToScrape.length} volumes for chapter details`);

  const scrapingPromises = volumesToScrape.map(async ({ url }) => {
    try {
      return await comicVineScraper.scrapeVolumeChapters(url);
    } catch (error: unknown) {
      logger.error(`[comicvine-volume-scraper] Failed to scrape volume ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  });

  const scrapedResults = await Promise.all(scrapingPromises);
  const volumesData = scrapedResults.filter((v): v is ComicVineVolumeChapters => v !== null);

  if (volumesData.length === 0) {
    logger.warn(`[comicvine-volume-scraper] No volumes were successfully scraped`);
    return null;
  }

  logger.info(`[comicvine-volume-scraper] Successfully scraped ${volumesData.length} of ${volumesToScrape.length} volumes`);

  // Build updated provider metadata
  const updatedProviderMetadata = {
    ...providerMetadata,
    comicvine: {
      ...(isRecord(comicvineData) ? comicvineData : {}),
      volumeData: volumesData,
      rawData: { issues: volumesData },
      metadata: { issues: volumesData },
      lastFetch: new Date().toISOString(),
    },
  };

  const enrichedVolumes = transformToEnrichedVolumes(volumesData, existingRawDataObj);
  const volumeCovers = enrichedVolumes
    .map((vol) => ({ volumeNumber: vol.volumeNumber, url: vol.coverImageUrl, volumeName: vol.title }))
    .filter((cover) => Boolean(cover.url));

  return { updatedProviderMetadata, enrichedVolumes, volumeCovers };
}

export async function saveComicVineScrapedData(
  prisma: PrismaClient,
  mangaId: number,
  result: ComicVineScraperResult
): Promise<void> {
  // Save updated provider metadata
  await prisma.manga.update({
    where: { id: mangaId },
    data: { providerMetadata: result.updatedProviderMetadata as unknown as Prisma.InputJsonValue },
  });

  logger.info(`[comicvine-volume-scraper] Updated providerMetadata with fresh ComicVine volume data`);

  // Get existing raw data for merging
  const existingRawData = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { rawProviderData: true },
  });

  const existingRawDataObj = parseRawProviderData(existingRawData?.rawProviderData);

  const updatedRawData = {
    ...existingRawDataObj,
    volumes: result.enrichedVolumes,
    volumeCovers: result.volumeCovers.length > 0 ? result.volumeCovers : (existingRawDataObj['volumeCovers'] ?? []),
    totalVolumes: result.enrichedVolumes.length,
    providerMetadata: result.updatedProviderMetadata,
  };

  await prisma.manga.update({
    where: { id: mangaId },
    data: { rawProviderData: updatedRawData as unknown as Prisma.InputJsonValue },
  });

  logger.info(`[comicvine-volume-scraper] Updated rawProviderData with ${result.enrichedVolumes.length} volumes and ${result.volumeCovers.length} covers`);
}
