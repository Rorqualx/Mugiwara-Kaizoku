/**
 * @jest-environment node
 *
 * Unit coverage for the cross-manga filePath guard.
 */

import { validateChapterFilePath, assertChapterFilePathOwned } from '@/server/services/library/chapter-path-guard';

type FakePrisma = {
  manga: {
    findUnique: jest.Mock<Promise<{ libraryPath: string | null } | null>, unknown[]>;
  };
};

function makePrisma(libraryPath: string | null | undefined): FakePrisma {
  return {
    manga: {
      findUnique: jest.fn().mockResolvedValue(
        libraryPath === undefined ? null : { libraryPath },
      ),
    },
  };
}

describe('validateChapterFilePath', () => {
  it('returns ok when filePath is null (no path to validate)', async () => {
    const p = makePrisma('/lib/Manga A');
    const v = await validateChapterFilePath(p as never, 1, null);
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('ok');
  });

  it('returns ok when filePath starts with manga.libraryPath', async () => {
    const p = makePrisma('/lib/Manga A');
    const v = await validateChapterFilePath(p as never, 1, '/lib/Manga A/Chapters/Volume 01/x.cbz');
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('ok');
  });

  it('flags cross-manga: filePath under a different manga\'s dir', async () => {
    const p = makePrisma('/lib/Manga A');
    const v = await validateChapterFilePath(p as never, 1, '/lib/Manga B/Chapters/Volume 01/x.cbz');
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('cross-manga');
    expect(v.expectedPrefix).toBe('/lib/Manga A');
  });

  it('soft-fails when manga.libraryPath is null (warn-only)', async () => {
    const p = makePrisma(null);
    const v = await validateChapterFilePath(p as never, 1, '/wherever/file.cbz');
    expect(v.ok).toBe(true);
    expect(v.reason).toBe('libpath-null');
  });

  it('rejects when the manga row is missing entirely', async () => {
    const p = makePrisma(undefined);
    const v = await validateChapterFilePath(p as never, 999, '/lib/file.cbz');
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('manga-missing');
  });
});

describe('assertChapterFilePathOwned', () => {
  it('throws on cross-manga violation with the tag in the message', async () => {
    const p = makePrisma('/lib/Manga A');
    await expect(
      assertChapterFilePathOwned(p as never, 1, '/lib/Manga B/foo.cbz', 'linkVolumeChapters')
    ).rejects.toThrow(/linkVolumeChapters.*does not belong to manga 1/);
  });

  it('does not throw on a valid filePath', async () => {
    const p = makePrisma('/lib/Manga A');
    await expect(
      assertChapterFilePathOwned(p as never, 1, '/lib/Manga A/Chapters/Unsorted/x.cbz', 'tag')
    ).resolves.toBeUndefined();
  });

  it('does not throw when filePath is null', async () => {
    const p = makePrisma('/lib/Manga A');
    await expect(
      assertChapterFilePathOwned(p as never, 1, null, 'tag')
    ).resolves.toBeUndefined();
  });

  it('does not throw when libraryPath is null (soft mode)', async () => {
    const p = makePrisma(null);
    await expect(
      assertChapterFilePathOwned(p as never, 1, '/wherever/file.cbz', 'tag')
    ).resolves.toBeUndefined();
  });
});
