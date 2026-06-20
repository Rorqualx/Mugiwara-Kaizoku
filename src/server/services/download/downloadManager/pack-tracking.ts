/**
 * Pack Download Tracking
 *
 * Detects and tracks multi-volume/chapter pack downloads.
 */

import { getJobOwnerUserId } from '@/server/queue/job-owner';
import { parseVolumeRange } from '@/server/utils/volumeRangeParser';
import { logger } from '@/utils/logger';

import type { PackDownloadParams } from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Detect if a download is a pack (multi-volume or covers multiple chapters)
 */
export async function isPackDownload(
    prismaClient: PrismaClient,
    releaseTitle: string,
    chapterIds: number[],
    mangaId: number
): Promise<boolean> {
    // Check if release title indicates volume range
    const volumeRange = parseVolumeRange(releaseTitle);

    if (volumeRange !== null && !volumeRange.isSingleVolume) {
        logger.info(
            `[PackTracking] Detected multi-volume pack: ${releaseTitle} (v${volumeRange.start}-v${volumeRange.end})`
        );
        return true;
    }

    // Check if multiple chapters from different volumes are being downloaded
    if (chapterIds.length > 1) {
        const chapters = await prismaClient.chapter.findMany({
            where: {
                id: { in: chapterIds },
                mangaId
            },
            select: {
                volume: true
            }
        });

        const uniqueVolumes = new Set(chapters.map((ch) => ch.volume).filter((v) => v !== null));
        if (uniqueVolumes.size > 1) {
            logger.info(`[PackTracking] Detected pack spanning ${uniqueVolumes.size} volumes`);
            return true;
        }
    }

    return false;
}

/**
 * Create pack download record and link chapters
 *
 * FIX: Uses PackDownloadParams object instead of 9 individual parameters
 */
export async function trackPackDownload(
    prismaClient: PrismaClient,
    params: PackDownloadParams
): Promise<void> {
    try {
        const {
            releaseTitle,
            mangaId,
            jobId,
            downloadId,
            clientType,
            indexer,
            protocol,
            chapterIds,
            fileSize,
            downloadUrl
        } = params;

        // Parse volume range from release title
        const volumeRange = parseVolumeRange(releaseTitle);

        // Inherit ownership from the initiating job when not explicitly passed,
        // so the row is scoped to the user who triggered the download.
        const initiatedByUserId = params.initiatedByUserId ?? await getJobOwnerUserId(jobId);

        // Create PackDownload record
        const packDownloadResult = await prismaClient.packDownload.create({
            data: {
                releaseTitle,
                mangaId,
                jobId: BigInt(jobId),
                downloadId,
                clientType,
                indexer,
                protocol,
                volumeStart: volumeRange !== null ? volumeRange.start : null,
                volumeEnd: volumeRange !== null ? volumeRange.end : null,
                fileSize: fileSize !== undefined ? BigInt(fileSize) : null,
                downloadUrl: downloadUrl ?? null,
                initiatedByUserId,
                status: 'DOWNLOADING'
            }
        });

        logger.info(
            `[PackTracking] Created PackDownload record #${packDownloadResult.id} for "${releaseTitle}"`
        );

        // Link chapters to this pack download
        await prismaClient.chapter.updateMany({
            where: {
                id: { in: chapterIds },
                mangaId
            },
            data: {
                packDownloadId: packDownloadResult.id
            }
        });

        logger.info(
            `[PackTracking] Linked ${chapterIds.length} chapters to PackDownload #${packDownloadResult.id}`
        );
    } catch (error: unknown) {
        logger.error(`[PackTracking] Failed to track pack download:`, error);
        // Don't throw - we don't want to fail the download if pack tracking fails
    }
}
