/**
 * Downloads Queue Operations
 *
 * Persistence and client-side helpers backing the downloads queue router.
 * Queue state lives in the existing PackDownload + jobs tables (there is no
 * separate Download model by design); live transfer state comes from the
 * configured download clients.
 */

import { PackDownloadStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { getConfiguredClient, getEnabledClients, TORRENT_CLIENTS } from './client-config';

import type { DownloadClient } from './utils';

// ============================================================================
// Types
// ============================================================================

export interface ClientDownloadItem {
  id: string;
  name: string;
  status: string;
  progress: number;
  clientType: string;
  savePath: string;
  size: number;
}

/** Queue-filter statuses → PackDownload statuses. PAUSED has no DB state (client-only). */
export const QUEUE_STATUS_MAP: Record<string, PackDownloadStatus[]> = {
  PENDING: [PackDownloadStatus.DOWNLOADING],
  DOWNLOADING: [PackDownloadStatus.DOWNLOADING],
  COMPLETED: [
    PackDownloadStatus.COMPLETED,
    PackDownloadStatus.IMPORTING,
    PackDownloadStatus.IMPORTED,
  ],
  FAILED: [PackDownloadStatus.FAILED],
  PAUSED: [],
};

// ============================================================================
// Client item listing
// ============================================================================

export async function fetchDownloadsFromClient(
  clientType: string
): Promise<ClientDownloadItem[]> {
  try {
    const client = await getConfiguredClient(clientType);
    if (!client) {
      logger.debug(`[TrackDownload] No configured client for ${clientType}`);
      return [];
    }
    const itemsResult = await client.getAllItems();
    if (!isSuccess(itemsResult)) {
      logger.warn(`[TrackDownload] Failed to get items from ${clientType}`, {
        error: 'error' in itemsResult ? String(itemsResult.error) : 'unknown',
      });
      return [];
    }
    return itemsResult.data.map((item) => ({
      id: String(item.id),
      name: item.name,
      status: item.status,
      progress: item.progress,
      clientType,
      savePath: item.savePath,
      size: item.size ?? 0,
    }));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`[TrackDownload] Error fetching from ${clientType}: ${msg}`);
    return [];
  }
}

/** Fetch from a client with a 10s timeout to avoid blocking on unresponsive clients */
export async function fetchWithTimeout(clientType: string): Promise<ClientDownloadItem[]> {
  const clientStart = Date.now();
  const result = await Promise.race([
    fetchDownloadsFromClient(clientType),
    new Promise<ClientDownloadItem[]>((resolve) => {
      setTimeout(() => {
        logger.warn(`[TrackDownload] Timeout fetching from ${clientType} after 10s`);
        resolve([]);
      }, 10_000);
    }),
  ]);
  logger.debug(`[TrackDownload] ${clientType}: ${result.length} items (${Date.now() - clientStart}ms)`);
  return result;
}

// ============================================================================
// Tracking persistence (jobs + PackDownload)
// ============================================================================

/**
 * Create the jobs row that the download monitor polls for a tracked download.
 * Raw SQL with NOW() avoids the JS Date/PostgreSQL timezone mismatch.
 */
export async function createDownloadTrackingJob(opts: {
  mangaId: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
}): Promise<bigint> {
  const payloadJson = JSON.stringify(opts.payload);
  const resultJson = JSON.stringify(opts.result);
  const jobRows = await prisma.$queryRaw<Array<{ id: bigint }>>`
    INSERT INTO jobs (
      queue_name, job_type, priority, status, progress,
      started_at, scheduled_for, manga_id, partition_key,
      payload, result
    ) VALUES (
      'default',
      'chapter_download'::"JobType",
      'high'::"JobPriority",
      'active'::"JobStatus",
      0,
      NOW(), NOW(),
      ${opts.mangaId}::integer,
      'active',
      ${payloadJson}::jsonb,
      ${resultJson}::jsonb
    ) RETURNING id
  `;
  const job = jobRows[0];
  if (!job) throw new Error('Failed to create tracking job');
  return job.id;
}

/** Protocol label for a client type (PackDownload.protocol) */
export function protocolForClientType(clientType: string): string {
  return (TORRENT_CLIENTS as readonly string[]).includes(clientType) ? 'torrent' : 'usenet';
}

// ============================================================================
// Per-download client operations
// ============================================================================

type ClientOperation = 'pause' | 'resume' | 'remove';

async function runOperationOnClient(
  client: DownloadClient,
  operation: ClientOperation,
  downloadId: string,
  deleteFiles?: boolean
): Promise<boolean> {
  const result =
    operation === 'pause'
      ? await client.pauseItem(downloadId)
      : operation === 'resume'
        ? await client.resumeItem(downloadId)
        : await client.removeItem(downloadId, deleteFiles ?? false);
  return isSuccess(result) && result.data === true;
}

/**
 * Run a pause/resume/remove operation against the client holding a download.
 *
 * Resolution order: the PackDownload row's clientType if one exists, then
 * every enabled client until one accepts the operation.
 */
export async function runClientOperation(
  downloadId: string,
  operation: ClientOperation,
  deleteFiles?: boolean
): Promise<boolean> {
  const tracked = await prisma.packDownload.findFirst({
    where: { downloadId },
    orderBy: { createdAt: 'desc' },
    select: { clientType: true },
  });

  const candidateTypes: string[] = [];
  if (tracked) candidateTypes.push(tracked.clientType);
  const enabled = await getEnabledClients();
  for (const c of enabled) {
    if (!candidateTypes.includes(c.type)) candidateTypes.push(c.type);
  }

  for (const clientType of candidateTypes) {
    // eslint-disable-next-line no-await-in-loop -- clients are tried sequentially until one accepts the operation
    const client = await getConfiguredClient(clientType);
    if (!client) continue;
    try {
      // eslint-disable-next-line no-await-in-loop -- see above
      const ok = await runOperationOnClient(client, operation, downloadId, deleteFiles);
      if (ok) {
        logger.info(`Download ${operation} succeeded via ${clientType}`, { downloadId });
        return true;
      }
    } catch (error: unknown) {
      logger.debug(`Download ${operation} attempt failed on ${clientType}`, {
        downloadId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return false;
}

/**
 * Remove completed items from every enabled client (files are kept).
 * Returns the number of items cleared.
 */
export async function clearCompletedFromClients(): Promise<number> {
  const enabled = await getEnabledClients();
  const completedStatuses = new Set(['completed', 'complete', 'COMPLETED', 'seeding']);
  let cleared = 0;
  const perClient = await Promise.all(
    enabled.map(async ({ type }) => {
      const items = await fetchWithTimeout(type);
      const completed = items.filter((i) => completedStatuses.has(i.status));
      const client = await getConfiguredClient(type);
      if (!client || completed.length === 0) return 0;
      const results = await Promise.all(
        completed.map(async (item) => {
          const result = await client.removeItem(item.id, false);
          return isSuccess(result) && result.data === true ? 1 : 0;
        })
      );
      return results.reduce<number>((sum, r) => sum + r, 0);
    })
  );
  cleared = perClient.reduce((sum, c) => sum + c, 0);
  return cleared;
}
