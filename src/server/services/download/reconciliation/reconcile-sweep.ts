import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Download Reconciliation Sweep
 *
 * Recovers chapters whose `downloadStatus='ERROR'` even though the underlying
 * torrent/NZB actually completed in the download client. The base DownloadMonitor
 * only scans `jobs.status='active'`, so once a job is archived as failed the
 * pipeline loses track of the download — even if the client still holds a
 * seeding/complete copy of the files.
 *
 * The sweep re-queries the client for each ERROR chapter's last-known download,
 * and when the client reports COMPLETED/SEEDING it triggers a fresh import.
 *
 * iter-3.
 *
 * @module server/services/download/reconciliation/reconcile-sweep
 */

import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, createSuccessResult, isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { ClientDownloadService } from '../clientDownload';
import { FileImporter } from '../fileImporter';
import { getPathMapper, PathMapper } from '../pathMapper';

import type { CompletedDownload } from '../downloadMonitor';
import type { PrismaClient } from '@prisma/client';

export interface ReconciliationResult {
  candidatesExamined: number;
  uniqueDownloads: number;
  clientConfirmedComplete: number;
  clientNotFound: number;
  clientStillRunning: number;
  importAttempted: number;
  importSucceeded: number;
  importFailed: number;
  chaptersRecovered: number;
  errors: string[];
}

export interface ReconciliationOptions {
  /** Only consider ERROR chapters whose DownloadHistory startTime is within this many hours (default 24) */
  maxAgeHours?: number;
  /** Optional manga-id filter (inclusive) — used by the loop harness to scope the sweep */
  mangaIds?: number[];
}

interface ReconcileCandidate {
  mangaId: number;
  chapterIds: number[];
  clientType: string;
  downloadId: string;
  releaseTitle: string;
  historyId: number;
}

/**
 * Main entrypoint — identifies ERROR chapters, queries the client for each
 * associated download, and re-imports any that the client says are complete.
 */
