/**
 * @jest-environment node
 *
 * File-to-chapter auto-matching in the library scanner.
 *
 * Regression coverage for the Sakamoto Days mislink class: matching must key
 * on the canonical chapterNumber column, not the ordinal index. Gap stubs are
 * parked at ordinal indexes (a stub for chapter 200 can sit at index 191), so
 * index-keyed maps swallowed the wrong files. Also covers the volume-archive
 * clobber: once a chapter is linked to its own per-chapter file, a volume
 * archive processed later in the same batch must not re-link it.
 */

import { describe, it, expect } from '@jest/globals';

import {
  parseFileInfo,
  buildChapterMaps,
  matchFileToChapter,
  linkVolumeFileToChapters,
  processFileForLinking,
} from '@/server/services/library/scanner/chapter-creator/auto-matcher';

import type { ChapterUpdate, ChapterCreate } from '@/server/services/library/scanner/chapter-creator/types';

interface StubRow {
  id: number;
  number: number | null;
  chapterNumber: number | null;
  index: number;
  volume: number | null;
}

function stub(id: number, chapterNumber: number | null, index: number, volume: number | null): StubRow {
  return { id, number: null, chapterNumber, index, volume };
}

function fileInfoFor(filePath: string): ReturnType<typeof parseFileInfo> {
  return parseFileInfo(filePath, 0, new Map([[filePath, 1000]]));
}

describe('buildChapterMaps', () => {
  it('keys byNumber on chapterNumber, not ordinal index', () => {
    // Sakamoto Days shape: stub for chapter 200 parked at index 191.
    const maps = buildChapterMaps([stub(1, 200, 191, 22)]);
    expect(maps.byNumber.has(200)).toBe(true);
    expect(maps.byNumber.has(191)).toBe(false);
  });

  it('falls back to index when chapterNumber is NULL', () => {
    const maps = buildChapterMaps([stub(1, null, 5, null)]);
    expect(maps.byNumber.has(5)).toBe(true);
  });
});

describe('matchFileToChapter', () => {
  it('matches a chapter file to the stub with the same chapterNumber', () => {
    const maps = buildChapterMaps([stub(1, 200, 191, 22), stub(2, 201, 192, 22)]);
    const match = matchFileToChapter(fileInfoFor('/x/Sakamoto Days V20 C200.cbz'), maps);
    expect(match?.id).toBe(1);
  });

  it('does not match a file to a stub whose ordinal index merely collides', () => {
    // File c191 must NOT bind to the chapter-200 stub at index 191.
    const maps = buildChapterMaps([stub(1, 200, 191, 22)]);
    const match = matchFileToChapter(fileInfoFor('/x/Sakamoto Days V20 C191.cbz'), maps);
    expect(match).toBeNull();
  });

  it('removes the matched chapter from the by-volume map', () => {
    const maps = buildChapterMaps([stub(1, 200, 191, 22), stub(2, 201, 192, 22)]);
    matchFileToChapter(fileInfoFor('/x/Sakamoto Days V20 C200.cbz'), maps);
    const volumeLinks = linkVolumeFileToChapters(fileInfoFor('/x/Sakamoto Days V22.cbz'), maps.byVolume);
    expect(volumeLinks.map((c) => c.id)).toEqual([2]);
  });
});

describe('processFileForLinking', () => {
  it('per-chapter file wins over a later volume archive for the same chapter', () => {
    const maps = buildChapterMaps([stub(1, 200, 191, 22), stub(2, 201, 192, 22)]);
    const updates: ChapterUpdate[] = [];
    const creates: ChapterCreate[] = [];

    processFileForLinking(fileInfoFor('/x/Sakamoto Days V20 C200.cbz'), 4892, maps, updates, creates);
    processFileForLinking(fileInfoFor('/x/Sakamoto Days V20 C201.cbz'), 4892, maps, updates, creates);
    processFileForLinking(fileInfoFor('/x/Sakamoto Days V22.cbz'), 4892, maps, updates, creates);

    // Both stubs link to their per-chapter files exactly once; the volume
    // archive finds no pending chapters left and creates nothing for them.
    expect(updates).toHaveLength(2);
    expect(updates[0]?.id).toBe(1);
    expect(updates[0]?.fileName).toBe('Sakamoto Days V20 C200.cbz');
    expect(updates[1]?.id).toBe(2);
    expect(updates[1]?.fileName).toBe('Sakamoto Days V20 C201.cbz');
  });

  it('creates a new numbered chapter row when no stub matches', () => {
    const maps = buildChapterMaps([]);
    const updates: ChapterUpdate[] = [];
    const creates: ChapterCreate[] = [];

    processFileForLinking(fileInfoFor('/x/Sakamoto Days V26 C251.cbz'), 4892, maps, updates, creates);

    expect(updates).toHaveLength(0);
    expect(creates).toHaveLength(1);
    expect(creates[0]?.chapterNumber).toBe(251);
    expect(creates[0]?.volume).toBe(26);
    expect(creates[0]?.index).toBe(251);
  });
});
