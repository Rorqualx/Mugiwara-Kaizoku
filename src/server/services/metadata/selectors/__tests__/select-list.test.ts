import { selectList } from '../select-list';

import type { Candidate, SelectorContext } from '../types';

function ctx(field: SelectorContext['field'], candidates: Candidate[]): SelectorContext {
  return {
    mangaId: 1,
    field,
    fieldType: 'list',
    candidates,
    existingValue: null,
    existingProvider: null,
  };
}

function cand(provider: Candidate['provider'], value: string[], field: Candidate['field']): Candidate {
  return { field, provider, value, matchConfidence: 0.95 };
}

describe('selectList', () => {
  describe('union', () => {
    it('merges identical items across providers and counts them once', () => {
      const result = selectList(ctx('genres', [
        cand('anilist',  ['Action', 'Adventure'],  'genres'),
        cand('mangadex', ['Action', 'Comedy'],     'genres'),
      ]));
      expect(result.winner).not.toBeNull();
      const value = result.winner?.value as string[];
      expect(value).toContain('Action');
      expect(value).toContain('Adventure');
      expect(value).toContain('Comedy');
      expect(value.filter(v => v === 'Action')).toHaveLength(1);
    });

    it('aliases tag drift (Sci-Fi vs Science Fiction) to one canonical key', () => {
      const result = selectList(ctx('tags', [
        cand('anilist',  ['Sci-Fi'],          'tags'),
        cand('mangadex', ['Science Fiction'], 'tags'),
        cand('mal',      ['Sci-Fi'],          'tags'),
      ]));
      const value = result.winner?.value as string[];
      // Aliased to single key — should appear exactly once.
      expect(value.length).toBe(1);
    });

    it('caps results at per-field limit (genres ≤ 12)', () => {
      const many = Array.from({ length: 20 }, (_, i) => `Genre${i}`);
      const result = selectList(ctx('genres', [cand('anilist', many, 'genres')]));
      const value = result.winner?.value as string[];
      expect(value.length).toBeLessThanOrEqual(12);
      // Dropped items land in alternatives.
      expect(result.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe('confidence', () => {
    it('floors single-contributor confidence so sparse fields still persist', () => {
      const result = selectList(ctx('synonyms', [
        cand('anilist', Array.from({ length: 25 }, (_, i) => `Alt${i}`), 'synonyms'),
      ]));
      // Without floor, mean per-item confidence would be 1/25 = 0.04 (reject).
      // Floor for candidateCount <= 1 lifts to 0.5.
      expect(result.winner).not.toBeNull();
      expect(result.confidence).toBeGreaterThanOrEqual(0.4);
    });

    it('returns winner=null when no candidates contributed items', () => {
      const result = selectList(ctx('genres', [cand('anilist', [], 'genres')]));
      expect(result.winner).toBeNull();
      expect(result.reason).toContain('no candidates');
    });
  });

  describe('winner-provider', () => {
    it('credits the provider who contributed the most kept items', () => {
      const result = selectList(ctx('genres', [
        cand('anilist',  ['A', 'B'],         'genres'),
        cand('mangadex', ['A', 'B', 'C', 'D'], 'genres'),
      ]));
      // MD contributes 4 items vs AL's 2 → MD wins provider credit.
      expect(result.winner?.provider).toBe('mangadex');
    });
  });
});
