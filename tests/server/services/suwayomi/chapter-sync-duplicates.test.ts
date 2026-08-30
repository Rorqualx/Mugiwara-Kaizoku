/**
 * @jest-environment node
 *
 * syncSuwayomiChapters duplicate-handling tests.
 *
 * Regression tests for the log-flood incident: the sync built its dedup map
 * once per run, so two Suwayomi uploads with the same chapter number in one
 * run both went to `chapter.create` and the second always died on the partial
 * unique index `Chapter_mangaId_chapterNumber_unique` — swallowed at debug
 * level in the app but logged as an ERROR by Postgres on every sync. The fake
 * prisma below enforces the schema's unique constraints exactly like Postgres
 * (throwing unless `skipDuplicates` is set) so a regression fails these tests.
 */

jest.mock('@/server/db', () => {
  interface FakeRow {
    id: number;
    mangaId: number;
    index: number;
    chapterNumber: number | null;
    suwayomiChapterId: string | null;
  }
  interface FakeState {
    rows: FakeRow[];
    nextId: number;
    constraintErrors: number;
    /** Simulate a racing writer: the next findMany can't see existing rows. */
    hideRowsFromNextFindMany: boolean;
    reset: () => void;
  }
  const state: FakeState = {
    rows: [],
    nextId: 1,
    constraintErrors: 0,
    hideRowsFromNextFindMany: false,
    reset(): void {
      state.rows = [];
      state.nextId = 1;
      state.constraintErrors = 0;
      state.hideRowsFromNextFindMany = false;
    },
  };

  const violates = (data: Omit<FakeRow, 'id'>, ignoreId?: number): boolean =>
    state.rows.some((r) => {
      if (r.id === ignoreId) return false;
      const chapterNumberDup = data.chapterNumber !== null
        && r.mangaId === data.mangaId
        && r.chapterNumber === data.chapterNumber;
      const suwayomiIdDup = data.suwayomiChapterId !== null
        && r.suwayomiChapterId === data.suwayomiChapterId;
      const indexDup = r.mangaId === data.mangaId && r.index === data.index;
      return chapterNumberDup || suwayomiIdDup || indexDup;
    });

  return {
    __fakeDb: state,
    prisma: {
      manga: {
        findUnique: async (): Promise<{ id: number; suwayomiPluginConfig: unknown }> => (
          { id: 1, suwayomiPluginConfig: { mangaId: 99 } }
        ),
        update: async (): Promise<{ id: number }> => ({ id: 1 }),
      },
      chapter: {
        findMany: async (args: { where: { mangaId: number } }): Promise<Array<{
          id: number; chapterNumber: number | null; suwayomiChapterId: string | null;
        }>> => {
          if (state.hideRowsFromNextFindMany) {
            state.hideRowsFromNextFindMany = false;
            return [];
          }
          return state.rows
            .filter((r) => r.mangaId === args.where.mangaId)
            .map((r) => ({
              id: r.id,
              chapterNumber: r.chapterNumber,
              suwayomiChapterId: r.suwayomiChapterId,
            }));
        },
        count: async (args: { where: { mangaId: number } }): Promise<number> =>
          state.rows.filter(
            (r) => r.mangaId === args.where.mangaId && r.suwayomiChapterId !== null
          ).length,
        update: async (args: {
          where: { id: number };
          data: { suwayomiChapterId: string };
        }): Promise<{ id: number }> => {
          const row = state.rows.find((r) => r.id === args.where.id);
          if (!row) throw new Error(`Row ${args.where.id} not found`);
          const candidate = { ...row, suwayomiChapterId: args.data.suwayomiChapterId };
          const { id: _id, ...data } = candidate;
          if (violates(data, row.id)) {
            state.constraintErrors++;
            throw new Error('duplicate key value violates unique constraint "Chapter_suwayomiChapterId_key"');
          }
          row.suwayomiChapterId = args.data.suwayomiChapterId;
          return { id: row.id };
        },
        createMany: async (args: {
          data: Array<{
            mangaId: number;
            index: number;
            chapterNumber: number | null;
            suwayomiChapterId?: string | null;
          }>;
          skipDuplicates?: boolean;
        }): Promise<{ count: number }> => {
          let count = 0;
          for (const d of args.data) {
            const data = {
              mangaId: d.mangaId,
              index: d.index,
              chapterNumber: d.chapterNumber,
              suwayomiChapterId: d.suwayomiChapterId ?? null,
            };
            if (violates(data)) {
              if (args.skipDuplicates === true) continue;
              state.constraintErrors++;
              throw new Error('duplicate key value violates unique constraint "Chapter_mangaId_chapterNumber_unique"');
            }
            state.rows.push({ ...data, id: state.nextId++ });
            count++;
          }
          return { count };
        },
        create: async (args: {
          data: {
            mangaId: number;
            index: number;
            chapterNumber: number | null;
            suwayomiChapterId?: string | null;
          };
        }): Promise<{ id: number }> => {
          // Bare create has no conflict handling — exactly like Postgres.
          const data = {
            mangaId: args.data.mangaId,
            index: args.data.index,
            chapterNumber: args.data.chapterNumber,
            suwayomiChapterId: args.data.suwayomiChapterId ?? null,
          };
          if (violates(data)) {
            state.constraintErrors++;
            throw new Error('duplicate key value violates unique constraint "Chapter_mangaId_chapterNumber_unique"');
          }
          const row = { ...data, id: state.nextId++ };
          state.rows.push(row);
          return { id: row.id };
        },
      },
    },
  };
});

