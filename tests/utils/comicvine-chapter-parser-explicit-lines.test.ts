/**
 * @jest-environment node
 *
 * Guards ComicVine description parsing against headings the parser does not
 * know: Frieren volumes 11-14 use "Chapters Titles" (extra s), which made each
 * volume parse as a single chapter and collapsed its range to one chapter.
 */
import { parseChaptersFromDescription } from '@/utils/comicvine-chapter-parser';

jest.mock('@/utils/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const FRIEREN_VOL_11 =
  '<p><em>Frieren has broken the curse of Diagoldze and released herself and Denken.</em></p>' +
  '<h2>Chapters Titles</h2><ul>' +
  '<li>Chapter 98: Retribution</li><li>Chapter 99: Offense and Defense</li>' +
  '<li>Chapter 100: The Fundamentals of Mages</li><li>Chapter 101: The Breakthrough</li>' +
  '<li>Chapter 102: A Promise</li></ul>';

describe('parseChaptersFromDescription — unrecognised headings', () => {
  it('reads every chapter under the heading "Chapters Titles" (Frieren volume 11 parsed as one chapter)', () => {
    const parsed = parseChaptersFromDescription(FRIEREN_VOL_11);
    expect(parsed.map(c => c.chapterNumber)).toEqual([98, 99, 100, 101, 102]);
    expect(parsed.every(c => c.hasRealNumber)).toBe(true);
    expect(parsed[1]?.title).toBe('Offense and Defense');
  });

  it('accepts every "Chapter N:" line when the heading is one the parser does not know', () => {
    const html = '<h2>In this volume</h2><ul>' +
      '<li>Chapter 128: Magic Special Forces</li><li>Chapter 129: Shadow of the Empire</li>' +
      '<li>Chapter 130: Beneath the Water\'s Surface</li></ul>';
    expect(parseChaptersFromDescription(html).map(c => c.chapterNumber)).toEqual([128, 129, 130]);
  });

  it('accepts "Chapter N:" lines with no heading at all', () => {
    const html = '<p>Chapter 1: The Journey\'s End</p><p>Chapter 2: The Priest\'s Lie</p><p>Chapter 3: Blue Moonweed</p>';
    expect(parseChaptersFromDescription(html).map(c => c.chapterNumber)).toEqual([1, 2, 3]);
  });

  it('does not read prose that merely starts with "Chapter N" as a chapter line', () => {
    const html = '<p>Chapter 1: The Journey\'s End</p><p>Chapter 2 concludes the opening arc.</p>';
    expect(parseChaptersFromDescription(html).map(c => c.chapterNumber)).toEqual([1]);
  });

  it('does not list the same chapter number twice', () => {
    const html = '<p>Chapter 5: Killing Magic</p><p>Chapter 5: Killing Magic</p><p>Chapter 6: The Village Hero</p>';
    expect(parseChaptersFromDescription(html).map(c => c.chapterNumber)).toEqual([5, 6]);
  });
});
