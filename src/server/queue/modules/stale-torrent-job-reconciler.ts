/**
 * Reconcile jobs that dispatched a torrent to a download client but
 * whose torrent disappeared from that client mid-flight.
 *
 * The dispatch flow records `result.{downloadId, clientType, releaseTitle}`
 * on the job when the magnet is accepted by Transmission / qBittorrent /
 * Deluge. Subsequent progress tracking lives in
 * `services/download/downloadManager` which polls the client for state,
 * detects 0-seeder / stalled torrents (`torrent-health.checkTorrentHealth`),
 * and calls `handleProgressFailure` to remove the dead torrent +
 * mark the job failed.
 *
 * The gap this fills: if the polling cycle MISSES that transition —
 * e.g. the BULK Prowlarr dispatch path doesn't enter the per-torrent
 * polling loop, the worker process restarts before the next poll, the
 * torrent is removed externally (UI, RPC, or VPN reconnect kicking the
 * session), etc — the job stays `active` forever, the chapters stay
 * `DOWNLOADING`, and the UI looks like work is happening when nothing
 * is. Verified on Lookism 2026-05-11: job 79 stuck active for 45 min
 * after Transmission lost the torrent (0 transfers in client, 597
 * chapters DOWNLOADING).
 *
 * Sweep logic (read-only checks → bounded mutation):
 *   1. Pick jobs with `status='active'`, started >10 min ago, with a
 *      `result.downloadId` + `result.clientType`.
 *   2. For each, call `clientService.getDownloadStatus(clientType,
 *      downloadId)`. If the call errors with "not found" OR returns
 *      an empty/missing status, the torrent is GONE from the client.
 *   3. Mark the job failed (`reason: stale-torrent-job`); reset its
 *      DOWNLOADING chapters back to PENDING so the next
 *      autoDownloadScheduler tick (or a manual re-dispatch) can pick
 *      them up cleanly via either Prowlarr alternative or the
 *      native-source path.
 *
 * Called from `MaintenanceManager.startMaintenance()` every 5 minutes,
 * matching the staleJobInterval cadence.
 */
import { JobStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { ClientDownloadService } from '@/server/services/download/clientDownload';
import { logger } from '@/utils/logger';

const log = logger.child('StaleTorrentJobReconciler');

const TORRENT_CLIENT_TYPES = new Set(['transmission', 'qbittorrent', 'deluge']);
const MIN_AGE_MS = 10 * 60 * 1000;

export interface StaleTorrentJobReport {
  candidatesScanned: number;
  staleJobsFailed: number;
  chaptersReset: number;
  errors: string[];
}

interface CandidateRow {
  id: string;          // jobs.id (bigint serialized to string by raw query)
  partition_key: string;
  result_json: string; // jobs.result jsonb serialized
  manga_id: number | null;
}

interface JobResult {
  downloadId?: string;
  clientType?: string;
  releaseTitle?: string;
  mangaId?: number;
}

export function parseResult(s: string | null): JobResult | null {
  if (!s) return null;
  try {
    const parsed: unknown = JSON.parse(s);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as JobResult;
  } catch {
    return null;
  }
}

/**
 * Decide if a client-status result means "the torrent is gone".
 * `getStatus` returns AsyncResult; errors with not-found messages OR
 * a success-with-empty payload both indicate the client doesn't track
 * the download anymore.
 *
 * Inspects the result shape directly (status / data / error fields)
 * instead of via the AsyncResult guards — those require a typed
 * `AsyncResult<T, E>` parameter and we only have `unknown` here.
 */
export function clientLostTorrent(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const r = result as Record<string, unknown>;
  if (r['status'] === 'error') {
    const err = r['error'];
    const msg = err instanceof Error ? err.message : String(err ?? '');
    return /not.?found|no.?such|invalid.?id|unknown.?torrent|404/i.test(msg);
  }
  if (r['status'] === 'success') {
    const data = r['data'];
    if (data === null || data === undefined) return true;
    if (typeof data !== 'object') return false;
    const inner = data as Record<string, unknown>;
    if ('data' in inner && (inner['data'] === null || inner['data'] === undefined)) return true;
  }
  return false;
}

async function findCandidates(): Promise<CandidateRow[]> {
  const cutoff = new Date(Date.now() - MIN_AGE_MS).toISOString();
  return prisma.$queryRaw<CandidateRow[]>`
    SELECT j.id::text AS id,
           j.partition_key,
           j.result::text AS result_json,
           (j.payload->>'mangaId')::int AS manga_id
    FROM jobs j
    WHERE j.status = 'active'::"JobStatus"
      AND j.started_at < ${cutoff}::timestamptz
      AND j.result IS NOT NULL
      AND j.result ? 'downloadId'
      AND j.result ? 'clientType'
    ORDER BY j.started_at ASC
    LIMIT 50
  `;
}

async function resetChapters(mangaId: number | null, _downloadId: string): Promise<number> {
  // First try chapters with explicit downloadId in their metadata
  // (NativeDownload sourceChapterId links them via the FK in some flows),
  // fall back to "all DOWNLOADING for this manga" — same shape the
  // existing handleProgressFailure uses.
  if (mangaId === null) return 0;
  const result = await prisma.chapter.updateMany({
    where: { mangaId, downloadStatus: 'DOWNLOADING' },
    data: { downloadStatus: 'PENDING' },
  });
  return result.count;
}

async function failJob(jobId: string, partitionKey: string, reason: string): Promise<void> {
  await prisma.jobs.updateMany({
    where: { id: BigInt(jobId), partition_key: partitionKey, status: JobStatus.active },
    data: {
      status: JobStatus.failed,
      completed_at: new Date(),
      last_error: { source: 'stale-torrent-job-reconciler', message: reason },
    },
  });
}

async function processCandidate(
  clientService: ClientDownloadService,
  c: CandidateRow,
  report: StaleTorrentJobReport,
): Promise<void> {
  const r = parseResult(c.result_json);
  if (!r?.downloadId || !r.clientType) return;
  if (!TORRENT_CLIENT_TYPES.has(r.clientType.toLowerCase())) return;

  let lost = false;
  try {
    const status = await clientService.getDownloadStatus(r.clientType, r.downloadId);
    lost = clientLostTorrent(status);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not.?found|no.?such|404/i.test(msg)) lost = true;
    else {
      report.errors.push(`job ${c.id}: client query threw — ${msg}`);
      return;
    }
  }
  if (!lost) return;

  const reason = `Torrent ${r.downloadId} missing from ${r.clientType}` +
    (r.releaseTitle ? ` (release: ${r.releaseTitle})` : '');
  try {
    await failJob(c.id, c.partition_key, reason);
    const resetCount = await resetChapters(c.manga_id, r.downloadId);
    // `report` is an explicit accumulator threaded into every candidate
    // — mutating it here is the intended pattern, not a bug.
    /* eslint-disable no-param-reassign */
    report.staleJobsFailed++;
    report.chaptersReset += resetCount;
    /* eslint-enable no-param-reassign */
    log.info(`Reconciled stale torrent job ${c.id}: ${reason}; ${resetCount} chapters reset to PENDING`);
  } catch (err: unknown) {
    report.errors.push(`job ${c.id}: failed to update — ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function reconcileStaleTorrentJobs(): Promise<StaleTorrentJobReport> {
  const report: StaleTorrentJobReport = {
    candidatesScanned: 0, staleJobsFailed: 0, chaptersReset: 0, errors: [],
  };
  const candidates = await findCandidates();
  report.candidatesScanned = candidates.length;
  if (candidates.length === 0) return report;

  const clientService = new ClientDownloadService(prisma);
  for (const c of candidates) {
    // eslint-disable-next-line no-await-in-loop -- bounded loop (limit 50), per-row client RPC must be sequential to avoid hammering the client
    await processCandidate(clientService, c, report);
  }

  if (report.staleJobsFailed > 0 || report.errors.length > 0) {
    log.info('Stale-torrent-job reconciliation sweep complete', report);
  }
  return report;
}
