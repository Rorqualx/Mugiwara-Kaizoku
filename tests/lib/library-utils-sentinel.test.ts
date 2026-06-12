/**
 * @jest-environment node
 *
 * Sentinel-band filtering in the shared library-view helpers.
 *
 * Pack import creates synthetic volume rows at index/chapterNumber
 * 100000 + volumeNumber (the library scanner uses the same index band with
 * NULL chapterNumber). These rows must never surface in user-facing chapter
 * counts, latest-chapter, or progress math — Bleach's "Volume 74" row
 * rendered as "Chapters: 100074" before this filtering existed.
 */

import { describe, it, expect } from '@jest/globals';

import {
  SENTINEL_INDEX_MIN,
  isRealChapter,
  calculateProgress,
  getLatestChapterNumber,
  getDownloadStatus,
} from '@/components/library/utils/libraryUtils';

type HelperManga = Parameters<typeof calculateProgress>[0];

function chapter(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 1,
    index: 1,
    chapterNumber: 1,
    isRead: false,
    downloadStatus: 'COMPLETED',
    ...overrides,
  };
}

function manga(chapters: Array<Record<string, unknown>>): HelperManga {
  return { id: 4638, title: 'Bleach', Metadata: null, Chapter: chapters } as unknown as HelperManga;
}

// Bleach-shaped fixture: real numbered chapters + pack-import volume rows
// (chapterNumber = 100000 + vol) + a scanner volume-file row (NULL).
const bleach = manga([
  chapter({ id: 1, index: 1, chapterNumber: 1, isRead: true }),
  chapter({ id: 2, index: 2, chapterNumber: 2, isRead: true }),
  chapter({ id: 3, index: 3, chapterNumber: 686, downloadStatus: 'PENDING' }),
  chapter({ id: 4, index: 100073, chapterNumber: 100073 }),
  chapter({ id: 5, index: 100074, chapterNumber: 100074 }),
  chapter({ id: 6, index: 100200, chapterNumber: null }),
]);

describe('isRealChapter', () => {
  it('cuts at the sentinel band', () => {
    expect(isRealChapter({ index: 99999 })).toBe(true);
    expect(isRealChapter({ index: SENTINEL_INDEX_MIN })).toBe(false);
    expect(isRealChapter({ index: 100074 })).toBe(false);
  });

  it('treats legacy synthetic chapterNumbers as volume rows regardless of index', () => {
    expect(isRealChapter({ index: 100074, chapterNumber: 100074 })).toBe(false);
  });

  it('keeps real numbered chapters parked at sentinel indexes (Gantz gap stubs)', () => {
    // Gantz has real chapters (chapterNumber 0.1-978) stored at index 100007+.
    expect(isRealChapter({ index: 100092, chapterNumber: 124 })).toBe(true);
    expect(isRealChapter({ index: 100007, chapterNumber: 0.1 })).toBe(true);
  });

  it('treats NULL-chapterNumber rows in the sentinel band as volume rows', () => {
    expect(isRealChapter({ index: 100200, chapterNumber: null })).toBe(false);
    expect(isRealChapter({ index: 5, chapterNumber: null })).toBe(true);
  });
});

describe('getLatestChapterNumber', () => {
  it('ignores synthetic volume rows', () => {
    expect(getLatestChapterNumber(bleach)).toBe('686');
  });

  it('returns null when only sentinel rows exist', () => {
    const onlyVolumes = manga([chapter({ index: 100001, chapterNumber: 100001 })]);
    expect(getLatestChapterNumber(onlyVolumes)).toBeNull();
  });

  it('counts gap-chapter stubs parked at sentinel indexes', () => {
    const gantz = manga([
      chapter({ id: 1, index: 1, chapterNumber: 1 }),
      chapter({ id: 2, index: 100359, chapterNumber: 978, downloadStatus: 'PENDING' }),
      chapter({ id: 3, index: 100200, chapterNumber: null }),
    ]);
    expect(getLatestChapterNumber(gantz)).toBe('978');
    expect(getDownloadStatus(gantz)).toEqual({ downloaded: 1, total: 2, hasErrors: false });
  });
});

describe('calculateProgress', () => {
  it('excludes sentinel rows from the denominator', () => {
    // 2 read of 3 real chapters — not 2 of 6.
    expect(calculateProgress(bleach)).toBe(67);
  });

  it('returns 0 when only sentinel rows exist', () => {
    const onlyVolumes = manga([chapter({ index: 100001, chapterNumber: 100001, isRead: true })]);
    expect(calculateProgress(onlyVolumes)).toBe(0);
  });
});

describe('getDownloadStatus', () => {
  it('counts only real chapters', () => {
    expect(getDownloadStatus(bleach)).toEqual({ downloaded: 2, total: 3, hasErrors: false });
  });

  it('ignores errors on sentinel rows', () => {
    const m = manga([
      chapter({ id: 1, index: 1, chapterNumber: 1 }),
      chapter({ id: 2, index: 100001, chapterNumber: 100001, downloadStatus: 'ERROR' }),
    ]);
    expect(getDownloadStatus(m).hasErrors).toBe(false);
  });
});
