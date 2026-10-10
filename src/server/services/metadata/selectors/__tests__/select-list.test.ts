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

  describe('person names', () => {
    // The registry's bind confidence for MangaUpdates (0.92) — below AniList's
    // 0.95, which is what makes AniList's spelling the heavier one.
    const muCand = (value: string[], field: Candidate['field']): Candidate =>
      ({ field, provider: 'mangaupdates', value, matchConfidence: 0.92 });

    it('merges name-order, case, punctuation and diacritic variants into one entry', () => {
      const result = selectList(ctx('authors', [
        muCand(['ODA Eiichiro', 'Inagaki, Riichirou'], 'authors'),
        cand('anilist',      ['Eiichiro Oda', 'Riichirou Inagaki', 'Kōhei Horikoshi'], 'authors'),
        cand('kitsu',        ['Kohei Horikoshi'], 'authors'),
      ]));
      expect([...(result.winner?.value as string[])].sort()).toEqual(
        ['Eiichiro Oda', 'Kōhei Horikoshi', 'Riichirou Inagaki'],
      );
    });

    it('keeps the higher-weight provider\'s spelling whatever the claim order', () => {
      const al = cand('anilist', ['Eiichiro Oda'], 'artists');
      const mu = muCand(['EIICHIRO ODA'], 'artists');
      expect(selectList(ctx('artists', [al, mu])).winner?.value).toEqual(['Eiichiro Oda']);
      expect(selectList(ctx('artists', [mu, al])).winner?.value).toEqual(['Eiichiro Oda']);
    });

    it('merges long-vowel romanisation variants', () => {
      const result = selectList(ctx('authors', [
        cand('anilist', ['Eiichirou Oda', 'Kentarou Miura', 'Tsugumi Ooba', 'Yuusuke Murata'], 'authors'),
        muCand(['ODA Eiichiro', 'MIURA Kentaro', 'OHBA Tsugumi', 'MURATA Yusuke'], 'authors'),
      ]));
      expect(result.winner?.value).toEqual(['Eiichirou Oda', 'Kentarou Miura', 'Tsugumi Ooba', 'Yuusuke Murata']);
    });

    it('does not merge different people who share a token', () => {
      const result = selectList(ctx('authors', [
        cand('anilist', ['Eiichiro Oda', 'Tetsuo Oda'], 'authors'),
      ]));
      expect(result.winner?.value).toHaveLength(2);
    });

    it('leaves genre keys order-sensitive (names only)', () => {
      const result = selectList(ctx('genres', [cand('anilist', ['Slice of Life', 'Life of Slice'], 'genres')]));
      expect(result.winner?.value).toHaveLength(2);
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
