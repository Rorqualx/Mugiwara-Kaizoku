/**
 * Pack Import Handler Module
 *
 * Handle pack download import workflow after download completes.
 * Manages PackDownload records and triggers pack import service.
 *
 * Extracted from: downloadMonitor.ts (lines 418-518)
 * Created: 2025-11-21
 */

import { createPackImportService } from '@/server/services/packImport/packImportService';
import { pipelineEventBus } from '@/server/services/pipeline/pipeline-event-bus';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { invalidateMangaCache } from '@/server/trpc/routers/manga/crud-operations/get-manga-cache';
import { PIPELINE_EVENTS } from '@/types/domain/pipeline-events';
import type { PackExtractionResult } from '@/types/pack-download-types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { cleanupAfterImport } from '../cleanup/cleanup-service';
import { getPathMapper } from '../pathMapper';

import { updateChaptersToError } from './chapter-manager';
import { safeParseJson } from './utils';

import type { PrismaClient, PackDownload, PackDownloadStatus } from '@prisma/client';

/**
 * Find PackDownload record by download ID and job ID
 *
 * @param prisma - Prisma client
 * @param downloadId - Download ID from client
 * @param jobId - Job ID that initiated the download
 * @returns AsyncResult with PackDownload or error
 */
export async function findPackDownload(
  prisma: PrismaClient,
  downloadId: string,
  jobId: bigint
): Promise<AsyncResult<PackDownload, Error>> {
  try {
    const packDownload = await prisma.packDownload.findFirst({
      where: { downloadId, jobId }
    });

    if (!packDownload) {
      return createErrorResult(
        new Error(`PackDownload not found for downloadId: ${downloadId}, jobId: ${jobId}`)
      );
    }

    return createSuccessResult(packDownload);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return createErrorResult(err);
  }
}

/**
 * Create a PackDownload record as a fallback when trackPackDownload failed
 * during download initiation. Extracts metadata from the job record.
 *
 * @param prisma - Prisma client
 * @param jobId - Job ID
 * @param downloadId - Download client ID
 * @param savePath - Path where the download was saved
 * @param mangaId - Manga ID
 * @returns AsyncResult with the created PackDownload or error
 */
async function createPackDownloadFallback(
  prisma: PrismaClient,
  jobId: bigint,
  downloadId: string,
  savePath: string,
  mangaId: number
): Promise<AsyncResult<PackDownload, Error>> {
  try {
    const job = await prisma.jobs.findFirst({
      where: { id: jobId },
      select: { result: true, payload: true }
    });

    if (!job) {
      return createErrorResult(new Error(`Job ${jobId} not found`));
    }

    const result = safeParseJson(job.result) as Record<string, unknown> | null;
    const payload = safeParseJson(job.payload) as Record<string, unknown> | null;

    const releaseTitle = (result?.['releaseTitle'] as string | undefined) ?? 'Unknown Pack';
    const clientType = (result?.['clientType'] as string | undefined) ?? 'unknown';
    // Prefer `indexerName` (the field actually returned by Prowlarr — see
    // `ProwlarrSearchResult` in `src/types/prowlarr.ts`); fall back to the
    // older `indexer` field that was the source of the all-'unknown' bug.
    const indexer = (result?.['indexerName'] as string | undefined)
      ?? (result?.['indexer'] as string | undefined)
      ?? 'unknown';

    // Extract download URL from prowlarr result for re-download capability
    const prowlarrResult = payload?.['prowlarrResult'] as Record<string, unknown> | undefined;
    const dlUrl = (prowlarrResult?.['downloadUrl'] as string | undefined) ?? null;

    // Link DOWNLOADING chapters to the new PackDownload
    const chapterIds = (payload?.['chapterIds'] as number[] | undefined) ?? [];

    const packDownload = await prisma.packDownload.create({
      data: {
        releaseTitle,
        mangaId,
        jobId,
        downloadId,
        clientType,
        indexer,
        protocol: 'torrent',
        status: 'COMPLETED',
        filePath: savePath,
        downloadUrl: dlUrl,
      }
    });

    if (chapterIds.length > 0) {
      await prisma.chapter.updateMany({
        where: { id: { in: chapterIds }, mangaId },
        data: { packDownloadId: packDownload.id }
      });
    }

    logger.info(
      `[DownloadMonitor] Created fallback PackDownload #${packDownload.id} for "${releaseTitle}"`,
      { jobId: String(jobId), downloadId, chapterCount: chapterIds.length }
    );

    return createSuccessResult(packDownload);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return createErrorResult(err);
  }
}

