/**
 * @jest-environment node
 */
import { toFandomVolumeInputs, toWikipediaVolumeInputs, type WikipediaVolumeLike } from '../pipeline-orchestrator/volume-inputs';

function wikiVolume(extra: Record<string, unknown>, chapters: Array<string | number> = [1, 2, 3]): WikipediaVolumeLike {
  return { number: 1, chapters: chapters.map(number => ({ number })), ...extra } as WikipediaVolumeLike;
}

describe('toWikipediaVolumeInputs', () => {
  it('derives the chapter range from the lowest and highest listed chapter, ignoring unnumbered entries', () => {
    const [row] = toWikipediaVolumeInputs([wikiVolume({}, ['9', 8, 'Extra', 10.5])]);
    expect(row).toMatchObject({ number: 1, chapterStart: 8, chapterEnd: 10.5 });
    expect(row?.chapters).toHaveLength(4);
  });

  it('leaves the range out when no chapter has a number', () => {
    const [row] = toWikipediaVolumeInputs([wikiVolume({}, ['Extra'])]);
    expect(row).not.toHaveProperty('chapterStart');
    expect(row).not.toHaveProperty('chapterEnd');
  });

  it('prefers the original release date over the English one, and isbn13 over isbn', () => {
    const [row] = toWikipediaVolumeInputs([wikiVolume({
      originalReleaseDate: '2002-01-05', englishReleaseDate: '2004-06-01', releaseDate: '1999-01-01',
      isbn13: '978-4-08-873213-8', isbn: '4-08-873213-8',
    })]);
    expect(row?.releaseDate).toBe('2002-01-05');
    expect(row?.isbn).toBe('978-4-08-873213-8');
  });

  it('falls back to the English release date and the plain isbn', () => {
    const [row] = toWikipediaVolumeInputs([wikiVolume({ englishReleaseDate: '2004-06-01', isbn: '4-08-873213-8' })]);
    expect(row?.releaseDate).toBe('2004-06-01');
    expect(row?.isbn).toBe('4-08-873213-8');
  });
});

describe('toFandomVolumeInputs', () => {
  it('copies the range and semantic fields and falls back to the English isbn', () => {
    const [row] = toFandomVolumeInputs([{ number: 3, chapterStart: 17, chapterEnd: 25, isbnEn: '978-1', pageCount: 192 }]);
    expect(row).toEqual({ number: 3, chapterStart: 17, chapterEnd: 25, isbn: '978-1', pageCount: 192 });
  });

  it('keeps a volume that has no chapter range as a bare volume', () => {
    expect(toFandomVolumeInputs([{ number: 4 }])).toEqual([{ number: 4 }]);
  });
});
