/**
 * Duplicate Job Detection
 *
 * Prevents duplicate download jobs from being created.
 * Checks for existing pending/active/recently-failed jobs with the same chapters.
 *
 * Extracted from download-manager.ts to keep file under 500 lines.
 */

import { logger } from '@/utils/logger';

import { isDownloadPayload } from './utils';

import type { JobStatus, JobType, PrismaClient } from '@prisma/client';

// Retry cooldown configuration
const RETRY_COOLDOWN_MINUTES = 5;

/**
 * Result of duplicate job check
 */
export interface DuplicateCheckResult {
    isDuplicate: boolean;
    existingJobId?: number;
}

/**
 * Build the Prisma where clause for finding duplicate jobs
 */
function buildDuplicateJobFilter(mangaId: number, cooldownThreshold: Date): Record<string, unknown> {
    return {
        job_type: 'chapter_download' as JobType,
        status: { in: ['pending' as JobStatus, 'active' as JobStatus, 'failed' as JobStatus] },
        manga_id: mangaId,
        OR: [
            { status: { in: ['pending' as JobStatus, 'active' as JobStatus] } },
            { status: 'failed' as JobStatus, completed_at: { gte: cooldownThreshold } }
        ]
    };
}

/**
 * Load the set of job IDs whose associated pack_download is FAILED or
 * CANCELLED. Those rows are orphaned tombstones from the retry path:
 * RetryService kills the client-side torrent + the pack but historically
 * left the parent job row in 'active' status (fixed 2026-05-16 by adding
 * Step 1.5, but defensive filtering here means any future code path that
 * leaves the orphan in place still can't silently dedupe new dispatches
 * against it).
 */
async function loadOrphanJobIds(
    prismaClient: PrismaClient,
    candidateJobIds: bigint[],
): Promise<Set<string>> {
    if (candidateJobIds.length === 0) return new Set();
    const rows = await prismaClient.packDownload.findMany({
        where: {
            jobId: { in: candidateJobIds },
            status: { in: ['FAILED', 'CANCELLED'] },
        },
        select: { jobId: true },
    });
    return new Set(rows.map(r => String(r.jobId)));
}

/**
 * Check for duplicate jobs to prevent spam
 */
export async function checkForDuplicateJob(
    prismaClient: PrismaClient,
    mangaId: number,
    chapterIds: number[]
): Promise<DuplicateCheckResult> {
    const cooldownThreshold = new Date(Date.now() - RETRY_COOLDOWN_MINUTES * 60 * 1000);

    const existingJobs = await prismaClient.jobs.findMany({
        where: buildDuplicateJobFilter(mangaId, cooldownThreshold),
        select: { id: true, status: true, payload: true, created_at: true, completed_at: true },
        orderBy: { created_at: 'desc' }
    });

    const orphanJobIds = await loadOrphanJobIds(prismaClient, existingJobs.map(j => j.id));

    const sortedRequestChapterIds = [...chapterIds].sort((a, b) => a - b);

    for (const existingJob of existingJobs) {
        if (orphanJobIds.has(String(existingJob.id))) continue;
        const matchResult = checkJobChapterMatch(existingJob, sortedRequestChapterIds, mangaId);
        if (matchResult.isMatch) {
            return { isDuplicate: true, existingJobId: Number(existingJob.id) };
        }
    }

    return { isDuplicate: false };
}

/**
 * Check if a job's chapter IDs match the requested chapter IDs
 */
function checkJobChapterMatch(
    existingJob: { id: bigint; status: string; payload: unknown; completed_at: Date | null },
    sortedRequestChapterIds: number[],
    mangaId: number
): { isMatch: boolean } {
    if (!isDownloadPayload(existingJob.payload)) {
        return { isMatch: false };
    }

    const existingPayload = existingJob.payload;
    const sortedExistingChapterIds = [...existingPayload.chapterIds].sort((a, b) => a - b);

    const isMatch =
        sortedRequestChapterIds.length === sortedExistingChapterIds.length &&
        sortedRequestChapterIds.every((id, index) => id === sortedExistingChapterIds[index]);

    if (!isMatch) {
        return { isMatch: false };
    }

    logDuplicateDetection(existingJob, mangaId, sortedRequestChapterIds);
    return { isMatch: true };
}

/**
 * Log duplicate job detection with appropriate context
 */
function logDuplicateDetection(
    existingJob: { id: bigint; status: string; completed_at: Date | null },
    mangaId: number,
    chapterIds: number[]
): void {
    const timeSinceJob = existingJob.completed_at
        ? Math.floor((Date.now() - existingJob.completed_at.getTime()) / 1000 / 60)
        : 0;

    const baseLogContext = {
        existingJobId: Number(existingJob.id),
        status: existingJob.status,
        mangaId,
        chapterCount: chapterIds.length,
        chapterIds: chapterIds.slice(0, 5).join(', ') + (chapterIds.length > 5 ? '...' : '')
    };

    if (existingJob.status === ('failed' as JobStatus)) {
        logger.warn(
            `Blocking duplicate download: Job ${existingJob.id} failed ${timeSinceJob}min ago (within ${RETRY_COOLDOWN_MINUTES}min cooldown)`,
            { ...baseLogContext, timeSinceFailure: `${timeSinceJob}min`, cooldownRemaining: `${RETRY_COOLDOWN_MINUTES - timeSinceJob}min`, reason: 'Retry cooldown active' }
        );
    } else {
        logger.warn(
            `Blocking duplicate download: Job ${existingJob.id} already ${existingJob.status}`,
            { ...baseLogContext, reason: 'Duplicate detection - job already exists' }
        );
    }
}
