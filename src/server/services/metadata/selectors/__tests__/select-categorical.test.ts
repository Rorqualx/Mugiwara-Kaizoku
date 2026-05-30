import { selectCategorical } from '../select-categorical';

import type { Candidate, SelectorContext } from '../types';

function ctx(field: SelectorContext['field'], candidates: Candidate[]): SelectorContext {
  return {
    mangaId: 1,
    field,
    fieldType: 'categorical',
    candidates,
    existingValue: null,
    existingProvider: null,
  };
}

function cand(provider: Candidate['provider'], value: unknown, matchConfidence = 0.95, field: Candidate['field'] = 'status'): Candidate {
  return { field, provider, value, matchConfidence };
}

describe('selectCategorical', () => {
  describe('status — the master-plan headline win', () => {
    it('lets 3-way agreement overrule a stale anchor', () => {
      // Today's path: AL "RELEASING" writes first, persister keeps it.
      // Selector path: MD/MAL/MU all say COMPLETED → outvote AL.
      const result = selectCategorical(ctx('status', [
        cand('anilist', 'RELEASING', 0.95),
        cand('mangadex', 'completed', 0.95),
        cand('mal', 'Finished', 0.92),
        cand('mangaupdates', 'Complete', 0.92),
      ]));
      expect(result.winner).not.toBeNull();
      expect(result.winner?.value).not.toBe('RELEASING');
      expect(result.alternatives.find(a => a.provider === 'anilist')?.value).toBe('RELEASING');
      // 3 of 4 providers agree on COMPLETED.
      expect(result.reason).toContain('3/4');
    });

    it('normalizes provider-side variants to MangaPublicationStatus enum', () => {
      // Different spellings of "ongoing" all cluster together.
      const result = selectCategorical(ctx('status', [
        cand('anilist', 'RELEASING'),
        cand('mangadex', 'ongoing'),
        cand('mal', 'Publishing'),
      ]));
      expect(result.winner).not.toBeNull();
      expect(result.alternatives).toHaveLength(2);
      // No dissent at all — all three resolve to ONGOING.
      expect(result.reason).toContain('3/3');
    });

    it('drops UNKNOWN / placeholder values from voting', () => {
      const result = selectCategorical(ctx('status', [
        cand('anilist', 'UNKNOWN'),
        cand('mangadex', 'completed'),
      ]));
      expect(result.winner?.provider).toBe('mangadex');
      // AL didn't make it to alternatives — it normalized to null.
      expect(result.alternatives.find(a => a.provider === 'anilist')).toBeUndefined();
    });
  });

  describe('format', () => {
    it('maps MANGA / Manga / manga to canonical MANGA', () => {
      const result = selectCategorical(ctx('format', [
        cand('anilist', 'MANGA', 0.95, 'format'),
        cand('mangadex', 'Manga', 0.95, 'format'),
        cand('mal', 'manga', 0.92, 'format'),
      ]));
      expect(result.winner).not.toBeNull();
      expect(result.alternatives.every(a => typeof a.value === 'string')).toBe(true);
    });

    it('separates ONE_SHOT from MANGA when providers disagree', () => {
      const result = selectCategorical(ctx('format', [
        cand('anilist', 'MANGA', 0.95, 'format'),
        cand('mangadex', 'One-shot', 0.95, 'format'),
      ]));
      expect(result.alternatives).toHaveLength(1);
    });
  });

  describe('reject', () => {
    it('returns winner=null when all values normalize to null', () => {
      const result = selectCategorical(ctx('status', [
        cand('anilist', 'UNKNOWN'),
        cand('mangadex', ''),
      ]));
      expect(result.winner).toBeNull();
      expect(result.reason).toContain('no candidates');
    });
  });
});
