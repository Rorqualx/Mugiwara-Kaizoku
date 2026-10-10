// @ts-nocheck - Test file uses a hand-rolled Prisma stub
import { describe, expect, it, jest } from '@jest/globals';

import {
  assertChapterMembership,
  assertChaptersMembership,
  assertVolumeMembership,
} from '@/server/trpc/routers/_shared/library-access';

/**
 * Prisma stub: chapters/volumes map id → mangaId; `memberships` is the set of
 * manga ids in the caller's library.
 */
function createPrisma(opts: {
  chapters?: Record<number, number>;
  volumes?: Record<number, number>;
  memberships?: number[];
}) {
  const chapters = opts.chapters ?? {};
  const volumes = opts.volumes ?? {};
  const memberships = new Set(opts.memberships ?? []);
  return {
    chapter: {
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(where.id in chapters ? { mangaId: chapters[where.id] } : null)
      ),
      findMany: jest.fn(({ where }) => {
        const mangaIds = new Set(where.id.in.filter((id) => id in chapters).map((id) => chapters[id]));
        return Promise.resolve([...mangaIds].map((mangaId) => ({ mangaId })));
      }),
    },
    volume: {
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(where.id in volumes ? { mangaId: volumes[where.id] } : null)
      ),
    },
    libraryMembership: {
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(memberships.has(where.userId_mangaId.mangaId) ? { id: 1 } : null)
      ),
      findMany: jest.fn(({ where }) =>
        Promise.resolve(
          where.mangaId.in.filter((id) => memberships.has(id)).map((mangaId) => ({ mangaId }))
        )
      ),
    },
  };
}

describe('library-access membership helpers', () => {
  describe('assertChapterMembership', () => {
    it('returns the manga id when the chapter is in the caller library', async () => {
      const prisma = createPrisma({ chapters: { 10: 5 }, memberships: [5] });
      await expect(assertChapterMembership(prisma, 'u1', 10)).resolves.toBe(5);
    });

    it('rejects a chapter of a title outside the caller library', async () => {
      const prisma = createPrisma({ chapters: { 10: 5 }, memberships: [6] });
      await expect(assertChapterMembership(prisma, 'u1', 10)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('reports an unknown chapter as NOT_FOUND', async () => {
      const prisma = createPrisma({ memberships: [5] });
      await expect(assertChapterMembership(prisma, 'u1', 999)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('assertVolumeMembership', () => {
    it('authorises by the volume row, not by anything the caller supplies', async () => {
      const prisma = createPrisma({ volumes: { 3: 7, 4: 8 }, memberships: [7] });
      await expect(assertVolumeMembership(prisma, 'u1', 3)).resolves.toBe(7);
      await expect(assertVolumeMembership(prisma, 'u1', 4)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(assertVolumeMembership(prisma, 'u1', 5)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('assertChaptersMembership', () => {
    it('passes when every chapter belongs to a library title', async () => {
      const prisma = createPrisma({ chapters: { 1: 5, 2: 5, 3: 6 }, memberships: [5, 6] });
      await expect(assertChaptersMembership(prisma, 'u1', [1, 2, 3])).resolves.toBeUndefined();
    });

    it('fails the whole batch when one chapter is foreign', async () => {
      const prisma = createPrisma({ chapters: { 1: 5, 2: 9 }, memberships: [5] });
      await expect(assertChaptersMembership(prisma, 'u1', [1, 2])).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('does not query for an empty batch', async () => {
      const prisma = createPrisma({});
      await expect(assertChaptersMembership(prisma, 'u1', [])).resolves.toBeUndefined();
      expect(prisma.chapter.findMany).not.toHaveBeenCalled();
    });
  });
});
