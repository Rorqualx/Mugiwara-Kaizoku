/**
 * Chapter Job Handlers
 *
 * Handles both simple chapter downloads (mangaId + chapterIndex)
 * and DownloadManager-style bulk downloads (mode + method + chapterIds + prowlarrResult).
 */

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { jobs } from '@prisma/client';

/**
 * Check if payload is a DownloadManager-style payload (has method/mode/chapterIds)
 */
function isDownloadManagerPayload(payload: Record<string, unknown>): boolean {
  return payload['method'] !== undefined || payload['mode'] !== undefined;
}

/**
 * Handle DownloadManager-style payloads by delegating to DownloadManager.processTask()
 */
async function handleDownloadManagerJob(job: jobs): Promise<void> {
  const { DownloadManager } = await import(
    '@/server/services/download/downloadManager/download-manager'
  );
  const downloadManager = new DownloadManager();
  const result = await downloadManager.processTask(Number(job.id));

  if (isError(result)) {
    throw new Error(result.error.message);
  }
}

export async function handleChapterCheck(job: jobs): Promise<void> {
  const payload = job.payload as Record<string, unknown>;
  const { mangaId, chapterId } = payload;

  if (typeof mangaId !== 'number') {
    throw new Error('Missing or invalid mangaId in job payload');
  }

  logger.info(`Checking chapters for manga ${mangaId}`, {
    jobId: job["id"],
    chapterId
  });

  void realtimeEmitter.emitSystemEvent({
    eventType: 'job:chapter_check:started',
    source: 'chapterHandler',
    message: `Chapter check started for manga ${mangaId}`,
    data: { jobId: String(job["id"]), mangaId }
  });

  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    include: {
      Chapter: {
        orderBy: { index: 'asc' }
      }
    }
  });

  if (!manga) {
    throw new Error(`Manga ${mangaId} not found`);
  }

  logger.info(`Chapter check completed for manga ${mangaId}`);

  void realtimeEmitter.emitMangaUpdate({
    mangaId,
    action: 'updated',
    data: {
      chapterCheckCompleted: true,
      chaptersFound: manga.Chapter.length,
      source: 'chapter-check-job'
    }
  });
}

export async function handleChapterDownload(job: jobs): Promise<void> {
  const payload = job.payload as Record<string, unknown>;

  // Detect DownloadManager-style payloads (PROWLARR/BULK/DIRECT_URL)
  // These are created by DownloadManager and may arrive here via retry
  if (isDownloadManagerPayload(payload)) {
    logger.info(`[chapterHandler] Routing DownloadManager-style job ${job.id} to processTask`);
    return handleDownloadManagerJob(job);
  }

  // Simple handler path: expects mangaId + chapterIndex
  const { mangaId, chapterId, chapterIndex } = payload;

  if (typeof mangaId !== 'number') {
    throw new Error('Missing or invalid mangaId in job payload');
  }

  if (typeof chapterIndex !== 'number') {
    throw new Error('Missing or invalid chapterIndex in job payload');
  }

  logger.info(`Downloading chapter ${chapterIndex} for manga ${mangaId}`, {
    jobId: job["id"],
    chapterId
  });

  void realtimeEmitter.emitSystemEvent({
    eventType: 'job:chapter_download:started',
    source: 'chapterHandler',
    message: `Chapter download started for manga ${mangaId} chapter ${chapterIndex}`,
    data: { jobId: String(job["id"]), mangaId, chapterIndex }
  });

  let chapter;
  if (typeof chapterId === 'number') {
    chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { Manga: true }
    });
  } else {
    chapter = await prisma.chapter.findFirst({
      where: {
        mangaId,
        index: chapterIndex
      },
      include: { Manga: true }
    });
  }

  if (!chapter) {
    throw new Error(`Chapter not found for manga ${mangaId} index ${chapterIndex}`);
  }

  logger.info(`Chapter download completed for manga ${mangaId} chapter ${chapterIndex}`);

  void realtimeEmitter.emitChapterUpdate({
    chapterId: chapter.id,
    mangaId,
    action: 'updated',
    data: {
      downloadCompleted: true,
      chapterIndex,
      source: 'chapter-download-job'
    }
  });
}
