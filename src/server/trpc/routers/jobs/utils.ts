import { prisma } from '@/server/db';
import { ClientDownloadService } from '@/server/services/download/clientDownload';
import { logger } from '@/utils/logger';

/**
 * Attempts to remove a torrent from the download client for a cancelled job.
 *
 * @param jobResult - The job's result field (may contain downloadId and clientType)
 * @param jobId - Job ID for logging
 * @returns Whether the torrent was successfully removed
 */
export async function tryRemoveTorrent(jobResult: unknown, jobId: string): Promise<boolean> {
  if (!jobResult || typeof jobResult !== 'object' || Array.isArray(jobResult)) return false;

  const result = jobResult as Record<string, unknown>;
  const downloadId = result['downloadId'];
  const clientType = result['clientType'];
  if (typeof downloadId !== 'string' || typeof clientType !== 'string') return false;

  try {
    const clientService = new ClientDownloadService(prisma);
    const removeResult = await clientService.removeDownload(clientType, downloadId, true);
    if ('data' in removeResult) {
      logger.info(`[JobCancel] Removed torrent ${downloadId} from ${clientType} for job ${jobId}`);
      return true;
    }
    logger.warn(`[JobCancel] Failed to remove torrent ${downloadId} from ${clientType}`, removeResult);
  } catch (err: unknown) {
    logger.warn(`[JobCancel] Error removing torrent for job ${jobId}:`, err);
  }
  return false;
}
