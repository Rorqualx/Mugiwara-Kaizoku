/** @jest-environment node */
/**
 * Per-volume "volume-file" rows (chapterNumber NULL, one per volume): the
 * stale sweep must not delete them, and their summed size must fit int4.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockChapter = {
  findMany: jest.fn<(args: { where: Record<string, unknown> }) => Promise<unknown[]>>(),
  findFirst: jest.fn<(args: { where: Record<string, unknown> }) => Promise<unknown>>(),
  create: jest.fn<(args: { data: Record<string, unknown> }) => Promise<unknown>>(),
  update: jest.fn<(args: { where: { id: number }; data: Record<string, unknown> }) => Promise<unknown>>(),
  deleteMany: jest.fn<() => Promise<{ count: number }>>(),
};
jest.mock('@/server/db', () => ({ prisma: { chapter: mockChapter } }));
// phase-db-persistence pulls in the persistence services, which start timers
// at import; only its pure sweep is under test here.
jest.mock('@/server/services/metadata/metadata-persister', () => ({ metadataPersistenceService: {} }));
jest.mock('@/server/services/volume-persister', () => ({ persistNormalizedVolumes: jest.fn() }));

import { findStaleChapterIds } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-db-persistence';
import { ensureVolumeFileRows } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize/ensure-volume-file-rows';
import {
  clampToInt4,
  findKeptVolumeFileRowIds,
  INT4_MAX,
  isVolumeFileRow,
  volumeFileBaseIndex,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize/volume-file-row-scheme';

const NO_USER_DATA = { chapterFiles: 0, ReadingProgress: 0, ReaderBookmark: 0, ReadingHistory: 0, WantedItem: 0, NativeDownload: 0 };

function row(over: { id: number; index: number; chapterNumber: number | null; volume: number | null; filePath?: string | null; downloadStatus?: string }): Parameters<typeof findStaleChapterIds>[0][number] {
  return {
    title: '', description: null, coverImage: null, pages: null, pageCount: null, releaseDate: null,
    packDownloadId: null, filePath: null, downloadStatus: 'PENDING', _count: NO_USER_DATA, ...over,
  };
}

describe('isVolumeFileRow', () => {
  it('recognises the synthetic index space, including bumped and negative-volume rows', () => {
    expect(volumeFileBaseIndex(3)).toBe(100_300);
    expect(isVolumeFileRow({ chapterNumber: null, volume: 3, index: 100_300 })).toBe(true);
    expect(isVolumeFileRow({ chapterNumber: null, volume: 3, index: 100_301 })).toBe(true);
    expect(isVolumeFileRow({ chapterNumber: null, volume: 0, index: 100_000 })).toBe(true);
    // Blood Lad carries a volume -1 row at index 99,900.
    expect(isVolumeFileRow({ chapterNumber: null, volume: -1, index: 99_900 })).toBe(true);
  });

  it('rejects numbered rows, volume-less rows and ordinary indices', () => {
    expect(isVolumeFileRow({ chapterNumber: 12, volume: 3, index: 100_300 })).toBe(false);
    expect(isVolumeFileRow({ chapterNumber: null, volume: null, index: 100_300 })).toBe(false);
    expect(isVolumeFileRow({ chapterNumber: null, volume: 3, index: 57 })).toBe(false);
    expect(isVolumeFileRow({ chapterNumber: null, volume: 3, index: 100_299 })).toBe(false);
  });
});

describe('findStaleChapterIds — per-volume rows survive the phantom sweep', () => {
  const numbered = row({ id: 1, index: 1, chapterNumber: 1, volume: 1, filePath: '/lib/c001.cbz', downloadStatus: 'COMPLETED' });
  const volumeRow = row({ id: 2, index: 100_100, chapterNumber: null, volume: 1 });
  const phantomNoVolume = row({ id: 3, index: 40, chapterNumber: null, volume: null });
  const phantomWrongIndex = row({ id: 4, index: 41, chapterNumber: null, volume: 1 });
  const orphanVolumeRow = row({ id: 5, index: 100_900, chapterNumber: null, volume: 9 });

  it('keeps the per-volume row and still removes genuine phantoms', () => {
    const stale = findStaleChapterIds(
      [numbered, volumeRow, phantomNoVolume, phantomWrongIndex, orphanVolumeRow], new Set([1]), new Set(), 1,
    );
    expect(stale).not.toContain(2);
    // No volume, an ordinary index, or a volume with no numbered chapters left: all still phantoms.
    expect(stale.sort()).toEqual([3, 4, 5]);
  });

  it('exposes the kept set for the same rows', () => {
    expect([...findKeptVolumeFileRowIds([numbered, volumeRow, phantomNoVolume, phantomWrongIndex, orphanVolumeRow])]).toEqual([2]);
  });
});

describe('clampToInt4', () => {
  it('caps One Piece\'s summed volume size at the int4 maximum', () => {
    expect(clampToInt4(2_558_355_943)).toBe(INT4_MAX);
    expect(INT4_MAX).toBe(2_147_483_647);
  });

  it('leaves values that fit alone', () => {
    expect(clampToInt4(783_029_893)).toBe(783_029_893);
    expect(clampToInt4(0)).toBe(0);
  });
});

describe('ensureVolumeFileRows', () => {
  const chapters = [
    { index: 1, pageCount: 20, size: 1_300_000_000, filePath: '/lib/c001.cbz', fileName: 'c001.cbz', fileFormat: 'cbz', volume: 1, volumeId: 7, downloadStatus: 'COMPLETED' },
    { index: 2, pageCount: 22, size: 1_258_355_943, filePath: '/lib/c002.cbz', fileName: 'c002.cbz', fileFormat: 'cbz', volume: 1, volumeId: 7, downloadStatus: 'COMPLETED' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockChapter.deleteMany.mockResolvedValue({ count: 0 });
    mockChapter.create.mockResolvedValue({});
    mockChapter.update.mockResolvedValue({});
    // First call: numbered chapters. Second: file-less containers for the orphan pass.
    mockChapter.findMany.mockImplementation(async (args) => ('chapterNumber' in args.where && args.where['chapterNumber'] === null ? [] : chapters));
  });

  it('creates the row with the size clamped instead of overflowing the column', async () => {
    mockChapter.findFirst.mockResolvedValue(null);
    await ensureVolumeFileRows(81);
    expect(mockChapter.create).toHaveBeenCalledTimes(1);
    expect(mockChapter.create.mock.calls[0]?.[0].data).toMatchObject({
      mangaId: 81, volume: 1, index: 100_100, size: INT4_MAX, pageCount: 42, downloadStatus: 'COMPLETED',
    });
  });

  it('stores a shared archive\'s size once, not once per chapter', async () => {
    // One Piece vol 1: eight chapter rows all point at V01.cbz and each carries its 152 MB.
    const archive = '/lib/Volumes/One Piece V01.cbz';
    const shared = [53, 24, 22].map((pageCount, i) => ({
      index: i + 1, pageCount, size: 152_387_051, filePath: archive, fileName: 'One Piece Vol 01', fileFormat: 'CBZ',
      volume: 1, volumeId: 7, downloadStatus: 'COMPLETED',
    }));
    mockChapter.findMany.mockImplementation(async (args) => ('chapterNumber' in args.where && args.where['chapterNumber'] === null ? [] : shared));
    mockChapter.findFirst.mockResolvedValue(null);
    await ensureVolumeFileRows(81);
    expect(mockChapter.create.mock.calls[0]?.[0].data).toMatchObject({ size: 152_387_051, pageCount: 99, filePath: archive });
  });

  it('is a no-op on the next run: a clamped row compares equal to the clamped total', async () => {
    mockChapter.findFirst.mockImplementation(async (args) => ('volume' in args.where
      ? { id: 500, pageCount: 42, size: INT4_MAX, filePath: null, downloadStatus: 'COMPLETED' }
      : null));
    await ensureVolumeFileRows(81);
    expect(mockChapter.create).not.toHaveBeenCalled();
    expect(mockChapter.update).not.toHaveBeenCalled();
  });

  it('refreshes a stale status even when pages and size are unchanged', async () => {
    mockChapter.findFirst.mockImplementation(async (args) => ('volume' in args.where
      ? { id: 500, pageCount: 42, size: INT4_MAX, filePath: null, downloadStatus: 'PENDING' }
      : null));
    await ensureVolumeFileRows(81);
    expect(mockChapter.update).toHaveBeenCalledTimes(1);
    expect(mockChapter.update.mock.calls[0]?.[0]).toMatchObject({ where: { id: 500 }, data: { downloadStatus: 'COMPLETED' } });
  });
});
