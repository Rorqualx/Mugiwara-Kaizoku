/**
 * Pack-import retry helper.
 *
 * Wraps `handlePackImport` in a wallclock-bounded retry loop. Used by
 * the two paths that observe a download finish:
 *   - `downloadManager/torrent-health.ts` (live torrent SEEDING/COMPLETED
 *     transition; primary path)
 *   - `downloadMonitor.ts:handleCompleted` (downloadMonitor sweep; rare
 *     recovery path for jobs that the live path missed)
 *
 * The retry exists because pack readiness lags the download client's
 * "completed" event: file moves between Transmission/SAB/NZBGet's
 * temp dir and the final completed dir take several seconds, and the
 * pack-import service rejects partially-moved trees. Retrying for up
 * to 10min at 30s pacing covers the realistic move window without
 * holding a worker indefinitely on a genuinely failed import.
 *
 * When the deadline expires, the caller fires `IMPORT_FAILED` →
 * `IMPORT_BLOCKED`. At that point the pack is genuinely terminal-failed,
 * so the `IMPORT_BLOCKED → 'FAILED'` mapping in `db-sync.ts` is correct.
 */
import { logger } from '@/utils/logger';

import { handlePackImport } from './pack-import-handler';

import type { PrismaClient } from '@prisma/client';

const IMPORT_RETRY_DEADLINE_MS = 10 * 60 * 1000;
const IMPORT_RETRY_INTERVAL_MS = 30 * 1000;

export async function runPackImportWithRetry(
  prismaClient: PrismaClient,
  jobId: bigint,
  downloadId: string,
  localPath: string,
  mangaId: number,
): Promise<boolean> {
  const startedAt = Date.now();
  let attempt = 0;
  while (true) {
    attempt++;
    // eslint-disable-next-line no-await-in-loop -- sequential retries are the design
    const ok = await handlePackImport(prismaClient, jobId, downloadId, localPath, mangaId);
    if (ok) {
      if (attempt > 1) {
        logger.info(`[PackImportRetry] Job ${jobId} import succeeded on attempt ${attempt}`);
      }
      return true;
    }
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs + IMPORT_RETRY_INTERVAL_MS >= IMPORT_RETRY_DEADLINE_MS) {
      logger.warn(
        `[PackImportRetry] Job ${jobId} pack import failed after ${attempt} attempt(s) over ${Math.round(elapsedMs / 1000)}s — giving up`,
      );
      return false;
    }
    logger.info(
      `[PackImportRetry] Job ${jobId} pack import not ready (attempt ${attempt}); retrying in ${IMPORT_RETRY_INTERVAL_MS / 1000}s`,
    );
    // eslint-disable-next-line no-await-in-loop -- retry pacing
    await new Promise<void>((resolve) => { setTimeout(resolve, IMPORT_RETRY_INTERVAL_MS); });
  }
}
