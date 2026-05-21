/**
 * @jest-environment node
 *
 * Pure-function coverage for the Chapters/Volume NN/ subdir helpers
 * introduced when the canonical library layout was widened to group
 * chapter files by volume.
 */

import path from 'path';

import {
  buildChapterDestDir,
  chapterSubdirName,
} from '@/server/services/packImport/library-path-resolver';

describe('chapterSubdirName', () => {
  it('returns "Unsorted" when volume is null', () => {
    expect(chapterSubdirName(null)).toBe('Unsorted');
  });

  it('pads single-digit volumes to two digits', () => {
    expect(chapterSubdirName(1)).toBe('Volume 01');
    expect(chapterSubdirName(7)).toBe('Volume 07');
  });

  it('leaves two-digit volumes unchanged', () => {
    expect(chapterSubdirName(20)).toBe('Volume 20');
    expect(chapterSubdirName(99)).toBe('Volume 99');
  });

  it('handles 3+ digit volumes without truncation', () => {
    expect(chapterSubdirName(100)).toBe('Volume 100');
  });

  it('treats volume 0 as a real volume (specials / prologues)', () => {
    expect(chapterSubdirName(0)).toBe('Volume 00');
  });
});

describe('buildChapterDestDir', () => {
  const chaptersDir = '/library/My Manga/Chapters';

  it('joins chaptersDir with the volume subdir', () => {
    expect(buildChapterDestDir(chaptersDir, 1)).toBe(
      path.join(chaptersDir, 'Volume 01'),
    );
  });

  it('routes null-volume chapters to Unsorted', () => {
    expect(buildChapterDestDir(chaptersDir, null)).toBe(
      path.join(chaptersDir, 'Unsorted'),
    );
  });
});
