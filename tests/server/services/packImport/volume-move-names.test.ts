import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/server/db', () => ({ prisma: {} }));

import { pickUniqueFileName, sanitizeFileNamePart } from '@/server/services/packImport/packImportService';

describe('pickUniqueFileName', () => {
  it('gives the volume name to the first file and keeps siblings under their own names', () => {
    const used = new Set<string>();
    const names = ['Title v02 c05.cbz', 'Title v02 c06.cbz', 'Title v02 c07.cbz']
      .map((original) => pickUniqueFileName('Title V02.cbz', original, used));

    expect(names).toEqual(['Title V02.cbz', 'Title v02 c06.cbz', 'Title v02 c07.cbz']);
    expect(new Set(names).size).toBe(3);
  });

  it('numbers exact duplicates instead of overwriting', () => {
    const used = new Set<string>();
    const names = [1, 2, 3].map(() => pickUniqueFileName('Title V04.cbz', 'Title V04.cbz', used));

    expect(names).toEqual(['Title V04.cbz', 'Title V04 (2).cbz', 'Title V04 (3).cbz']);
  });

  it('treats names differing only by case as the same file', () => {
    const used = new Set<string>();
    pickUniqueFileName('Title V01.cbz', 'a.cbz', used);
    expect(pickUniqueFileName('TITLE v01.cbz', 'b.cbz', used)).toBe('b.cbz');
  });

  it('leaves distinct volumes alone', () => {
    const used = new Set<string>();
    expect(pickUniqueFileName('Title V01.cbz', 'x v01.cbz', used)).toBe('Title V01.cbz');
    expect(pickUniqueFileName('Title V02.cbz', 'x v02.cbz', used)).toBe('Title V02.cbz');
  });
});

describe('sanitizeFileNamePart', () => {
  it('removes path separators and reserved characters', () => {
    expect(sanitizeFileNamePart('Fate/stay night')).toBe('Fate stay night');
    expect(sanitizeFileNamePart('Re:Zero')).toBe('Re Zero');
    expect(sanitizeFileNamePart('What?  <Really>')).toBe('What Really');
  });

  it('never returns an empty name', () => {
    expect(sanitizeFileNamePart('///')).toBe('Untitled');
  });
});
