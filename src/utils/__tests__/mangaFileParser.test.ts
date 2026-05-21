import { describe, it, expect } from '@jest/globals';

import { MangaFileParser, type ParsedMangaInfo } from '../parsers/mangaFileParser';

function fakeParsed(cleanTitle: string): ParsedMangaInfo {
  return { original: cleanTitle, title: cleanTitle, cleanTitle };
}

describe('MangaFileParser', () => {
  describe('cleanExtractedTitle (via parse)', () => {
    it('returns empty title when nothing remains after stripping vol/ch/year', () => {
      // Filename like `Volume 01.cbz` strips the volume token → empty body.
      const parsed = MangaFileParser.parse('Volume 01.cbz');
      expect(parsed.cleanTitle).toBe('Volume');
      expect(parsed.volume).toBe(1);
    });

    it('does not emit the literal "Unknown" string for unparseable filenames', () => {
      // The historical 'Unknown' sentinel must no longer be returned.
      const parsed = MangaFileParser.parse('(2020).cbz');
      expect(parsed.cleanTitle).not.toBe('Unknown');
      expect(parsed.title).not.toBe('Unknown');
    });

    it('keeps a real series title intact', () => {
      const parsed = MangaFileParser.parse('Naruto V01 C001.cbz');
      expect(parsed.cleanTitle).toBe('Naruto');
    });
  });

  describe('extractConsistentTitle', () => {
    it('rejects "Volume" / "Volumes" as a consensus title', () => {
      const files = [fakeParsed('Volume'), fakeParsed('Volume'), fakeParsed('Volume')];
      expect(MangaFileParser.extractConsistentTitle(files)).toBeNull();

      const files2 = [fakeParsed('Volumes'), fakeParsed('Volumes')];
      expect(MangaFileParser.extractConsistentTitle(files2)).toBeNull();
    });

    it('rejects "Chapter" / "Chapters" / "Tome" / "Part" / "Book" placeholders', () => {
      for (const placeholder of ['Chapter', 'Chapters', 'Tome', 'Tomes', 'Part', 'Parts', 'Book', 'Books']) {
        const files = [fakeParsed(placeholder), fakeParsed(placeholder), fakeParsed(placeholder)];
        expect(MangaFileParser.extractConsistentTitle(files)).toBeNull();
      }
    });

    it('rejects the legacy "Unknown" sentinel', () => {
      const files = [fakeParsed('Unknown'), fakeParsed('Unknown'), fakeParsed('Unknown')];
      expect(MangaFileParser.extractConsistentTitle(files)).toBeNull();
    });

    it('is case-insensitive about placeholders', () => {
      const files = [fakeParsed('VOLUMES'), fakeParsed('volumes'), fakeParsed('Volumes')];
      expect(MangaFileParser.extractConsistentTitle(files)).toBeNull();
    });

    it('returns a real series title when the consensus is genuine', () => {
      const files = [fakeParsed('Naruto'), fakeParsed('Naruto'), fakeParsed('Naruto')];
      expect(MangaFileParser.extractConsistentTitle(files)).toBe('Naruto');
    });

    it('still returns null on empty input', () => {
      expect(MangaFileParser.extractConsistentTitle([])).toBeNull();
    });
  });
});
