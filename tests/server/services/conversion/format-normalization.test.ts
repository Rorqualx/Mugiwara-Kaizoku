/**
 * @jest-environment node
 */

import { normalizeFileFormat } from '@/server/services/conversion/format-normalization';

describe('normalizeFileFormat', () => {
  it('lowercases uppercase extensions', () => {
    expect(normalizeFileFormat('CBZ')).toBe('cbz');
    expect(normalizeFileFormat('.CBZ')).toBe('cbz');
    expect(normalizeFileFormat('PDF')).toBe('pdf');
    expect(normalizeFileFormat('EPUB')).toBe('epub');
  });

  it('handles bare format codes (no dot)', () => {
    expect(normalizeFileFormat('cbz')).toBe('cbz');
    expect(normalizeFileFormat('cbr')).toBe('cbr');
    expect(normalizeFileFormat('7z')).toBe('7z');
  });

  it('handles dotted extensions', () => {
    expect(normalizeFileFormat('.cbz')).toBe('cbz');
    expect(normalizeFileFormat('.PDF')).toBe('pdf');
  });

  it('plucks extension from full filename', () => {
    expect(normalizeFileFormat('Pluto V01.cbz')).toBe('cbz');
    expect(normalizeFileFormat('chapter-1.PDF')).toBe('pdf');
    expect(normalizeFileFormat('Re:ZERO.EPUB')).toBe('epub');
    expect(normalizeFileFormat('Lookism 001.CBZ')).toBe('cbz');
  });

  it('handles multi-dot filenames (takes the last extension)', () => {
    expect(normalizeFileFormat('Title (2024) (Digital).cbz')).toBe('cbz');
  });

  it('returns null for unknown extensions', () => {
    expect(normalizeFileFormat('xyz')).toBeNull();
    expect(normalizeFileFormat('file.unknown')).toBeNull();
    expect(normalizeFileFormat('foo.txt')).toBeNull();
  });

  it('returns null for null / undefined / empty', () => {
    expect(normalizeFileFormat(null)).toBeNull();
    expect(normalizeFileFormat(undefined)).toBeNull();
    expect(normalizeFileFormat('')).toBeNull();
    expect(normalizeFileFormat('   ')).toBeNull();
  });

  it('returns null for filenames with no extension', () => {
    expect(normalizeFileFormat('README')).toBeNull();
  });

  it('covers every member of KNOWN_FILE_FORMATS', () => {
    for (const fmt of ['cbz', 'cbr', 'zip', '7z', 'cb7', 'tar', 'cbt', 'pdf', 'epub', 'mobi', 'azw3']) {
      expect(normalizeFileFormat(fmt)).toBe(fmt);
      expect(normalizeFileFormat(fmt.toUpperCase())).toBe(fmt);
      expect(normalizeFileFormat(`file.${fmt.toUpperCase()}`)).toBe(fmt);
    }
  });
});
