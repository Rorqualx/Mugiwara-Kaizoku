import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { findJobDownloadingChapters } from '@/server/services/download/job-chapter-scope';

import type { PrismaClient } from '@prisma/client';

interface ChapterRow { id: number; mangaId: number; downloadStatus: string; filePath: string | null }
interface JobRow { id: bigint; manga_id: number; status: string; payload: unknown }

describe('findJobDownloadingChapters', () => {
  let chapters: ChapterRow[];
  let jobs: JobRow[];
  let db: Pick<PrismaClient, 'chapter' | 'jobs'>;

  beforeEach(() => {
    // Title 5: job 100 downloads chapters 1-3, job 200 downloads 4-6.
    chapters = [1, 2, 3, 4, 5, 6].map((id) => ({ id, mangaId: 5, downloadStatus: 'DOWNLOADING', filePath: null }));
    chapters.push({ id: 7, mangaId: 5, downloadStatus: 'COMPLETED', filePath: '/library/c7.cbz' });
    jobs = [
      { id: 100n, manga_id: 5, status: 'active', payload: { chapterIds: [1, 2, 3, 7] } },
      { id: 200n, manga_id: 5, status: 'active', payload: { chapterIds: [4, 5, 6] } },
      { id: 300n, manga_id: 5, status: 'active', payload: { mode: 'PACK' } },
    ];
    const chapterFindMany = jest.fn((args: { where: { mangaId: number; downloadStatus: string; id?: { in: number[] } } }) =>
      Promise.resolve(chapters
        .filter((c) => c.mangaId === args.where.mangaId && c.downloadStatus === args.where.downloadStatus)
        .filter((c) => args.where.id === undefined || args.where.id.in.includes(c.id))
        .map((c) => ({ id: c.id, filePath: c.filePath }))));
    const jobsFindFirst = jest.fn((args: { where: { id: bigint } }) =>
      Promise.resolve(jobs.find((j) => j.id === args.where.id) ?? null));
    const jobsFindMany = jest.fn((args: { where: { manga_id: number; id: { not: bigint }; status: { in: string[] } } }) =>
      Promise.resolve(jobs.filter((j) => j.manga_id === args.where.manga_id && j.id !== args.where.id.not && args.where.status.in.includes(j.status))));
    db = {
      chapter: { findMany: chapterFindMany },
      jobs: { findFirst: jobsFindFirst, findMany: jobsFindMany },
    } as unknown as Pick<PrismaClient, 'chapter' | 'jobs'>;
  });

  const ids = (rows: Array<{ id: number }>): number[] => rows.map((row) => row.id).sort((a, b) => a - b);

  it('returns only the chapters the job names, and only those still downloading', async () => {
    expect(ids(await findJobDownloadingChapters(db, 5, { id: 100n }))).toEqual([1, 2, 3]);
    expect(ids(await findJobDownloadingChapters(db, 5, { id: 200n }))).toEqual([4, 5, 6]);
  });

  it('uses a payload passed in without looking the job up', async () => {
    const rows = await findJobDownloadingChapters(db, 5, { id: 999n, payload: { chapterIds: [2] } });

    expect(ids(rows)).toEqual([2]);
    expect(db.jobs.findFirst).not.toHaveBeenCalled();
  });

  it('gives a job without a chapter list the title\'s chapters no other live job names', async () => {
    chapters.push({ id: 8, mangaId: 5, downloadStatus: 'DOWNLOADING', filePath: null });

    expect(ids(await findJobDownloadingChapters(db, 5, { id: 300n }))).toEqual([8]);
  });

  it('stops excluding a chapter once the job that named it is no longer live', async () => {
    const other = jobs.find((j) => j.id === 200n);
    if (other) other.status = 'failed';

    expect(ids(await findJobDownloadingChapters(db, 5, { id: 300n }))).toEqual([4, 5, 6]);
  });
});
