/**
 * Native Download Queue Manager Module
 *
 * Handles queueing operations for downloads, syncs, and validations.
 *
 * Responsibilities:
 * - Queue download tasks
 * - Queue source sync operations
 * - Queue source validation tasks
 * - Update task statuses
 *
 * Extracted from: NativeDownloadManager.ts
 */



import { NativeDownloadStatus, JobType } from '@prisma/client';

import { queueManager } from '@/server/queue/queueManager';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, createSuccessResult } from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { nativeDownloadNotifications } from './notifications';

import type { PrismaClient } from '@prisma/client';

export class QueueManager {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Queue a download by ID
     *
     * Note: Job creation is handled by the caller (typically in tRPC mutation).
     * This method only updates the download status to QUEUED.
     */
    async queueDownload(downloadId: string): Promise<AsyncResult<void, Error>> {
        try {
            const download = await this.prisma.nativeDownload.findUnique({
                where: { id: downloadId }
            });

            if (!download) {
                return createErrorResult(new Error('Download not found'));
            }

            // Update download status to queued
            // Note: The Job record is created by the tRPC mutation in a transaction
            await this.prisma.nativeDownload.update({
                where: { id: downloadId },
                data: {
                    status: NativeDownloadStatus.QUEUED
                }
            });

            logger.info(`Download ${downloadId} status updated to QUEUED`);

            // Emit download queued notification
            const chapterTitle = `Chapter ${download.chapterNumber}`;
            nativeDownloadNotifications.downloadQueued(chapterTitle, download.chapterId ? toStringId(download.chapterId) : '');

            return createSuccessResult(undefined);
        } catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Queue a source sync task
     * Note: Custom source validation removed - sourceId is now a string identifier
     */
    async queueSourceSync(sourceId: string, fullSync = false): Promise<AsyncResult<void, Error>> {
        try {
            // Queue the sync task
            const taskId = await queueManager.enqueue(JobType.native_sync, {
                sourceId,
                fullSync
            });

            logger.info(`Queued Native download source sync task ${taskId} for source ${sourceId}`);

            return createSuccessResult(undefined);
        } catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Queue a source validation task
     * Note: Custom source validation removed - sourceId is now a string identifier
     */
    async queueSourceValidation(sourceId: string, testQuery?: string): Promise<AsyncResult<void, Error>> {
        try {
            // Queue the validation task
            const taskId = await queueManager.enqueue(JobType.native_sync, {
                sourceId,
                testQuery
            });

            logger.info(`Queued Native download source validation task ${taskId} for source ${sourceId}`);

            return createSuccessResult(undefined);
        } catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
}
