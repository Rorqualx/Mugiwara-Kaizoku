// @ts-nocheck - Test file uses a hand-rolled Prisma stub
import { describe, expect, it, jest } from '@jest/globals';

import {
  assertChapterMembership,
  assertChaptersMembership,
  assertVolumeMembership,
  rehomeSharedTitles,
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

  describe('rehomeSharedTitles', () => {
    /** manga: id -> libraryId; members: mangaId -> userIds; libraries: id -> ownerId */
    function createRehomePrisma(manga, members, libraries) {
      return {
        manga: {
          findMany: jest.fn(({ where }) =>
            Promise.resolve(Object.entries(manga)
              .filter(([, libraryId]) => where.libraryId.in.includes(libraryId))
              .map(([id]) => ({ id: Number(id) })))
          ),
          update: jest.fn(({ where, data }) => {
            manga[where.id] = data.libraryId;
            return Promise.resolve({});
          }),
        },
        libraryMembership: {
          findFirst: jest.fn(({ where }) => {
            const other = (members[where.mangaId] ?? []).find((userId) => userId !== where.userId.not);
            return Promise.resolve(other ? { userId: other } : null);
          }),
        },
        library: {
          findFirst: jest.fn(({ where }) => {
            const found = Object.entries(libraries)
              .map(([id, ownerId]) => ({ id: Number(id), ownerId }))
              .filter((lib) => lib.ownerId === where.ownerId && !where.id.notIn.includes(lib.id))
              .sort((a, b) => a.id - b.id)[0];
            return Promise.resolve(found ? { id: found.id } : null);
          }),
        },
      };
    }

    it('moves titles other users still hold and leaves the rest to the cascade', async () => {
      const manga = { 1: 10, 2: 10, 3: 20 };
      const prisma = createRehomePrisma(manga, { 1: ['gone', 'stays'], 2: ['gone'] }, { 10: 'gone', 20: 'stays' });

      await expect(rehomeSharedTitles(prisma, 'gone', [10])).resolves.toBe(1);
      expect(manga).toEqual({ 1: 20, 2: 10, 3: 20 });
    });

    it('never re-homes into a library that is itself being deleted', async () => {
      const manga = { 1: 10 };
      const prisma = createRehomePrisma(manga, { 1: ['gone', 'stays'] }, { 10: 'gone', 11: 'gone', 30: 'stays' });

      await rehomeSharedTitles(prisma, 'gone', [10, 11]);
      expect(manga[1]).toBe(30);
    });

    it('aborts when a remaining holder has no library to receive the title', async () => {
      const manga = { 1: 10 };
      const prisma = createRehomePrisma(manga, { 1: ['gone', 'stays'] }, { 10: 'gone' });

      await expect(rehomeSharedTitles(prisma, 'gone', [10])).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
      expect(manga[1]).toBe(10);
    });

    it('does nothing when the user owns no libraries', async () => {
      const prisma = createRehomePrisma({}, {}, {});
      await expect(rehomeSharedTitles(prisma, 'gone', [])).resolves.toBe(0);
      expect(prisma.manga.findMany).not.toHaveBeenCalled();
    });
  });
});
