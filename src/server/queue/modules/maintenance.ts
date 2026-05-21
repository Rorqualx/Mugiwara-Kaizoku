/**
 * Maintenance operations for the queue system
 *
 * @module server/queue/modules/maintenance
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';


import { JobStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';


import { PostgreSQLQueueWorker } from '../PostgreSQLQueueWorker';

import { reassignOrphanedChapters } from './chapter-volume-reassignment';
import { reconcileNativeDownloadsWithFailedJobs } from './native-download-reconciler';
import { pruneOrphanVolumes } from './orphan-volume-prune';
import { reconcileFalseFailedPackDownloads } from './pack-download-reconciler';
import { reconcileStaleTorrentJobs } from './stale-torrent-job-reconciler';

export class MaintenanceManager {
  private eventEmitter: EventEmitter;
  private staleJobInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private chapterVolumeInterval: NodeJS.Timeout | null = null;
  private nativeDownloadReconcileInterval: NodeJS.Timeout | null = null;
  private packDownloadReconcileInterval: NodeJS.Timeout | null = null;
  private staleTorrentJobInterval: NodeJS.Timeout | null = null;
  private orphanVolumeInterval: NodeJS.Timeout | null = null;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: bigint): Promise<boolean> {
    const result = await prisma.jobs.updateMany({
      where: {
        id: jobId,
        status: {
          in: [JobStatus.pending, JobStatus.retrying]
        }
      },
      data: {
        status: JobStatus.cancelled,
        completed_at: new Date()
      }
    });

    if (result.count > 0) {
      logger.info(`Cancelled job ${jobId}`);
      this.eventEmitter.emit('job:cancelled', { jobId });
      return true;
    }

    return false;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: bigint): Promise<boolean> {
    // Use raw SQL with NOW() to avoid JS Date/PG timezone mismatch
    const result = await prisma.$executeRaw`
      UPDATE jobs
      SET status = 'pending'::"JobStatus",
          scheduled_for = NOW(),
          attempt_count = 0,
          partition_key = 'active'
      WHERE id = ${jobId} AND status = 'failed'::"JobStatus"
    `;

    if (result > 0) {
      logger.info(`Retrying job ${jobId}`);
      this.eventEmitter.emit('job:retried', { jobId });
      return true;
    }

    return false;
  }

  /**
   * Clean up old completed jobs
   */
  async cleanup(daysToKeep = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await prisma.jobs.deleteMany({
      where: {
        completed_at: { lt: cutoffDate },
        status: { in: [JobStatus.completed, JobStatus.cancelled] }
      }
    });

    if (result.count > 0) {
      logger.info(`Deleted ${result.count} old completed jobs`);
    }

    return result.count;
  }

  /**
   * Clean up old jobs from the database
   */
  async cleanupOldTasks(days = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const deleted = await prisma.jobs.deleteMany({
      where: {
        completed_at: { lt: cutoffDate },
        status: { in: [JobStatus.completed, JobStatus.failed, JobStatus.cancelled] }
      }
    });

    logger.info(`Cleaned up ${deleted.count} old jobs older than ${days} days`);
  }

  /**
   * Reschedule failed jobs for retry
   */
  async rescheduleFailed(): Promise<number> {
    // Use raw SQL with NOW() to avoid JS Date/PG timezone mismatch
    const result = await prisma.$executeRaw`
      UPDATE jobs
      SET status = 'pending'::"JobStatus",
          attempt_count = attempt_count + 1,
          scheduled_for = NOW() + INTERVAL '5 minutes'
      WHERE status = 'failed'::"JobStatus"
        AND created_at > NOW() - INTERVAL '24 hours'
        AND attempt_count < max_attempts
    `;

    if (result > 0) {
      logger.info(`Rescheduled ${result} failed jobs for retry`);
    }
    return result;
  }

  /**
   * Start periodic maintenance tasks
   */
  startMaintenance(): void {
    // Recover stale jobs every 5 minutes
    this.staleJobInterval = setInterval(() => {
      void (async () => {
        try {
          await PostgreSQLQueueWorker.recoverStaleJobs();
        } catch (error) {
          logger.error('Failed to recover stale jobs:', error);
        }
      })();
    }, 5 * 60 * 1000);

    // Clean up old jobs daily
    this.cleanupInterval = setInterval(() => {
      void (async () => {
        try {
          await this.cleanup();
        } catch (error) {
          logger.error('Failed to clean up old jobs:', error);
        }
      })();
    }, 24 * 60 * 60 * 1000);

    // Bucket newly-orphaned Chapter rows into Volumes daily. Catches
    // chapters added past the last canonical volume, decimals that fell
    // outside integer ranges, and zero-volume manga whose tree was never
    // built. See `chapter-volume-reassignment.ts` for the four-step ladder.
    this.chapterVolumeInterval = setInterval(() => {
      void (async () => {
        try {
          await reassignOrphanedChapters();
        } catch (error) {
          logger.error('Failed to reassign orphaned chapters:', error);
        }
      })();
    }, 24 * 60 * 60 * 1000);

    // Reconcile NativeDownload rows whose paired job force-failed
    // (SQL hard-timeout / worker SIGKILL) every 5 min. See
    // `native-download-reconciler.ts` for the rationale.
    this.nativeDownloadReconcileInterval = setInterval(() => {
      void (async () => {
        try {
          await reconcileNativeDownloadsWithFailedJobs();
        } catch (error) {
          logger.error('Failed to reconcile NativeDownload rows:', error);
        }
      })();
    }, 5 * 60 * 1000);

    // Promote pack_download rows that report FAILED but whose linked
    // chapters all reached COMPLETED (readiness-poll false-failure
    // followed by successful retry). See
    // `pack-download-reconciler.ts` for the rationale.
    this.packDownloadReconcileInterval = setInterval(() => {
      void (async () => {
        try {
          await reconcileFalseFailedPackDownloads();
        } catch (error) {
          logger.error('Failed to reconcile pack_download rows:', error);
        }
      })();
    }, 15 * 60 * 1000);

    // Fail jobs whose dispatched torrent disappeared from the
    // download client (Transmission lost it after 0-seeder detection,
    // manual removal via UI/RPC, VPN reconnect, etc) while the job
    // stays stuck `active` forever. Polls every 5 min, matching the
    // staleJobInterval cadence. See `stale-torrent-job-reconciler.ts`.
    this.staleTorrentJobInterval = setInterval(() => {
      void (async () => {
        try {
          await reconcileStaleTorrentJobs();
        } catch (error) {
          logger.error('Failed to reconcile stale torrent jobs:', error);
        }
      })();
    }, 5 * 60 * 1000);

    // iter-VO: prune Volume rows that no Chapter references and that
    // lack a trusted provider source. Phantom rows from past auto-
    // enrichment that inflate the volume-count badge. Daily cadence
    // — these accumulate slowly, no need for tighter polling.
    this.orphanVolumeInterval = setInterval(() => {
      void (async () => {
        try {
          await pruneOrphanVolumes();
        } catch (error) {
          logger.error('Failed to prune orphan volumes:', error);
        }
      })();
    }, 24 * 60 * 60 * 1000);

    // Run once at startup so newly-deployed servers reconcile immediately
    // instead of waiting 24h for the first interval tick.
    void (async () => {
      try {
        await reassignOrphanedChapters();
      } catch (error) {
        logger.error('Initial chapter-volume reassignment failed:', error);
      }
    })();

    // Initial stale-job sweep with threshold=0 catches anything left behind
    // by a previous server (process crash, kill -9 — the worker's own
    // recoverOrphanedJobs only fires for jobs whose worker_id matches this
    // incarnation's id). Without this, post-restart cleanup would wait up
    // to 5min for the first interval tick.
    void (async () => {
      try {
        await PostgreSQLQueueWorker.recoverStaleJobs(0);
      } catch (error) {
        logger.error('Initial stale-job recovery failed:', error);
      }
    })();
  }

  /**
   * Stop periodic maintenance tasks
   */
  stopMaintenance(): void {
    if (this.staleJobInterval) {
      clearInterval(this.staleJobInterval);
      this.staleJobInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.chapterVolumeInterval) {
      clearInterval(this.chapterVolumeInterval);
      this.chapterVolumeInterval = null;
    }
    if (this.nativeDownloadReconcileInterval) {
      clearInterval(this.nativeDownloadReconcileInterval);
      this.nativeDownloadReconcileInterval = null;
    }
    if (this.packDownloadReconcileInterval) {
      clearInterval(this.packDownloadReconcileInterval);
      this.packDownloadReconcileInterval = null;
    }
    if (this.staleTorrentJobInterval) {
      clearInterval(this.staleTorrentJobInterval);
      this.staleTorrentJobInterval = null;
    }
    if (this.orphanVolumeInterval) {
      clearInterval(this.orphanVolumeInterval);
      this.orphanVolumeInterval = null;
    }
    logger.info('Maintenance tasks stopped');
  }

  /**
   * Process pending tasks (compatibility method)
   */
  processTasks(): Promise<void> {
    // This is now handled by workers automatically
    // Kept for backward compatibility
    logger.debug('processTasks called - workers handle this automatically');
    return Promise.resolve();
  }

  /**
   * Detect orphaned ChapterFile entries pointing to files no longer on disk.
   * Logs warnings but does not delete — manual review recommended.
   */
  async detectOrphanedChapterFiles(): Promise<number> {
    const chapterFiles = await prisma.chapterFile.findMany({
      select: { id: true, chapterId: true, filePath: true, fileName: true },
    });

    // Check all file existence in parallel
    const results = await Promise.all(
      chapterFiles.map(async (cf) => {
        try {
          await fs.access(cf.filePath);
          return null;
        } catch {
          return cf;
        }
      })
    );

    const orphanIds: number[] = [];
    for (const orphan of results) {
      if (orphan) {
        orphanIds.push(orphan.id);
      }
    }
    const orphanCount = orphanIds.length;

    if (orphanCount > 0) {
      logger.warn('Detected orphaned ChapterFile entries (files missing from disk)', {
        count: orphanCount,
        ids: orphanIds.slice(0, 20),
      });
    }

    return orphanCount;
  }
}