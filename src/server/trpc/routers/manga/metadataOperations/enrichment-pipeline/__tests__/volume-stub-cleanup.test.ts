/**
 * @jest-environment node
 *
 * Guards the volume file-stub cleanup: empty file-backed rows that duplicate a numbered chapter's
 * whole-volume archive are pruned (they inflate the CHAPTERS + PAGES badges), real omake/extras are
 * preserved, and pack-download rows are never touched. Also guards the mis-stamped page-count
 * repair that strips the whole-archive count off rows that are really a slice.
 */
import {
  selectVolumeFileStubsToDelete,
  isMisStampedArchiveCount,
  correctedSlicePageCount,
} from '../phase-volume-stub-cleanup';

interface StubRow {
  id: number;
  chapterNumber: number | null;
  title: string | null;
  filePath: string | null;
  packDownloadId: bigint | null;
  index: number;
}

const numbered = (id: number, ch: number, title: string, file: string, index: number): StubRow =>
  ({ id, chapterNumber: ch, title, filePath: file, packDownloadId: null, index });
const stub = (id: number, file: string | null, index: number, title: string | null = null): StubRow =>
  ({ id, chapterNumber: null, title, filePath: file, packDownloadId: null, index });

describe('selectVolumeFileStubsToDelete', () => {
  it('deletes empty file-backed stubs that duplicate a numbered chapter archive (Dorohedoro vol 20)', () => {
    const chapters: StubRow[] = [
      numbered(1, 128, 'Last-Ditch Resurrection', 'v20.zip', 255),
      numbered(2, 137, 'Maze Trail', 'v20.zip', 273),
      numbered(3, 137.5, 'Bonus Curse', 'v20.zip', 343), // real omake — titled, numbered
      stub(11, 'v20.zip', 345),
      stub(12, 'v20.zip', 347),
      stub(13, 'v20.zip', 349),
    ];
    const numberedPaths = new Set(['v20.zip']);
    expect(selectVolumeFileStubsToDelete(chapters, numberedPaths).sort((a, b) => a - b)).toEqual([11, 12, 13]);
  });

  it('preserves a titled omake even when its chapterNumber is null', () => {
    const chapters: StubRow[] = [
      numbered(1, 100, 'Real Chapter', 'v10.zip', 1),
      stub(2, 'v10.zip', 2, 'Bonus Curse'), // titled → not a stub
      stub(3, 'v10.zip', 3, '   '),          // whitespace title → stub
    ];
    expect(selectVolumeFileStubsToDelete(chapters, new Set(['v10.zip']))).toEqual([3]);
  });

  it('keeps exactly one volume-file row per filePath when no numbered chapter covers it', () => {
    const chapters: StubRow[] = [
      stub(1, 'v05.zip', 30),
      stub(2, 'v05.zip', 31),
      stub(3, 'v05.zip', 32),
    ];
    // no numbered chapters → keep the lowest-index row (id 1), delete the rest
    expect(selectVolumeFileStubsToDelete(chapters, new Set()).sort((a, b) => a - b)).toEqual([2, 3]);
  });

  it('never deletes pack-download rows', () => {
    const chapters: StubRow[] = [
      numbered(1, 6, 'Ch', 'v06.zip', 1),
      { id: 2, chapterNumber: null, title: null, filePath: 'v06.zip', packDownloadId: 373n, index: 2 },
    ];
    expect(selectVolumeFileStubsToDelete(chapters, new Set(['v06.zip']))).toEqual([]);
  });

  it('ignores rows with no file (handled by the Chapter_one_null_per_volume index)', () => {
    const chapters: StubRow[] = [stub(1, null, 1), stub(2, null, 2)];
    expect(selectVolumeFileStubsToDelete(chapters, new Set())).toEqual([]);
  });
});

describe('isMisStampedArchiveCount', () => {
  it('flags a count claiming ~the whole archive on a shared archive (omake 255 in a 254-page vol)', () => {
    expect(isMisStampedArchiveCount(255, 254, 11)).toBe(true);
    expect(isMisStampedArchiveCount(348, 354, 18)).toBe(true); // numbered ch 163 also mis-stamped
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
