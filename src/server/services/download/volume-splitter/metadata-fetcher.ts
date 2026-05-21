/**
 * Volume Metadata Fetcher
 *
 * Fetches chapter and volume metadata from database for validation.
 *
 * Extracted from: volumeSplitter.ts (lines 140-192)
 */

import { logger } from '@/utils/logger';

import type { ChapterMetadata, VolumeMetadata } from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Fetch volume and chapter metadata from database for validation
 *
 * @param prismaClient - Prisma client instance
 * @param mangaId - Manga ID
 * @param volumeNumber - Volume number
 * @returns Volume metadata if available
 */
export async function fetchVolumeMetadata(
  prismaClient: PrismaClient,
  mangaId: number,
  volumeNumber: number
): Promise<VolumeMetadata | null> {
  try {
    // Get all chapters for this volume
    const chapters = await prismaClient.chapter.findMany({
      where: {
        mangaId,
        volume: volumeNumber
      },
      select: {
        chapterNumber: true,
        pages: true,
        title: true
      },
      orderBy: {
        chapterNumber: 'asc'
      }
    });

    if (chapters.length === 0) {
      logger.debug(`[VolumeSplitter] No metadata found for volume ${volumeNumber}`);
      return null;
    }

    const chapterMetadata: ChapterMetadata[] = chapters.map(ch => {
      const metadata: ChapterMetadata = {
        chapterNumber: ch.chapterNumber ?? 0
      };
      if (ch.pages !== null) {
        metadata.expectedPageCount = ch.pages;
      }
      // ✅ FIXED: Remove unnecessary null check
      if (ch.title) {
        metadata.title = ch.title;
      }
      return metadata;
    });

    const totalPages = chapters.reduce((sum, ch) => sum + (ch.pages ?? 0), 0);

    logger.info(`[VolumeSplitter] Found metadata: ${chapters.length} chapters, ${totalPages} pages`);

    const result: VolumeMetadata = {
      volumeNumber,
      chapters: chapterMetadata
    };
    if (totalPages > 0) {
      result.totalPages = totalPages;
    }
    return result;
  } catch (error) {
    logger.warn(`[VolumeSplitter] Failed to fetch volume metadata:`, error);
    return null;
  }
}