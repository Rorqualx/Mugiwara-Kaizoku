/**
 * Raw Provider Data Service
 *
 * Handles updating rawProviderData with enriched volume/chapter information
 * from provider metadata.
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


/**
 * Update rawProviderData with enriched volume data from providerMetadata
 */
export async function updateRawProviderData(
  mangaId: number,
  volumeSource: string
): Promise<AsyncResult<void, Error>> {
  try {
    logger.info(`[refreshMetadata] Updating rawProviderData for manga ${mangaId}`);

    const updatedManga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: {
        providerMetadata: true,
        rawProviderData: true
      }
    });

    if (!updatedManga?.providerMetadata) {
      logger.warn('No provider metadata found for rawProviderData update');
      return createSuccessResult(undefined);
    }

    const providerMetadata = parseProviderMetadata(updatedManga.providerMetadata);
    const existingRawData = parseRawProviderData(updatedManga.rawProviderData);

    logger.info(`[refreshMetadata] Using volume source: ${volumeSource}`);

    const { enrichedVolumes, volumeCovers } = extractVolumeData(providerMetadata, volumeSource);

    if (enrichedVolumes.length > 0) {
      await saveRawProviderData(mangaId, existingRawData, enrichedVolumes, volumeCovers, providerMetadata);
      logger.info(
        `[refreshMetadata] Updated rawProviderData with ${enrichedVolumes.length} volumes and ${volumeCovers.length} covers`
      );
    } else {
      logger.warn(
        `[refreshMetadata] No enriched volume data found in provider metadata for ${volumeSource}`
      );
    }

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error updating rawProviderData: ${errorMessage}`);
    return createErrorResult(new Error(`RawProviderData update failed: ${errorMessage}`));
  }
}

/**
 * Parse provider metadata from unknown type
 */
function parseProviderMetadata(providerMetadata: unknown): Record<string, unknown> {
  if (typeof providerMetadata === 'string') {
    return JSON.parse(providerMetadata) as Record<string, unknown>;
  }
  return providerMetadata as Record<string, unknown>;
}

/**
 * Parse raw provider data from unknown type
 */
function parseRawProviderData(rawProviderData: unknown): Record<string, unknown> {
  if (!rawProviderData) {
    return {};
  }
  if (typeof rawProviderData === 'string') {
    return JSON.parse(rawProviderData) as Record<string, unknown>;
  }
  return rawProviderData as Record<string, unknown>;
}

/**
 * Extract enriched volume data and covers from provider metadata
 */
function extractVolumeData(
  providerMetadata: Record<string, unknown>,
  volumeSource: string
): {
  enrichedVolumes: unknown[];
  volumeCovers: Array<{ volumeNumber: unknown; url: unknown; volumeName: unknown }>;
} {
  const providerData =
    providerMetadata[volumeSource] ?? providerMetadata[`${volumeSource}_volumes`];

  if (!providerData || typeof providerData !== 'object') {
    return { enrichedVolumes: [], volumeCovers: [] };
  }

  const providerDataObj = providerData as Record<string, unknown>;

  // Try standard volume data first
  const volumeData =
    providerDataObj['volumeData'] ??
    providerDataObj['volumes'] ??
    (providerDataObj['Metadata'] as Record<string, unknown> | undefined)?.['volumeDetails'] ??
    (providerDataObj['Metadata'] as Record<string, unknown> | undefined)?.['volumes'];

  if (Array.isArray(volumeData)) {
    logger.info(`[refreshMetadata] Found ${volumeData.length} volumes from ${volumeSource}`);
    return extractVolumesAndCovers(volumeData);
  }

  // Try ComicVine issues data
  const issuesData =
    (providerDataObj['rawData'] as Record<string, unknown> | undefined)?.['issues'] ??
    (providerDataObj['Metadata'] as Record<string, unknown> | undefined)?.['issues'] ??
    providerDataObj['issues'];

  if (Array.isArray(issuesData) && issuesData.length > 0) {
    logger.info(`[refreshMetadata] Found ${issuesData.length} issues from ${volumeSource}`);
    return extractComicVineIssues(issuesData);
  }

  return { enrichedVolumes: [], volumeCovers: [] };
}

/**
 * Extract volumes and covers from standard volume data
 */
function extractVolumesAndCovers(
  volumeData: unknown[]
): {
  enrichedVolumes: unknown[];
  volumeCovers: Array<{ volumeNumber: unknown; url: unknown; volumeName: unknown }>;
} {
  const enrichedVolumes = volumeData;

  const volumeCovers = volumeData
    .map((vol: unknown) => {
      const volObj = vol as Record<string, unknown>;
      return {
        volumeNumber: volObj['volumeNumber'] ?? volObj['number'],
        url: volObj['coverImageUrl'] ?? volObj['coverUrl'] ?? volObj['cover'],
        volumeName: volObj['title'] ?? volObj['name']
      };
    })
    .filter((cover) => Boolean(cover.url));

  return { enrichedVolumes, volumeCovers };
}

/**
 * Extract ComicVine issues and map to volume structure
 */
function extractComicVineIssues(
  issuesData: unknown[]
): {
  enrichedVolumes: unknown[];
  volumeCovers: Array<{ volumeNumber: unknown; url: unknown; volumeName: unknown }>;
} {
  const enrichedVolumes = issuesData.map((issue: unknown, index: number) => {
    const issueObj = issue as Record<string, unknown>;
    const imageObj = issueObj['image'] as Record<string, unknown> | undefined;
    const publisherObj = issueObj['publisher'] as Record<string, unknown> | undefined;

    const issueName = issueObj['name'] ?? issueObj['title'];
    const issueNumber = issueObj['issue_number'] ?? index + 1;

    const formattedTitle = issueName ? `#${issueNumber}: ${issueName}` : `Issue #${issueNumber}`;

    return {
      volumeNumber: issueObj['volumeNumber'] ?? issueObj['issueNumber'] ?? index + 1,
      number: issueObj['volumeNumber'] ?? issueObj['issueNumber'] ?? index + 1,
      title: formattedTitle,
      name: issueName,
      coverImageUrl: imageObj?.['medium_url'] ?? imageObj?.['small_url'],
      description: issueObj['description'],
      releaseDate: issueObj['cover_date'] ?? issueObj['store_date'],
      publisher: publisherObj?.['name'],
      chapters: issueObj['chapters'] ?? []
    };
  });

  const volumeCovers = enrichedVolumes
    .map((vol) => {
      const volObj = vol as Record<string, unknown>;
      return {
        volumeNumber: volObj['volumeNumber'],
        url: volObj['coverImageUrl'],
        volumeName: volObj['title']
      };
    })
    .filter((cover) => Boolean(cover.url));

  return { enrichedVolumes, volumeCovers };
}

/**
 * Save updated rawProviderData to database
 */
async function saveRawProviderData(
  mangaId: number,
  existingRawData: Record<string, unknown>,
  enrichedVolumes: unknown[],
  volumeCovers: Array<{ volumeNumber: unknown; url: unknown; volumeName: unknown }>,
  providerMetadata: Record<string, unknown>
): Promise<void> {
  const updatedRawData: Record<string, unknown> = {
    ...existingRawData,
    volumes: enrichedVolumes,
    volumeCovers: volumeCovers.length > 0 ? volumeCovers : existingRawData['volumeCovers'] ?? [],
    totalVolumes: enrichedVolumes.length,
    providerMetadata: providerMetadata
  };

  await prisma.manga.update({
    where: { id: mangaId },
    data: {
      rawProviderData: updatedRawData as Prisma.InputJsonValue
    }
  });
}
