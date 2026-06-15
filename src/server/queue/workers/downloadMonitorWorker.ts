import { prisma } from '@/server/db';
import { resolveChapterDispatchAttempts } from '@/server/services/download/download-monitor/chapter-dispatch-resolver';
import { cleanupGhostCompletedChapters, cleanupOrphanedDownloadingChapters, cleanupVanishedFileChapters, healArchiveCoveredChaptersSweep, resolveCoverageAttempts } from '@/server/services/download/download-monitor/chapter-manager';
import { DownloadMonitor } from '@/server/services/download/downloadMonitor';
import { FileImporter } from '@/server/services/download/fileImporter';
import { hydrateFromDatabase } from '@/server/services/download/tracked-download/db-sync';
import { TrackedDownloadService } from '@/server/services/download/tracked-download/tracked-download-service';
import { preExtractChapterPages } from '@/server/services/reader/pre-extraction-service';
import { realtimeEmitter } from '@/server/services/realtime';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

/**
 * Download Monitor Worker
 *
 * Monitors download clients for completed downloads and imports files into
 * the manga library.
 *
 * Workflow:
 * 1. Check all download clients for completed downloads
 * 2. Find jobs that are marked COMPLETED but have chapters still DOWNLOADING
 * 3. Query download client to verify actual completion
 * 4. Import files from download client directory to manga library
 * 5. Update chapter statuses to COMPLETED and set file paths
 */

const downloadMonitor = new DownloadMonitor();
const fileImporter = new FileImporter();
let shadowModeHydrated = false;

/**
 * Trigger pre-extraction for recently imported chapters.
 * Runs in background (non-blocking) to avoid delaying the import workflow.
 */
async function triggerPreExtraction(mangaId: number): Promise<void> {
  try {
    // Get recently imported chapters for this manga
    const chapters = await prisma.chapter.findMany({
      where: {
        mangaId,
        filePath: { not: null },
        downloadStatus: 'COMPLETED'
      },
      orderBy: { createdAt: 'desc' },
      take: 5, // Pre-extract last 5 chapters
      select: { id: true, filePath: true }
    });

    for (const chapter of chapters) {
      if (chapter.filePath) {
        void preExtractChapterPages(mangaId, chapter.id, chapter.filePath);
      }
    }
  } catch (error) {
    logger.error('[DownloadMonitor] Pre-extraction trigger failed:', error);
  }
}

/**
 * Hydrate the shadow mode tracked download state machine from the database.
 * Called once on first poll cycle to reconstruct in-memory state.
 */
