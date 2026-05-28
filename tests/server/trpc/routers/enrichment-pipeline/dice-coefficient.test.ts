import { describe, it, expect } from '@jest/globals';

import {
  diceCoefficient,
  normalizeTitle,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/utils';

describe('diceCoefficient — empty/short-string guard', () => {
  // Regression: normalizeTitle() reduces any non-latin title to "". The old
  // implementation checked `a === b` BEFORE the length guard, so dice("","")
  // returned a perfect 1.0. Every candidate carrying a foreign alt-title (which
  // is almost all of them) then tied at 1.0 against any empty query variant, and
  // the most popular pooled hit won regardless of title — e.g. the kitsu picker
  // binding "Skip Beat!" to "One Piece".
  it('returns 0 for two empty strings (not 1)', () => {
    expect(diceCoefficient('', '')).toBe(0);
  });

  it('returns 0 when either side is empty', () => {
    expect(diceCoefficient('', 'naruto')).toBe(0);
    expect(diceCoefficient('naruto', '')).toBe(0);
  });

  it('returns 0 for identical single characters', () => {
    expect(diceCoefficient('a', 'a')).toBe(0);
  });

  it('still returns 1 for identical real titles', () => {
    expect(diceCoefficient('naruto', 'naruto')).toBe(1);
  });

  it('normalizeTitle reduces non-latin titles to empty (the trigger)', () => {
    expect(normalizeTitle('スキップ・ビート')).toBe('');
    // ...so a foreign query variant cannot perfect-match a foreign candidate title.
    expect(diceCoefficient(normalizeTitle('スキップ・ビート'), normalizeTitle('ワンピース'))).toBe(0);
  });

  it('does not exceed 1 for repeated bigrams (multiset intersection)', () => {
    // "dandadan" vs "dadadadan" previously scored >1 with a Set-based impl.
    expect(diceCoefficient('dandadan', 'dadadadan')).toBeLessThanOrEqual(1);
  });
});
