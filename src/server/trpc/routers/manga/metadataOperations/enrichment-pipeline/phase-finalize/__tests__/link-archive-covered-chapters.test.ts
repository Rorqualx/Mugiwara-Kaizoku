/**
 * @jest-environment node
 *
 * Integration test for linkArchiveCoveredChapters: verifies the prisma wrapper
 * correctly drives the pure coverage logic — flipping archive-covered chapters
 * to COMPLETED + archive filePath, batching by volume, and skipping chapters
 * that already have their own file.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('@/server/db', () => ({
  prisma: {
    chapter: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/server/db';
import { linkArchiveCoveredChapters } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize/link-archive-covered-chapters';

const findMany = prisma.chapter.findMany as unknown as jest.Mock<(args: unknown) => Promise<unknown>>;
const updateMany = prisma.chapter.updateMany as unknown as jest.Mock<(args: unknown) => Promise<unknown>>;

interface UpdateArg { where: { id: { in: number[] } }; data: Record<string, unknown> }
const updateArg = (call: number): UpdateArg => updateMany.mock.calls[call]?.[0] as UpdateArg;

beforeEach(() => {
  findMany.mockReset();
  updateMany.mockReset();
  updateMany.mockImplementation((args: unknown) =>
    Promise.resolve({ count: (args as UpdateArg).where.id.in.length }));
});

describe('linkArchiveCoveredChapters', () => {
  it('links fileless numbered chapters in an archive-covered volume to the archive', async () => {
    findMany.mockResolvedValue([
      { id: 100, chapterNumber: null, volume: 2, filePath: '/lib/V02.cbr', downloadStatus: 'COMPLETED', fileName: 'V02.cbr', fileFormat: 'cbr', size: 9, pageCount: 315 },
      { id: 1, chapterNumber: 19, volume: 2, filePath: null, downloadStatus: 'PENDING' },
      { id: 2, chapterNumber: 20, volume: 2, filePath: null, downloadStatus: 'DOWNLOADING' },
    ]);

    const linked = await linkArchiveCoveredChapters(80);

    expect(linked).toBe(2);
    expect(updateMany).toHaveBeenCalledTimes(1);
    const arg = updateArg(0);
    expect([...arg.where.id.in].sort()).toEqual([1, 2]);
    expect(arg.data['downloadStatus']).toBe('COMPLETED');
    expect(arg.data['filePath']).toBe('/lib/V02.cbr');
    expect(arg.data['pageCount']).toBe(315);
    expect(arg.data['downloadUrl']).toBeNull();
  });

  it('does not touch chapters that already have their own file', async () => {
    findMany.mockResolvedValue([
      { id: 100, chapterNumber: null, volume: 1, filePath: '/lib/V01.cbr', downloadStatus: 'COMPLETED', fileName: 'V01.cbr', fileFormat: 'cbr', size: 9, pageCount: 378 },
      { id: 1, chapterNumber: 1, volume: 1, filePath: '/lib/Chapter 0001.cbz', downloadStatus: 'COMPLETED' },
      { id: 2, chapterNumber: 11, volume: 1, filePath: null, downloadStatus: 'PENDING' },
    ]);

    const linked = await linkArchiveCoveredChapters(80);

    expect(linked).toBe(1);
    expect(updateArg(0).where.id.in).toEqual([2]);
  });

  it('is a no-op when no volume has a file-backed archive', async () => {
    findMany.mockResolvedValue([
      { id: 100, chapterNumber: null, volume: 3, filePath: null, downloadStatus: 'COMPLETED' }, // fileless archive
      { id: 1, chapterNumber: 30, volume: 3, filePath: null, downloadStatus: 'PENDING' },
    ]);

    const linked = await linkArchiveCoveredChapters(80);

    expect(linked).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('batches one updateMany per volume', async () => {
    findMany.mockResolvedValue([
      { id: 100, chapterNumber: null, volume: 2, filePath: '/lib/V02.cbr', downloadStatus: 'COMPLETED', fileName: 'V02.cbr', fileFormat: 'cbr', size: 9, pageCount: 315 },
      { id: 200, chapterNumber: null, volume: 3, filePath: '/lib/V03.cbr', downloadStatus: 'COMPLETED', fileName: 'V03.cbr', fileFormat: 'cbr', size: 9, pageCount: 292 },
      { id: 1, chapterNumber: 19, volume: 2, filePath: null, downloadStatus: 'PENDING' },
      { id: 2, chapterNumber: 34, volume: 3, filePath: null, downloadStatus: 'PENDING' },
    ]);

    const linked = await linkArchiveCoveredChapters(80);

    expect(linked).toBe(2);
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it('returns 0 and does not throw if the query fails', async () => {
    findMany.mockRejectedValue(new Error('db down'));
    await expect(linkArchiveCoveredChapters(80)).resolves.toBe(0);
  });
});
