/**
 * @jest-environment node
 *
 * Guards the volume file-stub cleanup: duplicate volume-file rows (empty file-backed compilation
 * entries) are deduped to ONE per archive, real omake/extras + numbered chapters are preserved,
 * pack-download rows are never touched, the mis-stamped page-count repair fixes real chapters while
 * leaving the kept volume-file row, and that kept row is stamped with the volume's canonical pages.
 */
import {
  selectVolumeFileStubsToDelete,
  isMisStampedArchiveCount,
  correctedSlicePageCount,
  planPageCountRepairs,
  planVolumeFilePageStamps,
  type PageCountRepair,
} from '../phase-volume-stub-cleanup';

interface StubRow {
  id: number;
  chapterNumber: number | null;
  title: string | null;
  filePath: string | null;
  packDownloadId: bigint | null;
  index: number;
}
interface VolRow extends StubRow {
  volumeId: number | null;
  pageCount: number | null;
  pages: number | null;
}

const numbered = (id: number, ch: number, title: string, file: string, index: number): StubRow =>
  ({ id, chapterNumber: ch, title, filePath: file, packDownloadId: null, index });
const stub = (id: number, file: string | null, index: number, title: string | null = null): StubRow =>
  ({ id, chapterNumber: null, title, filePath: file, packDownloadId: null, index });
const vrow = (o: {
  id: number; chapterNumber: number | null; file: string; volumeId: number;
  pageCount: number | null; pages: number | null; index: number;
}): VolRow => ({
  id: o.id, chapterNumber: o.chapterNumber, title: o.chapterNumber === null ? '' : 'T',
  filePath: o.file, packDownloadId: null, index: o.index,
  volumeId: o.volumeId, pageCount: o.pageCount, pages: o.pages,
});

describe('selectVolumeFileStubsToDelete', () => {
  it('keeps one volume-file row per archive and deletes the duplicates (Dorohedoro vol 20)', () => {
    const chapters: StubRow[] = [
      numbered(1, 128, 'Last-Ditch Resurrection', 'v20.zip', 255),
      numbered(2, 137, 'Maze Trail', 'v20.zip', 273),
      numbered(3, 137.5, 'Bonus Curse', 'v20.zip', 343),
      stub(11, 'v20.zip', 345),
      stub(12, 'v20.zip', 347),
      stub(13, 'v20.zip', 349),
    ];
    expect(selectVolumeFileStubsToDelete(chapters).sort((a, b) => a - b)).toEqual([12, 13]);
  });

  it('preserves a titled omake and keeps a lone volume-file row', () => {
    const chapters: StubRow[] = [
      numbered(1, 100, 'Real Chapter', 'v10.zip', 1),
      stub(2, 'v10.zip', 2, 'Bonus Curse'),
      stub(3, 'v10.zip', 3, '   '),
    ];
    expect(selectVolumeFileStubsToDelete(chapters)).toEqual([]);
  });

  it('keeps exactly one volume-file row per filePath, deletes the rest', () => {
    const chapters: StubRow[] = [
      stub(1, 'v05.zip', 30),
      stub(2, 'v05.zip', 31),
      stub(3, 'v05.zip', 32),
    ];
    expect(selectVolumeFileStubsToDelete(chapters).sort((a, b) => a - b)).toEqual([2, 3]);
  });

  it('never deletes pack-download rows even when duplicated', () => {
    const chapters: StubRow[] = [
      { id: 1, chapterNumber: null, title: null, filePath: 'v06.zip', packDownloadId: 373n, index: 1 },
      { id: 2, chapterNumber: null, title: null, filePath: 'v06.zip', packDownloadId: 374n, index: 2 },
    ];
    expect(selectVolumeFileStubsToDelete(chapters)).toEqual([]);
  });

  it('ignores rows with no file (handled by the Chapter_one_null_per_volume index)', () => {
    const chapters: StubRow[] = [stub(1, null, 1), stub(2, null, 2)];
    expect(selectVolumeFileStubsToDelete(chapters)).toEqual([]);
  });
});

