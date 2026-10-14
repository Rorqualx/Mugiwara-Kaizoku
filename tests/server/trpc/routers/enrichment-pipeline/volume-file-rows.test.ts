/** @jest-environment node */
/**
 * Per-volume "volume-file" rows (chapterNumber NULL, one per volume): the
 * stale sweep must not delete them, and their summed size is stored in full
 * (`Chapter.size` is a BigInt column, so sizes are bigint as Prisma returns them).
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
import { ensureVolumeFileRows, sharedArchivePath } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize/ensure-volume-file-rows';
import {
  findKeptVolumeFileRowIds,
  isVolumeFileRow,
  volumeFileBaseIndex,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize/volume-file-row-scheme';

const NO_USER_DATA = { chapterFiles: 0, ReadingProgress: 0, ReaderBookmark: 0, ReadingHistory: 0, WantedItem: 0, NativeDownload: 0 };

function row(over: { id: number; index: number; chapterNumber: number | null; volume: number | null; filePath?: string | null; downloadStatus?: string }): Parameters<typeof findStaleChapterIds>[0][number] {
  return {
    title: '', packDownloadId: null, filePath: null, downloadStatus: 'PENDING', _count: NO_USER_DATA, ...over,
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

describe('findStaleChapterIds — a refresh does not delete a titled chapter 0 only for the Fandom phase to re-create it', () => {
  // Bleach "side-A the sand": no provider list numbers a chapter 0, so the
  // sweep deleted it and the Fandom phase created it again, under a new id, on every refresh.
  const one = row({ id: 1, index: 1, chapterNumber: 1, volume: 1, filePath: '/lib/c001.cbz', downloadStatus: 'COMPLETED' });
  const prologue = { ...row({ id: 2, index: 900, chapterNumber: 0, volume: null }), title: 'side-A the sand' };
  const genericZero = { ...row({ id: 3, index: 901, chapterNumber: 0, volume: null }), title: 'Chapter 0' };
  const staleTitled = { ...row({ id: 4, index: 902, chapterNumber: 7, volume: null }), title: 'A Wrong Binding' };

  it('keeps the titled chapter 0 and still removes a generic chapter 0 and other unlisted stubs', () => {
    const stale = findStaleChapterIds([one, prologue, genericZero, staleTitled], new Set([1]), new Set(), 1);
    expect(stale).not.toContain(2);
    expect(stale.sort()).toEqual([3, 4]);
  });
});

/** Largest value the old int4 column held; One Piece's summed volume exceeds it. */
const INT4_MAX = BigInt(2_147_483_647);
const ONE_PIECE_VOLUME_BYTES = BigInt(2_558_355_943);

