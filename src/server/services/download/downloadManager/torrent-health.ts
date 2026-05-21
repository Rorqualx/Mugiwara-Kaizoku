/**
 * Torrent Health Detection & Failure Handling
 *
 * Helpers for detecting unhealthy torrents in the progress loop:
 * - 0-seeder detection (torrent will never complete)
 * - Stall detection (partial seeders, no complete copy available)
 * - Failure handling with retry/blocklist pipeline
 *
 * Extracted from download-manager.ts to keep file under 500 lines.
 */

import path from 'path';

import { pipelineEventBus } from '@/server/services/pipeline/pipeline-event-bus';
import { realtimeEmitter } from '@/server/services/realtime';
import { autoBlockFailedRelease } from '@/server/services/release-blocklist/blocklist-manager';
import { PIPELINE_EVENTS } from '@/types/domain/pipeline-events';
import { logger } from '@/utils/logger';


import { ClientDownloadService } from '../clientDownload';
import { resetChaptersToPending } from '../download-monitor/chapter-manager';
import { runPackImportWithRetry } from '../download-monitor/pack-import-retry';
import { attemptDownloadRetry, extractReleaseUrl } from '../download-monitor/retry-handler';
import { extractChapterIdsFromPayload } from '../job-payload';
import { getRetryService, DownloadFailureReason } from '../retry';

import type { JobStatus, Prisma, PrismaClient } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface TorrentHealthState {
    lastProgress: number;
    stallCount: number;
}

export interface TorrentHealthCheck {
    progress: number;
    seeds: number | undefined;
    downloadSpeed: number;
    iteration: number;
}

export interface TorrentHealthResult {
    failReason: string | null;
    updatedState: TorrentHealthState;
}

