/**
 * @jest-environment node
 *
 * Guards the extras-loop DH1 dedup: overflow-integer duplicates / misnumbered extras are removed
 * so they can't inflate the chapter count into phantom `reconciliation` volumes — while decimals,
 * in-range chapters, and genuine beyond-scalar chapters survive untouched.
 */
import { suppressOverflowDuplicateExtras } from '../phase-chapter-reconciliation';

import type { ChapterDataItem } from '../types';

const EXPECTED = 167; // Dorohedoro: AniList 167 chapters

function numbers(items: ChapterDataItem[]): number[] {
  return items.map(i => i.number).sort((a, b) => a - b);
}

describe('suppressOverflowDuplicateExtras', () => {
  it('drops an overflow integer that exactly duplicates a non-overflow title', () => {
    const input: ChapterDataItem[] = [
      { number: 6.1, title: 'Extra Evil', volume: 1 },   // canonical decimal omake
      { number: 167, title: 'Goodbye All Stars!' },
      { number: 169, title: 'Extra Evil', volume: 24 },  // re-listed duplicate
    ];
    expect(numbers(suppressOverflowDuplicateExtras(input, EXPECTED))).toEqual([6.1, 167]);
  });

  it('drops an overflow integer whose title is bonus/extra-marked even without an exact match', () => {
    const input: ChapterDataItem[] = [
      { number: 156.5, title: 'Lizard-head Kaiman and the magic seedling', volume: 23 },
      { number: 179, title: 'Special Chapter: The Lizard Head and the Magic Whistle', volume: 24 },
    ];
    expect(numbers(suppressOverflowDuplicateExtras(input, EXPECTED))).toEqual([156.5]);
  });

  it('keeps a genuine beyond-scalar chapter with an ordinary unique title', () => {
    const input: ChapterDataItem[] = [
      { number: 167, title: 'Goodbye All Stars!' },
      { number: 168, title: 'A Brand New Arc Begins' }, // AniList undercount — real chapter
    ];
    expect(numbers(suppressOverflowDuplicateExtras(input, EXPECTED))).toEqual([167, 168]);
  });

  it('never touches decimals, even bonus-titled ones above the count', () => {
    const input: ChapterDataItem[] = [
      { number: 167, title: 'Goodbye All Stars!' },
      { number: 167.75, title: 'Ma No Omake: Special Episode', volume: 23 }, // decimal bonus — keep
    ];
    expect(numbers(suppressOverflowDuplicateExtras(input, EXPECTED))).toEqual([167, 167.75]);
  });

  it('never touches chapters within the declared count', () => {
    const input: ChapterDataItem[] = [
      { number: 50, title: 'Extra Evil' }, // bonus-titled but in-range → keep
      { number: 167, title: 'Goodbye All Stars!' },
    ];
    expect(numbers(suppressOverflowDuplicateExtras(input, EXPECTED))).toEqual([50, 167]);
  });

  it('is a no-op when the expected count is not trusted (<= 0)', () => {
    const input: ChapterDataItem[] = [
      { number: 169, title: 'Extra Evil' },
      { number: 200, title: 'Bonus' },
    ];
    expect(numbers(suppressOverflowDuplicateExtras(input, 0))).toEqual([169, 200]);
  });

  it('drops an overflow finale whose title is a superset of an in-range chapter title', () => {
    // Attack on Titan: ch 139 "Toward the Tree on That Hill" is the real finale;
    // a source re-lists it as overflow ch 144 "Final Episode: Toward the Tree on
    // That Hill". The prefix means it is not an EXACT duplicate, so the superset
    // rule must catch it.
    const input: ChapterDataItem[] = [
      { number: 139, title: 'Toward the Tree on That Hill' },
      { number: 144, title: 'Final Episode: Toward the Tree on That Hill' },
    ];
    expect(numbers(suppressOverflowDuplicateExtras(input, 139))).toEqual([139]);
  });

  it('does not superset-drop on a short/single-word in-range title', () => {
    // Guard against coincidental matches: "Titans" (an in-range title) must not
    // cause a longer overflow title that happens to contain it to be dropped.
    const input: ChapterDataItem[] = [
      { number: 137, title: 'Titans' },
      { number: 168, title: 'The Last Titans Standing' }, // real beyond-scalar chapter
    ];
    expect(numbers(suppressOverflowDuplicateExtras(input, 139))).toEqual([137, 168]);
  });
});
