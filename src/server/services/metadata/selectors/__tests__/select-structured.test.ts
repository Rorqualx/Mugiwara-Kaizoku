import { selectStructured } from '../select-structured';

import type { Candidate, SelectorContext } from '../types';

function ctx(field: SelectorContext['field'], candidates: Candidate[]): SelectorContext {
  return {
    mangaId: 1,
    field,
    fieldType: 'structured',
    candidates,
    existingValue: null,
    existingProvider: null,
  };
}

function cand(provider: Candidate['provider'], value: unknown, field: Candidate['field']): Candidate {
  return { field, provider, value, matchConfidence: 0.95 };
}

describe('selectStructured', () => {
  describe('dates', () => {
    it('startDate picks the earliest non-null date', () => {
      const result = selectStructured(ctx('startDate', [
        cand('anilist',  '2010-07-15', 'startDate'),
        cand('mangadex', '2010-01-01', 'startDate'), // earlier
        cand('mal',      '2010-08-01', 'startDate'),
      ]));
      const winnerDate = result.winner?.value as Date;
      expect(winnerDate.toISOString().slice(0, 10)).toBe('2010-01-01');
    });

    it('endDate picks the latest non-null date', () => {
      const result = selectStructured(ctx('endDate', [
        cand('anilist',  '2020-12-01', 'endDate'),
        cand('mangadex', '2021-06-15', 'endDate'), // latest
      ]));
      const winnerDate = result.winner?.value as Date;
      expect(winnerDate.toISOString().slice(0, 10)).toBe('2021-06-15');
    });

    it('returns winner=null when no value parses as a date', () => {
      const result = selectStructured(ctx('startDate', [
        cand('anilist', 'not-a-date', 'startDate'),
      ]));
      expect(result.winner).toBeNull();
    });
  });

  describe('rating', () => {
    it('boosts the provider with more votes (scoredBy)', () => {
      const result = selectStructured(ctx('rating', [
        cand('anilist', { value: 85, scoredBy: 100000, source: 'anilist' }, 'rating'),
        cand('mal',     { value: 80, scoredBy: 50000,  source: 'mal' },     'rating'),
        cand('kitsu',   { value: 90, scoredBy: 200,    source: 'kitsu' },   'rating'),
      ]));
      expect(result.winner?.provider).toBe('anilist');
      // Kitsu (low authority + low votes) lands in alternatives.
      expect(result.alternatives.find(a => a.provider === 'kitsu')).toBeDefined();
    });

    it('skips ratings with no scoredBy when better-vetted ones exist', () => {
      const result = selectStructured(ctx('rating', [
        cand('mangaupdates', { value: 75, source: 'mangaupdates' },                'rating'), // no scoredBy → penalty
        cand('anilist',      { value: 85, scoredBy: 20000, source: 'anilist' },    'rating'),
      ]));
      expect(result.winner?.provider).toBe('anilist');
    });
  });

  describe('externalLinks', () => {
    it('unions across providers and dedupes (site, url) pairs', () => {
      const result = selectStructured(ctx('externalLinks', [
        cand('anilist',  [{ site: 'AniList',  url: 'https://anilist.co/manga/1' }, { site: 'MAL', url: 'https://mal.net/1' }], 'externalLinks'),
        cand('mangadex', [{ site: 'MAL',      url: 'https://mal.net/1' }, { site: 'MangaDex', url: 'https://mangadex.org/title/x' }], 'externalLinks'),
      ]));
      const links = result.winner?.value as Array<{ site: string; url: string }>;
      expect(links).toHaveLength(3); // AniList + MAL + MangaDex (dedup MAL)
    });
  });

  describe('galleryImages', () => {
    it('unions URLs and rejects non-https', () => {
      const result = selectStructured(ctx('galleryImages', [
        cand('comicvine', ['https://comicvine.gamespot.com/img/a.jpg', 'not a url'], 'galleryImages'),
        cand('fandom',    ['https://comicvine.gamespot.com/img/a.jpg', 'https://fandom.com/img/b.jpg'], 'galleryImages'),
      ]));
      const urls = result.winner?.value as string[];
      expect(urls).toHaveLength(2);
    });
  });

  describe('unhandled fields', () => {
    it('summary is not handled by selectStructured — returns null winner', () => {
      // summary dispatches to selectString in real life; this is a defensive check.
      const result = selectStructured(ctx('summary', [cand('anilist', 'whatever', 'summary')]));
      expect(result.winner).toBeNull();
      expect(result.reason).toContain('no structured strategy');
    });
  });
});