async function hydrateShadowMode(): Promise<void> {
  try {
    const downloads = await hydrateFromDatabase(prisma);
    const service = TrackedDownloadService.getInstance();
    service.loadAll(downloads);
    logger.info('[DownloadMonitor] Shadow mode hydrated from database', {
      count: downloads.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('[DownloadMonitor] Shadow mode hydration failed (non-fatal)', { error: message });
  }
}

/**
 * Per-cycle maintenance sweeps. Must run every cycle (even with zero
 * completed downloads) so chapters orphaned by past crashes get reclaimed
 * even when no live job survives to recover them.
 */
async function runMaintenanceSweeps(): Promise<void> {
  // Safety net: clean up chapters orphaned by prior import failures.
  const orphanCount = await cleanupOrphanedDownloadingChapters(prisma);
  if (orphanCount > 0) {
    logger.info(`[DownloadMonitor] Orphan cleanup: reset ${orphanCount} stuck DOWNLOADING chapters to PENDING`);
  }

  // Recover ghost-completed chapters (pageCount=0 with file present, usually
  // from a count attempt during a transient mount outage). Bounded per cycle.
  await cleanupGhostCompletedChapters(prisma);

  // iter-IM: downgrade ghost-completed chapters whose file is GONE and whose
  // parent dir IS reachable (so we're sure it's not a mount outage).
  await cleanupVanishedFileChapters(prisma);

  // Heal chapters on disk inside a file-backed volume archive but stuck
  // non-COMPLETED (the Kaiju case). Bounded per cycle; makes the archive-
  // coverage fix self-healing library-wide with no user action. Runs after
  // cleanupVanishedFileChapters so phantom archive rows are downgraded first
  // and never counted as coverage.
  await healArchiveCoveredChaptersSweep(prisma);

  // iter-D1: resolve pending ProwlarrCoverageAttempt rows (observation-only
  // telemetry that drives the coverage-parser improvement loop).
  await resolveCoverageAttempts(prisma);

  // iter-EX: resolve pending ChapterDispatchAttempt rows so the
  // exhaustion-guard read-side has accurate per-chapter failed-source
  // history for the next dispatch cycle.
  await resolveChapterDispatchAttempts(prisma);
}

/**
 * Process download monitoring and file import
 *
 * @returns AsyncResult indicating success or failure
 */
export async function processDownloadMonitoring(): Promise<AsyncResult<{
  checked: number;
  imported: number;
  errors: number;
}, Error>> {
  try {
    // Shadow mode: one-time hydration of tracked download state machine from DB
    if (!shadowModeHydrated) {
      await hydrateShadowMode();
      shadowModeHydrated = true;
    }

    logger.info('[DownloadMonitor] Starting download monitoring check');

    // Emit WebSocket event for monitoring started
    void realtimeEmitter.emitSystemEvent({
      eventType: 'download:monitor:started',
      source: 'downloadMonitorWorker',
      message: 'Download monitoring check started',
      data: { timestamp: new Date().toISOString() }
    });

    // Check for completed downloads across all clients
    const completedResult = await downloadMonitor.checkCompletedDownloads();

    if (isError(completedResult)) {
      logger.error('[DownloadMonitor] Failed to check completed downloads:', completedResult.error);
      return completedResult;
    }

    if (!isSuccess(completedResult)) {
      return createErrorResult(new Error('Failed to check completed downloads'));
    }

    const completedDownloads = completedResult.data;
    const stats = {
      checked: completedDownloads.length,
      imported: 0,
      errors: 0
    };

    if (completedDownloads.length === 0) {
      logger.info('[DownloadMonitor] No completed downloads found');
    } else {
      logger.info(`[DownloadMonitor] Found ${completedDownloads.length} completed downloads to import`);
    }

    // Import each completed download sequentially (no-op when list is empty).
    // NOTE: Sequential processing is intentional here to:
    // 1. Avoid file system race conditions during file moves/copies
    // 2. Ensure database state is consistent between imports
    // 3. Prevent overwhelming disk I/O with concurrent operations
    //
    // Maintenance sweeps below MUST run every cycle, including when there are
    // no completed downloads — they reclaim chapters orphaned by past crashes
    // that have no live job to recover them.
    /* eslint-disable no-await-in-loop -- Intentional sequential file system operations */
    for (const download of completedDownloads) {
      try {
        logger.info(`[DownloadMonitor] Importing download for manga ${download.mangaId}, job ${download.jobId}`);

        const importResult = await fileImporter.importDownload(download);

        if (isError(importResult)) {
          logger.error(`[DownloadMonitor] Failed to import download for job ${download.jobId}:`, importResult.error);
          stats.errors++;
          continue;
        }

        if (!isSuccess(importResult)) {
          logger.error(`[DownloadMonitor] Import failed for job ${download.jobId}`);
          stats.errors++;
          continue;
        }

        const result = importResult.data;

        logger.info(`[DownloadMonitor] Successfully imported: ${result.filesImported} files, ${result.chaptersUpdated} chapters updated`);
        stats.imported++;

        // Emit realtime event for successful import
        void realtimeEmitter.emitDownloadCompleted({
          taskId: String(download.jobId),
          mangaId: download.mangaId,
          progress: 100,
          status: 'completed',
        });

        // Fire-and-forget: pre-extract pages for instant reader startup
        void triggerPreExtraction(download.mangaId);

        // Log any import errors
        if (result.errors.length > 0) {
          logger.warn(`[DownloadMonitor] Import completed with ${result.errors.length} errors:`, result.errors);
        }

      } catch (error: unknown) {
        logger.error(`[DownloadMonitor] Unexpected error importing download for job ${download.jobId}:`, error);
        stats.errors++;
      }
    }
    /* eslint-enable no-await-in-loop */

    await runMaintenanceSweeps();

    logger.info(`[DownloadMonitor] Monitoring complete - checked: ${stats.checked}, imported: ${stats.imported}, errors: ${stats.errors}`);

    // Emit WebSocket event for monitoring completed
    void realtimeEmitter.emitSystemEvent({
      eventType: 'download:monitor:completed',
      source: 'downloadMonitorWorker',
      message: `Download monitoring completed: ${stats.imported} imported, ${stats.errors} errors`,
      data: { ...stats, timestamp: new Date().toISOString() }
    });

    return createSuccessResult(stats);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[DownloadMonitor] Error processing download monitoring:', error);

    // Emit WebSocket event for monitoring error
    void realtimeEmitter.emitSystemEvent({
      eventType: 'download:monitor:error',
      source: 'downloadMonitorWorker',
      message: `Download monitoring failed: ${errorMessage}`,
      data: { error: errorMessage, timestamp: new Date().toISOString() }
    });

    return createErrorResult(error instanceof Error ? error : new Error(errorMessage));
  }
}
