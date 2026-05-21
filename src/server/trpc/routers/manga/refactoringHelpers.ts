/**
 * Refactoring Helpers for manga.ts lines 2177-2448
 * Extracted to reduce complexity and max-depth violations
 *
 * Agent M-9 Refactoring - Lines 2177-2448
 */

import { prisma } from '@/server/db';
import type { ProviderData } from '@/types/api/manga-router-types';
import { isProviderMetadataRecord } from '@/types/api/manga-router-types';
import { logger } from '@/utils/logger';

import type { Prisma } from '@prisma/client';

// Re-export helper functions from main file for use in helpers
function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Helper: Extract field value from provider metadata
 * Reduces nesting in main logic
 */
export function getFieldValueFromProvider(
  providerData: Record<string, unknown>,
  field: string
): unknown {
  // Try to get the field value directly
  let fieldValue = providerData[field];

  // Also check nested metadata object if exists
  const providerDataTyped = providerData as ProviderData;
  if (!fieldValue && providerDataTyped.metadata && isRecord(providerDataTyped.metadata)) {
    fieldValue = (providerDataTyped.metadata as Record<string, unknown>)[field];
  }

  return fieldValue;
}

/**
 * Helper: Preserve field-level provider selections from import
 * Extracts complex nested logic into a focused function
 */
export async function preserveFieldLevelProviderSelections(
  ctx: { prisma: typeof prisma },
  id: number,
  selectedFields: Record<string, string>,
  providerMetadata: Record<string, unknown>
): Promise<void> {
  if (Object.keys(selectedFields).length === 0) {
    return;
  }

  logger.info('[refreshMetaData] Found field-level provider selections:', selectedFields);

  // Get current metadata after enrichment
  const currentManga = await ctx.prisma.manga.findUnique({
    where: { id },
    select: { Metadata: true }
  });

  const currentMetadata: unknown = currentManga?.["Metadata"]
    ? (typeof currentManga["Metadata"] === 'string' ? JSON.parse(currentManga["Metadata"]) : currentManga["Metadata"])
    : {};
  const currentMetadataRecord = isRecord(currentMetadata) ? currentMetadata : {};

  // Preserve specific field values from their selected providers
  // Exclude relation fields (id, createdAt, updatedAt, manga) that can't be updated directly
  const { id: _id2, createdAt: _createdAt2, updatedAt: _updatedAt2, manga: _manga2, ...MetadataFields2 } = currentMetadataRecord;
  const preservedMetadata: Record<string, unknown> = {
    ...MetadataFields2
  };

  // For each field with a specific provider selection, try to preserve its value
  for (const [field, provider] of Object.entries(selectedFields)) {
    if (!provider || typeof provider !== 'string') {
      continue;
    }

    const providerKey = provider.toLowerCase();
    const providerData = safeGet(providerMetadata, providerKey);

    if (!providerData || !isRecord(providerData)) {
      continue;
    }

    const fieldValue = getFieldValueFromProvider(providerData, field);

    // If we found the field value, preserve it
    if (fieldValue !== undefined && fieldValue !== null) {
      preservedMetadata[field] = fieldValue;
      logger.info(`[refreshMetaData] Preserved '${field}' from ${provider} provider`);
    }
  }

  // Update metadata with preserved field selections
  if (Object.keys(preservedMetadata).length > Object.keys(currentMetadataRecord).length) {
    await ctx.prisma.manga.update({
      where: { id },
      data: {
        Metadata: {
          upsert: {
            create: preservedMetadata as Prisma.MetadataCreateInput,
            update: preservedMetadata as Prisma.MetadataUpdateInput
          }
        }
      }
    });

    logger.info('[refreshMetaData] Successfully preserved field-level provider selections');
  }
}

/**
 * Helper: Find ComicVine series URL from metadata
 * Reduces complexity by extracting URL discovery logic
 */
