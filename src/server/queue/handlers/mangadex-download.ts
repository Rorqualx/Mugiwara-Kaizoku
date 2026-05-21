/**
 * MangaDex Download Job Handler
 *
 * Handles MangaDex chapter download jobs from the queue.
 * Downloads chapter images and bundles them into CBZ files.
 *
 * @module server/queue/handlers/mangadex-download
 */

import path from 'path';

import { ChapterStatus, jobs, JobType, NativeDownloadStatus } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import type { ComicInfoMetadata } from '@/server/services/native-download/downloaders/cbz-bundler';
import { mangadexDownloader } from '@/server/services/native-download/downloaders/mangadex-downloader';
import type { DownloadProgress, MangaDexDownloadResult } from '@/server/services/native-download/downloaders/mangadex-downloader';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { invalidateMangaCache } from '@/server/trpc/routers/manga/crud-operations/get-manga-cache';
import { logger } from '@/utils/logger';



const log = logger.child('mangadexDownloadHandler');

/**
 * Zod schema for MangaDex download job payload
 */
const MangaDexDownloadPayloadSchema = z.object({
  mangaId: z.number(),
  downloadId: z.string(), // cuid from NativeDownload
  mangadexChapterId: z.string(),
  chapterNumber: z.number().optional(),
  quality: z.enum(['full', 'dataSaver']).default('full'),
  destinationPath: z.string(),
  metadata: z.object({
    title: z.string().optional(),
    series: z.string().optional(),
    number: z.string().optional(),
    volume: z.string().optional(),
    language: z.string().optional(),
    teams: z.array(z.string()).optional()
  }).optional()
});

type MangaDexDownloadPayload = z.infer<typeof MangaDexDownloadPayloadSchema>;

/**
 * Convert bigint job id to number safely
 */
function jobIdToNumber(jobId: bigint): number {
  return Number(jobId);
}

/**
 * Handle MangaDex download job
 *
 * `signal` aborts when the job's `hard_timeout_at` is reached (default
 * 30min absolute deadline). Threaded into the MangaDex downloader so
 * stalled fetches don't outlive the lease — see iter-4 of the
 * retry-exhaustion + stuck-jobs improvement loop.
 */
