/**
 * Suwayomi Download Job Handler
 *
 * Handles `JobType.suwayomi_download` jobs. Mirrors the MangaDex handler:
 * validates the payload, delegates to {@link SuwayomiDownloader}, updates
 * `NativeDownload` and `Chapter` rows, and emits realtime events via the
 * shared `realtimeEmitter` channel so the existing UI listeners just work.
 *
 * @module server/queue/handlers/suwayomi-download
 */
import path from 'path';

import { ChapterStatus, jobs, NativeDownloadStatus, type Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import type { ComicInfoMetadata } from '@/server/services/native-download/downloaders/cbz-bundler';
import { suwayomiDownloader } from '@/server/services/native-download/downloaders/suwayomi-downloader';
import type {
  DownloadProgress,
  SuwayomiDownloadResult,
} from '@/server/services/native-download/downloaders/suwayomi-downloader';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { getSuwayomiGraphQLClient } from '@/server/services/suwayomi/graphql/client';
import { readSuwayomiPluginConfig } from '@/server/services/suwayomi/manga-matcher';
import { invalidateMangaCache } from '@/server/trpc/routers/manga/crud-operations/get-manga-cache';
import { logger } from '@/utils/logger';

const log = logger.child('suwayomiDownloadHandler');

const SuwayomiDownloadPayloadSchema = z.object({
  mangaId: z.number(),
  downloadId: z.string(),                 // cuid from NativeDownload
  // Suwayomi-internal chapter id. Stored as `text` on Chapter.suwayomiChapterId,
  // so requeues that read straight from the DB (scripts, recovery sweeps) hand
  // us a numeric string; the dispatcher hands us a number. Accept either and
  // normalize to number so downstream code stays unchanged.
  suwayomiChapterId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)])
    .transform((v) => (typeof v === 'string' ? Number(v) : v)),
  chapterNumber: z.number().optional(),
  destinationPath: z.string(),
  metadata: z.object({
    title: z.string().optional(),
    series: z.string().optional(),
    number: z.string().optional(),
    volume: z.string().optional(),
    language: z.string().optional(),
    teams: z.array(z.string()).optional(),
  }).optional(),
});

type SuwayomiDownloadPayload = z.infer<typeof SuwayomiDownloadPayloadSchema>;

function jobIdToNumber(jobId: bigint): number {
  return Number(jobId);
}

/** Update NativeDownload row to match Step result (mirrors MangaDex handler). */
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
    if (error !== undefined) updateData.error = error;
    if (status === NativeDownloadStatus.COMPLETED) {
      updateData.progress = 100;
      updateData.endTime = new Date();
    } else if (status === NativeDownloadStatus.FAILED || status === NativeDownloadStatus.CANCELLED) {
      updateData.endTime = new Date();
    }
    await prisma.nativeDownload.update({ where: { id: downloadId }, data: updateData });
  } catch (updateError) {
    log.error('Failed to update NativeDownload status', {
      downloadId, status,
      error: updateError instanceof Error ? updateError.message : String(updateError),
    });
  }
}

/**
 * Look up an existing Chapter row that matches this Suwayomi download. Tries
 * suwayomiChapterId first, then falls back to (mangaId, chapterNumber) so a
 * row created by the metadata reconciler from MangaDex aggregate gets filled
 * in instead of producing a duplicate.
 */
async function findExistingChapterForSuwayomi(
  payload: SuwayomiDownloadPayload,
): Promise<{ id: number; suwayomiChapterId: string | null } | null> {
  const suwayomiChapterId = String(payload.suwayomiChapterId);
  const byId = await prisma.chapter.findUnique({
    where: { suwayomiChapterId },
    select: { id: true, suwayomiChapterId: true },
  });
  if (byId) return byId;
  if (payload.chapterNumber === undefined) return null;
  return prisma.chapter.findFirst({
    where: { mangaId: payload.mangaId, chapterNumber: payload.chapterNumber },
    select: { id: true, suwayomiChapterId: true },
  });
}

