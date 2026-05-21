/**
 * Database Synchronization for Tracked Downloads
 *
 * Maps TrackedDownloadState to database statuses and provides
 * hydration/sync functions for persistence.
 *
 * @module server/services/download/tracked-download/db-sync
 */

import { logger } from '@/utils/logger';

import { updateChaptersToCompleted, updateChaptersToError } from '../download-monitor/chapter-manager';

import { TrackedDownloadEvent, TrackedDownloadState } from './types';

import type { TrackedDownload } from './types';
import type {
  PrismaClient,
  JobStatus,
  ChapterStatus,
  PackDownloadStatus,
} from '@prisma/client';

// ============================================================================
// State-to-DB Mapping Tables
// ============================================================================

const STATE_TO_JOB_STATUS: Readonly<Record<TrackedDownloadState, JobStatus>> = {
  [TrackedDownloadState.QUEUED]: 'pending',
  [TrackedDownloadState.DOWNLOADING]: 'active',
  [TrackedDownloadState.DOWNLOAD_PAUSED]: 'active',
  [TrackedDownloadState.DOWNLOAD_FAILED]: 'failed',
  [TrackedDownloadState.IMPORT_PENDING]: 'active',
  [TrackedDownloadState.IMPORTING]: 'active',
  [TrackedDownloadState.IMPORTED]: 'completed',
  [TrackedDownloadState.IMPORT_BLOCKED]: 'active',
  [TrackedDownloadState.FAILED]: 'failed',
  [TrackedDownloadState.IGNORED]: 'cancelled',
};

const STATE_TO_CHAPTER_STATUS: Readonly<Record<TrackedDownloadState, ChapterStatus>> = {
  [TrackedDownloadState.QUEUED]: 'DOWNLOADING',
  [TrackedDownloadState.DOWNLOADING]: 'DOWNLOADING',
  [TrackedDownloadState.DOWNLOAD_PAUSED]: 'DOWNLOADING',
  [TrackedDownloadState.DOWNLOAD_FAILED]: 'ERROR',
  [TrackedDownloadState.IMPORT_PENDING]: 'DOWNLOADING',
  [TrackedDownloadState.IMPORTING]: 'DOWNLOADING',
  [TrackedDownloadState.IMPORTED]: 'COMPLETED',
  [TrackedDownloadState.IMPORT_BLOCKED]: 'DOWNLOADING',
  [TrackedDownloadState.FAILED]: 'ERROR',
  [TrackedDownloadState.IGNORED]: 'ERROR',
};

const STATE_TO_PACK_STATUS: Readonly<Record<TrackedDownloadState, PackDownloadStatus>> = {
  [TrackedDownloadState.QUEUED]: 'DOWNLOADING',
  [TrackedDownloadState.DOWNLOADING]: 'DOWNLOADING',
  [TrackedDownloadState.DOWNLOAD_PAUSED]: 'DOWNLOADING',
  [TrackedDownloadState.DOWNLOAD_FAILED]: 'FAILED',
  [TrackedDownloadState.IMPORT_PENDING]: 'COMPLETED',
  [TrackedDownloadState.IMPORTING]: 'IMPORTING',
  [TrackedDownloadState.IMPORTED]: 'IMPORTED',
  [TrackedDownloadState.IMPORT_BLOCKED]: 'FAILED',
  [TrackedDownloadState.FAILED]: 'FAILED',
  [TrackedDownloadState.IGNORED]: 'CANCELLED',
};

// ============================================================================
// Public Mapping Functions
// ============================================================================

/**
 * Map a TrackedDownloadState to the corresponding JobStatus.
 *
 * @param state - The tracked download state
 * @returns The corresponding JobStatus value
 */
export function mapStateToJobStatus(state: TrackedDownloadState): JobStatus {
  return STATE_TO_JOB_STATUS[state];
}

/**
 * Map a TrackedDownloadState to the corresponding ChapterStatus.
 *
 * @param state - The tracked download state
 * @returns The corresponding ChapterStatus value
 */
export function mapStateToChapterStatus(state: TrackedDownloadState): ChapterStatus {
  return STATE_TO_CHAPTER_STATUS[state];
}

/**
 * Map a TrackedDownloadState to the corresponding PackDownloadStatus.
 *
 * @param state - The tracked download state
 * @returns The corresponding PackDownloadStatus value
 */
export function mapStateToPackStatus(state: TrackedDownloadState): PackDownloadStatus {
  return STATE_TO_PACK_STATUS[state];
}

/**
 * Map a download client status string to a TrackedDownloadEvent.
 *
 * @param clientStatus - Status string from the download client
 * @returns The corresponding TrackedDownloadEvent, or undefined if unmapped
 */
