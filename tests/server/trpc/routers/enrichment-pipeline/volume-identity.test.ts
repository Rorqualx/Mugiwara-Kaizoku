/**
 * @jest-environment node
 */
import { beforeEach, describe, it, expect, jest } from '@jest/globals';

import { prisma } from '@/server/db';
import {
  planVolumeRekeys,
  sameVolumeContent,
  stabilizeVolumeIds,
  type VolumeContent,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/volume-identity';

import type { Volume } from '@prisma/client';

jest.mock('@/server/db', () => ({
  prisma: {
    volume: { findMany: jest.fn() },
    volumeProgress: { createMany: jest.fn() },
    bookmarkedVolume: { createMany: jest.fn() },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

const T0 = new Date('2026-10-01T00:00:00Z');
const T1 = new Date('2026-10-13T00:00:00Z');

function volume(id: number, number: number, extra: Partial<Volume> = {}): Volume {
  return {
    id, mangaId: 81, number, title: `Vol ${number}`, subtitle: null, alternativeTitle: null, description: null,
    summary: null, isbn: null, isbn13: null, publisher: 'Viz', pageCount: null, format: 'TANKOBON', releaseDate: null,
    coverImage: null, chapterStart: number * 10 - 9, chapterEnd: number * 10, totalChapters: null, source: 'comicvine',
    sourceId: null, sourceUrl: null, fetchedAt: T0, lastEnriched: T0, enrichmentTier: 1, createdAt: T0, updatedAt: T0,
    ...extra,
  };
}

describe('planVolumeRekeys — a refresh keeps each volume\'s id', () => {
  it('a refresh with unchanged volumes keeps every Volume id: each rebuilt row takes back the id of the same number', () => {
    const before = [{ id: 9896, number: 1 }, { id: 9897, number: 2 }, { id: 10011, number: 115 }];
    const rebuilt = [{ id: 20001, number: 1 }, { id: 20002, number: 2 }, { id: 20003, number: 115 }];
    expect(planVolumeRekeys(before, rebuilt, new Set())).toEqual([
      { number: 1, fromId: 20001, toId: 9896 },
      { number: 2, fromId: 20002, toId: 9897 },
      { number: 115, fromId: 20003, toId: 10011 },
    ]);
  });

  it('a volume that is new this run keeps the id the rebuild gave it', () => {
    expect(planVolumeRekeys([{ id: 1, number: 1 }], [{ id: 50, number: 1 }, { id: 51, number: 2 }], new Set()))
      .toEqual([{ number: 1, fromId: 50, toId: 1 }]);
  });

  it('a volume the rebuild dropped is not brought back (the restore and prune rules own that)', () => {
    expect(planVolumeRekeys([{ id: 1, number: 1 }, { id: 2, number: 116 }], [{ id: 50, number: 1 }], new Set()))
      .toEqual([{ number: 1, fromId: 50, toId: 1 }]);
  });

  it('leaves a row alone that already has its previous id (restored from the snapshot) and never reuses a taken id', () => {
    expect(planVolumeRekeys([{ id: 1, number: 1 }, { id: 2, number: 2 }], [{ id: 1, number: 1 }, { id: 60, number: 2 }], new Set([2])))
      .toEqual([]);
  });
});

describe('sameVolumeContent — what counts as an unchanged volume', () => {
  const base: VolumeContent = volume(1, 110, { chapterStart: 1111, chapterEnd: 1121 });

  it('ignores ids and timestamps', () => {
    expect(sameVolumeContent(base, volume(99, 110, { chapterStart: 1111, chapterEnd: 1121, createdAt: T1, updatedAt: T1, fetchedAt: T1 }))).toBe(true);
  });

  it('sees a changed range, cover, title or source', () => {
    expect(sameVolumeContent(base, { ...base, chapterEnd: 1122 })).toBe(false);
    expect(sameVolumeContent(base, { ...base, coverImage: 'https://x/cover.jpg' })).toBe(false);
    expect(sameVolumeContent(base, { ...base, title: 'The Upheaval of the Era' })).toBe(false);
    expect(sameVolumeContent(base, { ...base, source: 'mangadex' })).toBe(false);
  });

  it('compares dates by value', () => {
    expect(sameVolumeContent({ ...base, releaseDate: new Date(T0) }, { ...base, releaseDate: new Date(T0) })).toBe(true);
  });
});

describe('stabilizeVolumeIds — after the rebuild', () => {
  const findMany = jest.mocked(prisma.volume.findMany);
  const executeRaw = jest.mocked(prisma.$executeRaw);
  const transaction = jest.mocked(prisma.$transaction);

  beforeEach(() => {
    jest.clearAllMocks();
    executeRaw.mockImplementation(((..._args: unknown[]) => Promise.resolve(1)) as never);
    transaction.mockImplementation(((ops: unknown[]) => Promise.all(ops)) as never);
  });

  it('re-keys every rebuilt volume to its previous id, one UPDATE per volume', async () => {
    const before = [volume(9896, 1), volume(9897, 2)];
    findMany
      .mockResolvedValueOnce([{ id: 20001, number: 1 }, { id: 20002, number: 2 }] as never) // current rows
      .mockResolvedValueOnce([] as never) // previous ids taken by nobody
      .mockResolvedValueOnce([] as never); // timestamp pass: content compare finds none

    const result = await stabilizeVolumeIds(81, { volumes: before, progress: [], bookmarks: [] });

    expect(result.rekeyed).toBe(2);
    const updates = executeRaw.mock.calls.map(call => (call as unknown[]).slice(1));
    expect(updates).toEqual([[9896, 20001, 81], [9897, 20002, 81]]);
  });

  it('a refresh that changes nothing leaves the row byte-identical: unchanged content gets its old timestamps back', async () => {
    const before = [volume(9896, 1)];
    findMany
      .mockResolvedValueOnce([{ id: 9896, number: 1 }] as never)
      .mockResolvedValueOnce([{ id: 9896 }] as never)
      .mockResolvedValueOnce([volume(9896, 1, { createdAt: T1, updatedAt: T1, fetchedAt: T1, lastEnriched: T1 })] as never);

    const result = await stabilizeVolumeIds(81, { volumes: before, progress: [], bookmarks: [] });

    expect(result).toMatchObject({ rekeyed: 0, unchanged: 1 });
    expect((executeRaw.mock.calls[0] as unknown[]).slice(1)).toEqual([T0, T0, T0, T0, 9896]);
  });

  it('does nothing for a title that had no volumes before the run', async () => {
    expect(await stabilizeVolumeIds(81, { volumes: [], progress: [], bookmarks: [] }))
      .toEqual({ rekeyed: 0, unchanged: 0, restoredProgress: 0, restoredBookmarks: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });
});
