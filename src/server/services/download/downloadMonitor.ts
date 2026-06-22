/**
 * DownloadMonitor - Orchestrator for monitoring download clients
 *
 * The state machine drives all status updates. After state transitions,
 * syncToDatabase() handles DB synchronization for terminal states.
 *
 * Delegates to: utils, job-parser, download-status-checker,
 * chapter-manager, pack-import-handler, retry-handler
 */

import { prisma } from '@/server/db';
import { pipelineEventBus } from '@/server/services/pipeline/pipeline-event-bus';
import { realtimeEmitter } from '@/server/services/realtime';
import { autoBlockFailedRelease } from '@/server/services/release-blocklist/blocklist-manager';
import { PIPELINE_EVENTS } from '@/types/domain/pipeline-events';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { ClientDownloadService } from './clientDownload';
import { fetchDownloadingChapters } from './download-monitor/chapter-manager';
import {
  checkDownloadStatus as checkClientDownloadStatus,
  isDownloadComplete,
  isDownloadFailed,
} from './download-monitor/download-status-checker';
import { parseJobResult, isPackMode } from './download-monitor/job-parser';
import { runPackImportWithRetry } from './download-monitor/pack-import-retry';
import { attemptDownloadRetry, extractReleaseUrl } from './download-monitor/retry-handler';
import { classifyDownloadFiles } from './media-format-guard';
import { getRetryService, DownloadFailureReason, detectFailure } from './retry';
import { syncToDatabase } from './tracked-download/db-sync';
import { TrackedDownloadService } from './tracked-download/tracked-download-service';
import { TrackedDownloadEvent, TrackedDownloadState } from './tracked-download/types';

import type { DownloadItem, GetStatusOptions } from './base';
import type { ValidatedDownloadStatus } from './download-monitor/download-status-checker';
import type { CompletedDownload } from './download-monitor/utils';
import type { DownloadRetryConfig, DownloadClientStatus } from './retry';
import type { Prisma, PrismaClient } from '@prisma/client';

/** Full job type returned by findMany with manga included */
type JobWithManga = Prisma.jobsGetPayload<{ include: { manga: true } }>;

/** Parsed job context for per-job processing */
interface JobContext {
  job: JobWithManga;
  downloadId: string;
  clientType: string;
  mode: string | undefined;
  mangaId: number;
  chapterIds: number[];
  isPack: boolean;
}

/** Client types whose downloads are torrents (vs usenet). Only these expose a
 *  meaningful per-file list for the video-only guard. */
const TORRENT_CLIENT_TYPES = new Set(['transmission', 'deluge', 'qbittorrent', 'rtorrent']);

/**
 * DownloadMonitor - State machine driven orchestrator
 */
export class DownloadMonitor {
  private downloadService: ClientDownloadService;
  private retryConfig: DownloadRetryConfig | null = null;
  private trackedDownloadService: TrackedDownloadService;

  constructor(private prismaClient: PrismaClient = prisma) {
    this.downloadService = new ClientDownloadService(prismaClient);
    this.trackedDownloadService = TrackedDownloadService.getInstance();
  }

  private async getRetryConfig(): Promise<DownloadRetryConfig> {
    if (!this.retryConfig) {
      const retryService = getRetryService(this.prismaClient);
      this.retryConfig = await retryService.getRetryConfig();
    }
    return this.retryConfig;
  }

