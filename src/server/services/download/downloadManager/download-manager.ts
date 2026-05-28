/**
 * Download Manager - Core Service
 *
 * Main class for managing all download operations.
 * Orchestrates download requests through validation, client selection, and handlers.
 */

import { DownloadMethod, DownloadMode, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { ProwlarrMangaSearch } from '@/server/services/prowlarr/mangaSearch';
import { realtimeEmitter } from '@/server/services/realtime';
import type { DownloadRequest } from '@/types/download-types';
import { isValidDownloadRequest } from '@/types/download-types';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, createSuccessResult, isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { ClientDownloadService } from '../clientDownload';
import { DownloadFailureReason } from '../retry';

import { handleDirectDownload } from './direct-handler';
import { checkForDuplicateJob } from './duplicate-check';
import { handleGetComicsDownload } from './getcomics-handler';
import { handleProwlarrDownload } from './prowlarr-handler';
import { checkTorrentHealth, unwrapDownloadStatus, handleProgressFailure, handleDownloadCompletion } from './torrent-health';
import { isDownloadPayload } from './utils';
import { validateDownloadRequest } from './validation';

import type { TorrentHealthState } from './torrent-health';
import type { DownloadPayload } from './types';
import type { JobStatus, jobs, PrismaClient } from '@prisma/client';

/**
 * DownloadManager - Core service for managing all download operations
 *
 * Handles routing download requests to appropriate handlers based on method.
 * Provides unified interface for all download operations regardless of source.
 */
export class DownloadManager {
    private clientService: ClientDownloadService;
    private prowlarrSearch: ProwlarrMangaSearch;

    constructor(private prismaClient: PrismaClient = prisma) {
        this.clientService = new ClientDownloadService(prismaClient);
        this.prowlarrSearch = new ProwlarrMangaSearch(prismaClient);
    }

    /**
     * Resume progress loops for active Prowlarr jobs (call on server startup).
     * After a restart, in-flight progress loops are lost — this restarts them.
     */
    async resumeActiveProgressLoops(): Promise<void> {
        const activeJobs = await this.prismaClient.jobs.findMany({
            where: { status: 'active', job_type: 'chapter_download', result: { not: { equals: null } } },
            select: { id: true, partition_key: true, manga_id: true, result: true }
        });
        for (const job of activeJobs) {
            const result = job.result as Record<string, unknown> | null;
            const downloadId = result?.['downloadId'];
            if (typeof downloadId === 'string' && job.manga_id !== null) {
                logger.info(`[DownloadManager] Resuming progress loop for active job ${job.id}`);
                void this.startProgressLoop(job.id, job.partition_key, job.manga_id);
            }
        }
    }

    /**
     * Process a download request
     *
     * @param request - Download request with method, mode, and target details
     * @returns AsyncResult containing the task ID
     */
    async processDownloadRequest(
        request: DownloadRequest
    ): Promise<AsyncResult<{ taskId: number }, Error>> {
        try {
            if (!isValidDownloadRequest(request)) {
                return createErrorResult(
                    new Error('Invalid download request: missing required fields or invalid types')
                );
            }

            const payload: DownloadPayload = {
                method: request.method,
                mode: request.mode,
                chapterIds: request.chapterIds,
                ...(request.format !== undefined && { format: request.format }),
                ...(request.quality !== undefined && { quality: request.quality }),
                ...(request.clientType !== undefined && { clientType: request.clientType }),
                ...(request.directUrl !== undefined && { directUrl: request.directUrl }),
                ...(request.prowlarrResult !== undefined && { prowlarrResult: request.prowlarrResult }),
                ...(request.getcomicsUrl !== undefined && { getcomicsUrl: request.getcomicsUrl })
            };

            // Quick validation before job creation
            const validationResult = await validateDownloadRequest(this.prismaClient, payload);
            if (isError(validationResult)) {
                logger.warn(`Download request validation failed: ${validationResult.error.message}`);
                return validationResult;
            }

            // Check for duplicate jobs
            const duplicateCheck = await checkForDuplicateJob(
                this.prismaClient,
                request.mangaId,
                request.chapterIds
            );

            if (duplicateCheck.isDuplicate && duplicateCheck.existingJobId !== undefined) {
                return createSuccessResult({ taskId: duplicateCheck.existingJobId });
            }

            logger.debug(
                `No duplicate jobs found for ${request.chapterIds.length} chapters on manga ${request.mangaId}, creating new job`
            );

            // Create job record — sanitize payload to convert any BigInt values to Numbers
            // (Prowlarr API responses may contain BigInt values that break JSON serialization)
            const sanitizedPayload = JSON.stringify(payload, (_key, value: unknown) =>
                typeof value === 'bigint' ? Number(value) : value
            );
            const priority = request.mode === DownloadMode.AUTO ? 'low' : 'high';
            const chapterId = (request.chapterId !== undefined && request.chapterId > 0)
                ? request.chapterId
                : null;

            // Use raw SQL with NOW() to avoid JS Date/PostgreSQL timezone mismatch
            const jobs = await this.prismaClient.$queryRaw<Array<{ id: bigint }>>`
                INSERT INTO jobs (
                    queue_name, job_type, priority, payload, status,
                    scheduled_for, manga_id, chapter_id, partition_key
                ) VALUES (
                    'default',
                    ${`chapter_download`}::"JobType",
                    ${priority}::"JobPriority",
                    ${sanitizedPayload}::jsonb,
                    'pending'::"JobStatus",
                    NOW(),
                    ${request.mangaId}::integer,
                    ${chapterId}::integer,
                    'active'
                ) RETURNING id
            `;

            const job = jobs[0];
            if (!job) {
                return createErrorResult(new Error('Failed to create download job'));
            }

            // Emit realtime event for download started
            void realtimeEmitter.emitDownloadStarted({
                taskId: String(job.id),
                mangaId: request.mangaId,
                progress: 0,
                status: 'queued',
            });

            // Process asynchronously so activity monitor can catch the job
            // FIX: Use globalThis.queueMicrotask to avoid no-undef error
            globalThis.queueMicrotask(() => {
                this.processTask(Number(job.id)).catch((error: unknown) => {
                    logger.error(`Background download task ${job.id} failed:`, error);
                });
            });

            return createSuccessResult({ taskId: Number(job.id) });
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : 'Failed to process download request';
            return createErrorResult(new Error(errorMessage));
        }
    }

    /**
     * Process a download task
     *
     * @param taskId - Task ID to process
     * @returns AsyncResult indicating success or failure
     */
    async processTask(taskId: number): Promise<AsyncResult<void, Error>> {
        try {
            // Get task with manga info
            const task = await this.prismaClient.jobs.findFirst({
                where: { id: BigInt(taskId) },
                include: { manga: true }
            });

            if (!task || !task.manga) {
                return createErrorResult(new Error(`Task not found or missing manga: ${taskId}`));
            }

            // Extract and validate payload
            if (!isDownloadPayload(task.payload)) {
                return createErrorResult(new Error('Task missing or invalid download payload'));
            }

            const payload = task.payload;

            // Idempotency: if this job already has a downloadId recorded,
            // dispatch already happened (queueMicrotask path raced with the
            // queue worker, OR we restarted and recoverOrphanedJobs flipped
            // the row back to 'pending'). Don't re-send the magnet — just
            // ensure the progress loop is monitoring. Transmission would
            // dedupe by infohash anyway, but skipping the network round-trip
            // is cheaper and the realtime "download started" toast doesn't
            // misfire a second time.
            const existingResult = task.result as Record<string, unknown> | null;
            const existingDownloadId = typeof existingResult?.['downloadId'] === 'string'
                ? existingResult['downloadId']
                : undefined;
            if (existingDownloadId && payload.method === DownloadMethod.PROWLARR) {
                logger.info(`Job ${taskId} already dispatched (downloadId=${existingDownloadId}); skipping re-dispatch, resuming progress loop`);
                if (task.status !== 'active') {
                    await this.prismaClient.jobs.update({
                        where: { id_partition_key: { id: task.id, partition_key: task.partition_key } },
                        data: { status: 'active' as JobStatus },
                    });
                }
                void this.startProgressLoop(task.id, task.partition_key, task.manga.id);
                return createSuccessResult(undefined);
            }

            // Update task status to ACTIVE
            await this.prismaClient.jobs.update({
                where: {
                    id_partition_key: {
                        id: task.id,
                        partition_key: task.partition_key
                    }
                },
                data: {
                    status: 'active' as JobStatus,
                    started_at: new Date()
                }
            });

            // Emit realtime event for download started processing
            void realtimeEmitter.emitDownloadProgress({
                taskId: String(taskId),
                mangaId: task.manga.id,
                progress: 0,
                status: 'downloading',
            });

            // Route to appropriate handler based on method
            let result: AsyncResult<void, Error>;
            switch (payload.method) {
                case DownloadMethod.PROWLARR:
                    result = await handleProwlarrDownload(
                        this.prismaClient,
                        this.clientService,
                        task,
                        payload
                    );
                    break;
                case DownloadMethod.DIRECT_URL:
                    result = await handleDirectDownload(
                        this.prismaClient,
                        this.clientService,
                        task,
                        payload
                    );
                    break;
                case DownloadMethod.GETCOMICS: {
                    // GetComics returns DDL links - handle via getcomics-handler
                    const getcomicsResult = await handleGetComicsDownload(
                        this.prismaClient,
                        task,
                        payload
                    );
                    // Convert the GetComicsDownloadResult to void result
                    result = isError(getcomicsResult)
                        ? getcomicsResult
                        : createSuccessResult(undefined);
                    break;
                }
                default:
                    result = createErrorResult(
                        new Error(`Unsupported download method: ${payload.method}`)
                    );
            }

            // Update task based on result
            if (isError(result)) {
                await this.prismaClient.jobs.update({
                    where: {
                        id_partition_key: {
                            id: task.id,
                            partition_key: task.partition_key
                        }
                    },
                    data: {
                        status: 'failed' as JobStatus,
                        last_error: {
                            message:
                                result.error instanceof Error
                                    ? result.error.message
                                    : String(result.error)
                        } as Prisma.InputJsonValue,
                        completed_at: new Date()
                    }
                });

                // Emit realtime event for download failed
                const errorMessage = result.error instanceof Error
                    ? result.error.message
                    : String(result.error);
                void realtimeEmitter.emitDownloadFailed(
                    {
                        taskId: String(taskId),
                        mangaId: task.manga.id,
                        progress: 0,
                        status: 'failed',
                    },
                    errorMessage
                );

                return result;
            }

            // For Prowlarr downloads, the magnet/nzb has been sent to the download client
            // but the actual download hasn't finished — keep job active for monitoring
            if (payload.method === DownloadMethod.PROWLARR) {
                logger.info(`Job ${taskId} sent to download client, staying active until download completes`);
                void realtimeEmitter.emitDownloadProgress({
                    taskId: String(taskId),
                    mangaId: task.manga.id,
                    progress: 0,
                    status: 'downloading',
                });

                // Start real-time progress loop (non-blocking)
                void this.startProgressLoop(task.id, task.partition_key, task.manga.id);
            } else {
                // Direct/GetComics downloads complete synchronously — mark done
                await this.prismaClient.jobs.update({
                    where: {
                        id_partition_key: {
                            id: task.id,
                            partition_key: task.partition_key
                        }
                    },
                    data: {
                        status: 'completed' as JobStatus,
                        completed_at: new Date()
                    }
                });

                void realtimeEmitter.emitDownloadCompleted({
                    taskId: String(taskId),
                    mangaId: task.manga.id,
                    progress: 100,
                    status: 'completed',
                });
            }

            return createSuccessResult(undefined);
        } catch (error: unknown) {
            const errorMessage =
                error instanceof Error ? error.message : 'Failed to process task';
            return createErrorResult(new Error(errorMessage));
        }
    }

    /**
     * Get download task status
     *
     * @param taskId - Task ID to retrieve
     * @returns AsyncResult with task data or error
     */
    /**
     * One iteration of the progress loop. Returns 'stop' when the job
     * should no longer be polled (completed, failed, or no longer active).
     */
    // eslint-disable-next-line max-params, complexity -- 6 distinct loop-state inputs; complexity 21 covers the 5 distinct outcomes (inactive, no-result, fetch-failed, health-failure, completion, progress-update) which can't be cleanly split without scattering local state
    private async pollProgressOnce(
        jobId: bigint,
        partitionKey: string,
        mangaId: number,
        iteration: number,
        healthState: TorrentHealthState,
        stallThreshold: number,
    ): Promise<{ next: 'continue' | 'stop'; healthState: TorrentHealthState }> {
        const job = await this.prismaClient.jobs.findFirst({ where: { id: jobId } });
        if (job?.status !== 'active') return { next: 'stop', healthState };
        const jobResult = job.result as Record<string, unknown> | null;
        const downloadId = jobResult?.['downloadId'];
        const clientType = jobResult?.['clientType'];
        if (typeof downloadId !== 'string' || typeof clientType !== 'string') return { next: 'continue', healthState };

        const statusResult = await this.clientService.getDownloadStatus(clientType, downloadId);
        if (isError(statusResult) || !isSuccess(statusResult)) return { next: 'continue', healthState };
        const dl = unwrapDownloadStatus(statusResult.data);
        const progress = typeof dl['progress'] === 'number' ? Math.round(dl['progress']) : 0;
        const seeds = typeof dl['seeds'] === 'number' ? dl['seeds'] : undefined;
        const speed = typeof dl['rateDownload'] === 'number' ? dl['rateDownload'] : undefined;
        const name = typeof dl['name'] === 'string' ? dl['name'] : undefined;
        const where = { id_partition_key: { id: jobId, partition_key: partitionKey } };

        const dlSpeed = typeof dl['downloadSpeed'] === 'number' ? dl['downloadSpeed'] : (speed ?? 0);
        const healthResult = checkTorrentHealth(
            { progress, seeds, downloadSpeed: dlSpeed, iteration },
            healthState, stallThreshold,
        );

        if (healthResult.failReason) {
            await handleProgressFailure(this.prismaClient, this.clientService, jobId, partitionKey, {
                mangaId, downloadId, clientType, progress,
                reason: healthResult.failReason,
                failureReason: seeds === 0 ? DownloadFailureReason.NO_SEEDS : DownloadFailureReason.STALLED,
                releaseName: name,
            });
            return { next: 'stop', healthState: healthResult.updatedState };
        }

        if (progress >= 100) {
            const savePath = typeof dl['savePath'] === 'string' ? dl['savePath'] : '';
            await handleDownloadCompletion(this.prismaClient, jobId, partitionKey, mangaId, downloadId, savePath, name);
            return { next: 'stop', healthState: healthResult.updatedState };
        }

        await this.prismaClient.jobs.update({ where, data: { progress } });
        void realtimeEmitter.emitDownloadProgress({
            taskId: String(jobId), mangaId, progress, status: 'downloading',
            ...(speed !== undefined && { speed: Math.round(Number(speed)) }),
            ...(name !== undefined && { filename: name }),
        });
        return { next: 'continue', healthState: healthResult.updatedState };
    }

    /**
     * Real-time progress loop — queries download client every 5s and emits WebSocket events
     */
    private async startProgressLoop(jobId: bigint, partitionKey: string, mangaId: number): Promise<void> {
        const INTERVAL_MS = 5_000;
        const MAX_ITERATIONS = 4320; // 6 hours max
        const STALL_THRESHOLD = 36; // 36 × 5s = 3 minutes of no progress
        let healthState: TorrentHealthState = { lastProgress: -1, stallCount: 0 };

        /* eslint-disable no-await-in-loop -- polling loop is sequential by design (5s interval between client queries) */
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            await new Promise(resolve => { setTimeout(resolve, INTERVAL_MS); });
            try {
                const result = await this.pollProgressOnce(jobId, partitionKey, mangaId, i, healthState, STALL_THRESHOLD);
                healthState = result.healthState;
                if (result.next === 'stop') return;
            } catch { /* non-fatal */ }
        }
        /* eslint-enable no-await-in-loop */
    }

    async getTaskStatus(taskId: number): Promise<AsyncResult<jobs, Error>> {
        try {
            const task = await this.prismaClient.jobs.findFirst({
                where: { id: BigInt(taskId) },
                include: {
                    manga: true,
                    chapter: true
                }
            });

            if (!task) {
                return createErrorResult(new Error(`Task not found: ${taskId}`));
            }

            return createSuccessResult(task);
        } catch (error: unknown) {
            return createErrorResult(
                error instanceof Error ? error : new Error('Failed to get task status')
            );
        }
    }
}
