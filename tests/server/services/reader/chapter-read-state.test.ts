/**
 * @jest-environment node
 *
 * Per-user chapter read state — isolation between two users who share a title.
 *
 * Runs against a small in-memory stand-in for the two Prisma models the
 * service touches, so it runs everywhere (Jest mocks `@/server/db`). The same
 * scenarios run against real Postgres, including the grid's SQL aggregate, in
 * chapter-read-state.integration.test.ts.
 */
import {
  applyReadMarks,
  getReadMarks,
  markChapterRead,
  markMangaRead,
  markMangaUnread,
  withMangaListReadState,
  withMangaReadState,
} from '@/server/services/reader/chapter-read-state';
import type { ReadStateDb } from '@/server/services/reader/chapter-read-state';
import { isSuccess } from '@/utils/async-result';

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

interface ChapterRow { id: number; mangaId: number }
interface MarkRow { userId: string; chapterId: number; mangaId: number; readAt: Date }
interface InFilter { in: number[] }
interface MarkWhere { userId: string; mangaId?: InFilter; chapterId?: InFilter }

const ALICE = 'alice';
const BOB = 'bob';
const SHARED = 1;
const ALICE_ONLY = 2;

/** In-memory stand-in for `chapter` + `chapterReadState`. */
function createFakeDb(chapters: ChapterRow[]): { db: ReadStateDb; marks: MarkRow[] } {
  const marks: MarkRow[] = [];
  const matches = (row: MarkRow, where: MarkWhere): boolean =>
    row.userId === where.userId
    && (where.mangaId === undefined || where.mangaId.in.includes(row.mangaId))
    && (where.chapterId === undefined || where.chapterId.in.includes(row.chapterId));

  const fake = {
    chapter: {
      findMany: ({ where }: { where: { mangaId: InFilter } }): Promise<ChapterRow[]> =>
        Promise.resolve(chapters.filter((c) => where.mangaId.in.includes(c.mangaId))),
    },
    chapterReadState: {
      findMany: ({ where }: { where: MarkWhere }): Promise<MarkRow[]> =>
        Promise.resolve(marks.filter((row) => matches(row, where))),
      createMany: ({ data }: { data: Array<Omit<MarkRow, 'readAt'>> }): Promise<{ count: number }> => {
        let count = 0;
        for (const item of data) {
          if (marks.some((row) => row.userId === item.userId && row.chapterId === item.chapterId)) continue;
          marks.push({ ...item, readAt: new Date() });
          count++;
        }
        return Promise.resolve({ count });
      },
      deleteMany: ({ where }: { where: MarkWhere }): Promise<{ count: number }> => {
        const before = marks.length;
        for (let i = marks.length - 1; i >= 0; i--) {
          const row = marks[i];
          if (row && matches(row, where)) marks.splice(i, 1);
        }
        return Promise.resolve({ count: before - marks.length });
      },
      upsert: ({ where, create }: { where: { userId_chapterId: { userId: string; chapterId: number } }; create: Omit<MarkRow, 'readAt'> }): Promise<MarkRow> => {
        const key = where.userId_chapterId;
        const existing = marks.find((row) => row.userId === key.userId && row.chapterId === key.chapterId);
        if (existing) return Promise.resolve(existing);
        const created = { ...create, readAt: new Date() };
        marks.push(created);
        return Promise.resolve(created);
      },
    },
  };
  return { db: fake as unknown as ReadStateDb, marks };
}

function seed(): { db: ReadStateDb; marks: MarkRow[] } {
  return createFakeDb([
    { id: 11, mangaId: SHARED }, { id: 12, mangaId: SHARED }, { id: 13, mangaId: SHARED },
    { id: 21, mangaId: ALICE_ONLY }, { id: 22, mangaId: ALICE_ONLY },
  ]);
}

async function readIds(db: ReadStateDb, userId: string, mangaId: number): Promise<number[]> {
  const marks = await getReadMarks(db, userId, { mangaIds: [mangaId] });
  return Array.from(marks.keys()).sort((a, b) => a - b);
}

