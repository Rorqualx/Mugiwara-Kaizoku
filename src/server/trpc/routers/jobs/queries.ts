import { JobStatus, JobType, Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { extractChapterIdsFromPayload } from '@/server/services/download/job-payload';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import { isAdmin, requireUserId } from '../_shared/library-access';

/**
 * Owner-scope fragment for the partitioned `jobs` table. Admins see every job;
 * everyone else only the jobs they initiated (NULL-owned/system jobs stay
 * admin-only). See _shared/library-access.ts.
 */
function jobOwnerWhere(ctx: unknown): Prisma.jobsWhereInput {
  return isAdmin(ctx) ? {} : { initiated_by_user_id: requireUserId(ctx) };
}

/**
 * Query procedures for the jobs router.
 *
 * All read endpoints require authentication — jobs include manga titles,
 * library paths, and error payloads, which are not safe to expose publicly.
 */

const jobRelationsInclude = {
  manga: { select: { id: true, title: true, libraryPath: true } },
  chapter: { select: { id: true, title: true, chapterNumber: true } },
} satisfies Prisma.jobsInclude;

const jobListSelect = {
  id: true,
  job_type: true,
  status: true,
  progress: true,
  created_at: true,
  started_at: true,
  completed_at: true,
  attempt_count: true,
  last_error: true,
  metadata: true,
  manga_id: true,
  manga: { select: { id: true, title: true, libraryPath: true } },
  chapter: { select: { id: true, title: true, chapterNumber: true } },
} satisfies Prisma.jobsSelect;

const latestScanSelect = {
  id: true,
  status: true,
  progress: true,
  result: true,
  created_at: true,
  completed_at: true,
  last_error: true,
} satisfies Prisma.jobsSelect;

interface AffectedChapter {
  id: number;
  index: number;
  chapterNumber: number | null;
  title: string;
  downloadStatus: string;
  volumeId: number | null;
  fileName: string;
  filePath: string | null;
}

interface AffectedVolume {
  volumeId: number | null;
  volumeNumber: number | null;
  volumeTitle: string | null;
  chapterStart: number | null;
  chapterEnd: number | null;
  chapterCount: number;
  statusCounts: Record<string, number>;
  chapters: AffectedChapter[];
}

interface JobDetail {
  id: string;
  job_type: string;
  status: string;
  progress: number | null;
  created_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  attempt_count: number;
  last_error: Prisma.JsonValue;
  manga: { id: number; title: string; libraryPath: string | null } | null;
  payload: Prisma.JsonValue;
  chapterIdsFromPayload: number[];
  affectedVolumes: AffectedVolume[];
}

async function buildJobDetail(jobId: bigint, ctx: unknown): Promise<JobDetail | null> {
  const job = await prisma.jobs.findFirst({
    // Owner-scope so a non-admin can't read another user's job detail by id.
    where: { id: jobId, ...jobOwnerWhere(ctx) },
    include: jobRelationsInclude,
  });
  if (!job) return null;

  const chapterIds = extractChapterIdsFromPayload(job.payload);
  const affectedChapters: AffectedChapter[] = chapterIds.length > 0
    ? (await prisma.chapter.findMany({
        where: { id: { in: chapterIds } },
        select: {
          id: true, index: true, chapterNumber: true, title: true,
          downloadStatus: true, volumeId: true, fileName: true, filePath: true,
        },
        orderBy: [{ volumeId: 'asc' }, { chapterNumber: 'asc' }, { index: 'asc' }],
      })).map(c => ({
        id: c.id,
        index: c.index,
        chapterNumber: c.chapterNumber,
        title: c.title,
        downloadStatus: String(c.downloadStatus),
        volumeId: c.volumeId,
        fileName: c.fileName,
        filePath: c.filePath,
      }))
    : [];

  const volumeIds = [...new Set(
    affectedChapters.map(c => c.volumeId).filter((v): v is number => v !== null),
  )];
  const volumes = volumeIds.length > 0
    ? await prisma.volume.findMany({
        where: { id: { in: volumeIds } },
        select: { id: true, number: true, title: true, chapterStart: true, chapterEnd: true },
      })
    : [];

  const volumeBuckets = new Map<number | null, AffectedChapter[]>();
  for (const ch of affectedChapters) {
    const bucket = volumeBuckets.get(ch.volumeId) ?? [];
    bucket.push(ch);
    volumeBuckets.set(ch.volumeId, bucket);
  }

  const affectedVolumes: AffectedVolume[] = [...volumeBuckets.entries()].map(([volumeId, chapters]) => {
    const meta = volumeId !== null ? volumes.find(v => v.id === volumeId) : undefined;
    const statusCounts: Record<string, number> = {};
    for (const ch of chapters) statusCounts[ch.downloadStatus] = (statusCounts[ch.downloadStatus] ?? 0) + 1;
    return {
      volumeId,
      volumeNumber: meta?.number ?? null,
      volumeTitle: meta?.title ?? null,
      chapterStart: meta?.chapterStart ?? null,
      chapterEnd: meta?.chapterEnd ?? null,
      chapterCount: chapters.length,
      statusCounts,
      chapters,
    };
  }).sort((a, b) => (a.volumeNumber ?? -1) - (b.volumeNumber ?? -1));

  return {
    id: String(job.id),
    job_type: String(job.job_type),
    status: String(job.status),
    progress: job.progress,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    attempt_count: job.attempt_count,
    last_error: job.last_error,
    manga: job.manga ? { id: job.manga.id, title: job.manga.title, libraryPath: job.manga.libraryPath } : null,
    payload: job.payload,
    chapterIdsFromPayload: chapterIds,
    affectedVolumes,
  };
}

export const jobsQueriesRouter = router({
  getByStatus: protectedProcedure
    .input(z.object({
      status: z.enum([
        'pending',
        'active',
        'completed',
        'failed',
        'cancelled',
        'retrying',
      ]),
    }))
    .query(async ({ input, ctx }) => {
      const jobStatus = input.status as JobStatus;
      return prisma.jobs.findMany({
        where: { status: jobStatus, ...jobOwnerWhere(ctx) },
        orderBy: { created_at: 'desc' },
        include: jobRelationsInclude,
      });
    }),

  getInProgress: protectedProcedure
    .query(async ({ ctx }) => {
      return prisma.jobs.findMany({
        where: {
          status: { in: [JobStatus.pending, JobStatus.active, JobStatus.retrying] },
          ...jobOwnerWhere(ctx),
        },
        orderBy: { created_at: 'desc' },
        include: jobRelationsInclude,
      });
    }),

  getAll: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1).optional(),
      limit: z.number().min(1).max(500).default(100).optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 100;
      const skip = (page - 1) * limit;

      const where = jobOwnerWhere(ctx);
      const totalCount = await prisma.jobs.count({ where });

      const jobs = await prisma.jobs.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: jobListSelect,
      });

      const totalPages = Math.ceil(totalCount / limit);

      return {
        jobs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    }),

  /**
   * Detailed view of a single job, with affected chapters + volumes
   * grouped for the manual-import flow. Reads `payload.chapterIds`
   * (written by every dispatcher — see prowlarr-handler.ts:147,315)
   * as the authoritative set of chapters the job was meant to fulfill.
   */
  getJobDetail: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => buildJobDetail(BigInt(input.jobId), ctx)),

  /**
   * Best-effort existence + readability probe for a user-provided
   * source path (manual-import inline validation). Returns booleans
   * — no path is leaked back beyond what the caller already supplied.
   */
  probePath: protectedProcedure
    .input(z.object({ path: z.string().min(1).max(4000) }))
    .query(async ({ input }) => {
      const fsp = await import('fs/promises');
      try {
        const stat = await fsp.stat(input.path);
        return {
          exists: true,
          isFile: stat.isFile(),
          isDirectory: stat.isDirectory(),
          sizeBytes: Number(stat.size),
        };
      } catch {
        return { exists: false, isFile: false, isDirectory: false, sizeBytes: 0 };
      }
    }),

  getLatestScanForLibrary: protectedProcedure
    .input(z.object({ libraryId: z.number() }))
    .query(async ({ input, ctx }) => {
      const job = await prisma.jobs.findFirst({
        where: {
          job_type: JobType.library_scan,
          payload: { path: ['libraryId'], equals: input.libraryId },
          ...jobOwnerWhere(ctx),
        },
        orderBy: { id: 'desc' },
        select: latestScanSelect,
      });

      if (!job) return null;

      return { ...job, id: String(job.id) };
    }),
});
