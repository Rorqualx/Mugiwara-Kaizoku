/**
 * Fandom Refresh Service
 *
 * Handles Fandom-specific metadata refresh operations including chapter cover scraping
 * and volume data enrichment.
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


/**
 * Scrape Fandom chapter and volume covers and update provider metadata
 */
export async function scrapeFandomChaptersAndVolumes(
  mangaId: number,
  wikiSubdomain: string,
  mangaTitle: string,
  providerMetadata: unknown
): Promise<AsyncResult<void, Error>> {
  try {
    const { chapterDetailService } = await import('../fandom/chapter-detail');
    const { FandomService } = await import('../../services/fandom/FandomService');
    const fandomService = new FandomService(wikiSubdomain);

    const mangaInfo = await fandomService.getMangaInfo(mangaTitle);

    if (!mangaInfo) {
      logger.warn(`[refreshMetadata] No manga info found for ${mangaTitle}`);
      return createSuccessResult(undefined);
    }

    const chaptersWithCovers = await fetchChapterCovers(
      { chapters: mangaInfo.chapterList },
      chapterDetailService
    );
    const volumesWithCovers = await fetchVolumeCovers(
      { volumes: mangaInfo.volumeList },
      chapterDetailService
    );

    if (chaptersWithCovers.length > 0 || volumesWithCovers.length > 0) {
      await updateFandomProviderMetadata(
        mangaId,
        providerMetadata,
        chaptersWithCovers,
        volumesWithCovers
      );

      logger.info(
        `[refreshMetadata] Updated providerMetadata with fresh Fandom data (${chaptersWithCovers.length} chapters, ${volumesWithCovers.length} volumes)`
      );
    }

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to scrape Fandom chapters: ${errorMessage}`);
    return createErrorResult(new Error(`Fandom scraping failed: ${errorMessage}`));
  }
}

/**
 * Fetch cover images for chapters
 */
async function fetchChapterCovers(
  mangaInfo: { chapters?: Array<{ url?: string; title?: string; number?: string | number }> | undefined },
  chapterDetailService: { fetchChapterDetails: (url: string) => Promise<{ coverImageUrl?: string } | null> }
): Promise<unknown[]> {
  if (!mangaInfo.chapters || !Array.isArray(mangaInfo.chapters)) {
    return [];
  }

  logger.info(`[refreshMetadata] Found ${mangaInfo.chapters.length} chapters in Fandom`);

  const chaptersWithCovers = await Promise.all(
    mangaInfo.chapters.map(async (chapter) => {
      if (!chapter.url) {
        return chapter;
      }

      try {
        const chapterDetails = await chapterDetailService.fetchChapterDetails(chapter.url);

        if (chapterDetails) {
          return {
            ...chapter,
            coverUrl: chapterDetails.coverImageUrl ?? undefined,
            coverImage: chapterDetails.coverImageUrl ?? undefined
          };
        }
        return chapter;
      } catch (chapterError: unknown) {
        logger.warn(
          `[refreshMetadata] Failed to get cover for chapter ${chapter.number ?? chapter.title}`,
          {
            error: chapterError instanceof Error ? chapterError.message : String(chapterError)
          }
        );
        return chapter;
      }
    })
  );

  const coverCount = chaptersWithCovers.filter(
    (c: unknown): c is { url?: string; title?: string; number?: string | number; coverUrl?: string; coverImage?: string } =>
      typeof c === 'object' && c !== null && ('coverUrl' in c || 'coverImage' in c)
  ).length;
  logger.info(`[refreshMetadata] Successfully fetched ${coverCount} chapter covers from Fandom`);

  return chaptersWithCovers;
}

/**
 * Fetch cover images for volumes
 */
async function fetchVolumeCovers(
  mangaInfo: { volumes?: Array<{ url?: string; title?: string; number?: string | number }> | undefined },
  chapterDetailService: { fetchChapterDetails: (url: string) => Promise<{ coverImageUrl?: string } | null> }
): Promise<unknown[]> {
  if (!mangaInfo.volumes || !Array.isArray(mangaInfo.volumes)) {
    return [];
  }

  logger.info(`[refreshMetadata] Found ${mangaInfo.volumes.length} volumes in Fandom`);

  const volumesWithCovers = await Promise.all(
    mangaInfo.volumes.map(async (volume) => {
      if (!volume.url) {
        return volume;
      }

      try {
        const volumeDetails = await chapterDetailService.fetchChapterDetails(volume.url);

        if (volumeDetails) {
          return {
            ...volume,
            coverUrl: volumeDetails.coverImageUrl ?? undefined,
            coverImage: volumeDetails.coverImageUrl ?? undefined
          };
        }
        return volume;
      } catch (volumeError: unknown) {
        logger.warn(
          `[refreshMetadata] Failed to get cover for volume ${volume.number ?? volume.title}`,
          {
            error: volumeError instanceof Error ? volumeError.message : String(volumeError)
          }
        );
        return volume;
      }
    })
  );

  const coverCount = volumesWithCovers.filter(
    (v: unknown): v is { url?: string; title?: string; number?: string | number; coverUrl?: string; coverImage?: string } =>
      typeof v === 'object' && v !== null && ('coverUrl' in v || 'coverImage' in v)
  ).length;
  logger.info(`[refreshMetadata] Successfully fetched ${coverCount} volume covers from Fandom`);

  return volumesWithCovers;
}

/**
 * Update provider metadata with enriched Fandom data
 */
async function updateFandomProviderMetadata(
  mangaId: number,
  providerMetadata: unknown,
  chaptersWithCovers: unknown[],
  volumesWithCovers: unknown[]
): Promise<void> {
  const providerMetadataObj = providerMetadata as Record<string, unknown>;
  const fandomData =
    providerMetadataObj['fandom'] ?? providerMetadataObj['fandom_chapters'] ?? {};

  const updatedProviderMetadata: Record<string, unknown> = {
    ...providerMetadataObj,
    fandom: {
      ...(fandomData as Record<string, unknown>),
      ...(chaptersWithCovers.length > 0 && {
        chapters: chaptersWithCovers,
        chapterData: chaptersWithCovers
      }),
      ...(volumesWithCovers.length > 0 && {
        volumes: volumesWithCovers,
        volumeData: volumesWithCovers
      }),
      lastFetch: new Date().toISOString()
    }
  };

  await prisma.manga.update({
    where: { id: mangaId },
    data: {
      providerMetadata: updatedProviderMetadata as Prisma.InputJsonValue
    }
  });

  // Emit WebSocket event for real-time UI sync
  void realtimeEmitter.emitMangaUpdate({
    mangaId,
    action: 'updated',
    data: {
      fandomDataScraped: true,
      chaptersCount: chaptersWithCovers.length,
      volumesCount: volumesWithCovers.length,
      source: 'fandom-scraper'
    }
  });
}