export async function reconcileOrphanedDownloads(
  prisma: PrismaClient,
  options: ReconciliationOptions = {}
): Promise<AsyncResult<ReconciliationResult, Error>> {
  const maxAgeHours = options.maxAgeHours ?? 24;
  const sinceDate = new Date(Date.now() - maxAgeHours * 3600_000);

  const result: ReconciliationResult = {
    candidatesExamined: 0,
    uniqueDownloads: 0,
    clientConfirmedComplete: 0,
    clientNotFound: 0,
    clientStillRunning: 0,
    importAttempted: 0,
    importSucceeded: 0,
    importFailed: 0,
    chaptersRecovered: 0,
    errors: [],
  };

  try {
    const candidates = await findReconcileCandidates(prisma, sinceDate, options.mangaIds);
    result.candidatesExamined = candidates.length;

    if (candidates.length === 0) {
      logger.info('[Reconcile] No ERROR chapters with recent DownloadHistory rows found');
      return createSuccessResult(result);
    }

    const grouped = groupByDownload(candidates);
    result.uniqueDownloads = grouped.length;
    logger.info(`[Reconcile] Examining ${result.candidatesExamined} candidates across ${result.uniqueDownloads} unique downloads`);

    const clientService = new ClientDownloadService(prisma);
    const fileImporter = new FileImporter(prisma);
    // Load path_mappings directly from Config table — the singleton PathMapper
    // relies on GlobalConfigService being bootstrapped, which is not guaranteed
    // when this sweep runs from a script or cron context. Fall back to the
    // singleton if direct DB read yields no mappings.
    const pathMapper = await loadPathMapperFromConfig(prisma);
    // iter-4: cache all localPath roots so we can filesystem-scan for orphaned
    // torrents whose client entry has been removed but files still exist.
    const localRoots = pathMapper.getMappings().map((m) => m.localPath);

    for (const group of grouped) {
      // eslint-disable-next-line no-await-in-loop -- Sequential client probes avoid overwhelming client RPC.
      const outcome = await reconcileSingleDownload(prisma, clientService, fileImporter, pathMapper, localRoots, group);
      result.clientConfirmedComplete += outcome.clientConfirmedComplete;
      result.clientNotFound += outcome.clientNotFound;
      result.clientStillRunning += outcome.clientStillRunning;
      result.importAttempted += outcome.importAttempted;
      result.importSucceeded += outcome.importSucceeded;
      result.importFailed += outcome.importFailed;
      result.chaptersRecovered += outcome.chaptersRecovered;
      if (outcome.error !== null) result.errors.push(outcome.error);
    }

    logger.info(`[Reconcile] Sweep complete: recovered ${result.chaptersRecovered}/${result.candidatesExamined} chapters, ${result.importSucceeded}/${result.importAttempted} imports succeeded`);
    return createSuccessResult(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[Reconcile] Sweep crashed:', error);
    return createErrorResult(new Error(`Reconciliation sweep failed: ${msg}`));
  }
}

function parsePathMappingEntry(m: unknown): { remotePath: string; localPath: string; description?: string } | null {
  if (m === null || typeof m !== 'object') return null;
  const rec = m as { remotePath?: unknown; localPath?: unknown; description?: unknown };
  if (typeof rec.remotePath !== 'string' || typeof rec.localPath !== 'string') return null;
  const entry: { remotePath: string; localPath: string; description?: string } = {
    remotePath: rec.remotePath,
    localPath: rec.localPath,
  };
  if (typeof rec.description === 'string') entry.description = rec.description;
  return entry;
}

async function loadPathMapperFromConfig(prisma: PrismaClient): Promise<PathMapper> {
  const mapper = new PathMapper();
  mapper.loadFromEnvironment();
  try {
    const row = await prisma.config.findUnique({ where: { key: 'path_mappings' } });
    if (!row?.value) return mapper;
    const parsed: unknown = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return mapper;
    for (const item of parsed) {
      const entry = parsePathMappingEntry(item);
      if (entry !== null) mapper.addMapping(entry);
    }
  } catch (err) {
    logger.warn('[Reconcile] Failed to load path_mappings from Config, falling back to singleton:', err);
    return getPathMapper();
  }
  return mapper;
}

async function findReconcileCandidates(
  prisma: PrismaClient,
  sinceDate: Date,
  mangaIds: number[] | undefined
): Promise<ReconcileCandidate[]> {
  // iter-7: include DOWNLOADING chapters too, not just ERROR. In harness/script
  // contexts the DownloadMonitor worker isn't running, so chapters never flip
  // to ERROR even when their torrent is clearly stuck or already complete on
  // the client. Any chapter in a non-terminal, non-imported state with a
  // recent DownloadHistory row is a legitimate reconciliation candidate.
  const chapterWhere: {
    downloadStatus: { in: Array<'ERROR' | 'DOWNLOADING'> };
    filePath: null;
    mangaId?: { in: number[] };
  } = {
    downloadStatus: { in: ['ERROR', 'DOWNLOADING'] },
    filePath: null,
  };
  if (mangaIds && mangaIds.length > 0) chapterWhere.mangaId = { in: mangaIds };

  const errorChapters = await prisma.chapter.findMany({
    where: chapterWhere,
    select: { id: true, mangaId: true },
  });

  if (errorChapters.length === 0) return [];

  const chapterIds = errorChapters.map((c) => c.id);

  // Pull the most-recent DownloadHistory row per chapter that has a downloadClient + downloadId
  const history = await prisma.downloadHistory.findMany({
    where: {
      chapterId: { in: chapterIds },
      startTime: { gte: sinceDate },
      downloadClient: { not: null },
    },
    orderBy: { startTime: 'desc' },
    select: {
      id: true,
      chapterId: true,
      mangaId: true,
      downloadClient: true,
      metadata: true,
    },
  });

  const seen = new Set<number>();
  const out: ReconcileCandidate[] = [];
  for (const row of history) {
    if (row.chapterId === null || seen.has(row.chapterId)) continue;
    const meta = row.metadata;
    if (meta === null || typeof meta !== 'object') continue;
    const metaRecord = meta as Record<string, unknown>;
    const downloadId = typeof metaRecord['downloadId'] === 'string' ? metaRecord['downloadId'] : null;
    if (downloadId === null || row.downloadClient === null) continue;
    const releaseTitle = typeof metaRecord['releaseTitle'] === 'string' ? metaRecord['releaseTitle'] : '';

    seen.add(row.chapterId);
    out.push({
      mangaId: row.mangaId,
      chapterIds: [row.chapterId],
      clientType: row.downloadClient,
      downloadId,
      releaseTitle,
      historyId: row.id,
    });
  }
  return out;
}

function groupByDownload(candidates: ReconcileCandidate[]): ReconcileCandidate[] {
  const byKey = new Map<string, ReconcileCandidate>();
  for (const c of candidates) {
    const key = `${c.clientType}::${c.downloadId}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, { ...c, chapterIds: [...c.chapterIds] });
    } else {
      for (const chId of c.chapterIds) if (!existing.chapterIds.includes(chId)) existing.chapterIds.push(chId);
    }
  }
  return Array.from(byKey.values());
}

interface SingleDownloadOutcome {
  clientConfirmedComplete: number;
  clientNotFound: number;
  clientStillRunning: number;
  importAttempted: number;
  importSucceeded: number;
  importFailed: number;
  chaptersRecovered: number;
  error: string | null;
}

/**
 * iter-4 filesystem fallback: when the client no longer tracks a download,
 * look for the torrent's folder on disk under any configured local root.
 *
 * Uses a tolerant fuzzy match because release titles on Prowlarr often have
 * metadata chaff (brackets, dots, double spaces) that differs from the
 * filesystem folder name the client actually wrote.
 */
async function findTorrentOnFilesystem(
  roots: string[],
  releaseTitle: string
): Promise<{ dir: string } | null> {
  if (releaseTitle === '' || roots.length === 0) return null;
  const target = normalizeName(releaseTitle);
  if (target.length < 6) return null;
  for (const root of roots) {
    // eslint-disable-next-line no-await-in-loop -- Sequential to avoid network-mount thundering-herd.
    const entries = await safeReaddir(root);
    for (const entry of entries) {
      const candidate = normalizeName(entry);
      if (candidate === target || candidate.startsWith(target) || target.startsWith(candidate)) {
        return { dir: path.join(root, entry) };
      }
    }
  }
  return null;
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[[\](){}]/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// eslint-disable-next-line max-params, max-statements -- 4 distinct service deps + 2 inputs; 51 statements covering the find-confirm-reattach-import state machine for a single download
async function reconcileSingleDownload(
  prisma: PrismaClient,
  clientService: ClientDownloadService,
  fileImporter: FileImporter,
  pathMapper: { mapPath: (p: string) => string },
  localRoots: string[],
  candidate: ReconcileCandidate
): Promise<SingleDownloadOutcome> {
  const outcome: SingleDownloadOutcome = {
    clientConfirmedComplete: 0,
    clientNotFound: 0,
    clientStillRunning: 0,
    importAttempted: 0,
    importSucceeded: 0,
    importFailed: 0,
    chaptersRecovered: 0,
    error: null,
  };

  const probe = await probeClient(clientService, candidate.clientType, candidate.downloadId);
  if (probe.kind === 'error') {
    outcome.error = `${candidate.clientType}:${candidate.downloadId} probe error: ${probe.message}`;
    return outcome;
  }
  if (probe.kind === 'stillRunning') {
    outcome.clientStillRunning = 1;
    return outcome;
  }

  // Determine savePath: prefer the client's reported path (when COMPLETE),
  // else fall back to filesystem scan (iter-4: torrents removed from client
  // but whose files persist on disk — the monitor's failure path uses
  // deleteFiles=false so we can still find & import them).
  let savePath: string;
  let probeName: string;
  let probeSize: number;
  let probeStatus: string;
  if (probe.kind === 'complete') {
    outcome.clientConfirmedComplete = 1;
    const mappedSavePath = pathMapper.mapPath(probe.savePath);
    // Transmission (and most clients) report savePath as the download-root dir.
    // The actual torrent contents live at <savePath>/<torrent-name>/. Scanning
    // the root directly would pull unrelated torrents into this manga's import.
    savePath = probe.name ? path.join(mappedSavePath, probe.name) : mappedSavePath;
    probeName = probe.name;
    probeSize = probe.size;
    probeStatus = probe.status;
    logger.info(`[Reconcile] Client confirms ${candidate.clientType}:${candidate.downloadId} complete (${candidate.releaseTitle.slice(0, 60)}) — importing from ${savePath}`);
  } else {
    // kind === 'notFound' — client removed the entry. Try filesystem fallback.
    outcome.clientNotFound = 1;
    const fsMatch = await findTorrentOnFilesystem(localRoots, candidate.releaseTitle);
    if (fsMatch === null) {
      logger.debug(`[Reconcile] ${candidate.clientType}:${candidate.downloadId} not on client AND no filesystem match for "${candidate.releaseTitle.slice(0, 60)}"`);
      return outcome;
    }
    savePath = fsMatch.dir;
    probeName = path.basename(fsMatch.dir);
    probeSize = 0;
    probeStatus = 'COMPLETED';
    logger.info(`[Reconcile] Filesystem fallback: found "${candidate.releaseTitle.slice(0, 60)}" at ${savePath}`);
  }

  // FileImporter.importFile matches only chapters in DOWNLOADING state.
  // Candidates that are ERROR need flipping; DOWNLOADING ones are already
  // eligible. No-op flip for already-DOWNLOADING rows (updateMany is cheap
  // enough not to pre-filter).
  await prisma.chapter.updateMany({
    where: { id: { in: candidate.chapterIds }, downloadStatus: 'ERROR' },
    data: { downloadStatus: 'DOWNLOADING' },
  });

  const completed: CompletedDownload = {
    jobId: `reconcile:${String(candidate.historyId)}`,
    downloadId: candidate.downloadId,
    clientType: candidate.clientType,
    savePath,
    fileName: probeName,
    mangaId: candidate.mangaId,
    chapterIds: candidate.chapterIds,
    size: probeSize,
    status: probeStatus,
  };

  outcome.importAttempted = 1;
  const importResult = await fileImporter.importDownload(completed);
  if (isError(importResult)) {
    outcome.importFailed = 1;
    outcome.error = `import ${candidate.clientType}:${candidate.downloadId}: ${importResult.error.message}`;
    logger.warn(`[Reconcile] Import failed for ${candidate.clientType}:${candidate.downloadId}: ${importResult.error.message}`);
    return outcome;
  }
  if (!isSuccess(importResult)) {
    outcome.importFailed = 1;
    outcome.error = `import ${candidate.clientType}:${candidate.downloadId}: non-success result`;
    return outcome;
  }

  outcome.importSucceeded = 1;
  outcome.chaptersRecovered = importResult.data.chaptersUpdated;
  logger.info(`[Reconcile] Imported ${candidate.clientType}:${candidate.downloadId} — ${importResult.data.filesImported} files, ${importResult.data.chaptersUpdated} chapters updated`);

  try {
    await prisma.downloadHistory.update({
      where: { id: candidate.historyId },
      data: {
        status: 'COMPLETED',
        endTime: new Date(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    outcome.error = `history update for ${candidate.historyId}: ${msg}`;
  }

  return outcome;
}

interface ProbeResult {
  kind: 'complete' | 'stillRunning' | 'notFound' | 'error';
  status: string;
  savePath: string;
  name: string;
  size: number;
  message: string;
}

function isNotFoundMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('not found') || m.includes('no such') || m.includes('does not exist');
}

function unwrapInnerStatus(
  outerData: unknown
): { payload: Record<string, unknown>; error: string | null } {
  if (outerData === null || typeof outerData !== 'object') {
    return { payload: {}, error: 'probe inner not object' };
  }
  const rec = outerData as { status?: string; data?: Record<string, unknown>; error?: { message?: string } };
  if (rec.status === 'error') {
    return { payload: {}, error: rec.error?.message ?? 'inner error' };
  }
  if (rec.status !== 'success' || rec.data === undefined) {
    return { payload: {}, error: 'probe inner shape unexpected' };
  }
  return { payload: rec.data, error: null };
}

function extractProbePayload(payload: Record<string, unknown>): { status: string; savePath: string; name: string; size: number } {
  const status = typeof payload['status'] === 'string' ? payload['status'] : '';
  const savePath = typeof payload['savePath'] === 'string' ? payload['savePath'] : '';
  const name = typeof payload['name'] === 'string' ? payload['name'] : '';
  const sizeRaw = payload['size'] ?? payload['totalSize'];
  const size = typeof sizeRaw === 'number' ? sizeRaw : 0;
  return { status, savePath, name, size };
}

async function probeClient(
  clientService: ClientDownloadService,
  clientType: string,
  downloadId: string
): Promise<ProbeResult> {
  const outer = await clientService.getDownloadStatus(clientType, downloadId);
  if (isError(outer)) {
    if (isNotFoundMessage(outer.error.message)) return emptyProbe('notFound');
    return { ...emptyProbe('error'), message: outer.error.message };
  }
  if (!isSuccess(outer)) return { ...emptyProbe('error'), message: 'probe non-success' };

  const { payload, error } = unwrapInnerStatus(outer.data);
  if (error !== null) {
    if (isNotFoundMessage(error)) return emptyProbe('notFound');
    return { ...emptyProbe('error'), message: error };
  }

  const { status, savePath, name, size } = extractProbePayload(payload);
  const isComplete = (status === 'COMPLETED' || status === 'SEEDING') && savePath !== '';
  return { kind: isComplete ? 'complete' : 'stillRunning', status, savePath, name, size, message: '' };
}

function emptyProbe(kind: ProbeResult['kind']): ProbeResult {
  return { kind, status: '', savePath: '', name: '', size: 0, message: '' };
}
