/**
 * @jest-environment node
 *
 * Volume-file row detection in the volumeChapters table helpers.
 *
 * Unified convention: volume-file rows carry NULL chapterNumber + an index
 * in the synthetic band (>= 100000). Legacy pack-import rows mirrored the
 * offset into chapterNumber (100000 + vol) and must still be recognized.
 * Real numbered chapters can also be parked at sentinel indexes (Gantz gap
 * stubs) and must NOT be treated as volume rows.
 */

import { describe, it, expect } from '@jest/globals';

import { isVolumeEntry, getVolumeNumber, getChapterNumber } from '@/components/volumeChapters/utils';

import type { Chapter } from '@prisma/client';

function chapter(overrides: Partial<Chapter>): Chapter {
  return {
    id: 1,
    title: '',
    alternativeTitles: [],
    mangaId: 1,
    index: 1,
    downloadStatus: 'COMPLETED',
    createdAt: new Date(),
    updatedAt: new Date(),
    fileName: '',
    size: 0,
    pageCount: 0,
    pageCountAttempts: 0,
    chapterNumber: 1,
    number: null,
    pages: null,
    resolutionWidth: null,
    resolutionHeight: null,
    resolutionLabel: null,
    language: null,
    releaseDate: null,
    downloadUrl: null,
    coverImage: null,
    description: null,
    hash: null,
    mimeType: null,
    filePath: null,
    fileFormat: null,
    isRead: false,
    monitored: false,
    volume: null,
    volumeId: null,
    packDownloadId: null,
    mangadexId: null,
    suwayomiChapterId: null,
    ...overrides,
  } as Chapter;
}

describe('isVolumeEntry', () => {
  it('detects normalized pack-import volume rows (NULL chapterNumber, sentinel index)', () => {
    expect(isVolumeEntry(chapter({ index: 100074, chapterNumber: null, volume: 74 }))).toBe(true);
  });

  it('detects scanner volume-file rows (NULL chapterNumber, vol*100 index)', () => {
    expect(isVolumeEntry(chapter({ index: 100200, chapterNumber: null, volume: 2 }))).toBe(true);
  });

  it('detects legacy pack-import rows (synthetic chapterNumber)', () => {
    expect(isVolumeEntry(chapter({ index: 100074, chapterNumber: 100074, volume: 74 }))).toBe(true);
  });

  it('rejects real numbered chapters parked at sentinel indexes', () => {
    // Gantz-shaped gap stub: real chapter 124 stored at index 100092.
    expect(isVolumeEntry(chapter({ index: 100092, chapterNumber: 124, volume: 11 }))).toBe(false);
  });

  it('rejects regular chapters', () => {
    expect(isVolumeEntry(chapter({ index: 5, chapterNumber: 5 }))).toBe(false);
    expect(isVolumeEntry(chapter({ index: 5, chapterNumber: null }))).toBe(false);
  });
});

describe('getVolumeNumber', () => {
  it('reads the volume field on normalized rows', () => {
    expect(getVolumeNumber(chapter({ index: 100074, chapterNumber: null, volume: 74 }))).toBe(74);
  });

  it('decodes the legacy chapterNumber offset', () => {
    // Legacy rows may have a clobbered volume field — the offset is exact.
    expect(getVolumeNumber(chapter({ index: 100001, chapterNumber: 100001, volume: 75 }))).toBe(1);
  });
});

describe('getChapterNumber', () => {
  it('renders the real volume number for normalized volume rows', () => {
    expect(getChapterNumber(chapter({ index: 100074, chapterNumber: null, volume: 74 }))).toBe('74');
  });

  it('renders chapter numbers for sentinel-parked real chapters', () => {
    expect(getChapterNumber(chapter({ index: 100092, chapterNumber: 124, volume: 11 }))).toBe('124');
  });
});
