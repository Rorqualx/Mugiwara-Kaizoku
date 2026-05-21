/**
 * Direct Download Handler
 *
 * Handles direct URL downloads with blocklist checking.
 */

import { getReleaseBlocklistService, type ReleaseIdentifier } from '@/server/services/releaseBlocklistService';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { ClientDownloadService } from '../clientDownload';

import { sendToClientWithFailover } from './client-selection';
import { isMangaWithTitle, detectProtocol } from './utils';

import type { DownloadPayload } from './types';
import type { PrismaClient } from '@prisma/client';
import type { Prisma, jobs } from '@prisma/client';

/**
 * Build blocklist error message with alternatives
 */
function buildBlocklistErrorMessage(
    reason: string,
    details: string | undefined,
    alternatives: Array<{ releaseTitle: string; source?: string }> | undefined
): string {
    let errorMessage = `Release blocked: ${reason} - ${details ?? ''}`;

    if (alternatives && alternatives.length > 0) {
        errorMessage += `\n\nAlternative releases found (${alternatives.length}):`;
        alternatives.slice(0, 3).forEach((alt, index) => {
            errorMessage += `\n${index + 1}. ${alt.releaseTitle} (${alt.source ?? 'unknown'})`;
        });
        if (alternatives.length > 3) {
            errorMessage += `\n... and ${alternatives.length - 3} more`;
        }
    } else {
        errorMessage += '\n\nNo alternative releases found. Try searching with different criteria.';
    }

    return errorMessage;
}

/**
 * Handles direct URL downloads
 */
export async function handleDirectDownload(
    prismaClient: PrismaClient,
    clientService: ClientDownloadService,
    task: jobs & { manga: unknown },
    payload: DownloadPayload
): Promise<AsyncResult<void, Error>> {
    const blocklistService = getReleaseBlocklistService(prismaClient);
    const startTime = Date.now();

    try {
        if (!payload.directUrl) {
            return createErrorResult(new Error('Missing direct download URL'));
        }

        // Extract filename from URL
        const urlParts = payload.directUrl.split('/');
        const filename = urlParts[urlParts.length - 1] ?? payload.directUrl;

        // Check blocklist before downloading
        const releaseIdentifier: ReleaseIdentifier = {
            releaseTitle: decodeURIComponent(filename),
            ...(task.manga_id !== null ? { mangaId: task.manga_id } : {}),
            source: 'direct'
        };

        const blocklistCheck = await blocklistService.checkRelease(releaseIdentifier);
        if (isSuccess(blocklistCheck) && blocklistCheck.data.isBlocked) {
            logger.warn(`Direct download blocked by blocklist: ${releaseIdentifier.releaseTitle}`, {
                reason: blocklistCheck.data.reason,
                details: blocklistCheck.data.details
            });

            await blocklistService.recordDownloadAttempt(
                releaseIdentifier,
                false,
                `Blocked: ${blocklistCheck.data.reason}`
            );

            const errorMessage = buildBlocklistErrorMessage(
                blocklistCheck.data.reason ?? 'Unknown',
                blocklistCheck.data.details,
                blocklistCheck.data.alternatives
            );

            return createErrorResult(new Error(errorMessage));
        }

        // Detect protocol from URL
        const protocol = detectProtocol(payload.directUrl);
        logger.info(`Detected protocol '${protocol}' for direct download: ${filename}`);

        // Send to download client with automatic failover
        const mangaTitle = isMangaWithTitle(task.manga) ? task.manga.title : 'unknown';
        const result = await sendToClientWithFailover(
            prismaClient,
            clientService,
            protocol,
            payload.directUrl,
            {
                // category/label is sourced from each client's own configuration
                // (download.<client>.label or .category) — see config-builders.ts.
                destination: `/downloads/manga/${mangaTitle}`
            }
        );

        if (isError(result)) {
            await blocklistService.recordDownloadAttempt(
                releaseIdentifier,
                false,
                result.error instanceof Error ? result.error.message : String(result.error),
                { downloadTime: (Date.now() - startTime) / 1000 }
            );
            return result;
        }

        if (!isSuccess(result)) {
            return createErrorResult(new Error('Failed to send download to client'));
        }

        // Store download info in job result
        await prismaClient.jobs.update({
            where: {
                id_partition_key: {
                    id: task.id,
                    partition_key: task.partition_key
                }
            },
            data: {
                result: {
                    downloadId: result.data.downloadId,
                    clientType: result.data.clientType,
                    startTime: startTime,
                    releaseTitle: decodeURIComponent(filename),
                    indexer: 'direct',
                    mode: payload.mode
                } as Prisma.InputJsonValue
            }
        });

        // Update chapters as downloading
        if (task.manga_id !== null) {
            await prismaClient.chapter.updateMany({
                where: {
                    id: { in: payload.chapterIds },
                    mangaId: task.manga_id
                },
                data: {
                    downloadStatus: 'DOWNLOADING',
                    downloadUrl: payload.directUrl
                }
            });
        }

        // Record successful download
        await blocklistService.recordDownloadAttempt(
            releaseIdentifier,
            true,
            undefined,
            { downloadTime: (Date.now() - startTime) / 1000 }
        );

        return createSuccessResult(undefined);
    } catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Direct download failed'));
    }
}