jest.mock('@/server/services/suwayomi/configService', () => ({
  suwayomiConfigService: {
    loadConfig: jest.fn(async () => ({ port: 4567 })),
  },
}));

const mockGetChapters = jest.fn();
jest.mock('@/server/services/suwayomi/graphql/client', () => ({
  getSuwayomiGraphQLClient: jest.fn(() => ({
    fetchChapters: jest.fn(async () => undefined),
    getChapters: mockGetChapters,
  })),
}));

jest.mock('@/server/services/suwayomi/manga-matcher', () => ({
  readSuwayomiPluginConfig: jest.fn(() => ({ mangaId: 99 })),
}));

import { syncSuwayomiChapters } from '@/server/services/suwayomi/chapter-sync';

import type { ChapterType } from '@/server/services/suwayomi/graphql/types';

interface FakeDbState {
  rows: Array<{
    id: number;
    mangaId: number;
    index: number;
    chapterNumber: number | null;
    suwayomiChapterId: string | null;
  }>;
  constraintErrors: number;
  hideRowsFromNextFindMany: boolean;
  reset: () => void;
}

const fakeDb = (jest.requireMock('@/server/db') as { __fakeDb: FakeDbState }).__fakeDb;

function suwayomiChapter(id: number, chapterNumber: number, name: string): ChapterType {
  return { id, chapterNumber, name } as unknown as ChapterType;
}

beforeEach(() => {
  fakeDb.reset();
  mockGetChapters.mockReset();
});

describe('syncSuwayomiChapters duplicate handling', () => {
  it('same-number uploads within one run produce zero constraint errors', async () => {
    // Two scanlators uploaded chapter 5 — the exact intra-run collision that
    // flooded the Postgres log on every sync before the fix.
    mockGetChapters.mockResolvedValue({
      chapters: [
        suwayomiChapter(11, 5, 'Chapter 5'),
        suwayomiChapter(12, 5, 'Chapter 5 (alt scanlator)'),
        suwayomiChapter(13, 6, 'Chapter 6'),
      ],
    });

    const result = await syncSuwayomiChapters(1);

    expect(fakeDb.constraintErrors).toBe(0);
    // One row for chapter 5 (second upload deduped in-run), one for chapter 6.
    expect(result.suwayomiOnly).toBe(2);
    expect(fakeDb.rows).toHaveLength(2);
    expect(fakeDb.rows.map((r) => r.chapterNumber).sort()).toEqual([5, 6]);
  });

  it('running the same sync twice produces zero constraint errors and no duplicate rows', async () => {
    mockGetChapters.mockResolvedValue({
      chapters: [
        suwayomiChapter(11, 5, 'Chapter 5'),
        suwayomiChapter(12, 5, 'Chapter 5 (alt scanlator)'),
        suwayomiChapter(13, 6, 'Chapter 6'),
      ],
    });

    const first = await syncSuwayomiChapters(1);
    expect(first.suwayomiOnly).toBe(2);
    expect(fakeDb.constraintErrors).toBe(0);

    const second = await syncSuwayomiChapters(1);
    expect(second.suwayomiOnly).toBe(0);
    // ZERO constraint errors reached the DB layer across both runs.
    expect(fakeDb.constraintErrors).toBe(0);
    expect(fakeDb.rows).toHaveLength(2);
  });

  it('a chapter row racing in from another writer is skipped silently', async () => {
    // A row for chapter 7 exists in the DB (e.g. just created by the
    // reconciler) but the sync's dedup map was built before it landed —
    // simulated by hiding it from the next findMany. The insert then hits the
    // unique index, and must come back as a silent skip, never an error.
    fakeDb.rows.push({
      id: 1000, mangaId: 1, index: 7000, chapterNumber: 7, suwayomiChapterId: null,
    });
    fakeDb.hideRowsFromNextFindMany = true;
    mockGetChapters.mockResolvedValue({
      chapters: [suwayomiChapter(21, 7, 'Chapter 7')],
    });

    const result = await syncSuwayomiChapters(1);

    expect(fakeDb.constraintErrors).toBe(0);
    expect(result.suwayomiOnly).toBe(0);
    expect(fakeDb.rows).toHaveLength(1);
    expect(result.reason).toBeUndefined();
  });
});