describe('chapter read state is per user', () => {
  it('marking a shared title read for one user leaves the other user unread', async () => {
    const { db } = seed();

    const result = await markMangaRead(db, ALICE, [SHARED]);

    expect(isSuccess(result) && result.data).toBe(3);
    expect(await readIds(db, ALICE, SHARED)).toEqual([11, 12, 13]);
    expect(await readIds(db, BOB, SHARED)).toEqual([]);
  });

  it('marking a shared title unread for one user keeps the other user\'s marks', async () => {
    const { db } = seed();
    await markMangaRead(db, ALICE, [SHARED]);
    await markMangaRead(db, BOB, [SHARED]);

    const result = await markMangaUnread(db, BOB, [SHARED]);

    expect(isSuccess(result) && result.data).toBe(3);
    expect(await readIds(db, BOB, SHARED)).toEqual([]);
    expect(await readIds(db, ALICE, SHARED)).toEqual([11, 12, 13]);
  });

  it('finishing a chapter in the reader marks it for that user only', async () => {
    const { db } = seed();

    await markChapterRead(db, BOB, SHARED, 12);

    expect(await readIds(db, BOB, SHARED)).toEqual([12]);
    expect(await readIds(db, ALICE, SHARED)).toEqual([]);
  });

  it('only touches the titles it was given', async () => {
    const { db } = seed();
    await markMangaRead(db, ALICE, [SHARED, ALICE_ONLY]);

    await markMangaUnread(db, ALICE, [SHARED]);

    expect(await readIds(db, ALICE, SHARED)).toEqual([]);
    expect(await readIds(db, ALICE, ALICE_ONLY)).toEqual([21, 22]);
  });

  it('is idempotent and keeps the original read time', async () => {
    const { db, marks } = seed();
    await markChapterRead(db, ALICE, SHARED, 11);
    const firstReadAt = marks[0]?.readAt;

    const again = await markMangaRead(db, ALICE, [SHARED]);
    await markChapterRead(db, ALICE, SHARED, 11);

    expect(isSuccess(again) && again.data).toBe(2);
    expect(marks.filter((row) => row.userId === ALICE && row.chapterId === 11)).toHaveLength(1);
    expect(marks.find((row) => row.chapterId === 11)?.readAt).toBe(firstReadAt);
  });

  it('does nothing for an empty title list', async () => {
    const { db, marks } = seed();

    expect(await markMangaRead(db, ALICE, [])).toEqual({ status: 'success', data: 0 });
    expect(await markMangaUnread(db, ALICE, [])).toEqual({ status: 'success', data: 0 });
    expect(marks).toHaveLength(0);
    expect((await getReadMarks(db, ALICE, {})).size).toBe(0);
  });

  it('reports a database failure as an error result instead of throwing', async () => {
    const failing = {
      chapter: { findMany: (): Promise<never> => Promise.reject(new Error('connection lost')) },
      chapterReadState: { deleteMany: (): Promise<never> => Promise.reject(new Error('connection lost')) },
    } as unknown as ReadStateDb;

    expect((await markMangaRead(failing, ALICE, [SHARED])).status).toBe('error');
    expect((await markMangaUnread(failing, ALICE, [SHARED])).status).toBe('error');
  });
});

describe('attaching read state to query results', () => {
  it('overwrites the legacy shared flag with the caller\'s own state', () => {
    const readAt = new Date('2026-10-01T12:00:00.000Z');
    // Legacy column says "read" for chapter 11 and "unread" for 12; this user
    // has actually read only 12.
    const rows = [{ id: 11, isRead: true }, { id: 12, isRead: false }];

    const result = applyReadMarks(rows, new Map([[12, readAt]]));

    expect(result).toEqual([
      { id: 11, isRead: false, readAt: null },
      { id: 12, isRead: true, readAt },
    ]);
  });

  it('gives two users different views of the same shared row without changing it', async () => {
    const { db } = seed();
    await markChapterRead(db, ALICE, SHARED, 11);
    const sharedRow = { id: SHARED, title: 'Shared', Chapter: [{ id: 11 }, { id: 12 }] };

    const forAlice = await withMangaReadState(db, ALICE, sharedRow);
    const forBob = await withMangaReadState(db, BOB, sharedRow);

    expect(forAlice.Chapter.map((c) => (c as { isRead?: boolean }).isRead)).toEqual([true, false]);
    expect(forBob.Chapter.map((c) => (c as { isRead?: boolean }).isRead)).toEqual([false, false]);
    // The input (which may live in a cache shared by both users) is untouched.
    expect(sharedRow.Chapter).toEqual([{ id: 11 }, { id: 12 }]);
  });

  it('handles a page of titles, including ones loaded without chapters', async () => {
    const { db } = seed();
    await markMangaRead(db, ALICE, [ALICE_ONLY]);
    const page = [
      { id: SHARED, Chapter: [{ id: 11 }] },
      { id: ALICE_ONLY, Chapter: [{ id: 21 }, { id: 22 }] },
      { id: 3 },
    ];

    const result = await withMangaListReadState(db, ALICE, page);

    expect(result[0]?.Chapter).toEqual([{ id: 11, isRead: false, readAt: null }]);
    expect(result[1]?.Chapter?.every((c) => (c as { isRead?: boolean }).isRead)).toBe(true);
    expect(result[2]).toEqual({ id: 3 });
  });
});
