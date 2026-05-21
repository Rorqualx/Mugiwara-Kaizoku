/**
 * Reconcile `pack_download` rows that report FAILED but whose linked
 * chapters all reached `downloadStatus = COMPLETED`.
 *
 * Cause: when the readiness-poll deadline (67s) inside
 * `packImportService` fires, the pack row gets flipped to FAILED with
 * `errorMessage = 'pack path not ready after 67s'`. A subsequent retry
 * via `runPackImportWithRetry` (see
 * `src/server/services/download/download-monitor/pack-import-retry.ts`,
 * shipped in C1.b) can succeed — chapters land — but the pack row is
 * never promoted back to IMPORTED, leaving a stale FAILED tombstone in
 * the UI.
 *
 * Reconciliation rule: each FAILED pack with at least one linked
 * chapter where every linked chapter is `downloadStatus = COMPLETED`
 * is effectively imported. Promote it to IMPORTED, set `completedAt =
 * NOW()`, and clear `errorMessage`.
 *
 * Called from `MaintenanceManager.startMaintenance()` every 15 min.
 * Slower cadence than `recover_stale_jobs` (5 min) because the eventual
 * consistency window between chapters landing and pack-row promotion is
 * not user-visible-critical.
 */
import { PackDownloadStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

const log = logger.child('PackDownloadReconciler');

interface OrphanRow { pack_id: string }

export interface PackReconciliationReport {
  promoted: number;
}

async function promoteOne(packId: string): Promise<boolean> {
  try {
    await prisma.packDownload.update({
      where: { id: BigInt(packId) },
      data: {
        status: PackDownloadStatus.IMPORTED,
        completedAt: new Date(),
        errorMessage: null,
      },
    });
    return true;
  } catch (err) {
    log.warn('Failed to promote pack_download row', {
      packId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export async function reconcileFalseFailedPackDownloads(): Promise<PackReconciliationReport> {
  const orphans = await prisma.$queryRaw<OrphanRow[]>`
    SELECT pd.id::text AS pack_id
    FROM pack_download pd
    INNER JOIN "Chapter" c ON c."packDownloadId" = pd.id
    WHERE pd.status = 'FAILED'
    GROUP BY pd.id
    HAVING COUNT(c.id) > 0
       AND COUNT(c.id) = COUNT(c.id) FILTER (WHERE c."downloadStatus" = 'COMPLETED')
  `;

  const report: PackReconciliationReport = { promoted: 0 };
  if (orphans.length === 0) return report;

  for (const o of orphans) {
    // eslint-disable-next-line no-await-in-loop -- per-row update; small batch
    if (await promoteOne(o.pack_id)) report.promoted++;
  }

  log.info('PackDownload reconciliation sweep complete', report);
  return report;
}