export async function handleMangaDexDownload(job: jobs, signal?: AbortSignal): Promise<void> {
  const result = MangaDexDownloadPayloadSchema.safeParse(job.payload);

  if (!result.success) {
    log.error('Invalid MangaDex download payload', { error: result.error.message });
    throw new Error(`Invalid job payload: ${result.error.message}`);
  }

  const payload = result.data;
  const jobIdNum = jobIdToNumber(job.id);

  log.info('Processing MangaDex download', {
    jobId: jobIdNum,
    mangaId: payload.mangaId,
    chapterId: payload.mangadexChapterId,
    downloadId: payload.downloadId
  });

  // Update download status to DOWNLOADING
  await updateDownloadStatus(payload.downloadId, NativeDownloadStatus.DOWNLOADING);

  // Emit start event
  emitDownloadEvent(jobIdNum, payload, 'started');

  // Set up progress listener. The MangaDexDownloader is a shared singleton
  // EventEmitter, so every concurrent handler hears every chapter's progress
  // events. Filter by chapterId so a parallel job's progress doesn't
  // overwrite this job's row, and persist progress to the DB so the polling
  // Jobs page can render it (the realtime emission alone doesn't survive a
  // socket drop).
  let lastWrittenProgress = -1;
  const progressHandler = (progress: DownloadProgress): void => {
    if (progress.chapterId !== payload.mangadexChapterId) return;
    emitDownloadProgress(jobIdNum, payload, progress);
    const pct = progress.percentage;
    if (pct > lastWrittenProgress && pct <= 100) {
      lastWrittenProgress = pct;
      // updateMany + status guard so a late-arriving in-flight write doesn't
      // crash with P2025 when `completeJob` has already moved the row to
      // jobs_archived (we fire-and-forget here; many of these get queued).
      void prisma.jobs.updateMany({
        where: { id: job.id, partition_key: job.partition_key, status: 'active' },
        data: { progress: pct },
      }).catch((updErr: unknown) => {
        log.warn('Failed to persist chapter download progress', {
          jobId: jobIdNum,
          error: updErr instanceof Error ? updErr.message : String(updErr),
        });
      });
    }
  };
  mangadexDownloader.on('progress', progressHandler);

  try {
    // Convert payload metadata to ComicInfoMetadata format
    const metadata: ComicInfoMetadata | undefined = payload.metadata
      ? {
          title: payload.metadata.title,
          series: payload.metadata.series,
          number: payload.metadata.number,
          volume: payload.metadata.volume,
          language: payload.metadata.language,
          teams: payload.metadata.teams
        }
      : undefined;

    // Download the chapter
    const downloadResult = await mangadexDownloader.downloadChapter({
      chapterId: payload.mangadexChapterId,
      outputPath: payload.destinationPath,
      quality: payload.quality,
      metadata,
      ...(signal ? { signal } : {}),
    });

    if (!downloadResult.success) {
      throw new Error(downloadResult.error ?? 'Download failed');
    }

    // Update download status to COMPLETED
    await updateDownloadStatus(payload.downloadId, NativeDownloadStatus.COMPLETED);

    // Register the file as a Chapter row so the reader picks it up. Idempotent
    // via the unique `mangadexId` index — re-downloads update the same row.
    await upsertChapterFromDownload(payload, downloadResult);

    // Emit completion event
    emitDownloadEvent(jobIdNum, payload, 'completed', {
      fileSize: downloadResult.fileSize,
      pageCount: downloadResult.pageCount,
      outputPath: downloadResult.outputPath
    });

    log.info('MangaDex download completed', {
      jobId: jobIdNum,
      downloadId: payload.downloadId,
      fileSize: downloadResult.fileSize,
      pageCount: downloadResult.pageCount
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Try Suwayomi fallback before declaring failure. If the chapter has
    // been synced (suwayomiChapterId set) we hand the existing
    // NativeDownload off to the Suwayomi handler. Per-manga enable was
    // dropped — the binding (synced chapter id) is the only signal needed.
    const handed = await tryEnqueueSuwayomiFallback(payload, errorMessage);
    if (handed) {
      log.warn('MangaDex download failed; delegated to Suwayomi fallback', {
        jobId: jobIdNum, downloadId: payload.downloadId, error: errorMessage,
      });
      // Persist the delegation in the job's result so dashboards/metrics can
      // distinguish "natural success" from "MangaDex failed but Suwayomi
      // took over." Job stays `completed` because the user did get the
      // chapter — just via the fallback path.
      await prisma.jobs.updateMany({
        where: { id: job.id, partition_key: job.partition_key, status: 'active' },
        data: {
          result: {
            delegatedFallback: 'suwayomi',
            originalError: errorMessage,
            delegatedAt: new Date().toISOString(),
          },
        },
      }).catch((updErr: unknown) => {
        log.warn('Failed to record fallback delegation on job row', {
          jobId: jobIdNum,
          error: updErr instanceof Error ? updErr.message : String(updErr),
        });
      });
      return;
    }

    await updateDownloadStatus(
      payload.downloadId,
      NativeDownloadStatus.FAILED,
      errorMessage,
    );

    emitDownloadEvent(jobIdNum, payload, 'failed', { error: errorMessage });

    log.error('MangaDex download failed', {
      jobId: jobIdNum,
      downloadId: payload.downloadId,
      error: errorMessage
    });

    throw error;
  } finally {
    // Remove progress listener
    mangadexDownloader.off('progress', progressHandler);
  }
}

/**
 * Inspect the manga + chapter rows to see if Suwayomi can take over for this
 * chapter. Enqueues a `JobType.suwayomi_download` job with the SAME
 * `downloadId` so the resulting CBZ updates the same NativeDownload row.
 * Returns true if the fallback was enqueued.
 */
async function tryEnqueueSuwayomiFallback(
  payload: MangaDexDownloadPayload,
  originalError: string,
): Promise<boolean> {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: { mangadexId: payload.mangadexChapterId },
      select: { id: true, suwayomiChapterId: true },
    });
    if (!chapter?.suwayomiChapterId) return false;

    const suwayomiChapterId = parseInt(chapter.suwayomiChapterId, 10);
    if (!Number.isFinite(suwayomiChapterId)) return false;

    // Don't delegate to Suwayomi if its server is unreachable — the
    // resulting suwayomi_download job would just fail with "No pages
    // returned from Suwayomi" and mask the real MangaDex error in the
    // delegatedFallback metadata. Better to surface the original failure.
    const { isSuwayomiReachable } = await import('@/server/services/suwayomi/server-reachable');
    if (!(await isSuwayomiReachable())) {
      log.info('Suwayomi fallback skipped: server unreachable', {
        mangaId: payload.mangaId, downloadId: payload.downloadId,
      });
      return false;
    }

    const fallbackPayload = {
      mangaId: payload.mangaId,
      downloadId: payload.downloadId,
      suwayomiChapterId,
      ...(payload.chapterNumber !== undefined ? { chapterNumber: payload.chapterNumber } : {}),
      destinationPath: payload.destinationPath,
      ...(payload.metadata ? { metadata: payload.metadata } : {}),
    };

    // Dynamic import keeps this handler decoupled from the queueManager
    // module graph (handlers/index.ts is imported BY queueManager).
    const { queueManager } = await import('../queueManager');
    await queueManager.enqueue(
      JobType.suwayomi_download,
      fallbackPayload,
      { mangaId: payload.mangaId, chapterId: chapter.id },
    );
    return true;
  } catch (err) {
    log.warn('Suwayomi fallback enqueue failed; continuing as normal MangaDex failure', {
      mangaId: payload.mangaId,
      downloadId: payload.downloadId,
      originalError,
      enqueueError: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Update NativeDownload record status. Schema-aligned: writes to `error` /
 * `endTime`, with `progress` set to 100 on COMPLETED.
 */
async function updateDownloadStatus(
  downloadId: string,
  status: NativeDownloadStatus,
  error?: string,
): Promise<void> {
  try {
    const updateData: {
      status: NativeDownloadStatus;
      progress?: number;
      error?: string;
      endTime?: Date;
    } = { status };

    if (error !== undefined) {
      updateData.error = error;
    }
    if (status === NativeDownloadStatus.COMPLETED) {
      updateData.progress = 100;
      updateData.endTime = new Date();
    } else if (status === NativeDownloadStatus.FAILED || status === NativeDownloadStatus.CANCELLED) {
      updateData.endTime = new Date();
    }

    await prisma.nativeDownload.update({
      where: { id: downloadId },
      data: updateData,
    });
  } catch (updateError) {
    log.error('Failed to update download status', {
      downloadId,
      status,
      error: updateError instanceof Error ? updateError.message : String(updateError),
    });
  }
}

/**
 * Look up an existing Chapter row that matches this download. Tries
 * mangadexId first (existing key), then falls back to (mangaId, chapterNumber)
 * so rows created by another source (e.g. Suwayomi sync's source-only rows)
 * get filled in instead of duplicated.
 */
async function findExistingChapterForMangaDex(
  payload: MangaDexDownloadPayload,
): Promise<{ id: number; mangadexId: string | null } | null> {
  const byId = await prisma.chapter.findUnique({
    where: { mangadexId: payload.mangadexChapterId },
    select: { id: true, mangadexId: true },
  });
  if (byId) return byId;
  if (payload.chapterNumber === undefined) return null;
  return prisma.chapter.findFirst({
    where: { mangaId: payload.mangaId, chapterNumber: payload.chapterNumber },
    select: { id: true, mangadexId: true },
  });
}

/** Common file/state fields written on both update and create. */
function buildDownloadCompletionData(
  result: MangaDexDownloadResult,
  fileName: string,
): {
  fileName: string;
  filePath: string;
  fileFormat: string;
  pageCount: number;
  pages: number;
  size: number;
  downloadStatus: ChapterStatus;
  updatedAt: Date;
} {
  return {
    fileName,
    filePath: result.outputPath,
    fileFormat: 'cbz',
    pageCount: result.pageCount,
    pages: result.pageCount,
    size: result.fileSize,
    downloadStatus: ChapterStatus.COMPLETED,
    updatedAt: new Date(),
  };
}

async function updateExistingMangaDexChapter(
  existing: { id: number; mangadexId: string | null },
  payload: MangaDexDownloadPayload,
  result: MangaDexDownloadResult,
  fileName: string,
): Promise<void> {
  const language = payload.metadata?.language;
  await prisma.chapter.update({
    where: { id: existing.id },
    data: {
      mangadexId: existing.mangadexId ?? payload.mangadexChapterId,
      ...(language ? { language } : {}),
      ...buildDownloadCompletionData(result, fileName),
    },
  });
}

async function createMangaDexChapter(
  payload: MangaDexDownloadPayload,
  result: MangaDexDownloadResult,
  fileName: string,
): Promise<void> {
  // `index` is an Int sort key in the schema; multiply to preserve ordering
  // for decimal chapter numbers (e.g. 1, 1.5, 2 -> 1000, 1500, 2000).
  const sortIndex = Math.round((payload.chapterNumber ?? 0) * 1000);
  await prisma.chapter.create({
    data: {
      mangadexId: payload.mangadexChapterId,
      mangaId: payload.mangaId,
      title: payload.metadata?.title ?? `Chapter ${payload.chapterNumber ?? '?'}`,
      index: sortIndex,
      chapterNumber: payload.chapterNumber ?? null,
      number: payload.chapterNumber ?? null,
      language: payload.metadata?.language ?? null,
      ...buildDownloadCompletionData(result, fileName),
    },
  });
}

/**
 * After a successful download, register the file as a Chapter row. Cross-source
 * dedup key is `(mangaId, chapterNumber)`; an existing row (from metadata
 * reconciler, Suwayomi sync, or prior enrichment) is updated and `mangadexId`
 * is backfilled when missing — otherwise a fresh row is created.
 */
async function upsertChapterFromDownload(
  payload: MangaDexDownloadPayload,
  result: MangaDexDownloadResult,
): Promise<void> {
  try {
    const fileName = path.basename(result.outputPath);
    const existing = await findExistingChapterForMangaDex(payload);
    if (existing) {
      await updateExistingMangaDexChapter(existing, payload, result, fileName);
    } else {
      await createMangaDexChapter(payload, result, fileName);
    }
    // Bust the manga.get cache so the UI sees the new COMPLETED chapter on
    // its next refetch. Without this, the manga detail page can sit on a
    // pre-download snapshot (showing ERROR/PENDING) until TTL expires.
    await invalidateMangaCache(payload.mangaId);
  } catch (upsertError) {
    log.error('Failed to upsert Chapter row after MangaDex download', {
      mangadexChapterId: payload.mangadexChapterId,
      downloadId: payload.downloadId,
      error: upsertError instanceof Error ? upsertError.message : String(upsertError),
    });
  }
}

/**
 * Emit download event via WebSocket
 */
function emitDownloadEvent(
  jobId: number,
  payload: MangaDexDownloadPayload,
  event: 'started' | 'completed' | 'failed',
  data?: Record<string, unknown>
): void {
  void realtimeEmitter.emitSystemEvent({
    eventType: `job:mangadex_download:${event}`,
    source: 'mangadexDownloadHandler',
    message: `MangaDex download ${event} for manga ${payload.mangaId}`,
    data: {
      jobId: String(jobId),
      mangaId: payload.mangaId,
      downloadId: payload.downloadId,
      chapterId: payload.mangadexChapterId,
      ...data
    }
  });
}

/**
 * Emit download progress via WebSocket
 */
function emitDownloadProgress(
  jobId: number,
  payload: MangaDexDownloadPayload,
  progress: DownloadProgress
): void {
  void realtimeEmitter.emitDownloadProgress({
    taskId: String(jobId),
    mangaId: payload.mangaId,
    chapterId: payload.mangadexChapterId,
    progress: progress.percentage,
    status: progress.status === 'completed' ? 'completed'
      : progress.status === 'failed' ? 'failed'
      : 'downloading',
    filename: `Chapter ${payload.chapterNumber ?? 'Unknown'} - Page ${progress.currentPage}/${progress.totalPages}`
  });
}