/**
 * Update PackDownload status
 *
 * @param prisma - Prisma client
 * @param id - PackDownload ID
 * @param status - New status
 * @param filePath - Optional file path
 * @param errorMessage - Optional error message
 * @returns AsyncResult with void or error
 */
export async function updatePackDownloadStatus(
  prisma: PrismaClient,
  id: bigint,
  status: PackDownloadStatus,
  filePath?: string,
  errorMessage?: string
): Promise<AsyncResult<void, Error>> {
  try {
    await prisma.packDownload.update({
      where: { id },
      data: {
        status,
        ...(filePath && { filePath }),
        ...(errorMessage && { errorMessage })
      }
    });

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return createErrorResult(err);
  }
}

/**
 * Trigger pack import service
 *
 * @param prisma - Prisma client
 * @param packDownloadId - PackDownload ID
 * @returns AsyncResult with PackExtractionResult or error
 */
export async function triggerPackImportService(
  prisma: PrismaClient,
  packDownloadId: bigint
): Promise<AsyncResult<PackExtractionResult, Error>> {
  try {
    const packImportService = createPackImportService(prisma);
    const importResult = await packImportService.importPack(Number(packDownloadId));

    return importResult;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return createErrorResult(err);
  }
}

/**
 * Update chapter statuses to COMPLETED
 *
 * @param prisma - Prisma client
 * @param chapterIds - Chapter IDs to update
 * @returns AsyncResult with void or error
 */
export async function updateChapterStatuses(
  prisma: PrismaClient,
  chapterIds: number[]
): Promise<AsyncResult<void, Error>> {
  try {
    await prisma.chapter.updateMany({
      where: {
        id: { in: chapterIds }
      },
      data: {
        downloadStatus: 'COMPLETED'
      }
    });

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return createErrorResult(err);
  }
}

/**
 * Centralised handler for "the path-mapping resolver reported the pack
 * isn't reachable from this host". Logs the failure, emits a user-visible
 * notification with an actionable hint, and rolls the chapters back to
 * PENDING so the user's "Retry" still works once the mapping is fixed.
 * Extracted so `handlePackImport` stays under the max-statements cap.
 */
async function handleInaccessiblePackPath(
  prisma: PrismaClient,
  resolved: ResolvedPackPath,
  savePath: string,
  mangaId: number,
): Promise<void> {
  const mappingHint = resolved.mappingRemotePath
    ? `(mapping: ${resolved.mappingRemotePath} → ${resolved.path})`
    : '(no matching path-mapping rule)';
  const message = `Download client reported ${savePath} but Mugiwara cannot read ${resolved.path} ${mappingHint}. Open Settings → Path Mappings → Run Diagnostics.`;
  logger.error(`[DownloadMonitor] Skipping pack import — path not reachable. ${message}`);
  await realtimeEmitter.emitNotification({
    title: 'Pack import: path not reachable',
    message,
    level: 'error',
  });
  await resetChaptersOnFailure(prisma, mangaId);
}

interface ResolvedPackPath {
  /** Best-guess local path. When `accessible` is true this answered R_OK;
   *  when false it's still returned for logging/diagnostics. */
  path: string;
  accessible: boolean;
  /** Whichever mapping rule the resolver picked, for diagnostics. */
  mappingRemotePath?: string;
  /** Reason the primary + fallbacks were unreachable. */
  error?: string;
}

/**
 * Resolve a remote/Docker savePath to a local filesystem path AND probe it.
 * Applies configured path mappings (e.g. /data/completed → /Volumes/Public/data/completed).
 *
 * Primary path: `pathMapper.mapAndProbe(savePath)` — combines the longest-
 * prefix mapping rule with a cached R_OK probe. When that misses, we fall
 * back to trying each mapping's `localPath` joined with the torrent's
 * basename (catches the case where the user has the file mounted under a
 * different prefix than the one Transmission reports).
 */