export interface ProgressFailureParams {
    mangaId: number;
    downloadId: string;
    clientType: string;
    progress: number;
    reason: string;
    failureReason: DownloadFailureReason;
    releaseName: string | undefined;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check if a torrent should be failed due to 0 seeders or stalled download.
 * Returns a failure reason string, or null if the torrent is healthy.
 */
export function checkTorrentHealth(
    check: TorrentHealthCheck,
    state: TorrentHealthState,
    stallThreshold: number
): TorrentHealthResult {
    const { progress, seeds, downloadSpeed, iteration } = check;

    // 0-seed detection: no seeds and no progress after 60s
    if (seeds === 0 && progress === 0 && iteration > 12) {
        return {
            failReason: 'Torrent has 0 seeders — no peers available to download from',
            updatedState: state
        };
    }

    // Stall detection: progress stuck with 0 download speed (incomplete swarm)
    let newStallCount = state.stallCount;
    if (progress === state.lastProgress && downloadSpeed === 0 && progress < 100 && progress > 0) {
        newStallCount++;
    } else {
        newStallCount = 0;
    }

    const updatedState: TorrentHealthState = { lastProgress: progress, stallCount: newStallCount };

    if (newStallCount >= stallThreshold) {
        return {
            failReason: `Torrent stalled at ${progress}% — no seeder has the complete file`,
            updatedState
        };
    }

    return { failReason: null, updatedState };
}

// ============================================================================
// Status Unwrapping
// ============================================================================

/**
 * Unwrap download status from ClientDownloadService.getDownloadStatus().
 *
 * getDownloadStatus wraps client.getStatus() (which returns AsyncResult<DownloadStatusInfo>)
 * inside another createSuccessResult(), double-wrapping it. This helper unwraps to get
 * the actual DownloadStatusInfo fields (progress, seeds, etc.).
 */
export function unwrapDownloadStatus(statusData: unknown): Record<string, unknown> {
    if (!statusData || typeof statusData !== 'object') {
        return {};
    }

    const outer = statusData as Record<string, unknown>;

    // Check if this is a double-wrapped AsyncResult (has .data containing the actual status)
    if ('data' in outer && outer['data'] && typeof outer['data'] === 'object') {
        return outer['data'] as Record<string, unknown>;
    }

    // Already unwrapped — return as-is
    return outer;
}

// ============================================================================
// Failure Handling
// ============================================================================

/**
 * Handle a torrent health failure: remove from client, blocklist, retry with alternative.
 * Falls back to simple job failure if retry is not possible.
 */
export async function handleProgressFailure(
    prismaClient: PrismaClient,
    clientService: ClientDownloadService,
    jobId: bigint, partitionKey: string,
    params: ProgressFailureParams
): Promise<void> {
    const { mangaId, downloadId, clientType, progress, reason, failureReason, releaseName } = params;
    logger.warn(`[DownloadManager] Job ${jobId}: ${reason}`);

    pipelineEventBus.emit(PIPELINE_EVENTS.DOWNLOAD_FAILED, {
        timestamp: new Date(),
        source: 'torrent-health',
        mangaId,
        downloadId,
        jobId: String(jobId),
        error: reason,
        willRetry: false,
    });

    // iter-4: remove from client but keep downloaded files on disk. The
    // reconciliation sweep scans the filesystem for matching release titles
    // when the client no longer tracks the torrent — preserved files are
    // what lets a "failed" chapter get rescued if the torrent actually
    // finished in the background.
    try {
        await clientService.removeDownload(clientType, downloadId, false);
        logger.info(`[DownloadManager] Removed failed download ${downloadId} from ${clientType} (files preserved)`);
    } catch (removeErr: unknown) {
        logger.warn(`[DownloadManager] Could not remove download ${downloadId}:`, removeErr);
    }

    // Get retry config and attempt retry with blocklist
    const retryService = getRetryService(prismaClient);
    const retryConfig = await retryService.getRetryConfig();

    const job = await prismaClient.jobs.findFirst({ where: { id: jobId } });
    if (!job) { return; }
    const jobResultStr = typeof job.result === 'string' ? job.result : JSON.stringify(job.result);

    // Scope to the failed job's own chapter set (payload.chapterIds is the
    // authoritative dispatch list). Falls back to the legacy broad-sweep
    // only when payload is malformed — that branch existed before iter-IM
    // and keeps pre-payload-tagging jobs working.
    const payloadChapterIds = extractChapterIdsFromPayload(job.payload);
    let chapterIds: number[];
    if (payloadChapterIds.length > 0) {
        chapterIds = payloadChapterIds;
    } else {
        const chapters = await prismaClient.chapter.findMany({
            where: { mangaId, downloadStatus: 'DOWNLOADING' },
            select: { id: true }
        });
        chapterIds = chapters.map(ch => ch.id);
        logger.warn(`[DownloadManager] Job ${jobId}: payload.chapterIds missing — falling back to broad-sweep (${chapterIds.length} chapters)`);
    }

    const retried = await attemptDownloadRetry(prismaClient, retryConfig, {
        job: { id: jobId, partition_key: partitionKey, attempt_count: job.attempt_count, result: jobResultStr },
        downloadId, clientType, mangaId, chapterIds,
        failureReason, releaseTitle: releaseName ?? '',
    });

    if (retried) {
        logger.info(`[DownloadManager] Retry triggered for job ${jobId} — blocklisted "${releaseName ?? 'unknown'}"`);
        return;
    }

    // Retry not possible — blocklist and fail permanently
    if (retryConfig.autoBlockFailed) {
        const releaseUrl = extractReleaseUrl(job.result);
        await autoBlockFailedRelease(prismaClient, {
            releaseTitle: releaseName ?? '', releaseUrl,
            mangaId, failureReason: reason, expiryDays: retryConfig.blockExpiryDays,
        });
    }

    // Soft-fail: send chapters back to PENDING so the next dispatch can
    // pick them up. The job stays `failed` with `last_error` populated —
    // that is the audit trail the jobs page surfaces; we just don't burn
    // chapter rows to ERROR for sparse-seeder webtoon torrents.
    await resetChaptersToPending(prismaClient, chapterIds, mangaId);
    await prismaClient.jobs.update({
        where: { id_partition_key: { id: jobId, partition_key: partitionKey } },
        data: {
            status: 'failed' as JobStatus,
            last_error: { message: reason } as Prisma.InputJsonValue,
            completed_at: new Date()
        }
    });
    void realtimeEmitter.emitDownloadFailed(
        { taskId: String(jobId), mangaId, progress, status: 'failed' },
        reason
    );
}

// ============================================================================
// Download Completion
// ============================================================================

/**
 * Handle download completion: keep job active during import, then mark done.
 * Emits real-time progress so the UI shows download → importing → completed.
 *
 * Builds the full download path from savePath + torrent name and applies path mapping
 * to resolve remote client paths (e.g. /data/completed → /Volumes/Public/data/completed).
 */
// eslint-disable-next-line max-params -- 7 distinct identifiers from the job row + torrent payload; bundling them into an object hides intent at every call site
export async function handleDownloadCompletion(
    prismaClient: PrismaClient,
    jobId: bigint, partitionKey: string,
    mangaId: number, downloadId: string, savePath: string, torrentName: string | undefined
): Promise<void> {
    const where = { id_partition_key: { id: jobId, partition_key: partitionKey } };

    // Phase 1: Download done — notify UI, keep job active for import
    pipelineEventBus.emit(PIPELINE_EVENTS.DOWNLOAD_COMPLETED, {
        timestamp: new Date(),
        source: 'torrent-health',
        mangaId,
        downloadId,
        jobId: String(jobId),
        savePath,
        size: 0,
    });

    await prismaClient.jobs.update({ where, data: { progress: 100 } });
    void realtimeEmitter.emitDownloadProgress({
        taskId: String(jobId), mangaId, progress: 100, status: 'importing',
    });
    logger.info(`[DownloadManager] Job ${jobId} download complete, starting import`);

    // Phase 2: Build full path and apply path mapping
    const localPath = await resolveDownloadPath(savePath, torrentName);
    logger.info(`[DownloadManager] Resolved download path: "${localPath}"`);

    // Phase 3: Run pack import with retry-on-not-ready.
    //
    // The import's readiness check (`waitForPackReadiness`) gives up after
    // ~67s — fine for fast SMB/NFS finishes, but slow seeders + post-
    // completion file moves regularly take several minutes. Without retry,
    // the first miss marked the chapter_download job permanently failed
    // (~88% of chapter_download failures in the 7d survey). Retry every
    // 30s up to a 10-minute wallclock deadline; each attempt re-runs the
    // probe loop, so files that materialize between attempts are picked
    // up immediately on the next pass.
    const importSuccess = await runPackImportWithRetry(prismaClient, jobId, downloadId, localPath, mangaId);

    // Phase 4: Mark job based on import outcome
    if (importSuccess) {
        logger.info(`[DownloadManager] Job ${jobId} import finished successfully`);
        await prismaClient.jobs.update({
            where, data: { status: 'completed' as JobStatus, completed_at: new Date() }
        });
        void realtimeEmitter.emitDownloadCompleted({
            taskId: String(jobId), mangaId, progress: 100, status: 'completed',
        });
    } else {
        logger.warn(`[DownloadManager] Job ${jobId} pack import failed, marking job as failed`);
        await prismaClient.jobs.update({
            where, data: {
                status: 'failed' as JobStatus,
                last_error: { message: 'Pack import failed after download completed' } as Prisma.InputJsonValue,
                completed_at: new Date()
            }
        });
        void realtimeEmitter.emitDownloadFailed(
            { taskId: String(jobId), mangaId, progress: 100, status: 'failed' },
            'Pack import failed after download completed'
        );
    }
}

// Pack import retry helper moved to ../download-monitor/pack-import-retry.ts
// so the downloadMonitor sweep path can share the same wallclock-bounded retry.

/**
 * Resolve a download path from the client to a local filesystem path.
 *
 * 1. Applies configured path mappings via `mapAndProbe` (combines the longest-
 *    prefix rule with a cached R_OK probe so a slow/unreachable mount fails
 *    fast instead of stalling each consumer's `fs.stat`).
 * 2. If the mapped path is not reachable, scans all mapping localPaths for the
 *    torrent folder (catches the case where the user has the file mounted
 *    under a different prefix than the one Transmission reports).
 * 3. Falls back to the mapped path even if it isn't reachable — the import
 *    layer (`pack-import-handler`) does its own accessibility check and emits
 *    a user-visible notification on failure, so we don't double-warn here.
 */
async function resolveDownloadPath(savePath: string, torrentName: string | undefined): Promise<string> {
    const { existsSync } = await import('fs');
    const { getPathMapper } = await import('../pathMapper');
    const pathMapper = getPathMapper();

    // Ensure mappings are loaded from DB before resolving
    await pathMapper.loadFromDatabase();

    const remoteFull = torrentName ? path.join(savePath, torrentName) : savePath;
    const probe = await pathMapper.mapAndProbe(remoteFull);
    if (probe.accessible) return probe.localPath;

    // Mapped path not reachable — try finding the torrent folder in known local paths
    if (torrentName) {
        const mappings = pathMapper.getMappings();
        for (const m of mappings) {
            const candidate = path.join(m.localPath, torrentName);
            if (existsSync(candidate)) {
                logger.info(`[DownloadManager] Found torrent at fallback path: ${candidate}`);
                return candidate;
            }
        }
    }

    logger.warn(
        `[DownloadManager] Download path not reachable: ${remoteFull} → ${probe.localPath} (${probe.error ?? 'unknown'})`,
    );
    return probe.localPath;
}