  /**
   * Check all active downloads across all enabled clients
   *
   * @returns AsyncResult containing array of completed downloads ready for import
   */
  async checkCompletedDownloads(): Promise<AsyncResult<CompletedDownload[], Error>> {
    try {
      const activeJobs = await this.prismaClient.jobs.findMany({
        where: { status: 'active', job_type: 'chapter_download', result: { not: { equals: null } } },
        include: { manga: true },
      });
      logger.info(`[DownloadMonitor] Found ${activeJobs.length} active download jobs to monitor`);
      const completedDownloads: CompletedDownload[] = [];

      // Sequential: each job's status check affects download client state
      for (const job of activeJobs) {
        // eslint-disable-next-line no-await-in-loop
        const completed = await this.processJobStatus(job);
        if (completed) { completedDownloads.push(completed); }
      }

      logger.info(`[DownloadMonitor] Found ${completedDownloads.length} completed downloads ready for import`);
      return createSuccessResult(completedDownloads);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check completed downloads';
      logger.error('[DownloadMonitor] Error checking completed downloads:', error);
      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Process a single job's download status
   *
   * @returns CompletedDownload if download finished, null otherwise
   */
  private async processJobStatus(job: JobWithManga): Promise<CompletedDownload | null> {
    const parsed = parseJobResult(job);
    if (!parsed) {
      logger.warn(`[DownloadMonitor] Invalid job data for job ${job.id}`);
      return null;
    }

    const { downloadId, clientType, mode, mangaId } = parsed;
    const isPack = isPackMode(mode);

    const chaptersResult = await fetchDownloadingChapters(this.prismaClient, mangaId, isPack);
    if (!isSuccess(chaptersResult)) {
      if (isError(chaptersResult)) {
        logger.error(`[DownloadMonitor] Failed to fetch chapters for job ${job.id}:`, chaptersResult.error);
      }
      return null;
    }

    const chapterIds = chaptersResult.data;
    if (!isPack && chapterIds.length === 0) {
      logger.debug(`[DownloadMonitor] Job ${job.id} already imported, skipping`);
      return null;
    }

    const statusResult = await checkClientDownloadStatus(this.downloadService, clientType, downloadId);
    if (!isSuccess(statusResult)) {
      // Download client can't find this torrent — it was removed or never existed.
      // Fail the job so it doesn't stay stuck as "active" forever.
      const errorMsg = isError(statusResult)
        ? statusResult.error.message
        : 'Download not found in client';
      logger.warn(`[DownloadMonitor] Download ${downloadId} not found for job ${job.id}: ${errorMsg}`);

      const where = { id_partition_key: { id: job.id, partition_key: job.partition_key } };
      await this.prismaClient.jobs.update({
        where,
        data: {
          status: 'failed',
          progress: 100,
          completed_at: new Date(),
          last_error: { message: `Download removed from client: ${errorMsg}` },
        },
      });
      return null;
    }

    const downloadStatus = statusResult.data;
    const retryConfig = await this.getRetryConfig();
    const ctx: JobContext = { job, downloadId, clientType, mode, mangaId, chapterIds, isPack };

    // Ensure tracked download exists for state machine tracking
    await this.ensureTracking(ctx);

    // Backstop: reject video-only releases (anime .mkv packs mislabeled as
    // manga) once the client exposes the file list — before we import/seed them.
    if (await this.rejectIfVideoOnly(ctx)) return null;

    if (isDownloadComplete(downloadStatus.status) && downloadStatus.savePath) {
      return this.handleCompleted(ctx, downloadStatus);
    }
    if (isDownloadFailed(downloadStatus.status)) {
      await this.handleFailed(ctx, downloadStatus, retryConfig);
      return null;
    }
    await this.handleInProgress(ctx, downloadStatus, retryConfig);
    return null;
  }

  /** Handle a completed/seeding download */
  private async handleCompleted(ctx: JobContext, ds: ValidatedDownloadStatus): Promise<CompletedDownload> {
    const { job, downloadId, clientType, mode, mangaId, chapterIds, isPack } = ctx;
    const trackingId = `job:${String(job.id)}`;

    logger.info(`[DownloadMonitor] Download ${downloadId} ${ds.status === 'SEEDING' ? 'seeding' : 'completed'}!`);

    pipelineEventBus.emit(PIPELINE_EVENTS.DOWNLOAD_COMPLETED, {
      timestamp: new Date(), source: 'download-monitor',
      mangaId, downloadId, jobId: String(job.id),
      savePath: ds.savePath ?? '', size: ds.size ?? 0,
    });

    const completed: CompletedDownload = {
      jobId: String(job.id), downloadId, clientType,
      savePath: ds.savePath ?? '', fileName: ds.name ?? 'unknown',
      mangaId, chapterIds, size: ds.size ?? 0, status: ds.status,
      ...(mode ? { mode } : {}),
    };

    // Transition: Downloading -> ImportPending
    this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.DOWNLOAD_COMPLETED);

    if (isPack) {
      logger.info(`[DownloadMonitor] PACK download completed, triggering import for job ${job.id}`);

      // Transition: ImportPending -> Importing
      this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.IMPORT_STARTED);

      const importSuccess = await runPackImportWithRetry(this.prismaClient, job.id, downloadId, ds.savePath ?? '', mangaId);

      if (importSuccess) {
        this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.IMPORT_COMPLETED);
      } else {
        this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.IMPORT_FAILED, 'Pack import failed');
      }
    } else {
      // Non-pack: rapid transition through import phases
      this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.IMPORT_STARTED);
      this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.IMPORT_COMPLETED);
    }

    // Sync final state to database (replaces markJobCompleted / markJobFailedFromImport)
    const tracked = this.trackedDownloadService.get(trackingId);
    if (tracked) {
      await syncToDatabase(this.prismaClient, tracked, TrackedDownloadState.DOWNLOADING);
    }

    // Emit realtime events for UI
    if (tracked?.state === TrackedDownloadState.IMPORTED) {
      void realtimeEmitter.emitDownloadCompleted({
        taskId: String(job.id), mangaId, progress: 100, status: 'completed',
      });
    } else {
      void realtimeEmitter.emitDownloadFailed(
        { taskId: String(job.id), mangaId, progress: 100, status: 'failed' },
        'Pack import failed after download completed',
      );
    }

    return completed;
  }

  /** Handle a failed download -- retry, then blocklist and fail */
  private async handleFailed(
    ctx: JobContext, ds: ValidatedDownloadStatus, retryConfig: DownloadRetryConfig,
  ): Promise<void> {
    const { job, downloadId, clientType, mangaId, chapterIds } = ctx;
    const trackingId = `job:${String(job.id)}`;

    logger.error(`[DownloadMonitor] Download ${downloadId} failed: ${ds.status}`);

    pipelineEventBus.emit(PIPELINE_EVENTS.DOWNLOAD_FAILED, {
      timestamp: new Date(), source: 'download-monitor',
      mangaId, downloadId, jobId: String(job.id),
      error: `Download failed: ${ds.status}`,
      willRetry: job.attempt_count < retryConfig.maxAttempts,
    });

    const jobResultStr = typeof job.result === 'string' ? job.result : JSON.stringify(job.result);
    const retried = await attemptDownloadRetry(this.prismaClient, retryConfig, {
      job: { id: job.id, partition_key: job.partition_key, attempt_count: job.attempt_count, result: jobResultStr },
      downloadId, clientType, mangaId, chapterIds,
      failureReason: DownloadFailureReason.CLIENT_ERROR, releaseTitle: ds.name ?? '',
    });

    // Transition: Downloading -> DownloadFailed
    this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.DOWNLOAD_FAILED);

    if (retried) {
      logger.info(`[DownloadMonitor] Retry triggered for job ${job.id}`);
      // Transition: DownloadFailed -> Queued (retry handler already updated the job)
      this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.RETRY_STARTED);
      return;
    }

    // Failed permanently: DownloadFailed -> Failed
    this.trackedDownloadService.transitionState(
      trackingId, TrackedDownloadEvent.RETRIES_EXHAUSTED, `Download failed: ${ds.status}`,
    );

    // Blocklist the release if configured
    await this.blocklistRelease({
      retryConfig, job, downloadName: ds.name ?? '',
      mangaId, failureReason: `Download failed: ${ds.status}`,
    });

    // Sync failed state to DB (replaces updateChaptersToError + updateJobToFailed)
    const tracked = this.trackedDownloadService.get(trackingId);
    if (tracked) {
      await syncToDatabase(this.prismaClient, tracked, TrackedDownloadState.DOWNLOADING);
    }
  }

  /** Persist a successful progress tick: DB update + WS emit + tracker update */
  private async recordHealthyProgress(
    ctx: JobContext,
    ds: ValidatedDownloadStatus,
    state: { progress: number; dlSpeed: number; rawEta: number | undefined; seeds: number | undefined; trackingId: string },
  ): Promise<void> {
    const { job, downloadId, mangaId } = ctx;
    const { progress, dlSpeed, rawEta, seeds, trackingId } = state;
    logger.debug(`[DownloadMonitor] Download ${downloadId}: ${ds.status} (in progress)`);
    const where = { id_partition_key: { id: job.id, partition_key: job.partition_key } };
    await this.prismaClient.jobs.update({ where, data: { progress: Math.round(progress) } });
    void realtimeEmitter.emitDownloadProgress({
      taskId: String(job.id), mangaId, progress,
      status: 'downloading', filename: ds.name ?? 'unknown',
      ...(dlSpeed > 0 ? { speed: dlSpeed } : {}),
      ...(rawEta !== undefined && rawEta >= 0 ? { eta: rawEta } : {}),
    });
    this.trackedDownloadService.updateProgress(trackingId, progress, dlSpeed, seeds ?? null);
  }

  /** Handle in-progress download -- detect stalls, update progress */
  private async handleInProgress(
    ctx: JobContext, ds: ValidatedDownloadStatus, retryConfig: DownloadRetryConfig,
  ): Promise<void> {
    const { job, downloadId, clientType, mangaId, chapterIds } = ctx;
    const trackingId = `job:${String(job.id)}`;

    // Access extra fields preserved by passthrough() schema
    const raw = ds as unknown as Record<string, unknown>;
    const seeds = typeof raw['seeds'] === 'number' ? raw['seeds'] : undefined;
    const dlSpeed = typeof raw['downloadSpeed'] === 'number' ? raw['downloadSpeed'] : 0;
    const rawEta = typeof raw['eta'] === 'number' ? raw['eta'] : undefined;
    const progress = ds.progress ?? 0;
    // Use the job's actual age. Guard against timezone mismatch: if started_at
    // appears to be in the future (due to DB timezone offset), clamp to 0.
    const rawSinceStart = Math.floor((Date.now() - (job.started_at?.getTime() ?? Date.now())) / 1000);
    const sinceStart = Math.max(0, rawSinceStart);

    // Grace period: new torrents need time to connect to trackers/peers.
    // Don't consider a download stalled until it's been active for at least 2 minutes.
    const STALL_GRACE_PERIOD_SECONDS = 120;
    const pastGracePeriod = sinceStart > STALL_GRACE_PERIOD_SECONDS;
    const looksStalled = dlSpeed === 0 && progress < 2 && pastGracePeriod;

    const clientStatus: DownloadClientStatus = {
      status: ds.status, progress,
      isStalled: looksStalled,
      secondsSinceLastProgress: looksStalled ? sinceStart : 0,
      ...(seeds !== undefined && { seeders: seeds }),
    };
    const failureCheck = detectFailure(clientStatus, retryConfig);

    // Normal progress -- update and return
    if (!failureCheck.isFailure) {
      await this.recordHealthyProgress(ctx, ds, { progress, dlSpeed, rawEta, seeds, trackingId });
      return;
    }

    // Download is unhealthy -- retry, then blocklist and fail
    logger.warn(`[DownloadMonitor] Download ${downloadId} unhealthy: ${failureCheck.description}`);
    const jobResultStr = typeof job.result === 'string' ? job.result : JSON.stringify(job.result);
    const stallRetry = await attemptDownloadRetry(this.prismaClient, retryConfig, {
      job: { id: job.id, partition_key: job.partition_key, attempt_count: job.attempt_count, result: jobResultStr },
      downloadId, clientType, mangaId, chapterIds,
      failureReason: failureCheck.reason ?? DownloadFailureReason.STALLED, releaseTitle: ds.name ?? '',
    });

    // Transition: Downloading -> DownloadFailed
    this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.DOWNLOAD_FAILED);

    if (stallRetry) {
      logger.info(`[DownloadMonitor] Retry triggered for stalled job ${job.id}`);
      // Transition: DownloadFailed -> Queued (retry handler already updated the job)
      this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.RETRY_STARTED);
      return;
    }

    // Failed permanently: DownloadFailed -> Failed
    this.trackedDownloadService.transitionState(
      trackingId, TrackedDownloadEvent.RETRIES_EXHAUSTED, failureCheck.description ?? 'Download stalled',
    );

    // Blocklist the release if configured
    await this.blocklistRelease({
      retryConfig, job, downloadName: ds.name ?? '',
      mangaId, failureReason: failureCheck.description ?? 'Download stalled',
    });

    // Sync failed state to DB
    const tracked = this.trackedDownloadService.get(trackingId);
    if (tracked) {
      await syncToDatabase(this.prismaClient, tracked, TrackedDownloadState.DOWNLOADING);
    }
  }

  /** Get status of a specific download from its client */
  async getDownloadStatus(
    clientType: string, downloadId: string, options?: GetStatusOptions,
  ): Promise<AsyncResult<DownloadItem, Error>> {
    const statusResult = await this.downloadService.getDownloadStatus(clientType, downloadId, options);
    if (isError(statusResult)) { return statusResult; }
    if (!isSuccess(statusResult)) { return createErrorResult(new Error('Failed to get download status')); }
    return createSuccessResult(statusResult.data as DownloadItem);
  }

  /** Check if a specific job's download is complete */
  async checkJobDownload(jobId: string): Promise<AsyncResult<CompletedDownload | null, Error>> {
    const jobWhere = { id_partition_key: { id: BigInt(jobId), partition_key: 'active' } };
    try {
      const job = await this.prismaClient.jobs.findUnique({ where: jobWhere, include: { manga: true } });
      if (!job) { return createErrorResult(new Error(`Job ${jobId} not found`)); }
      if (job.status !== 'active' || job.job_type !== 'chapter_download') {
        return createSuccessResult(null);
      }

      const parsed = parseJobResult(job);
      if (!parsed) { return createErrorResult(new Error(`Invalid job result for job ${jobId}`)); }

      const { downloadId, clientType, mangaId } = parsed;
      const statusResult = await this.getDownloadStatus(clientType, downloadId);
      if (!isSuccess(statusResult)) {
        return isError(statusResult) ? statusResult : createErrorResult(new Error('Failed to get download status'));
      }

      const downloadItem = statusResult.data;
      if (downloadItem.status !== 'COMPLETED' || !downloadItem.savePath) {
        return createSuccessResult(null);
      }

      const chapterQuery = { where: { mangaId, downloadStatus: 'DOWNLOADING' as const }, select: { id: true as const } };
      const chapters = await this.prismaClient.chapter.findMany(chapterQuery);
      return createSuccessResult({
        jobId: String(job.id), downloadId, clientType,
        savePath: downloadItem.savePath, fileName: downloadItem.name,
        mangaId, chapterIds: chapters.map(ch => ch.id),
        size: downloadItem.size ?? 0, status: String(downloadItem.status),
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check job download';
      logger.error(`[DownloadMonitor] Error checking job ${jobId}:`, error);
      return createErrorResult(new Error(errorMessage));
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /** Ensure a tracked download exists in the state machine cache */
  private async ensureTracking(ctx: JobContext): Promise<void> {
    const trackingId = `job:${String(ctx.job.id)}`;
    if (this.trackedDownloadService.get(trackingId)) {
      return;
    }

    // Look up associated PackDownload so failure state transitions update it
    let packDownloadId: bigint | null = null;
    if (ctx.isPack) {
      try {
        const packDownload = await this.prismaClient.packDownload.findFirst({
          where: { jobId: ctx.job.id },
          select: { id: true },
        });
        packDownloadId = packDownload?.id ?? null;
      } catch {
        // Non-fatal — pack cleanup handled by PostgreSQLQueueWorker as fallback
      }
    }

    this.trackedDownloadService.create({
      downloadId: ctx.downloadId,
      clientType: ctx.clientType,
      mode: ctx.isPack ? 'PACK' : 'SINGLE',
      mangaId: ctx.mangaId,
      mangaTitle: ctx.job.manga?.title ?? 'Unknown',
      releaseTitle: '',
      chapterIds: ctx.chapterIds,
      jobId: ctx.job.id,
      packDownloadId,
    });

    // Job is already active -- transition Queued -> Downloading
    this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.DOWNLOAD_STARTED);
  }

  /**
   * Backstop for video releases that passed pre-download filtering: once the
   * torrent client exposes the file list, if it's all video (no manga files)
   * remove it, blocklist the release, and fail the job — so we never import or
   * keep seeding a video pack mislabeled as manga (job 13168, a 31GB JoJo BD
   * pack of 26 .mkv files tagged "Other"). Returns true if it acted.
   */
  private async rejectIfVideoOnly(ctx: JobContext): Promise<boolean> {
    if (!TORRENT_CLIENT_TYPES.has(ctx.clientType.toLowerCase())) return false;

    const statusResult = await this.getDownloadStatus(ctx.clientType, ctx.downloadId, { includeFiles: true });
    if (!isSuccess(statusResult)) return false;

    const verdict = classifyDownloadFiles(statusResult.data.files);
    if (!verdict.isVideoOnly) return false;

    const { job, downloadId, clientType, mangaId } = ctx;
    const name = statusResult.data.name;
    const trackingId = `job:${String(job.id)}`;
    logger.warn(
      `[DownloadMonitor] Rejecting video-only download for job ${job.id} ` +
      `(${verdict.videoCount}/${verdict.total} video files, 0 manga): ${name}`,
    );

    // Drop it from the client (and delete the files we don't want).
    await this.downloadService.removeDownload(clientType, downloadId, true);

    // Blocklist so it isn't re-picked, then fail the job permanently.
    const retryConfig = await this.getRetryConfig();
    await this.blocklistRelease({
      retryConfig,
      job: { id: job.id, result: job.result },
      downloadName: name, mangaId, failureReason: 'video_content',
    });

    this.trackedDownloadService.transitionState(trackingId, TrackedDownloadEvent.DOWNLOAD_FAILED);
    this.trackedDownloadService.transitionState(
      trackingId, TrackedDownloadEvent.RETRIES_EXHAUSTED, 'Rejected: video-only release',
    );

    await this.prismaClient.jobs.update({
      where: { id_partition_key: { id: job.id, partition_key: job.partition_key } },
      data: {
        status: 'failed',
        progress: 100,
        completed_at: new Date(),
        last_error: {
          message: `Rejected video-only release (${verdict.videoCount} video files, no manga): ${name}`,
        },
      },
    });

    void realtimeEmitter.emitDownloadFailed(
      { taskId: String(job.id), mangaId, progress: 100, status: 'failed' },
      'Rejected: download contained only video files',
    );

    return true;
  }

  /** Auto-blocklist a failed release */
  private async blocklistRelease(opts: {
    retryConfig: DownloadRetryConfig;
    job: { id: bigint; result: unknown };
    downloadName: string; mangaId: number; failureReason: string;
  }): Promise<void> {
    if (!opts.retryConfig.autoBlockFailed) return;

    const releaseUrl = extractReleaseUrl(opts.job.result);
    await autoBlockFailedRelease(this.prismaClient, {
      releaseTitle: opts.downloadName, releaseUrl,
      mangaId: opts.mangaId, failureReason: opts.failureReason,
      expiryDays: opts.retryConfig.blockExpiryDays,
    });
  }
}

export type { CompletedDownload };
