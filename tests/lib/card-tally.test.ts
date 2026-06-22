/**
 * @jest-environment node
 *
 * Whole-volume-aware download tally (`computeCardTally`).
 *
 * This is the trickiest part of the manga.query grid aggregate to replicate in
 * SQL, so these tests pin the JS *truth* the SQL parity harness validates
 * against. Each case maps to a row in the edge-case matrix: whole-volume
 * archives, orphan file-less containers, file-backed archives with no numbered
 * placeholders, the unassigned bucket, and partial multi-volume coverage.
 */

import { describe, it, expect } from '@jest/globals';

import { computeCardTally } from '@/components/library/utils/card-tally';

import type { CardChapter, CardTally } from '@/components/library/utils/card-tally';

const COMPLETED = 'COMPLETED';
const PENDING = 'PENDING';

function tally(chapters: CardChapter[]): CardTally {
  return computeCardTally(chapters);
}

describe('computeCardTally', () => {
  it('counts numbered chapters per volume by their own COMPLETED status (no archive)', () => {
    const chapters: CardChapter[] = [
      { chapterNumber: 1, volume: 1, downloadStatus: COMPLETED },
      { chapterNumber: 2, volume: 1, downloadStatus: COMPLETED },
      { chapterNumber: 3, volume: 1, downloadStatus: PENDING },
    ];
    expect(tally(chapters)).toEqual({ downloadedChapters: 2, totalChapters: 3, downloadedVolumes: 0, totalVolumes: 1 });
  });

  it('whole-volume archive (file-backed, COMPLETED) marks every numbered chapter in the volume downloaded', () => {
    const chapters: CardChapter[] = [
      { chapterNumber: 1, volume: 1, downloadStatus: PENDING },
      { chapterNumber: 2, volume: 1, downloadStatus: PENDING },
      { chapterNumber: 3, volume: 1, downloadStatus: PENDING },
      { chapterNumber: null, volume: 1, downloadStatus: COMPLETED, filePath: '/lib/Akira/Volumes/v01.cbz' },
    ];
    expect(tally(chapters)).toEqual({ downloadedChapters: 3, totalChapters: 3, downloadedVolumes: 1, totalVolumes: 1 });
  });

  it('orphan file-LESS container grants no coverage', () => {
    const chapters: CardChapter[] = [
      { chapterNumber: 1, volume: 1, downloadStatus: PENDING },
      { chapterNumber: 2, volume: 1, downloadStatus: PENDING },
      { chapterNumber: 3, volume: 1, downloadStatus: PENDING },
      { chapterNumber: null, volume: 1, downloadStatus: COMPLETED, filePath: null },
    ];
    expect(tally(chapters)).toEqual({ downloadedChapters: 0, totalChapters: 3, downloadedVolumes: 0, totalVolumes: 1 });
  });

  it('empty filePath also counts as file-less (no coverage)', () => {
    const chapters: CardChapter[] = [
      { chapterNumber: 1, volume: 2, downloadStatus: PENDING },
      { chapterNumber: null, volume: 2, downloadStatus: COMPLETED, filePath: '' },
    ];
    expect(tally(chapters)).toEqual({ downloadedChapters: 0, totalChapters: 1, downloadedVolumes: 0, totalVolumes: 1 });
  });

  it('file-backed archive with no numbered placeholders counts as one complete unit', () => {
    const chapters: CardChapter[] = [
      { chapterNumber: null, volume: 2, downloadStatus: COMPLETED, filePath: '/lib/Akira/Volumes/v02.cbz' },
    ];
    expect(tally(chapters)).toEqual({ downloadedChapters: 1, totalChapters: 1, downloadedVolumes: 1, totalVolumes: 1 });
  });

  it('unassigned bucket (volume null or negative) is a flat completed-count with no volume coverage', () => {
    const chapters: CardChapter[] = [
      { chapterNumber: 1, volume: null, downloadStatus: COMPLETED },
      { chapterNumber: 2, downloadStatus: PENDING },
      { chapterNumber: 3, volume: -5, downloadStatus: COMPLETED },
      { chapterNumber: 4, volume: -1, downloadStatus: PENDING },
    ];
    expect(tally(chapters)).toEqual({ downloadedChapters: 2, totalChapters: 4, downloadedVolumes: 0, totalVolumes: 0 });
  });

  it('sums across multiple volumes with mixed coverage', () => {
    const chapters: CardChapter[] = [
      // volume 1: full archive
      { chapterNumber: 1, volume: 1, downloadStatus: PENDING },
      { chapterNumber: 2, volume: 1, downloadStatus: PENDING },
      { chapterNumber: 3, volume: 1, downloadStatus: PENDING },
      { chapterNumber: null, volume: 1, downloadStatus: COMPLETED, filePath: '/lib/x/v01.cbz' },
      // volume 2: partial, no archive
      { chapterNumber: 4, volume: 2, downloadStatus: COMPLETED },
      { chapterNumber: 5, volume: 2, downloadStatus: PENDING },
    ];
    expect(tally(chapters)).toEqual({ downloadedChapters: 4, totalChapters: 5, downloadedVolumes: 1, totalVolumes: 2 });
  });

  it('decimal chapter numbers are still numbered and counted', () => {
    const chapters: CardChapter[] = [
      { chapterNumber: 49, volume: 5, downloadStatus: COMPLETED },
      { chapterNumber: 49.5, volume: 5, downloadStatus: COMPLETED },
    ];
    expect(tally(chapters)).toEqual({ downloadedChapters: 2, totalChapters: 2, downloadedVolumes: 1, totalVolumes: 1 });
  });

  it('returns all-zeros for an empty chapter set', () => {
    expect(tally([])).toEqual({ downloadedChapters: 0, totalChapters: 0, downloadedVolumes: 0, totalVolumes: 0 });
  });
});