describe('ensureVolumeFileRows', () => {
  const chapters = [
    { index: 1, pageCount: 20, size: BigInt(1_300_000_000), filePath: '/lib/c001.cbz', fileName: 'c001.cbz', fileFormat: 'cbz', volume: 1, volumeId: 7, downloadStatus: 'COMPLETED' },
    { index: 2, pageCount: 22, size: BigInt(1_258_355_943), filePath: '/lib/c002.cbz', fileName: 'c002.cbz', fileFormat: 'cbz', volume: 1, volumeId: 7, downloadStatus: 'COMPLETED' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockChapter.deleteMany.mockResolvedValue({ count: 0 });
    mockChapter.create.mockResolvedValue({});
    mockChapter.update.mockResolvedValue({});
    // First call: numbered chapters. Second: file-less containers for the orphan pass.
    mockChapter.findMany.mockImplementation(async (args) => ('chapterNumber' in args.where && args.where['chapterNumber'] === null ? [] : chapters));
  });

  it('creates the row with the full summed size, above the int4 maximum, unclamped', async () => {
    mockChapter.findFirst.mockResolvedValue(null);
    await ensureVolumeFileRows(81);
    expect(mockChapter.create).toHaveBeenCalledTimes(1);
    const data = mockChapter.create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      mangaId: 81, volume: 1, index: 100_100, size: ONE_PIECE_VOLUME_BYTES, pageCount: 42, downloadStatus: 'COMPLETED',
    });
    expect(typeof data?.['size']).toBe('bigint');
    expect(ONE_PIECE_VOLUME_BYTES > INT4_MAX).toBe(true);
  });

  it('widens a row left clamped at the int4 maximum by the old column', async () => {
    mockChapter.findFirst.mockImplementation(async (args) => ('volume' in args.where
      ? { id: 500, pageCount: 42, size: INT4_MAX, filePath: null, downloadStatus: 'COMPLETED' }
      : null));
    await ensureVolumeFileRows(81);
    expect(mockChapter.update).toHaveBeenCalledTimes(1);
    expect(mockChapter.update.mock.calls[0]?.[0]).toMatchObject({ where: { id: 500 }, data: { size: ONE_PIECE_VOLUME_BYTES } });
  });

  it('stores a shared archive\'s size once, not once per chapter', async () => {
    // One Piece vol 1: eight chapter rows all point at V01.cbz and each carries its 152 MB.
    const archive = '/lib/Volumes/One Piece V01.cbz';
    const shared = [53, 24, 22].map((pageCount, i) => ({
      index: i + 1, pageCount, size: BigInt(152_387_051), filePath: archive, fileName: 'One Piece Vol 01', fileFormat: 'CBZ',
      volume: 1, volumeId: 7, downloadStatus: 'COMPLETED',
    }));
    mockChapter.findMany.mockImplementation(async (args) => ('chapterNumber' in args.where && args.where['chapterNumber'] === null ? [] : shared));
    mockChapter.findFirst.mockResolvedValue(null);
    await ensureVolumeFileRows(81);
    expect(mockChapter.create.mock.calls[0]?.[0].data).toMatchObject({ size: BigInt(152_387_051), pageCount: 99, filePath: archive });
  });

  it('is a no-op on the next run: the stored row compares equal to the summed total', async () => {
    mockChapter.findFirst.mockImplementation(async (args) => ('volume' in args.where
      ? { id: 500, pageCount: 42, size: ONE_PIECE_VOLUME_BYTES, filePath: null, downloadStatus: 'COMPLETED' }
      : null));
    await ensureVolumeFileRows(81);
    expect(mockChapter.create).not.toHaveBeenCalled();
    expect(mockChapter.update).not.toHaveBeenCalled();
  });

  it('refreshes a stale status even when pages and size are unchanged', async () => {
    mockChapter.findFirst.mockImplementation(async (args) => ('volume' in args.where
      ? { id: 500, pageCount: 42, size: ONE_PIECE_VOLUME_BYTES, filePath: null, downloadStatus: 'PENDING' }
      : null));
    await ensureVolumeFileRows(81);
    expect(mockChapter.update).toHaveBeenCalledTimes(1);
    expect(mockChapter.update.mock.calls[0]?.[0]).toMatchObject({ where: { id: 500 }, data: { downloadStatus: 'COMPLETED' } });
  });
});

