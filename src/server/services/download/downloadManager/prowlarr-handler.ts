/**
 * Prowlarr Download Handler
 *
 * Handles downloads via Prowlarr/download clients with blocklist checking
 * and quality metrics tracking.
 */

import { pipelineEventBus } from '@/server/services/pipeline/pipeline-event-bus';
import {
    getReleaseBlocklistService,
    type ReleaseIdentifier,
    type ReleaseQualityMetrics
} from '@/server/services/releaseBlocklistService';
import { PIPELINE_EVENTS } from '@/types/domain/pipeline-events';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { extractBtihFromMagnet } from '@/utils/magnet';

import { ClientDownloadService } from '../clientDownload';

import { sendToClientWithFailover } from './client-selection';
import { isPackDownload, trackPackDownload } from './pack-tracking';
import { isMangaWithTitle, extractDownloadUrl } from './utils';

import type { DownloadPayload, PackDownloadParams } from './types';
import type { Prisma, jobs, PrismaClient } from '@prisma/client';

/**
 * Build blocklist error message with alternatives
 */
function buildBlocklistErrorMessage(
    reason: string,
    details: string | undefined,
    alternatives: ReleaseIdentifier[] | undefined
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
 * Extracted prowlarr result metadata
 */
interface ProwlarrMetadata {
    title: string;
    indexer: string;
    indexerId: string | number;
    protocol: string;
    fileSize: number | undefined;
    magnetUrl: string | undefined;
}

/**
 * Extract prowlarr result metadata
 */
function extractProwlarrMetadata(prowlarrResult: Record<string, unknown>): ProwlarrMetadata {
    // Prowlarr sometimes swaps fields: guid contains the actual magnet link while
    // magnetUrl contains a Prowlarr HTTP download URL. Prefer guid when it's a magnet.
    const guid = typeof prowlarrResult['guid'] === 'string' ? prowlarrResult['guid'] : undefined;
    const rawMagnetUrl = typeof prowlarrResult['magnetUrl'] === 'string' ? prowlarrResult['magnetUrl'] : undefined;
    const magnetUrl = guid?.startsWith('magnet:') ? guid
        : rawMagnetUrl?.startsWith('magnet:') ? rawMagnetUrl
        : undefined;
    const title =
        typeof prowlarrResult['title'] === 'string' ? prowlarrResult['title'] : 'unknown';
    // Prowlarr's API returns the field as `indexerName` (matches
    // `ProwlarrSearchResult` in `src/types/prowlarr.ts`). Some legacy code
    // paths used `indexer` — preserve that as a fallback so historical
    // payloads don't silently drop to 'unknown'.
    const indexer =
        typeof prowlarrResult['indexerName'] === 'string' ? prowlarrResult['indexerName']
            : typeof prowlarrResult['indexer'] === 'string' ? prowlarrResult['indexer']
            : 'unknown';
    const indexerId =
        typeof prowlarrResult['id'] === 'string' || typeof prowlarrResult['id'] === 'number'
            ? prowlarrResult['id']
            : 'unknown';
    const protocol =
        typeof prowlarrResult['protocol'] === 'string'
            ? prowlarrResult['protocol'].toLowerCase()
            : 'torrent';

    const rawSize = prowlarrResult['size'];
    const fileSize =
        typeof rawSize === 'number'
            ? rawSize
            : typeof rawSize === 'string'
              ? Number(rawSize)
              : undefined;

    return { title, indexer, indexerId, protocol, fileSize, magnetUrl };
}

/**
 * Resolve a Prowlarr HTTP download URL that may redirect to a magnet: link.
 * Clients like Deluge/Transmission can't follow magnet: redirects on their own.
 *
 * @returns The magnet URI if the URL redirects to one, undefined otherwise
 */
async function resolveProwlarrMagnet(url: string): Promise<string | undefined> {
    try {
        const response = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10_000) });
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location?.startsWith('magnet:')) {
                return location;
            }
        }
    } catch (error: unknown) {
        logger.debug('Could not resolve Prowlarr URL for magnet redirect', {
            url: url.substring(0, 80), error: error instanceof Error ? error.message : String(error)
        });
    }
    return undefined;
}

/**
 * iter-1: record dispatch into DownloadHistory so per-client observability is available
 * at inspection time. Status=PARTIAL marks "dispatched, outcome pending"; a follow-up
 * iter should flip it to COMPLETED or FAILED when the download terminates.
 */
interface DispatchHistoryInput {
    task: jobs;
    payload: DownloadPayload;
    clientType: string;
    downloadId: string;
    indexer: string;
    protocol: string;
    title: string;
    fileSize: number | undefined;
}

async function recordDispatchHistory(prismaClient: PrismaClient, input: DispatchHistoryInput): Promise<void> {
    if (input.task.manga_id === null) return;
    const firstChapterId = input.payload.chapterIds[0];
    await prismaClient.downloadHistory.create({
        data: {
            mangaId: input.task.manga_id,
            status: 'PARTIAL',
            source: input.indexer,
            downloadClient: input.clientType,
            // Inherit ownership from the initiating job so this row is scoped to
            // the user who triggered the download (admins still see NULL/all).
            initiatedByUserId: input.task.initiated_by_user_id,
            ...(firstChapterId !== undefined ? { chapterId: firstChapterId } : {}),
            ...(input.fileSize !== undefined ? { downloadSize: BigInt(Math.max(0, Math.floor(input.fileSize))) } : {}),
            metadata: {
                downloadId: input.downloadId,
                releaseTitle: input.title,
                protocol: input.protocol,
                jobId: String(input.task.id),
            } as Prisma.InputJsonValue,
        },
    });
}