export function mapClientStatusToEvent(
  clientStatus: string,
): TrackedDownloadEvent | undefined {
  const normalized = clientStatus.toUpperCase();

  switch (normalized) {
    case 'DOWNLOADING':
    case 'ACTIVE':
    case 'STARTED':
      return TrackedDownloadEvent.DOWNLOAD_STARTED;

    case 'COMPLETED':
    case 'SEEDING':
    case 'DONE':
      return TrackedDownloadEvent.DOWNLOAD_COMPLETED;

    case 'ERROR':
    case 'FAILED':
    case 'STALLED':
      return TrackedDownloadEvent.DOWNLOAD_FAILED;

    case 'PAUSED':
    case 'STOPPED':
      return TrackedDownloadEvent.DOWNLOAD_PAUSED;

    case 'QUEUED':
    case 'WAITING':
      return undefined;

    default:
      logger.debug('[DbSync] Unmapped client status', { clientStatus, normalized });
      return undefined;
  }
}

// ============================================================================
// Database Hydration
// ============================================================================

interface ParsedJobResult {
  downloadId: string;
  clientType: string;
  mode: string;
  releaseTitle: string;
  chapterIds: number[];
}

/**
 * Parse job result JSON for hydration purposes.
 *
 * @param result - The raw job result (JSON or null)
 * @returns Parsed result or null if invalid
 */
function parseJobResultForHydration(result: unknown): ParsedJobResult | null {
  if (!result) {
    return null;
  }

  try {
    const data = typeof result === 'string'
      ? JSON.parse(result) as Record<string, unknown>
      : result as Record<string, unknown>;

    return extractParsedFields(data);
  } catch {
    return null;
  }
}

/**
 * Extract typed fields from a parsed job result record.
 *
 * @param data - The parsed record
 * @returns Extracted fields or null if required fields missing
 */
function extractParsedFields(data: Record<string, unknown>): ParsedJobResult | null {
  const downloadId = data['downloadId'];
  const clientType = data['clientType'];

  if (typeof downloadId !== 'string' || typeof clientType !== 'string') {
    return null;
  }

  const mode = typeof data['mode'] === 'string' ? data['mode'] : 'SINGLE';
  const releaseTitle = typeof data['releaseTitle'] === 'string'
    ? data['releaseTitle']
    : '';

  const rawChapterIds = data['chapterIds'];
  const chapterIds = Array.isArray(rawChapterIds)
    ? rawChapterIds.filter((id): id is number => typeof id === 'number')
    : [];

  return { downloadId, clientType, mode, releaseTitle, chapterIds };
}

/**
 * Map a JobStatus string to a TrackedDownloadState for hydration.
 *
 * @param jobStatus - The job status from the database
 * @returns Approximate TrackedDownloadState
 */
function mapJobStatusToState(jobStatus: JobStatus): TrackedDownloadState {
  switch (jobStatus) {
    case 'pending':
    case 'retrying':
      return TrackedDownloadState.QUEUED;
    case 'active':
      return TrackedDownloadState.DOWNLOADING;
    case 'completed':
      return TrackedDownloadState.IMPORTED;
    case 'failed':
      return TrackedDownloadState.FAILED;
    case 'cancelled':
      return TrackedDownloadState.IGNORED;
    default:
      return TrackedDownloadState.QUEUED;
  }
}

/**
 * Build a TrackedDownload from a database job row and parsed result.
 */
function buildTrackedDownload(
  job: { id: bigint; manga_id: number | null; status: JobStatus; progress: number | null; attempt_count: number; started_at: Date | null; created_at: Date; manga: { title: string } | null },
  parsed: ParsedJobResult,
): TrackedDownload {
  const state = mapJobStatusToState(job.status);

  return {
    id: `job:${job.id}`,
    state,
    previousState: state,
    downloadId: parsed.downloadId,
    clientType: parsed.clientType,
    mode: parsed.mode === 'PACK' ? 'PACK' : 'SINGLE',
    mangaId: job.manga_id ?? 0,
    mangaTitle: job.manga?.title ?? 'Unknown',
    releaseTitle: parsed.releaseTitle,
    chapterIds: parsed.chapterIds,
    jobId: job.id,
    packDownloadId: null,
    progress: job.progress ?? 0,
    downloadSpeed: 0,
    seeders: null,
    errorMessage: null,
    attemptCount: job.attempt_count,
    stateChangedAt: job.started_at ?? job.created_at,
    createdAt: job.created_at,
  };
}

/**
 * Hydrate tracked downloads from the database.
 *
 * Loads active jobs and reconstructs TrackedDownload instances for the
 * in-memory cache. Called during startup.
 *
 * @param prismaClient - Prisma client instance
 * @returns Array of hydrated TrackedDownload instances
 */