describe('ensureVolumeFileRows — a refresh never manufactures a second file-backed row for a file that already has one', () => {
  const V74 = '/library/Bleach/Volumes/Bleach V74/Bleach V74.cbz';
  const numberedRow = (index: number, volume: number, filePath: string | null, downloadStatus = 'COMPLETED'): Record<string, unknown> => ({
    index, pageCount: 20, size: BigInt(1000), filePath, fileName: filePath?.split('/').pop() ?? `c${index}.cbz`, fileFormat: 'cbz',
    volume, volumeId: volume, downloadStatus,
  });
  /** Route the three findMany calls: numbered chapters, archive rows, file-less containers. */
  function mockRows(numbered: Array<Record<string, unknown>>, archiveRows: Array<{ id: number; filePath: string }>): void {
    mockChapter.findMany.mockImplementation(async (args) => {
      if (args.where['chapterNumber'] !== null) return numbered;
      return 'OR' in args.where ? [] : archiveRows;
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockChapter.deleteMany.mockResolvedValue({ count: 0 });
    mockChapter.create.mockResolvedValue({});
    mockChapter.update.mockResolvedValue({});
    mockChapter.findFirst.mockResolvedValue(null);
  });

  it('a second refresh on unchanged input does not create a row: Bleach V74.cbz already has its archive row in volume 74', async () => {
    // Four mis-numbered rows of the one archive sit in volume 75; the archive's
    // own numberless row sits in volume 74. Every refresh added another
    // file-backed V74.cbz row to volume 75 (771, 772, 773 … rows).
    mockRows([689, 695, 696, 705].map(i => numberedRow(i, 75, V74)), [{ id: 49452, filePath: V74 }]);
    await ensureVolumeFileRows(73);
    expect(mockChapter.create).not.toHaveBeenCalled();
    expect(mockChapter.update).not.toHaveBeenCalled();
  });

  it('does not turn one chapter\'s own file into a whole-volume archive row (it read as the chapter deleted and re-created)', async () => {
    // Blue Exorcist volume 10: five numbered rows, one of them downloaded.
    const rows = [numberedRow(41, 10, '/library/Blue Exorcist/c041.cbz'), ...[39, 40, 42, 43].map(i => numberedRow(i, 10, null, 'PENDING'))];
    mockRows(rows, []);
    await ensureVolumeFileRows(72);
    expect(mockChapter.create).toHaveBeenCalledTimes(1);
    expect(mockChapter.create.mock.calls[0]?.[0].data).toMatchObject({ volume: 10, filePath: null, fileName: '', downloadStatus: 'PENDING' });
  });

  it('still refreshes the archive row that is the volume\'s own', async () => {
    // A duplicate numberless row of the same archive (501) does not stop the refresh of 500.
    mockRows([1, 2, 3].map(i => numberedRow(i, 1, V74)), [{ id: 500, filePath: V74 }, { id: 501, filePath: V74 }]);
    mockChapter.findFirst.mockImplementation(async (args) => ('volume' in args.where
      ? { id: 500, pageCount: 10, size: BigInt(1000), filePath: V74, downloadStatus: 'COMPLETED' }
      : null));
    await ensureVolumeFileRows(73);
    expect(mockChapter.create).not.toHaveBeenCalled();
    expect(mockChapter.update.mock.calls[0]?.[0]).toMatchObject({ where: { id: 500 }, data: { pageCount: 60 } });
  });
});

describe('ensureVolumeFileRows — a file named for one chapter is never the volume\'s archive', () => {
  const C119 = '/library/Manga chapters/SPY x FAMILY/Chapters/Volume 17/SPY x FAMILY V17 C119.cbz';
  const numberedRow = (index: number, filePath: string | null, downloadStatus = 'COMPLETED'): Record<string, unknown> => ({
    index, pageCount: 39, size: BigInt(1000), filePath, fileName: filePath?.split('/').pop() ?? '', fileFormat: 'cbz',
    volume: 17, volumeId: 10105, downloadStatus,
  });
  /** Route the findMany calls: numbered chapters, archive rows, file-less containers. */
  function mockRows(numbered: Array<Record<string, unknown>>, archiveRows: Array<{ id: number; filePath: string }>): void {
    mockChapter.findMany.mockImplementation(async (args) => {
      if (args.where['chapterNumber'] !== null) return numbered;
      return 'OR' in args.where ? [] : archiveRows;
    });
  }
  /**
   * The volume's own row holds C119.cbz; `twin` is a file-less numberless row
   * beside it, `owner` the numbered row of chapter 119 on the same file.
   */
  function mockExisting(twin: { id: number } | null, owner: { id: number } | null = { id: 41002 }): void {
    mockChapter.findFirst.mockImplementation(async (args) => {
      if (!('volume' in args.where)) return args.where['chapterNumber'] === 119 ? owner : null;
      if (args.where['filePath'] === null) return twin;
      return { id: 47488, pageCount: 226, size: BigInt(1000), filePath: C119, downloadStatus: 'COMPLETED' };
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockChapter.deleteMany.mockResolvedValue({ count: 0 });
    mockChapter.create.mockResolvedValue({});
    mockChapter.update.mockResolvedValue({});
  });

  it('sharedArchivePath rejects a chapter file however many rows hold it, and keeps a volume archive', () => {
    expect(sharedArchivePath([{ filePath: C119 }, { filePath: C119 }, { filePath: C119 }])).toBeNull();
    const v03 = '/library/Manga chapters/One Piece/Volumes/One Piece V03.cbz';
    expect(sharedArchivePath([{ filePath: v03 }, { filePath: v03 }])).toBe(v03);
  });

  it('clears the chapter file from the volume\'s numberless row (SPY x FAMILY row 47488)', async () => {
    // Rows 119, 120.1, 123.1 all on C119.cbz, the rest of the volume pending.
    mockRows([numberedRow(119, C119), numberedRow(120, C119), numberedRow(123, C119), numberedRow(124, null, 'PENDING')], [{ id: 47488, filePath: C119 }]);
    mockExisting(null);
    await ensureVolumeFileRows(83);
    expect(mockChapter.create).not.toHaveBeenCalled();
    expect(mockChapter.update).toHaveBeenCalledTimes(1);
    expect(mockChapter.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 47488 }, data: { filePath: null, fileName: '', fileFormat: null, downloadStatus: 'PENDING' },
    });
  });

  it('leaves it when no row of its own chapter holds the file (clearing it would orphan the file)', async () => {
    mockRows([numberedRow(124, null, 'PENDING')], [{ id: 47488, filePath: C119 }]);
    mockExisting(null, null);
    await ensureVolumeFileRows(83);
    expect(mockChapter.update).not.toHaveBeenCalled();
    expect(mockChapter.create).not.toHaveBeenCalled();
  });

  it('leaves it when the volume already has its file-less row (only one may exist)', async () => {
    mockRows([numberedRow(119, C119), numberedRow(124, null, 'PENDING')], [{ id: 47488, filePath: C119 }]);
    mockExisting({ id: 9 });
    await ensureVolumeFileRows(83);
    expect(mockChapter.update).not.toHaveBeenCalled();
    expect(mockChapter.create).not.toHaveBeenCalled();
  });
});