export function findComicVineSeriesUrl(
  comicvineData: Record<string, unknown> | undefined,
  refreshedManga: { Metadata: unknown } | undefined | null
): string | undefined {
  if (!comicvineData || typeof comicvineData !== 'object') {
    return undefined;
  }

  const cvDataObj = comicvineData as Record<string, unknown>;
  // Check for series URL in various locations
  // Note: ComicVine uses camelCase siteDetailUrl, not snake_case site_detail_url
  const cvMetadata = isProviderMetadataRecord(cvDataObj['metadata']) ? cvDataObj['metadata'] as Record<string, unknown> : undefined;
  const seriesUrl = cvDataObj["siteDetailUrl"] as string | undefined
    ?? cvDataObj["site_detail_url"] as string | undefined
    ?? cvDataObj["url"] as string | undefined
    ?? cvMetadata?.["site_detail_url"] as string | undefined;

  // Also check metadata.urls array if not found
  if (seriesUrl) {
    return seriesUrl;
  }

  if (!refreshedManga?.["Metadata"]) {
    return undefined;
  }

  const metadataUrls = (refreshedManga["Metadata"] as Record<string, unknown>)["urls"];
  if (!Array.isArray(metadataUrls)) {
    return undefined;
  }

  return metadataUrls.find(url =>
    typeof url === 'string' && url.includes('comicvine.gamespot.com')
  ) as string | undefined;
}

/**
 * Helper: Filter volume URLs to only selected volumes
 * Reduces nesting by extracting volume filtering logic
 */
export function filterSelectedVolumes(
  volumeUrls: Array<{ url: string; volumeNumber: number }>,
  selectedVolumes: unknown
): Array<{ url: string; volumeNumber: number }> {
  if (!selectedVolumes || !Array.isArray(selectedVolumes) || selectedVolumes.length === 0) {
    return volumeUrls;
  }

  // Extract volume numbers from selectedVolumes (format: "comicvine-1", "comicvine-2", etc.)
  const selectedSet = new Set(
    selectedVolumes
      .map(v => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
          // Try to extract number from "provider-X" format
          const match = v.match(/(\d+)$/);
          return match?.[1] ? parseInt(match[1], 10) : NaN;
        }
        return NaN;
      })
      .filter(n => !isNaN(n))
  );

  const filtered = volumeUrls.filter(v => selectedSet.has(v.volumeNumber));
  logger.info(`[refreshMetaData] Filtering to ${filtered.length} selected volumes (from ${selectedVolumes.length} selections)`);

  return filtered;
}

/**
 * Helper: Scrape ComicVine volumes
 * Reduces max-depth violations by extracting complex scraping logic
 */