async function resolvePackPath(savePath: string): Promise<ResolvedPackPath> {
  const { existsSync } = await import('fs');
  const pathMapper = getPathMapper();
  await pathMapper.loadFromDatabase();

  const probe = await pathMapper.mapAndProbe(savePath);
  if (probe.accessible) {
    const result: ResolvedPackPath = { path: probe.localPath, accessible: true };
    if (probe.mappingUsed?.remotePath) result.mappingRemotePath = probe.mappingUsed.remotePath;
    return result;
  }

  // Fallback: try each mapping's localPath joined with the torrent's basename.
  const baseName = savePath.split('/').pop();
  if (baseName) {
    const { join } = await import('path');
    for (const m of pathMapper.getMappings()) {
      const candidate = join(m.localPath, baseName);
      if (existsSync(candidate)) {
        logger.info(`[DownloadMonitor] Found pack at fallback path: ${candidate}`);
        return { path: candidate, accessible: true, mappingRemotePath: m.remotePath };
      }
    }
  }

  // Nothing was reachable. Return the mapped path anyway so the caller can
  // surface a clear, actionable error and log every step of the attempt.
  logger.warn(
    `[DownloadMonitor] Pack path not reachable: ${savePath} → ${probe.localPath} (${probe.error ?? 'unknown reason'})`,
  );
  const result: ResolvedPackPath = {
    path: probe.localPath,
    accessible: false,
  };
  if (probe.mappingUsed?.remotePath) result.mappingRemotePath = probe.mappingUsed.remotePath;
  if (probe.error !== undefined) result.error = probe.error;
  return result;
}

/**
 * Reset all DOWNLOADING chapters for a manga to ERROR status.
 * Used when pack import fails after download completes, to prevent
 * chapters from being permanently stuck in DOWNLOADING.
 *
 * SAFETY: Skips chapters that already have a valid filePath — those
 * were successfully imported and should be marked COMPLETED, not ERROR.
 */
async function resetChaptersOnFailure(prisma: PrismaClient, mangaId: number): Promise<void> {
  try {
    // Fetch ALL DOWNLOADING chapters, then split by filePath presence
    const allDownloading = await prisma.chapter.findMany({
      where: { mangaId, downloadStatus: 'DOWNLOADING' },
      select: { id: true, filePath: true },
    });

    if (allDownloading.length === 0) return;

    // Chapters with files should be COMPLETED, not ERROR
    const withFiles = allDownloading.filter(ch => ch.filePath !== null && ch.filePath !== '');
    const withoutFiles = allDownloading.filter(ch => ch.filePath === null || ch.filePath === '');

    if (withFiles.length > 0) {
      await prisma.chapter.updateMany({
        where: { id: { in: withFiles.map(ch => ch.id) } },
        data: { downloadStatus: 'COMPLETED' },
      });
      logger.info(
        `[DownloadMonitor] Rescued ${withFiles.length} file-backed chapters to COMPLETED for manga ${mangaId}`,
      );
    }

    if (withoutFiles.length > 0) {
      await updateChaptersToError(prisma, withoutFiles.map(ch => ch.id), mangaId);
      logger.info(
        `[DownloadMonitor] Reset ${withoutFiles.length} stuck DOWNLOADING chapters to ERROR for manga ${mangaId}`,
      );
    }
    // Bust the manga.get cache so the UI reflects the new statuses on its
    // next refetch (otherwise we sit on a pre-failure snapshot).
    if (withFiles.length > 0 || withoutFiles.length > 0) {
      await invalidateMangaCache(mangaId);
    }
  } catch (err: unknown) {
    logger.error(`[DownloadMonitor] Failed to reset chapters on import failure for manga ${mangaId}:`, err);
  }
}

/**
 * Finalize a successful pack import: mark chapters COMPLETED, emit pipeline +
 * realtime events, and remove the completed download from its client.
 *
 * @returns true if chapters were updated successfully, false otherwise
 */
