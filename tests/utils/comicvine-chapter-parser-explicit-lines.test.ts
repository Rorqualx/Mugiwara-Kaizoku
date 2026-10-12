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

describe('parseChaptersFromDescription — "Chapter N." with a full stop', () => {
  // Bleach volume 74 as ComicVine writes it. The lines were numbered by
  // position (1-12), the running index turned that into 695-706, and a
  // series that ends at chapter 686 got chapters, stubs and a volume 75 past its end.
  const BLEACH_VOL_74 =
    '<p><em>The final battle against Yhwach gets under way.</em></p><h2>Chapter Titles</h2><ul>' +
    '<li>Chapter 675. Blood For My Bone</li><li>Chapter 676. Horn of Salvation</li>' +
    '<li>Chapter 685. The End of Flawnessness</li><li>Chapter 686. Death &amp; Strawberry</li></ul>';

  it('reads "Chapter 675. Title" by its written number, not by its position in the list', () => {
    const parsed = parseChaptersFromDescription(BLEACH_VOL_74);
    expect(parsed.map(c => c.chapterNumber)).toEqual([675, 676, 685, 686]);
    expect(parsed.every(c => c.hasRealNumber)).toBe(true);
    expect(parsed.map(c => c.title)).toEqual(['Blood For My Bone', 'Horn of Salvation', 'The End of Flawnessness', 'Death & Strawberry']);
  });

  it('keeps a decimal chapter number whole ("Chapter 520.5. Walk Under Two Letters")', () => {
    const html = '<h2>Chapter Titles</h2><ul><li>Chapter 642. Baby, Hold Your Hand 5</li><li>Chapter 520.5. Walk Under Two Letters</li></ul>';
    const parsed = parseChaptersFromDescription(html);
    expect(parsed.map(c => c.chapterNumber)).toEqual([642, 520.5]);
    expect(parsed[1]?.title).toBe('Walk Under Two Letters');
  });

  it('still reads "Chapter 1.5" followed by a colon as chapter 1.5', () => {
    const html = '<h2>Chapter Titles</h2><ul><li>Chapter 1.5: Interlude</li><li>Chapter 2: Onward</li></ul>';
    expect(parseChaptersFromDescription(html).map(c => c.chapterNumber)).toEqual([1.5, 2]);
  });
});
