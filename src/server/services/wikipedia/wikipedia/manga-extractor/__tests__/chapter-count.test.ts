/**
 * @jest-environment node
 *
 * Hardening plan 3.4 a: the list-implied chapter count added 1 "for chapter 0"
 * whether or not a chapter 0 existed, and overwrote the count the infobox
 * states.
 */
import type { WikipediaChapter, WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/types';

import { calculateAccurateChapterCount, finalizeMangaInfo } from '../best-match-finder';

const run = (from: number, to: number): WikipediaChapter[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ number: from + i, title: `T${from + i}` }));

describe('calculateAccurateChapterCount', () => {
  it('is the highest chapter number when the list starts at 1', () => {
    expect(calculateAccurateChapterCount(run(1, 247))).toBe(247);
  });

  it('adds one only when a chapter 0 is listed', () => {
    expect(calculateAccurateChapterCount(run(0, 247))).toBe(248);
    expect(calculateAccurateChapterCount([{ number: '00', title: 'Prologue' }, ...run(1, 10)])).toBe(11);
  });

  it('does not take a bonus chapter 0.5 for a chapter 0', () => {
    expect(calculateAccurateChapterCount([{ number: '0.5', title: 'Extra' }, ...run(1, 10)])).toBe(10);
  });

  it('counts epilogues on top of the regular chapters', () => {
    const chapters: WikipediaChapter[] = [...run(1, 302), { number: 'Epilogue 1', title: 'A' }, { number: 'Epilogue 2', title: 'B' }];
    expect(calculateAccurateChapterCount(chapters)).toBe(304);
  });

  it('ignores duplicates and gaps: it is a number, not a length', () => {
    expect(calculateAccurateChapterCount([...run(1, 5), ...run(4, 9), { number: 12, title: 'x' }])).toBe(12);
    expect(calculateAccurateChapterCount([])).toBe(0);
  });
});

describe('finalizeMangaInfo chapter count', () => {
  const base = { title: 'Series' } as WikipediaMangaData;

  it('keeps a stated count that goes beyond the list', () => {
    const result = finalizeMangaInfo({ ...base, chapters: 139 }, [], run(1, 100), 139);
    expect(result.chapters).toBe(139);
    expect(result.chapterList).toHaveLength(100);
  });

  it('prefers the list when the stated count falls short of it', () => {
    // Frieren: the info extractor reports 1 next to an 83-chapter list.
    expect(finalizeMangaInfo({ ...base, chapters: 1 }, [], run(1, 83), 1).chapters).toBe(83);
  });

  it('falls back to the list when no count is stated', () => {
    expect(finalizeMangaInfo(base, [], run(1, 100)).chapters).toBe(100);
    expect(finalizeMangaInfo(base, [], run(1, 100), 0).chapters).toBe(100);
  });

  it('does not treat the volume extractor\'s own tally as a stated count', () => {
    // enrichMangaData fills `chapters` from the extractor when the article
    // states none; that is the list counted another way and must not stick.
    expect(finalizeMangaInfo({ ...base, chapters: 196 }, [], run(1, 100)).chapters).toBe(100);
  });
});
