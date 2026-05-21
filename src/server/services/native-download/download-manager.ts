/**
 * Native Download Manager Module
 *
 * Handles download operations, monitoring, and control.
 *
 * Responsibilities:
 * - Execute chapter downloads
 * - Monitor active downloads
 * - Manage download lifecycle (cancel, retry)
 * - Update download status
 */


import { NativeDownloadStatus } from '@prisma/client';

import { createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { nativeDownloadNotifications } from './notifications';

import type { ActiveDownload } from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Download Manager
 *
 * Manages download operations for native download sources.
 * Handles download lifecycle, progress tracking, and status updates.
 */
export class DownloadManager {
    private prisma: PrismaClient;
    private adaptersGetter: () => Map<string, unknown>;

    constructor(prisma: PrismaClient, adaptersGetter: () => Map<string, unknown>) {
        this.prisma = prisma;
        this.adaptersGetter = adaptersGetter;
    }

    /**
     * Download a chapter
     *
     * Executes download for a specific chapter from a source.
     * Updates progress and status throughout the download lifecycle.
     *
     * @param sourceId - Source adapter ID
     * @param mangaId - Manga identifier
     * @param chapterId - Chapter identifier
     * @param downloadId - Download record ID
     * @returns AsyncResult with void on success, Error on failure
     */
    async downloadChapter(
        sourceId: string,
        mangaId: string,
        chapterId: string,
        downloadId: string
    ): Promise<AsyncResult<void, Error>> {
        try {
            const adapters = this.adaptersGetter();
            const adapter = adapters.get(sourceId);

            if (!adapter) {
                return createErrorResult(new Error(`Source ${sourceId} not found or disabled`));
            }

            // Get download info for notifications
            const download = await this.prisma.nativeDownload.findUnique({
                where: { id: downloadId }
            });

            const sourceName = download?.sourceType ?? sourceId;
            const chapterTitle = download ? `Chapter ${download.chapterNumber}` : `Chapter ${chapterId}`;

            // Update status to downloading
            await this.prisma.nativeDownload.update({
                where: { id: downloadId },
                data: {
                    status: NativeDownloadStatus.DOWNLOADING,
                    progress: 0
                }
            });

            // Emit download started notification
            nativeDownloadNotifications.downloadStarted(chapterTitle, sourceName, downloadId);

            // Get download links
            const adapterUntyped = adapter as Record<string, unknown>;
            const links = typeof adapterUntyped['getDownloadLinks'] === 'function'
                ? await (adapterUntyped['getDownloadLinks'] as (mangaId: string, chapterId: string) => Promise<string[]>)(mangaId, chapterId)
                : [];

            if (links.length === 0) {
                await this.updateDownloadStatus(downloadId, NativeDownloadStatus.FAILED, {
                    error: 'No download links found'
                });

                // Emit download failed notification
                nativeDownloadNotifications.downloadFailed(chapterTitle, downloadId, chapterId, 'No download links found');
                return createErrorResult(new Error('No download links found'));
            }

            logger.info(`Found ${links.length} download links for chapter ${chapterId}`);

            // Legacy stub: this path historically marked the download
            // COMPLETED with a hardcoded `/manga/${id}/chapters/${id}`
            // destinationPath without actually downloading anything.
            // Real downloads route through the dedicated handlers
            // (mangadex-download.ts / suwayomi-download.ts) which call
            // mangadex-downloader / suwayomi-downloader directly. As of
            // 2026-04-28 zero `native_download` jobs have ever been
            // enqueued and zero NativeDownload rows carry the stub
            // path pattern (see scripts/surveys/probe-native-download-stub.ts).
            // Fail loudly so any future regression that reaches this
            // path is immediately visible instead of silently lying
            // about success.
            const stubError = `NativeDownloadManager.downloadChapter is not implemented for sourceId=${sourceId}; route via dedicated handler (mangadex_download / suwayomi_download)`;
            await this.updateDownloadStatus(downloadId, NativeDownloadStatus.FAILED, {
                error: stubError,
            });
            nativeDownloadNotifications.downloadFailed(chapterTitle, downloadId, chapterId, stubError);
            return createErrorResult(new Error(stubError));
        }
        catch (error: unknown) {
            logger.error(`Download failed for chapter ${chapterId}`, error);

            await this.updateDownloadStatus(downloadId, NativeDownloadStatus.FAILED, {
                error: error instanceof Error ? error.message : String(error)
            });

            // Get chapter info for notification
            const download = await this.prisma.nativeDownload.findUnique({ where: { id: downloadId } });
            const chapterTitle = download ? `Chapter ${download.chapterNumber}` : `Chapter ${chapterId}`;

            // Emit download failed notification
            nativeDownloadNotifications.downloadFailed(
                chapterTitle,
                downloadId,
                chapterId,
                error instanceof Error ? error.message : String(error)
            );

            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Get active downloads
     *
     * Retrieves all downloads in QUEUED or DOWNLOADING status.
     * Includes manga titles and full download metadata.
     *
     * @returns Array of active downloads
     */
    async getActiveDownloads(): Promise<ActiveDownload[]> {
        const downloads = await this.prisma.nativeDownload.findMany({
            where: {
                status: {
                    in: [NativeDownloadStatus.QUEUED, NativeDownloadStatus.DOWNLOADING]
                }
            }
        });

        // Load manga titles separately since KapowarrDownload doesn't have Manga relation
        const mangaIds = [...new Set(downloads.map(d => d.mangaId))];
        const mangas = await this.prisma.manga.findMany({
            where: { id: { in: mangaIds } },
            select: { id: true, title: true }
        });
        const mangaMap = new Map(mangas.map(m => [m.id, m.title]));

        return downloads.map((download) => ({
            id: download.id,
            mangaId: download.mangaId,
            mangaTitle: mangaMap.get(download.mangaId) ?? 'Unknown',
            ...(download.chapterId && { chapterId: String(download.chapterId) }),
            ...(download.chapterNumber && { chapterNumber: download.chapterNumber }),
            status: download.status as NativeDownloadStatus,
            ...(download.progress && { progress: download.progress }),
            ...(download.error && { error: download.error }),
            startedAt: download.startTime,
            updatedAt: download.endTime ?? download.startTime
        }));
    }

    /**
     * Cancel a download
     *
     * Marks a download as cancelled and stops processing.
     *
     * @param downloadId - Download record ID
     */
    async cancelDownload(downloadId: string): Promise<void> {
        // TODO: Implement actual cancellation logic
        await this.updateDownloadStatus(downloadId, NativeDownloadStatus.CANCELLED);
        logger.info(`Download ${downloadId} cancelled`);
    }

    /**
     * Retry a failed download
     *
     * Resets a failed download and re-queues it for processing.
     *
     * @param downloadId - Download record ID
     * @throws ValidationError if download not found
     */
    async retryDownload(downloadId: string): Promise<void> {
        const download = await this.prisma.nativeDownload.findUnique({
            where: { id: downloadId }
        });

        if (!download) {
            throw new ValidationError('Download not found');
        }

        // Reset status and queue again
        await this.prisma.nativeDownload.update({
            where: { id: downloadId },
            data: {
                status: NativeDownloadStatus.QUEUED,
                progress: 0,
                error: null,
                startTime: new Date(),
                endTime: null
            }
        });

        // Emit download queued notification
        const chapterTitle = `Chapter ${download.chapterNumber}`;
        nativeDownloadNotifications.downloadQueued(
            chapterTitle,
            download.chapterId ? toStringId(download.chapterId) : ''
        );

        logger.info(`Download ${downloadId} queued for retry`);
    }

    /**
     * Update download status with additional data
     *
     * Private helper to update download record with status and metadata.
     * Automatically sets endTime for terminal states.
     *
     * @param downloadId - Download record ID
     * @param status - New download status
     * @param data - Optional additional data (progress, error, path)
     */
    private async updateDownloadStatus(
        downloadId: string,
        status: NativeDownloadStatus,
        data?: {
            progress?: number;
            error?: string;
            destinationPath?: string;
        }
    ): Promise<void> {
        const updateData: Record<string, unknown> = { status };

        if (data?.progress !== undefined) {
            updateData['progress'] = data.progress;
        }
        if (data?.error !== undefined) {
            updateData['error'] = data.error;
        }
        if (data?.destinationPath !== undefined) {
            updateData['destinationPath'] = data.destinationPath;
        }

        // Set endTime for terminal states
        if (
            status === NativeDownloadStatus.COMPLETED ||
            status === NativeDownloadStatus.FAILED ||
            status === NativeDownloadStatus.CANCELLED
        ) {
            updateData['endTime'] = new Date();
        }

        await this.prisma.nativeDownload.update({
            where: { id: downloadId },
            data: updateData
        });
    }
}
