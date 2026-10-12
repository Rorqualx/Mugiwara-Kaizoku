/**
 * @jest-environment node
 *
 * A refresh of "Why Does Nobody Remember Me in this World" (finished, 14
 * volumes, 66 chapters) deleted the seven pending rows of "Vol 14
 * (placeholder)" (chapters 60-66, which MangaDex does not list), re-created
 * them under new ids with no volume, dropped volume 14 and tagged the new
 * rows as unassigned overflow (volume -1) past volume 13.
 */
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@/server/db', () => ({ prisma: {} }));

import { findStaleChapterIds, isWithinSeriesCount, type StaleSweepRow } from '../phase-db-persistence/stale-chapter-sweep';
import { finishedSeriesChapterCount, isTaggableOverflow } from '../phase-volume-overflow';
import { isWithinStoredVolumeCount, selectEmptyPhantomVolumeIds } from '../phase-volume-phantom-prune';
import { planWithinCountRestore } from '../volume-snapshot';

const NO_USER_DATA = { chapterFiles: 0, ReadingProgress: 0, ReaderBookmark: 0, ReadingHistory: 0, WantedItem: 0, NativeDownload: 0 };

function pending(id: number, chapterNumber: number, over: Partial<StaleSweepRow> = {}): StaleSweepRow {
  return {
    id, index: id, chapterNumber, filePath: null, downloadStatus: 'PENDING', title: `Chapter ${chapterNumber}`,
    volume: 14, packDownloadId: null, _count: NO_USER_DATA, ...over,
  };
}

/** MangaDex lists chapters 1-59 of a 66-chapter series. */
const PROVIDER_1_TO_59 = new Set(Array.from({ length: 59 }, (_, i) => i + 1));

describe('stale-chapter sweep — rows the provider does not list but the series counts are kept in place', () => {
  const vol14 = [60, 61, 62, 63, 64, 65, 66].map((n, i) => pending(48745 + i, n));

  it('does not delete pending chapters 60-66 of a 66-chapter series that the provider list stops short of', () => {
    expect(findStaleChapterIds(vol14, PROVIDER_1_TO_59, new Set(), 59, 66)).toEqual([]);
  });

  it('still deletes an unlisted pending row numbered past the series count', () => {
    const past = pending(9001, 70, { volume: null });
    expect(findStaleChapterIds([...vol14, past], PROVIDER_1_TO_59, new Set(), 59, 66)).toEqual([9001]);
  });

  it('never deletes an unlisted numbered row that carries a wanted item or a native download', () => {
    const wanted = pending(9002, 80, { volume: null, _count: { ...NO_USER_DATA, WantedItem: 1 } });
    const downloading = pending(9003, 81, { volume: null, _count: { ...NO_USER_DATA, NativeDownload: 1 } });
    expect(findStaleChapterIds([wanted, downloading], PROVIDER_1_TO_59, new Set(), 59, 66)).toEqual([]);
  });

  it('keeps the old behaviour when the series count is unknown', () => {
    expect(findStaleChapterIds(vol14, PROVIDER_1_TO_59, new Set(), 59).sort()).toEqual(vol14.map(r => r.id));
  });

  it('counts 1..N as the series, nothing else', () => {
    expect(isWithinSeriesCount(66, 66)).toBe(true);
    expect(isWithinSeriesCount(67, 66)).toBe(false);
    expect(isWithinSeriesCount(0, 66)).toBe(false);
    expect(isWithinSeriesCount(5, 0)).toBe(false);
  });
});

describe('phantom prunes — a volume numbered within the stored volume count is never a phantom', () => {
  it('does not remove an empty "Vol 14 (placeholder)" of a 14-volume series', () => {
    expect(selectEmptyPhantomVolumeIds([{ id: 9288, number: 14, title: 'Vol 14 (placeholder)' }], 14, 14)).toEqual([]);
  });

  it('still removes an empty placeholder or an empty volume numbered past the count', () => {
    const empties = [
      { id: 1, number: 15, title: 'Vol 15 (placeholder)' },
      { id: 2, number: 16, title: null },
      { id: 3, number: 3, title: null },
    ];
    expect(selectEmptyPhantomVolumeIds(empties, 14, 14)).toEqual([1, 2]);
  });

  it('removes an empty placeholder when the volume count is unknown, as before', () => {
    expect(selectEmptyPhantomVolumeIds([{ id: 7, number: 2, title: 'Vol 2 (placeholder)' }], 0, 0)).toEqual([7]);
  });

  it('treats 1..count as the stored volumes', () => {
    expect(isWithinStoredVolumeCount(14, 14)).toBe(true);
    expect(isWithinStoredVolumeCount(15, 14)).toBe(false);
    expect(isWithinStoredVolumeCount(0, 14)).toBe(false);
  });
});

describe('volume rebuild — a volume within the stored count that no provider rebuilds is put back', () => {
  const rebuilt = [
    { number: 12, chapterStart: 27, chapterEnd: 30.3 },
    { number: 13, chapterStart: 48, chapterEnd: 59 },
  ];

  it('restores "Vol 14 (placeholder)" (60-66) of a 14-volume, 66-chapter series after a rebuild that stops at volume 13', () => {
    const snapshot = [...rebuilt, { number: 14, chapterStart: 60, chapterEnd: 66 }];
    expect(planWithinCountRestore(snapshot, rebuilt, 14, 66)).toEqual([14]);
  });

  it('does not restore a volume numbered past the count, covering chapters past the count, or overlapping a rebuilt range', () => {
    const snapshot = [
      { number: 15, chapterStart: 67, chapterEnd: 70 },
      { number: 14, chapterStart: 60, chapterEnd: 80 },
    ];
    expect(planWithinCountRestore(snapshot, rebuilt, 14, 66)).toEqual([]);
    expect(planWithinCountRestore([{ number: 14, chapterStart: 55, chapterEnd: 66 }], rebuilt, 14, 66)).toEqual([]);
  });

  it('restores nothing when the counts are unknown', () => {
    expect(planWithinCountRestore([{ number: 14, chapterStart: 60, chapterEnd: 66 }], rebuilt, 0, 66)).toEqual([]);
  });
});

describe('overflow tagging — a finished series\' own chapters are never tagged unassigned (-1)', () => {
  it('does not tag chapters 60-66 of a finished 66-chapter series past a last volume ending at 59', () => {
    const finished = finishedSeriesChapterCount('COMPLETED', false, 66);
    expect(finished).toBe(66);
    expect([60, 63, 66].some(n => isTaggableOverflow(n, finished))).toBe(false);
    expect(isTaggableOverflow(67, finished)).toBe(true);
  });

  it('tags overflow of a running series as before', () => {
    const running = finishedSeriesChapterCount('ONGOING', false, 66);
    expect(running).toBeNull();
    expect(isTaggableOverflow(60, running)).toBe(true);
  });

  it('treats an end date as finished and an unknown count as no bound', () => {
    expect(finishedSeriesChapterCount('ONGOING', true, 120)).toBe(120);
    expect(finishedSeriesChapterCount('COMPLETED', false, null)).toBeNull();
    expect(isTaggableOverflow(null, 66)).toBe(false);
  });
});
