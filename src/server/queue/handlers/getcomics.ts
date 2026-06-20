/**
 * GetComics Download Job Handler
 *
 * Handles downloading files from GetComics via various file hosts.
 * Integrates with the download tracking and post-processing pipeline.
 *
 * @module server/queue/handlers/getcomics
 */

import { jobs } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { getJobOwnerUserId } from '@/server/queue/job-owner';
import { downloadFromHost } from '@/server/services/getcomics/hosts';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { markGetComicsDispatchFailed, recordHostAttempt } from './getcomics-telemetry';

import type { HostOutcome } from './getcomics-telemetry';

function classifyHostError(msg: string): HostOutcome {
  const lower = msg.toLowerCase();
  if (lower.includes('cloudflare') || lower.includes('challenge')) return 'cloudflare_blocked';
  if (lower.includes('quota') || lower.includes('overquota') || lower.includes('bandwidth')) return 'quota';
  if (lower.includes('expired') || lower.includes('eexpired') || lower.includes('not found')) return 'expired';
  if (lower.includes('extract') || lower.includes('parse')) return 'parse_failed';
  return 'failed';
}


/**
 * Zod schema for GetComics download job payload
 */
const GetComicsDownloadPayloadSchema = z.object({
  mangaId: z.number(),
  volumeId: z.number().optional(),
  chapterId: z.number().optional(),
  downloadUrl: z.string().url(),
  fileName: z.string().optional(),
  destPath: z.string(),
});

type GetComicsDownloadPayload = z.infer<typeof GetComicsDownloadPayloadSchema>;

/** Track last persisted progress to debounce database updates */
const lastPersistedProgress = new Map<string, number>();

/** Build the where clause for job updates */
function buildJobWhereClause(jobId: string): { id_partition_key: { id: bigint; partition_key: string } } {
  return { id_partition_key: { id: BigInt(jobId), partition_key: 'active' } };
}

/** Persist progress to database */
async function persistProgress(jobId: string, progress: number, speed?: number | undefined): Promise<void> {
  const data: { progress: number; metadata?: { speed: number } } = { progress };
  if (speed !== undefined) data.metadata = { speed };
  await prisma.jobs.update({ where: buildJobWhereClause(jobId), data }).catch((error: unknown) => {
    logger.warn('[GetComics] Failed to persist progress', {
      jobId,
      progress,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  });
}

/** Check if progress should be persisted (every 5% or on status change) */
function shouldPersistProgress(jobId: string, progress: number, status: string): boolean {
  const lastProgress = lastPersistedProgress.get(jobId) ?? -1;
  return status !== 'downloading' || progress - lastProgress >= 5;
}

/** Emit download progress to realtime subscribers and persist to database */
async function emitProgress(
  jobId: string,
  mangaId: number,
  progress: number,
  status: 'queued' | 'downloading' | 'completed' | 'failed',
  speed?: number | undefined
): Promise<void> {
  // Emit realtime event
  const payload: Parameters<typeof realtimeEmitter.emitDownloadProgress>[0] = {
    taskId: jobId,
    mangaId,
    progress,
    status,
  };
  if (speed !== undefined) payload.speed = speed;
  void realtimeEmitter.emitDownloadProgress(payload);

  // Persist to database with debouncing
  if (shouldPersistProgress(jobId, progress, status)) {
    lastPersistedProgress.set(jobId, progress);
    await persistProgress(jobId, progress, speed);
  }

  // Clean up tracking on terminal states
  if (status === 'completed' || status === 'failed') {
    lastPersistedProgress.delete(jobId);
  }
}

/**
 * Handle GetComics download job
 */
export async function handleGetComicsDownload(job: jobs): Promise<void> {
  const result = GetComicsDownloadPayloadSchema.safeParse(job.payload);

  if (!result.success) {
    logger.error('[GetComics] Invalid download payload', { error: result.error });
    throw new Error(`Invalid job payload: ${result.error.message}`);
  }

  const payload = result.data;
  const jobId = String(job.id);

  logger.info('[GetComics] Processing download job', {
    jobId,
    mangaId: payload.mangaId,
    volumeId: payload.volumeId,
    url: payload.downloadUrl,
  });

  // Emit job queued event
  void emitProgress(jobId, payload.mangaId, 0, 'queued');

  // Get manga for context
  const manga = await prisma.manga.findUnique({
    where: { id: payload.mangaId },
  });

  if (!manga) {
    throw new Error(`Manga ${payload.mangaId} not found`);
  }

  // iter-CDB-0.3: record host attempt + iter-EX failure feedback.
  const t0 = Date.now();
  const downloadResult = await downloadFromHost(
    payload.downloadUrl,
    payload.destPath,
    (downloaded, total, speed) => {
      const progress = total > 0 ? Math.round((downloaded / total) * 100) : 0;
      void emitProgress(jobId, payload.mangaId, progress, 'downloading', speed);
    }
  );

  if (!isSuccess(downloadResult)) {
    const error = downloadResult.status === 'error' ? downloadResult.error : new Error('Download failed');
    logger.error('[GetComics] Download failed', { jobId, mangaId: payload.mangaId, error: error.message });
    recordHostAttempt({
      url: payload.downloadUrl, chapterId: payload.chapterId ?? null, jobId: job.id,
      outcome: classifyHostError(error.message),
      durationMs: Date.now() - t0, errorMessage: error.message,
    });
    await markGetComicsDispatchFailed(payload.chapterId);
    void emitProgress(jobId, payload.mangaId, 0, 'failed');
    throw error;
  }

  const { filePath, fileSize, duration } = downloadResult.data;
  recordHostAttempt({
    url: payload.downloadUrl, chapterId: payload.chapterId ?? null, jobId: job.id,
    outcome: 'success', durationMs: Date.now() - t0, fileBytes: fileSize,
  });

  logger.info('[GetComics] Download completed', {
    jobId,
    mangaId: payload.mangaId,
    filePath,
    fileSize,
    duration,
  });

  // Record download in history
  await recordDownloadHistory(payload, filePath, fileSize, job.id);

  // Emit completion event
  void emitProgress(jobId, payload.mangaId, 100, 'completed');

  // Emit system event for activity tracking
  void realtimeEmitter.emitSystemEvent({
    eventType: 'job:getcomics_download:completed',
    source: 'getcomicsHandler',
    message: `GetComics download completed for ${manga.title}`,
    data: { jobId, mangaId: payload.mangaId, filePath, fileSize },
  });
}

/**
 * Record download in history table
 */
async function recordDownloadHistory(
  payload: GetComicsDownloadPayload,
  _filePath: string,
  fileSize: number,
  jobId: bigint
): Promise<void> {
  // Inherit ownership from the initiating job so the history row is scoped to
  // the user who triggered the download (admins still see NULL/all).
  const initiatedByUserId = await getJobOwnerUserId(jobId);
  await prisma.downloadHistory.create({
    data: {
      mangaId: payload.mangaId,
      chapterId: payload.chapterId ?? null,
      source: 'getcomics',
      downloadSize: BigInt(fileSize),
      status: 'COMPLETED',
      endTime: new Date(),
      initiatedByUserId,
      metadata: {
        url: payload.downloadUrl,
        fileName: payload.fileName ?? null,
      },
    },
  });
}