describe('isMisStampedArchiveCount', () => {
  it('flags a count claiming ~the whole archive on a shared archive (omake 255 in a 254-page vol)', () => {
    expect(isMisStampedArchiveCount(255, 254, 11)).toBe(true);
    expect(isMisStampedArchiveCount(348, 354, 18)).toBe(true);
  });
  it('leaves real per-chapter slice counts alone', () => {
    expect(isMisStampedArchiveCount(27, 254, 11)).toBe(false);
  });
  it('never flags a single-file volume (the lone row legitimately owns the whole count)', () => {
    expect(isMisStampedArchiveCount(254, 254, 1)).toBe(false);
  });
  it('returns false for missing/invalid inputs', () => {
    expect(isMisStampedArchiveCount(null, 254, 11)).toBe(false);
    expect(isMisStampedArchiveCount(255, null, 11)).toBe(false);
    expect(isMisStampedArchiveCount(255, 0, 11)).toBe(false);
  });
});

describe('correctedSlicePageCount', () => {
  it('uses the provider per-chapter pages value when present', () => {
    expect(correctedSlicePageCount(25)).toBe(25);
  });
  it('returns null (unknown) when pages is missing or non-positive', () => {
    expect(correctedSlicePageCount(null)).toBeNull();
    expect(correctedSlicePageCount(0)).toBeNull();
  });
});

describe('planPageCountRepairs', () => {
  it('repairs real chapters stamped with the whole-archive count but leaves the volume-file row', () => {
    const vpc = new Map<number, number | null>([[200, 254]]);
    const chapters: VolRow[] = [
      vrow({ id: 1, chapterNumber: 128, file: 'v20.zip', volumeId: 200, pageCount: 27, pages: 27, index: 255 }),
      vrow({ id: 2, chapterNumber: 137.5, file: 'v20.zip', volumeId: 200, pageCount: 255, pages: 25, index: 343 }),
      vrow({ id: 3, chapterNumber: null, file: 'v20.zip', volumeId: 200, pageCount: 255, pages: 25, index: 345 }),
    ];
    const out: PageCountRepair[] = planPageCountRepairs(chapters, vpc);
    expect(out).toEqual([{ id: 2, pageCount: 25 }]);
  });

  it('skips repair when the chapter does not share its archive (single-file volume)', () => {
    const vpc = new Map<number, number | null>([[201, 200]]);
    const chapters: VolRow[] = [
      vrow({ id: 1, chapterNumber: 5, file: 'c5.cbz', volumeId: 201, pageCount: 200, pages: null, index: 5 }),
    ];
    expect(planPageCountRepairs(chapters, vpc)).toEqual([]);
  });
});

describe('planVolumeFilePageStamps', () => {
  it('stamps the kept volume-file row with the volume canonical page count (vol 23: 24 -> 354)', () => {
    const vpc = new Map<number, number | null>([[223, 354]]);
    const chapters: VolRow[] = [
      vrow({ id: 1, chapterNumber: 156, file: 'v23.zip', volumeId: 223, pageCount: 25, pages: 24, index: 321 }),
      vrow({ id: 2, chapterNumber: null, file: 'v23.zip', volumeId: 223, pageCount: 24, pages: 24, index: 317 }),
    ];
    expect(planVolumeFilePageStamps(chapters, new Set(), vpc)).toEqual([{ id: 2, pageCount: 354 }]);
  });

  it('skips a row already correct and a row being deleted', () => {
    const vpc = new Map<number, number | null>([[223, 354]]);
    const chapters: VolRow[] = [
      vrow({ id: 1, chapterNumber: 156, file: 'v23.zip', volumeId: 223, pageCount: 25, pages: 24, index: 321 }),
      vrow({ id: 2, chapterNumber: null, file: 'v23.zip', volumeId: 223, pageCount: 354, pages: 24, index: 317 }),
      vrow({ id: 3, chapterNumber: null, file: 'v23.zip', volumeId: 223, pageCount: 99, pages: 24, index: 318 }),
    ];
    expect(planVolumeFilePageStamps(chapters, new Set([3]), vpc)).toEqual([]);
  });
});