export async function scrapeComicVineVolumes(
  comicVineScraper: { scrapeVolumeChapters: (url: string) => Promise<unknown> },
  volumesToScrape: Array<{ url: string; volumeNumber: number }>
): Promise<unknown[]> {
  logger.info(`[refreshMetaData] Scraping ${volumesToScrape.length} volumes for chapter details`);

  const scrapingPromises = volumesToScrape.map(async ({ url }) => {
    try {
      return await comicVineScraper.scrapeVolumeChapters(url);
    } catch (error: unknown) {
      logger.error(`[refreshMetaData] Failed to scrape volume ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  });

  const scrapedResults = await Promise.all(scrapingPromises);
  return scrapedResults.filter(v => v !== null);
}

/**
 * Helper: Parse and extract current provider metadata
 * Reduces complexity by isolating metadata parsing logic
 */
function parseCurrentProviderMetadata(
  refreshedManga: { providerMetadata: unknown } | null
): Record<string, unknown> {
  if (!refreshedManga?.providerMetadata) {
    return {};
  }

  const parsed: unknown = typeof refreshedManga.providerMetadata === 'string'
    ? JSON.parse(refreshedManga.providerMetadata)
    : refreshedManga.providerMetadata;
  return isRecord(parsed) ? parsed : {};
}

/**
 * Helper: Build updated provider metadata with volume data
 * Extracts metadata building logic to reduce function length
 */
async function buildAndSaveProviderMetadata(
  ctx: { prisma: typeof prisma },
  id: number,
  currentProviderMetadata: Record<string, unknown>,
  comicvineData: Record<string, unknown>,
  volumesData: unknown[]
): Promise<Record<string, unknown>> {
  const updatedProviderMetadata = {
    ...currentProviderMetadata,
    comicvine: {
      ...comicvineData,
      volumeData: volumesData,
      rawData: {
        issues: volumesData
      },
      metadata: {
        issues: volumesData
      },
      lastFetch: new Date().toISOString()
    }
  };

  await ctx.prisma.manga.update({
    where: { id },
    data: {
      providerMetadata: updatedProviderMetadata as unknown as Prisma.InputJsonValue
    }
  });

  logger.info(`[refreshMetaData] Updated providerMetadata with fresh ComicVine volume data`);
  return updatedProviderMetadata;
}

/**
 * Helper: Enrich ComicVine volume data
 * Main orchestrator for ComicVine enrichment - reduces max-depth violations
 */
export async function enrichComicVineVolumeData(
  ctx: { prisma: typeof prisma },
  id: number,
  providerMetadata: Record<string, unknown>,
  refreshedManga: { providerMetadata: unknown; Metadata: unknown } | null
): Promise<Record<string, unknown>> {
  const currentProviderMetadata = parseCurrentProviderMetadata(refreshedManga);
  if (Object.keys(currentProviderMetadata).length === 0) {
    return providerMetadata;
  }

  // Try to find series URL or volume URLs in provider metadata
  const comicvineData = (currentProviderMetadata as Record<string, unknown>)["comicvine"]
    ?? (currentProviderMetadata as Record<string, unknown>)["comicvine_volumes"]
    ?? (currentProviderMetadata as Record<string, unknown>)["comicvine_chapters"];

  const seriesUrl = findComicVineSeriesUrl(
    comicvineData as Record<string, unknown> | undefined,
    refreshedManga
  );

  if (!seriesUrl) {
    return currentProviderMetadata;
  }

  logger.info(`[refreshMetaData] Found ComicVine series URL: ${seriesUrl}`);

  try {
    // Import the scraping service
    const { comicVineScraper } = await import('../../../services/comicvine/scrapingService');

    // STEP 1: Get all volume URLs from series page (fast, proven to work)
    logger.info(`[refreshMetaData] Fetching volume URLs from ComicVine series`);
    const volumeUrls = await comicVineScraper.scrapeSeriesVolumeUrls(seriesUrl);

    if (volumeUrls.length === 0) {
      return currentProviderMetadata;
    }

    logger.info(`[refreshMetaData] Found ${volumeUrls.length} volume URLs`);

    // STEP 2: Determine which volumes to scrape
    const existingRawData = await ctx.prisma.manga.findUnique({
      where: { id },
      select: { rawProviderData: true }
    });

    const existingRawDataObj: unknown = existingRawData?.rawProviderData
      ? (typeof existingRawData.rawProviderData === 'string'
          ? JSON.parse(existingRawData.rawProviderData)
          : existingRawData.rawProviderData)
      : {};
    const existingRawDataRecord = isRecord(existingRawDataObj) ? existingRawDataObj : {};

    const selectedVolumes = safeGet(existingRawDataRecord, 'selectedVolumes');
    const volumesToScrape = filterSelectedVolumes(volumeUrls, selectedVolumes);

    // STEP 3: Scrape each volume for detailed chapter data
    const volumesData = await scrapeComicVineVolumes(comicVineScraper, volumesToScrape);

    if (volumesData.length === 0) {
      return currentProviderMetadata;
    }

    logger.info(`[refreshMetaData] Successfully scraped ${volumesData.length} of ${volumesToScrape.length} volumes from ComicVine`);

    // STEP 4: Update and save provider metadata
    return await buildAndSaveProviderMetadata(
      ctx,
      id,
      currentProviderMetadata,
      comicvineData as Record<string, unknown>,
      volumesData
    );
  } catch (error: unknown) {
    logger.error(`[refreshMetaData] Error scraping ComicVine volumes: ${error instanceof Error ? error.message : String(error)}`);
    return currentProviderMetadata;
  }
}