async function handleImportSuccess(
  prisma: PrismaClient,
  packDownload: PackDownload,
  extraction: PackExtractionResult
): Promise<boolean> {
  const { chaptersCreated, chapterIds, errors } = extraction;

  logger.info(`[DownloadMonitor] Pack import succeeded: Created ${chaptersCreated} chapters`, {
    packDownloadId: packDownload.id,
    chapterIds,
    errorCount: errors.length,
  });

  if (errors.length > 0) {
    logger.warn(`[DownloadMonitor] Pack import had ${errors.length} errors:`, errors);
  }

  const chapterUpdateResult = await updateChapterStatuses(prisma, chapterIds);
  if (isError(chapterUpdateResult)) {
    logger.error(`[DownloadMonitor] Failed to update chapter statuses:`, chapterUpdateResult.error);
    return false;
  }

  logger.info(`[DownloadMonitor] Updated ${chapterIds.length} chapters to COMPLETED status`);

  // Claimed-vs-delivered reconciliation. The dispatcher tagged some set of
  // chapters with this packDownloadId at queue time based on the pack
  // title's *predicted* contents. If the archive's *actual* contents
  // didn't include all of them (mislabeled torrent, wrong volume metadata,
  // parser edge case, partial release), those chapters are now stranded:
  // pointing at a completed-but-empty-for-them pack. loadMissingChapters
  // filters by downloadStatus != COMPLETED so they'd still be re-picked
  // on the next dispatch, but they keep a stale packDownloadId that
  // pollutes PackDownload retention and the UI's pack-grouped views.
  // Reset them to PENDING + null packDownloadId so the next 1h scheduler
  // poll routes them to another pack or native source cleanly.
  const delivered = new Set(chapterIds);
  const claimed = await prisma.chapter.findMany({
    where: { packDownloadId: packDownload.id },
    select: { id: true },
  });
  const stranded = claimed.filter(c => !delivered.has(c.id)).map(c => c.id);
  if (stranded.length > 0) {
    await prisma.chapter.updateMany({
      where: { id: { in: stranded } },
      data: { packDownloadId: null, downloadStatus: 'PENDING' },
    });
    logger.info(`[DownloadMonitor] Reset ${stranded.length} stranded chapters from pack ${packDownload.id}`, {
      packDownloadId: packDownload.id.toString(),
      mangaId: packDownload.mangaId,
      claimedCount: claimed.length,
      deliveredCount: delivered.size,
    });
  }

  pipelineEventBus.emit(PIPELINE_EVENTS.IMPORT_COMPLETED, {
    timestamp: new Date(),
    source: 'pack-import-handler',
    mangaId: packDownload.mangaId,
    packDownloadId: Number(packDownload.id),
    chaptersCreated,
    chapterIds,
  });

  void realtimeEmitter.emitImportProgress({
    operation: 'completed',
    packDownloadId: Number(packDownload.id),
    mangaId: packDownload.mangaId,
    chaptersCreated,
    chapterIds,
  });

  // Remove the completed download from its client. Library copy is already
  // imported, so the client entry + source files are duplicates. Cleanup
  // service swallows errors — never throws, never reverts the success.
  await cleanupAfterImport(prisma, packDownload);

  // Bust the manga.get cache so the UI sees the new COMPLETED chapters on
  // its next refetch instead of sitting on a pre-import snapshot.
  await invalidateMangaCache(packDownload.mangaId);

  return true;
}

/**
 * Handle pack import after download completes
 *
 * Workflow:
 * 1. Find PackDownload record by downloadId
 * 2. Update PackDownload with file path and COMPLETED status
 * 3. Trigger pack import service
 * 4. Update chapter statuses based on import result
 * 5. Handle errors and update PackDownload status accordingly
 *
 * @param prisma - Prisma client
 * @param jobId - Job ID that initiated the download
 * @param downloadId - Download ID from client
 * @param savePath - Path where file was saved
 * @param mangaId - Manga ID for chapter cleanup on failure
 * @returns true if import succeeded, false if it failed
 */
