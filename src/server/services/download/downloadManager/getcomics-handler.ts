/**
 * GetComics Download Handler
 *
 * Handles downloads from GetComics DDL (Direct Download Links).
 * Supports various file hosts like MediaFire, MEGA, etc.
 *
 * @module server/services/download/downloadManager/getcomics-handler
 */

import path from 'path';

import { getGetComicsService } from '@/server/services/getcomics';
import type { GetComicsDownloadLink } from '@/server/services/getcomics';
import { getReleaseBlocklistService, type ReleaseIdentifier } from '@/server/services/releaseBlocklistService';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { isMangaWithTitle } from './utils';

import type { DownloadPayload } from './types';
import type { PrismaClient } from '@prisma/client';
import type { Prisma, jobs } from '@prisma/client';

/**
 * GetComics download options
 */
export interface GetComicsDownloadOptions {
  /** URL to the GetComics detail page */
  detailPageUrl: string;
  /** Manga ID for tracking */
  mangaId: number;
  /** Chapter IDs being downloaded */
  chapterIds: number[];
  /** Destination directory */
  destinationPath: string;
  /** Progress callback */
  onProgress?: (progress: number) => void;
}

/**
 * Result of GetComics download operation
 */
export interface GetComicsDownloadResult {
  /** Download ID or reference */
  downloadId: string;
  /** File name downloaded */
  fileName: string;
  /** Selected download link */
  downloadLink: GetComicsDownloadLink;
  /** File host used */
  fileHost: string;
}

/**
 * Handle download from GetComics source
 *
 * This handler:
 * 1. Fetches the detail page to get download links
 * 2. Selects the best available download link
 * 3. Returns the DDL info for the user to manually download
 *    (Direct file downloads from hosts like MediaFire/MEGA require browser)
 */
export async function handleGetComicsDownload(
  prismaClient: PrismaClient,
  task: jobs & { manga: unknown },
  payload: DownloadPayload
): Promise<AsyncResult<GetComicsDownloadResult, Error>> {
  const blocklistService = getReleaseBlocklistService(prismaClient);
  const startTime = Date.now();

  try {
    // Validate required fields
    if (!payload.getcomicsUrl) {
      return createErrorResult(new Error('Missing GetComics detail page URL'));
    }

    logger.info(`[GetComics Handler] Processing download from: ${payload.getcomicsUrl}`);

    // Get the GetComics service
    const getcomicsService = getGetComicsService();

    // Fetch download links from detail page
    const detailResult = await getcomicsService.getDownloadLinks(payload.getcomicsUrl);

    if (!isSuccess(detailResult)) {
      const errorMessage = detailResult.status === 'error' ? detailResult.error.message : 'Unknown error';
      logger.error('[GetComics Handler] Failed to get download links', { error: errorMessage });
      return createErrorResult(new Error('Failed to get download links from GetComics'));
    }

    const detailPage = detailResult.data;

    if (detailPage.downloadLinks.length === 0) {
      logger.warn('[GetComics Handler] No download links found on page');
      return createErrorResult(new Error('No download links found on GetComics page'));
    }

    // Select the best download link (sorted by preference in getcomicsService)
    const selectedLink = detailPage.downloadLinks[0];
    if (!selectedLink) {
      return createErrorResult(new Error('No download link available'));
    }

    logger.info(`[GetComics Handler] Selected download link:`, {
      host: selectedLink.host,
      label: selectedLink.label,
      url: selectedLink.url.substring(0, 50) + '...',
    });

    // Check blocklist
    const releaseIdentifier: ReleaseIdentifier = {
      releaseTitle: detailPage.title,
      ...(task.manga_id !== null ? { mangaId: task.manga_id } : {}),
      source: 'getcomics',
    };

    const blocklistCheck = await blocklistService.checkRelease(releaseIdentifier);
    if (isSuccess(blocklistCheck) && blocklistCheck.data.isBlocked) {
      logger.warn(`[GetComics Handler] Download blocked by blocklist: ${detailPage.title}`, {
        reason: blocklistCheck.data.reason,
      });

      await blocklistService.recordDownloadAttempt(
        releaseIdentifier,
        false,
        `Blocked: ${blocklistCheck.data.reason}`
      );

      return createErrorResult(
        new Error(`Release blocked: ${blocklistCheck.data.reason}`)
      );
    }

    // Generate a download ID
    const downloadId = `getcomics-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Store download info in job result
    const mangaTitle = isMangaWithTitle(task.manga) ? task.manga.title : 'unknown';
    await prismaClient.jobs.update({
      where: {
        id_partition_key: {
          id: task.id,
          partition_key: task.partition_key,
        },
      },
      data: {
        result: {
          downloadId,
          clientType: 'getcomics',
          startTime,
          releaseTitle: detailPage.title,
          indexer: 'getcomics',
          mode: payload.mode,
          fileHost: selectedLink.host,
          downloadUrl: selectedLink.url,
          allLinks: detailPage.downloadLinks.slice(0, 5).map((l) => ({
            host: l.host,
            label: l.label,
            url: l.url,
          })),
        } as Prisma.InputJsonValue,
      },
    });

    // Update chapters with download info - use DOWNLOADING as AWAITING_DDL is not a valid enum value
    if (task.manga_id !== null && payload.chapterIds.length > 0) {
      await prismaClient.chapter.updateMany({
        where: {
          id: { in: payload.chapterIds },
          mangaId: task.manga_id,
        },
        data: {
          downloadStatus: 'DOWNLOADING',
          downloadUrl: selectedLink.url,
        },
      });
    }

    // Record successful attempt
    await blocklistService.recordDownloadAttempt(releaseIdentifier, true, undefined, {
      downloadTime: (Date.now() - startTime) / 1000,
    });

    logger.info(`[GetComics Handler] Download prepared successfully`, {
      downloadId,
      title: detailPage.title,
      host: selectedLink.host,
      manga: mangaTitle,
    });

    return createSuccessResult({
      downloadId,
      fileName: `${detailPage.title}.cbr`,
      downloadLink: selectedLink,
      fileHost: selectedLink.host,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[GetComics Handler] Download failed', { error: errorMessage });
    return createErrorResult(new Error(`GetComics download failed: ${errorMessage}`));
  }
}

/**
 * Get alternative download links for a GetComics page
 *
 * Used when the primary link fails or user wants to try another host.
 */
export async function getAlternativeLinks(
  detailPageUrl: string
): Promise<AsyncResult<GetComicsDownloadLink[], Error>> {
  try {
    const getcomicsService = getGetComicsService();
    const detailResult = await getcomicsService.getDownloadLinks(detailPageUrl);

    if (!isSuccess(detailResult)) {
      return createErrorResult(new Error('Failed to get download links'));
    }

    // Return all links except the first one (which is primary)
    return createSuccessResult(detailResult.data.downloadLinks.slice(1));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return createErrorResult(new Error(errorMessage));
  }
}

/**
 * Generate destination path for GetComics downloads
 */
export function generateDestinationPath(
  baseDir: string,
  mangaTitle: string,
  comicTitle: string
): string {
  // Sanitize titles for filesystem
  const sanitize = (str: string): string =>
    str.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);

  return path.join(baseDir, sanitize(mangaTitle), sanitize(comicTitle));
}
