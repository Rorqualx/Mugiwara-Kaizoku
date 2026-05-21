/**
 * Reconcile `NativeDownload` rows whose paired job has reached a terminal
 * failed/cancelled state but whose own status is still QUEUED or
 * DOWNLOADING.
 *
 * The MangaDex/Suwayomi handlers update `NativeDownload.status` from
 * their try/catch paths (see `mangadex-download.ts:174-178`). When SQL
 * `recover_stale_jobs` force-fails a job at `hard_timeout_at` — or when
 * the worker process is killed (SIGKILL/OOM) — that catch block never
 * runs, leaving the NativeDownload row stuck in a non-terminal state
 * indefinitely. With the AbortController plumbing landed, the
 * hard-timeout case now propagates through the handler, but the
 * worker-crash case still falls into this reconciliation path.
 *
 * Lookup keys the job to its NativeDownload via `payload.downloadId`
 * (set by `releaseDispatcher/dispatch.ts` when enqueueing). The pairing
 * is one job per NativeDownload — there is no fan-out to worry about.
 *
 * Called from `MaintenanceManager.startMaintenance()` every 5 minutes,
 * matching the `recover_stale_jobs` cadence so that any job force-failed
 * in a sweep is reconciled to its NativeDownload in the next sweep.
 */
import { NativeDownloadStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

const log = logger.child('NativeDownloadReconciler');

interface OrphanRow {
  download_id: string;
  job_id: string;
  job_status: string;
  job_last_error: string | null;
}

export interface ReconciliationReport {
  reconciledFailed: number;
  reconciledCancelled: number;
}

async function reconcileOne(o: OrphanRow): Promise<NativeDownloadStatus | null> {
  const targetStatus = o.job_status === 'cancelled'
    ? NativeDownloadStatus.CANCELLED
    : NativeDownloadStatus.FAILED;
  const errorMessage = o.job_last_error
    ?? `Reconciled from terminally-${o.job_status} job ${o.job_id}`;
  try {
    await prisma.nativeDownload.update({
      where: { id: o.download_id },
      data: {
        status: targetStatus,
        error: errorMessage,
        endTime: new Date(),
      },
    });
    return targetStatus;
  } catch (err) {
    log.warn('Failed to reconcile NativeDownload row', {
      downloadId: o.download_id,
      jobId: o.job_id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function reconcileNativeDownloadsWithFailedJobs(): Promise<ReconciliationReport> {
  const orphans = await prisma.$queryRaw<OrphanRow[]>`
    SELECT
      nd.id                                AS download_id,
      j.id::text                           AS job_id,
      j.status::text                       AS job_status,
      COALESCE(j.last_error->>'error', j.last_error->>'message') AS job_last_error
    FROM "NativeDownload" nd
    INNER JOIN jobs j ON j.payload->>'downloadId' = nd.id
    WHERE nd.status IN ('QUEUED', 'DOWNLOADING')
      AND j.status IN ('failed', 'cancelled')
  `;

  const report: ReconciliationReport = { reconciledFailed: 0, reconciledCancelled: 0 };
  if (orphans.length === 0) return report;

  for (const o of orphans) {
    // eslint-disable-next-line no-await-in-loop -- per-row update; backlog is small
    const result = await reconcileOne(o);
    if (result === NativeDownloadStatus.CANCELLED) {
      report.reconciledCancelled++;
    } else if (result === NativeDownloadStatus.FAILED) {
      report.reconciledFailed++;
    }
  }

  log.info('NativeDownload reconciliation sweep complete', report);
  return report;
}