/** Common file/state fields written on both update and create. */
function buildDownloadCompletionData(
  result: SuwayomiDownloadResult,
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

async function updateExistingSuwayomiChapter(
  existing: { id: number; suwayomiChapterId: string | null },
  payload: SuwayomiDownloadPayload,
  result: SuwayomiDownloadResult,
  fileName: string,
): Promise<void> {
  await prisma.chapter.update({
    where: { id: existing.id },
    data: {
      suwayomiChapterId: existing.suwayomiChapterId ?? String(payload.suwayomiChapterId),
      ...buildDownloadCompletionData(result, fileName),
    },
  });
}

async function createSuwayomiChapter(
  payload: SuwayomiDownloadPayload,
  result: SuwayomiDownloadResult,
  fileName: string,
): Promise<void> {
  const sortIndex = Math.round((payload.chapterNumber ?? 0) * 1000);
  await prisma.chapter.create({
    data: {
      suwayomiChapterId: String(payload.suwayomiChapterId),
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
 * Upsert the Chapter row. Cross-source dedup key is `(mangaId, chapterNumber)`;
 * an existing row (from metadata reconciler, MangaDex sync, or prior Suwayomi
 * sync) is updated and `suwayomiChapterId` is backfilled when missing —
 * otherwise a fresh row is created.
 */
async function upsertChapterFromDownload(
  payload: SuwayomiDownloadPayload,
  result: SuwayomiDownloadResult,
): Promise<void> {
  try {
    const fileName = path.basename(result.outputPath);
    const existing = await findExistingChapterForSuwayomi(payload);
    if (existing) {
      await updateExistingSuwayomiChapter(existing, payload, result, fileName);
    } else {
      await createSuwayomiChapter(payload, result, fileName);
    }
    // Bust the manga.get cache so the UI sees the new COMPLETED chapter on
    // its next refetch. Without this, the manga detail page can sit on a
    // pre-download snapshot (showing ERROR/PENDING) until TTL expires.
    await invalidateMangaCache(payload.mangaId);
  } catch (upsertError) {
    log.error('Failed to upsert Chapter row after Suwayomi download', {
      suwayomiChapterId: payload.suwayomiChapterId,
      downloadId: payload.downloadId,
      error: upsertError instanceof Error ? upsertError.message : String(upsertError),
    });
  }
}

function emitDownloadEvent(
  jobId: number,
  payload: SuwayomiDownloadPayload,
  event: 'started' | 'completed' | 'failed',
  data?: Record<string, unknown>,
): void {
  void realtimeEmitter.emitSystemEvent({
    eventType: `job:suwayomi_download:${event}`,
    source: 'suwayomiDownloadHandler',
    message: `Suwayomi download ${event} for manga ${payload.mangaId}`,
    data: {
      jobId: String(jobId),
      mangaId: payload.mangaId,
      downloadId: payload.downloadId,
      suwayomiChapterId: payload.suwayomiChapterId,
      ...data,
    },
  });
}

function emitDownloadProgress(
  jobId: number, payload: SuwayomiDownloadPayload, progress: DownloadProgress,
): void {
  const status = progress.status === 'completed' ? 'completed'
    : progress.status === 'failed' ? 'failed'
    : 'downloading';
  void realtimeEmitter.emitDownloadProgress({
    taskId: String(jobId),
    mangaId: payload.mangaId,
    chapterId: String(payload.suwayomiChapterId),
    progress: progress.percentage,
    status,
    filename: `Chapter ${payload.chapterNumber ?? 'Unknown'} - Page ${progress.currentPage}/${progress.totalPages}`,
  });
}

/** Validate the job payload, throwing on bad input. */
function parsePayload(job: jobs): SuwayomiDownloadPayload {
  const parsed = SuwayomiDownloadPayloadSchema.safeParse(job.payload);
  if (!parsed.success) {
    log.error('Invalid Suwayomi download payload', { error: parsed.error.message });
    throw new Error(`Invalid job payload: ${parsed.error.message}`);
  }
  return parsed.data;
}

function convertMetadata(payload: SuwayomiDownloadPayload): ComicInfoMetadata | undefined {
  if (!payload.metadata) return undefined;
  return {
    title: payload.metadata.title,
    series: payload.metadata.series,
    number: payload.metadata.number,
    volume: payload.metadata.volume,
    language: payload.metadata.language,
    teams: payload.metadata.teams,
  };
}

async function finalizeFailure(
  jobIdNum: number, payload: SuwayomiDownloadPayload, errorMessage: string,
): Promise<void> {
  await updateDownloadStatus(payload.downloadId, NativeDownloadStatus.FAILED, errorMessage);
  emitDownloadEvent(jobIdNum, payload, 'failed', { error: errorMessage });
  log.error('Suwayomi download failed', {
    jobId: jobIdNum, downloadId: payload.downloadId, error: errorMessage,
  });
  await detectStaleBindingOnFailure(payload, errorMessage);
}

/**
 * When the failure is `No pages returned from Suwayomi`, probe Suwayomi for
 * the bound `cfg.mangaId`. If Suwayomi has no record of it the binding is
 * stale (datastore wiped, breaking upgrade, etc.) and every future job for
 * this manga will fail the same way. Null out `cfg.mangaId` so subsequent
 * dispatches stop using the dead pointer; the next monitor cycle (or an
 * operator running `scripts/rebind-suwayomi.ts`) can re-discover.
 *
 * Best-effort: errors are swallowed so detection failure never masks the
 * original job error or blocks retry semantics.
 */
async function detectStaleBindingOnFailure(
  payload: SuwayomiDownloadPayload, errorMessage: string,
): Promise<void> {
  if (errorMessage !== 'No pages returned from Suwayomi') return;
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: payload.mangaId },
      select: { suwayomiPluginConfig: true },
    });
    const cfg = readSuwayomiPluginConfig(manga?.suwayomiPluginConfig);
    if (typeof cfg.mangaId !== 'number') return;
    const probe = await getSuwayomiGraphQLClient().getManga(cfg.mangaId);
    if (probe !== null) return;
    const { mangaId: _drop, ...rest } = cfg;
    await prisma.manga.update({
      where: { id: payload.mangaId },
      data: { suwayomiPluginConfig: rest as unknown as Prisma.InputJsonValue },
    });
    log.warn('suwayomi:stale-binding-detected', {
      kaizokuMangaId: payload.mangaId,
      staleSuwayomiMangaId: cfg.mangaId,
      sourceId: cfg.sourceId ?? null,
      action: 'cleared cfg.mangaId — run scripts/rebind-suwayomi.ts to re-discover',
    });
  } catch (err) {
    log.warn('Stale-binding detection failed (non-fatal)', {
      mangaId: payload.mangaId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function finalizeSuccess(
  jobIdNum: number, payload: SuwayomiDownloadPayload, result: SuwayomiDownloadResult,
): Promise<void> {
  await updateDownloadStatus(payload.downloadId, NativeDownloadStatus.COMPLETED);
  await upsertChapterFromDownload(payload, result);
  emitDownloadEvent(jobIdNum, payload, 'completed', {
    fileSize: result.fileSize,
    pageCount: result.pageCount,
    outputPath: result.outputPath,
  });
  log.info('Suwayomi download completed', {
    jobId: jobIdNum, downloadId: payload.downloadId,
    fileSize: result.fileSize, pageCount: result.pageCount,
  });
}

/** Handle a Suwayomi download job. Throws to signal job failure. */
export async function handleSuwayomiDownload(job: jobs): Promise<void> {
  const payload = parsePayload(job);
  const jobIdNum = jobIdToNumber(job.id);

  log.info('Processing Suwayomi download', {
    jobId: jobIdNum, mangaId: payload.mangaId,
    suwayomiChapterId: payload.suwayomiChapterId, downloadId: payload.downloadId,
  });

  await updateDownloadStatus(payload.downloadId, NativeDownloadStatus.DOWNLOADING);
  emitDownloadEvent(jobIdNum, payload, 'started');

  const progressHandler = (progress: DownloadProgress): void => {
    emitDownloadProgress(jobIdNum, payload, progress);
  };
  suwayomiDownloader.on('progress', progressHandler);

  try {
    const result = await suwayomiDownloader.downloadChapter({
      suwayomiChapterId: payload.suwayomiChapterId,
      outputPath: payload.destinationPath,
      metadata: convertMetadata(payload),
    });
    if (!result.success) {
      const errorMessage = result.error ?? 'Download failed';
      await finalizeFailure(jobIdNum, payload, errorMessage);
      throw new Error(errorMessage);
    }
    await finalizeSuccess(jobIdNum, payload, result);
  } finally {
    suwayomiDownloader.off('progress', progressHandler);
  }
}