export async function handlePackImport(
  prisma: PrismaClient,
  jobId: bigint,
  downloadId: string,
  savePath: string,
  mangaId: number
): Promise<boolean> {
  try {
    // Apply path mapping: download clients may report Docker/remote paths
    // (e.g. /data/completed/...) that need to be mapped to local paths.
    const resolved = await resolvePackPath(savePath);
    const resolvedPath = resolved.path;
    if (resolvedPath !== savePath) {
      logger.info(`[DownloadMonitor] Mapped pack path: ${savePath} → ${resolvedPath}`);
    }

    if (!resolved.accessible) {
      await handleInaccessiblePackPath(prisma, resolved, savePath, mangaId);
      return false;
    }

    logger.info(`[DownloadMonitor] Starting pack import for job ${jobId}, downloadId: ${downloadId}`);

    pipelineEventBus.emit(PIPELINE_EVENTS.IMPORT_STARTED, {
      timestamp: new Date(),
      source: 'pack-import-handler',
      mangaId,
      packDownloadId: 0,
      downloadId,
    });

    // Emit WebSocket event for real-time sync (started)
    void realtimeEmitter.emitImportProgress({
      operation: 'started',
      packDownloadId: 0, // Will be updated once found
      status: 'starting'
    });

    // Find PackDownload record by downloadId, or create one if tracking failed during initiation
    let packDownloadResult = await findPackDownload(prisma, downloadId, jobId);

    if (!isSuccess(packDownloadResult)) {
      logger.warn(`[DownloadMonitor] PackDownload not found for downloadId: ${downloadId}, jobId: ${jobId} — creating fallback record`);
      packDownloadResult = await createPackDownloadFallback(prisma, jobId, downloadId, resolvedPath, mangaId);

      if (!isSuccess(packDownloadResult)) {
        const fallbackErr = isError(packDownloadResult) ? packDownloadResult.error : new Error('Unknown fallback error');
        logger.error(`[DownloadMonitor] Failed to create fallback PackDownload:`, fallbackErr);
        await resetChaptersOnFailure(prisma, mangaId);
        return false;
      }
    }

    const packDownload = packDownloadResult.data;
    logger.info(`[DownloadMonitor] Found PackDownload #${packDownload.id} for "${packDownload.releaseTitle}"`);

    // Update PackDownload with resolved file path and status
    const updateResult = await updatePackDownloadStatus(
      prisma,
      packDownload.id,
      'COMPLETED',
      resolvedPath
    );

    if (isError(updateResult)) {
      logger.error(`[DownloadMonitor] Failed to update PackDownload #${packDownload.id}:`, updateResult.error);
      await resetChaptersOnFailure(prisma, mangaId);
      return false;
    }

    logger.info(`[DownloadMonitor] Updated PackDownload #${packDownload.id} to COMPLETED with path: ${resolvedPath}`);

    // Trigger pack import
    const importResult = await triggerPackImportService(prisma, packDownload.id);

    if (isSuccess(importResult)) {
      return await handleImportSuccess(prisma, packDownload, importResult.data);
    } else if (isError(importResult)) {
      logger.error(`[DownloadMonitor] Pack import failed for PackDownload #${packDownload.id}:`, importResult.error);

      pipelineEventBus.emit(PIPELINE_EVENTS.IMPORT_FAILED, {
        timestamp: new Date(),
        source: 'pack-import-handler',
        mangaId: packDownload.mangaId,
        packDownloadId: Number(packDownload.id),
        error: importResult.error.message,
      });

      // Update PackDownload status to FAILED
      await updatePackDownloadStatus(
        prisma,
        packDownload.id,
        'FAILED',
        undefined,
        importResult.error.message
      );

      // Reset stuck DOWNLOADING chapters
      await resetChaptersOnFailure(prisma, mangaId);

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitImportProgress({
        operation: 'failed',
        packDownloadId: Number(packDownload.id),
        mangaId: packDownload.mangaId,
        error: importResult.error.message
      });

      return false;
    }

    logger.warn(`[DownloadMonitor] Pack import returned unexpected result status for PackDownload #${packDownload.id}`);
    await resetChaptersOnFailure(prisma, mangaId);
    return false;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Pack import handling failed';
    logger.error(`[DownloadMonitor] Error handling pack import for job ${jobId}:`, error);

    // Reset stuck DOWNLOADING chapters
    await resetChaptersOnFailure(prisma, mangaId);

    // Try to update PackDownload to FAILED if we can find it
    try {
      const packDownloadResult = await findPackDownload(prisma, downloadId, jobId);

      if (isSuccess(packDownloadResult)) {
        await updatePackDownloadStatus(
          prisma,
          packDownloadResult.data.id,
          'FAILED',
          undefined,
          errorMessage
        );
      }
    } catch (updateError: unknown) {
      logger.error(`[DownloadMonitor] Failed to update PackDownload status:`, updateError);
    }

    return false;
  }
}