export async function hydrateFromDatabase(
  prismaClient: PrismaClient,
): Promise<TrackedDownload[]> {
  try {
    const activeJobs = await prismaClient.jobs.findMany({
      where: {
        job_type: 'chapter_download',
        status: { in: ['pending', 'active'] },
        result: { not: { equals: null } },
      },
      include: { manga: true },
    });

    const downloads: TrackedDownload[] = [];

    for (const job of activeJobs) {
      const parsed = parseJobResultForHydration(job.result);
      if (!parsed) {
        continue;
      }
      downloads.push(buildTrackedDownload(job, parsed));
    }

    logger.info('[DbSync] Hydrated tracked downloads from database', {
      totalJobs: activeJobs.length,
      trackedDownloads: downloads.length,
    });

    return downloads;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[DbSync] Failed to hydrate from database', { error: message });
    return [];
  }
}

// ============================================================================
// Database Sync
// ============================================================================

/**
 * Sync job status to the database.
 *
 * Sets progress to 100 and completed_at for terminal states (Imported, Failed, Ignored).
 */
async function syncJobStatus(
  prismaClient: PrismaClient,
  download: TrackedDownload,
  jobStatus: JobStatus,
): Promise<void> {
  const isTerminal = download.state === TrackedDownloadState.IMPORTED
    || download.state === TrackedDownloadState.FAILED
    || download.state === TrackedDownloadState.IGNORED;

  await prismaClient.jobs.update({
    where: {
      id_partition_key: {
        id: download.jobId,
        partition_key: 'active',
      },
    },
    data: {
      status: jobStatus,
      ...(isTerminal ? { progress: 100, completed_at: new Date() } : {}),
      ...(download.errorMessage
        ? { last_error: { message: download.errorMessage } }
        : {}),
    },
  });
}

/**
 * Sync chapter statuses to the database if they changed.
 *
 * Uses chapter-manager helpers for COMPLETED and ERROR transitions,
 * which also emit WebSocket events for real-time UI updates.
 */
async function syncChapterStatuses(
  prismaClient: PrismaClient,
  chapterIds: number[],
  chapterStatus: ChapterStatus,
  previousChapterStatus: ChapterStatus,
  mangaId?: number,
): Promise<void> {
  if (chapterStatus === previousChapterStatus || chapterIds.length === 0) {
    return;
  }

  if (chapterStatus === 'COMPLETED') {
    await updateChaptersToCompleted(prismaClient, chapterIds, mangaId);
  } else if (chapterStatus === 'ERROR') {
    await updateChaptersToError(prismaClient, chapterIds, mangaId);
  } else {
    await prismaClient.chapter.updateMany({
      where: { id: { in: chapterIds } },
      data: { downloadStatus: chapterStatus },
    });
  }
}

/**
 * Sync pack download status to the database.
 */
async function syncPackDownloadStatus(
  prismaClient: PrismaClient,
  download: TrackedDownload,
): Promise<void> {
  if (download.packDownloadId === null) {
    return;
  }

  const packStatus = mapStateToPackStatus(download.state);
  await prismaClient.packDownload.update({
    where: { id: download.packDownloadId },
    data: {
      status: packStatus,
      ...(download.errorMessage ? { errorMessage: download.errorMessage } : {}),
      ...(download.state === TrackedDownloadState.IMPORTED
        ? { completedAt: new Date() }
        : {}),
    },
  });
}

/**
 * Sync a tracked download's state change to the database.
 *
 * Updates job status, chapter download statuses, and pack download status
 * based on the new tracked download state.
 *
 * @param prismaClient - Prisma client instance
 * @param download - The tracked download that changed state
 * @param previousState - The state before the transition
 */
export async function syncToDatabase(
  prismaClient: PrismaClient,
  download: TrackedDownload,
  previousState: TrackedDownloadState,
): Promise<void> {
  const jobStatus = mapStateToJobStatus(download.state);
  const chapterStatus = mapStateToChapterStatus(download.state);
  const previousChapterStatus = mapStateToChapterStatus(previousState);

  try {
    await syncJobStatus(prismaClient, download, jobStatus);
    await syncChapterStatuses(prismaClient, download.chapterIds, chapterStatus, previousChapterStatus, download.mangaId);
    await syncPackDownloadStatus(prismaClient, download);

    logger.debug('[DbSync] Synced state to database', {
      id: download.id,
      jobStatus,
      chapterStatus,
      previousState,
      newState: download.state,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[DbSync] Failed to sync state to database', {
      id: download.id,
      state: download.state,
      error: message,
    });
  }
}
