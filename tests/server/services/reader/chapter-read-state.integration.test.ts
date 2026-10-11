/**
 * Per-user chapter read state — integration test against a real Postgres.
 *
 * Two users share one title through LibraryMembership. The test drives the
 * real service functions and the library grid's SQL aggregate, so the
 * isolation is checked as actual SQL (the ChapterReadState join), not a mock.
 * It creates its own users/library/title under reserved names and removes
 * them afterwards.
 *
 * Runs under `bun test` with DATABASE_URL pointing at a migrated database. It
 * is SKIPPED under Jest (the pre-commit runner), which mocks `@/server/db` —
 * the same split as tests/server/services/metadata/binding-record.test.ts.
 * The service logic is also covered under Jest by chapter-read-state.test.ts.
 */

import { prisma } from '@/server/db';
import {
  getReadMarks,
  markChapterRead,
  markMangaRead,
  markMangaUnread,
  withMangaReadState,
} from '@/server/services/reader/chapter-read-state';
import { buildGridMangaData } from '@/server/trpc/routers/manga/chapter-stats-sql';

const ALICE = 'read-state-it-alice';
const BOB = 'read-state-it-bob';
const TITLE = 'Read State Integration Title';
const CHAPTER_COUNT = 4;

const underJest = typeof process !== 'undefined' && Boolean(process.env['JEST_WORKER_ID']);
const suite = underJest ? describe.skip : describe;

let mangaId = 0;
let chapterIds: number[] = [];

async function cleanup(): Promise<void> {
  // Deleting the users cascades to their library, the title, its chapters,
  // memberships and read marks.
  await prisma.manga.deleteMany({ where: { title: TITLE } });
  await prisma.user.deleteMany({ where: { id: { in: [ALICE, BOB] } } });
}

async function setup(): Promise<void> {
  await cleanup();
  const now = new Date();
  for (const id of [ALICE, BOB]) {
    await prisma.user.create({
      data: { id, userName: id, email: `${id}@example.test`, hashedPassword: 'not-a-real-hash', updatedAt: now },
    });
  }
  const library = await prisma.library.create({ data: { name: 'read-state-it', path: '/tmp/read-state-it', ownerId: ALICE } });
  const manga = await prisma.manga.create({
    data: { title: TITLE, source: 'manual', libraryId: library.id, libraryPath: '/tmp/read-state-it/title', updatedAt: now },
  });
  mangaId = manga.id;
  for (const userId of [ALICE, BOB]) {
    await prisma.libraryMembership.create({ data: { userId, mangaId } });
  }
  chapterIds = [];
  for (let n = 1; n <= CHAPTER_COUNT; n++) {
    const chapter = await prisma.chapter.create({
      data: { mangaId, index: n, chapterNumber: n, fileName: `ch${n}.cbz`, title: `Chapter ${n}`, updatedAt: now },
    });
    chapterIds.push(chapter.id);
  }
}

async function readCount(userId: string): Promise<number> {
  const grid = await buildGridMangaData([mangaId], userId);
  return grid.get(mangaId)?.chapterStats.readCount ?? -1;
}

suite('chapter read state (real-DB integration)', () => {
  beforeEach(setup);
  afterAll(async () => {
    await cleanup();
  });

  it('one user marking the shared title read does not change the other user', async () => {
    await markMangaRead(prisma, ALICE, [mangaId]);

    expect((await getReadMarks(prisma, ALICE, { mangaIds: [mangaId] })).size).toBe(CHAPTER_COUNT);
    expect((await getReadMarks(prisma, BOB, { mangaIds: [mangaId] })).size).toBe(0);
  });

  it('the library grid aggregate is computed per user', async () => {
    await markMangaRead(prisma, ALICE, [mangaId]);
    await markChapterRead(prisma, BOB, mangaId, chapterIds[0] ?? 0);

    expect(await readCount(ALICE)).toBe(CHAPTER_COUNT);
    expect(await readCount(BOB)).toBe(1);

    const aliceGrid = await buildGridMangaData([mangaId], ALICE);
    const bobGrid = await buildGridMangaData([mangaId], BOB);
    expect(aliceGrid.get(mangaId)?.recentChapters.every((c) => c.isRead)).toBe(true);
    expect(bobGrid.get(mangaId)?.recentChapters.filter((c) => c.isRead).map((c) => c.id)).toEqual([chapterIds[0]]);
    expect(bobGrid.get(mangaId)?.chapterStats.lastReadAt).not.toBeNull();
  });

  it('one user marking the title unread keeps the other user\'s marks', async () => {
    await markMangaRead(prisma, ALICE, [mangaId]);
    await markMangaRead(prisma, BOB, [mangaId]);

    await markMangaUnread(prisma, BOB, [mangaId]);

    expect(await readCount(BOB)).toBe(0);
    expect(await readCount(ALICE)).toBe(CHAPTER_COUNT);
    expect((await buildGridMangaData([mangaId], BOB)).get(mangaId)?.chapterStats.lastReadAt).toBeNull();
  });

  it('the legacy shared column has no effect on either user', async () => {
    await prisma.chapter.updateMany({ where: { mangaId }, data: { isRead: true } });

    expect(await readCount(ALICE)).toBe(0);
    expect(await readCount(BOB)).toBe(0);
    const manga = await prisma.manga.findUniqueOrThrow({ where: { id: mangaId }, include: { Chapter: true } });
    const forBob = await withMangaReadState(prisma, BOB, manga);
    expect(forBob.Chapter.some((c) => c.isRead)).toBe(false);
  });

  it('"next unread chapters" follows the caller, not other members', async () => {
    await markChapterRead(prisma, ALICE, mangaId, chapterIds[0] ?? 0);
    await markChapterRead(prisma, ALICE, mangaId, chapterIds[1] ?? 0);

    const nextFor = async (userId: string): Promise<number[]> => {
      const rows = await prisma.chapter.findMany({
        where: { mangaId, readStates: { none: { userId } } },
        orderBy: { index: 'asc' },
        select: { index: true },
      });
      return rows.map((r) => r.index);
    };

    expect(await nextFor(ALICE)).toEqual([3, 4]);
    expect(await nextFor(BOB)).toEqual([1, 2, 3, 4]);
  });

  it('marks are removed with the chapter and with the user', async () => {
    await markMangaRead(prisma, ALICE, [mangaId]);
    await markMangaRead(prisma, BOB, [mangaId]);

    await prisma.chapter.delete({ where: { id: chapterIds[0] ?? 0 } });
    expect(await prisma.chapterReadState.count({ where: { mangaId } })).toBe((CHAPTER_COUNT - 1) * 2);

    await prisma.user.delete({ where: { id: BOB } });
    expect(await prisma.chapterReadState.count({ where: { mangaId } })).toBe(CHAPTER_COUNT - 1);
    expect(await readCount(ALICE)).toBe(CHAPTER_COUNT - 1);
  });
});