/**
 * Handles downloads via Prowlarr/download clients
 */
// eslint-disable-next-line complexity -- complexity 25: linear pipeline (validate result → resolve URL → check blocklist → send to client → record outcome) with required guard branches at each step; refactor candidate
export async function handleProwlarrDownload(
    prismaClient: PrismaClient,
    clientService: ClientDownloadService,
    task: jobs & { manga: unknown },
    payload: DownloadPayload
): Promise<AsyncResult<void, Error>> {
    const blocklistService = getReleaseBlocklistService(prismaClient);
    const startTime = Date.now();

    try {
        if (!payload.prowlarrResult) {
            return createErrorResult(new Error('Missing Prowlarr search result'));
        }

        const prowlarrResult = payload.prowlarrResult as Record<string, unknown>;
        const { title, indexer, indexerId, protocol, fileSize, magnetUrl } =
            extractProwlarrMetadata(prowlarrResult);

        // Extract download URL - prefer magnetUrl for torrents
        let downloadUrl = magnetUrl ?? extractDownloadUrl(prowlarrResult);

        if (!downloadUrl) {
            logger.error('Missing download URL in Prowlarr result', { prowlarrResult });
            return createErrorResult(new Error('Missing download URL in Prowlarr search result'));
        }

        // Prowlarr HTTP URLs may redirect to magnet: links which clients can't follow.
        // Resolve the redirect and use the magnet link directly if found.
        if (!downloadUrl.startsWith('magnet:') && protocol === 'torrent') {
            const resolved = await resolveProwlarrMagnet(downloadUrl);
            if (resolved) {
                logger.info('Resolved Prowlarr URL to magnet link');
                downloadUrl = resolved;
            }
        }

        if (downloadUrl.startsWith('magnet:')) {
            logger.info('Using magnet URL for torrent download (bypasses Prowlarr fetch)');
        } else {
            logger.info('Using Prowlarr download URL (requires client to fetch from Prowlarr)');
        }

        logger.info(`Downloading from Prowlarr: ${title}`, { downloadUrl, protocol, indexer });

        // Check blocklist before downloading. Pull the BTIH from the
        // *resolved* downloadUrl, not the pre-redirect magnetUrl — Prowlarr
        // HTTP URLs can redirect to a different magnet than the one in the
        // search-result payload, and we want to gate on what we're actually
        // about to send to the client.
        const releaseHash = extractBtihFromMagnet(downloadUrl);
        const releaseIdentifier: ReleaseIdentifier = {
            releaseTitle: title,
            indexerId,
            ...(task.manga_id !== null ? { mangaId: task.manga_id } : {}),
            ...(releaseHash !== undefined ? { releaseHash } : {}),
            source: indexer
        };

        const blocklistCheck = await blocklistService.checkRelease(releaseIdentifier);
        if (isSuccess(blocklistCheck) && blocklistCheck.data.isBlocked) {
            logger.warn(`Download blocked by blocklist: ${releaseIdentifier.releaseTitle}`, {
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

        // Send to download client with automatic failover
        const mangaTitle = isMangaWithTitle(task.manga) ? task.manga.title : 'unknown';
        const result = await sendToClientWithFailover(
            prismaClient,
            clientService,
            protocol,
            downloadUrl,
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

        pipelineEventBus.emit(PIPELINE_EVENTS.DOWNLOAD_GRABBED, {
            timestamp: new Date(),
            source: 'prowlarr-handler',
            mangaId: task.manga_id ?? 0,
            downloadId: result.data.downloadId,
            clientType: result.data.clientType,
            releaseTitle: title,
            indexer,
            protocol,
            size: fileSize ?? 0,
        });

        await recordDispatchHistory(prismaClient, {
            task, payload,
            clientType: result.data.clientType,
            downloadId: result.data.downloadId,
            indexer, protocol, title, fileSize,
        });

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
                    releaseTitle: title,
                    indexer,
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
                    downloadUrl: downloadUrl
                }
            });
        }

        // Track pack downloads
        if (task.manga_id !== null) {
            const isPack = await isPackDownload(
                prismaClient,
                title,
                payload.chapterIds,
                task.manga_id
            );
            if (isPack) {
                const packParams: PackDownloadParams = {
                    releaseTitle: title,
                    mangaId: task.manga_id,
                    jobId: Number(task.id),
                    downloadId: result.data.downloadId,
                    clientType: result.data.clientType,
                    indexer,
                    protocol,
                    chapterIds: payload.chapterIds,
                    ...(fileSize !== undefined ? { fileSize } : {}),
                    ...(task.initiated_by_user_id !== null ? { initiatedByUserId: task.initiated_by_user_id } : {}),
                    downloadUrl
                };
                await trackPackDownload(prismaClient, packParams);
            }
        }

        // Record successful download
        const qualityMetrics: Partial<ReleaseQualityMetrics> = {
            downloadTime: (Date.now() - startTime) / 1000,
            ...(fileSize !== undefined ? { fileSize } : {})
        };
        await blocklistService.recordDownloadAttempt(
            releaseIdentifier,
            true,
            undefined,
            qualityMetrics
        );

        return createSuccessResult(undefined);
    } catch (error: unknown) {
        return createErrorResult(
            error instanceof Error ? error : new Error('Prowlarr download failed')
        );
    }
}
