/**
 * @jest-environment node
 *
 * Runtime coverage for `createMangaSafe`. TS-level enforcement is
 * verified by the type-checker — any call that omits `data.libraryPath`
 * fails `bun run type-check`. These tests confirm the runtime guards
 * for the cases TS can't catch (empty string, whitespace).
 */

import { createMangaSafe } from '@/server/services/library/manga-create-guard';

type FakePrisma = {
  manga: { create: jest.Mock };
};

function makePrisma(): FakePrisma {
  return {
    manga: { create: jest.fn().mockResolvedValue({ id: 1, title: 'X' }) },
  };
}

describe('createMangaSafe runtime guard', () => {
  it('passes through valid libraryPath', async () => {
    const p = makePrisma();
    await createMangaSafe(p as never, {
      data: { title: 'X', libraryPath: '/lib/X', source: 'local', updatedAt: new Date() } as never,
    });
    expect(p.manga.create).toHaveBeenCalledTimes(1);
  });

  it('throws on empty libraryPath at runtime', async () => {
    const p = makePrisma();
    await expect(
      createMangaSafe(p as never, {
        data: { title: 'X', libraryPath: '', source: 'local', updatedAt: new Date() } as never,
      })
    ).rejects.toThrow(/libraryPath must be a non-empty string/);
    expect(p.manga.create).not.toHaveBeenCalled();
  });

  it('throws on whitespace-only libraryPath', async () => {
    const p = makePrisma();
    await expect(
      createMangaSafe(p as never, {
        data: { title: 'X', libraryPath: '   ', source: 'local', updatedAt: new Date() } as never,
      })
    ).rejects.toThrow(/libraryPath must be a non-empty string/);
  });

  it('throws when libraryPath is not a string', async () => {
    const p = makePrisma();
    await expect(
      createMangaSafe(p as never, {
        data: { title: 'X', libraryPath: null, source: 'local', updatedAt: new Date() } as never,
      })
    ).rejects.toThrow(/libraryPath must be a non-empty string/);
  });
});
