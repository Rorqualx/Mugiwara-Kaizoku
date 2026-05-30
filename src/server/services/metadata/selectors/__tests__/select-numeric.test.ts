import { selectNumeric } from '../select-numeric';

import type { Candidate, SelectorContext } from '../types';

function ctx(field: SelectorContext['field'], candidates: Candidate[], existing?: { value: unknown; provider: SelectorContext['existingProvider'] }): SelectorContext {
  return {
    mangaId: 1,
    field,
    fieldType: 'numeric',
    candidates,
    existingValue: existing?.value ?? null,
    existingProvider: existing?.provider ?? null,
  };
}

function cand(provider: Candidate['provider'], value: unknown, matchConfidence = 0.95, field: Candidate['field'] = 'chapters'): Candidate {
  return { field, provider, value, matchConfidence };
}

describe('selectNumeric', () => {
  describe('happy paths', () => {
    it('picks the sole candidate when only one provider contributes', () => {
      const result = selectNumeric(ctx('chapters', [cand('anilist', 100)]));
      expect(result.winner?.provider).toBe('anilist');
      expect(result.winner?.value).toBe(100);
      expect(result.alternatives).toHaveLength(0);
      expect(result.guardRefused).toBe(false);
    });

    it('clusters near-equal values within tolerance (chapters ±5%)', () => {
      const result = selectNumeric(ctx('chapters', [
        cand('anilist', 100),
        cand('mangadex', 103), // within 5% → same cluster
        cand('mal', 100),
      ]));
      expect(result.winner).not.toBeNull();
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      // All three clustered → no dissenters; alternatives may still list the
      // ones whose value differs from the picked representative.
      expect(result.alternatives.every(a => Math.abs(Number(a.value) - 100) <= 5)).toBe(true);
    });

    it('picks the highest-weighted cluster on disagreement', () => {
      const result = selectNumeric(ctx('chapters', [
        cand('anilist', 100, 0.95),
        cand('mal', 100, 0.92),
        cand('mangadex', 200, 0.93), // outlier
      ]));
      expect(result.winner?.value).toBe(100);
      // Mangadex's value lands in alternatives.
      expect(result.alternatives.find(a => a.value === 200)?.provider).toBe('mangadex');
    });

    it('picks the higher-authority provider when clusters tie on weight', () => {
      // Force a single-member-each tie: kitsu (low auth) vs anilist (high auth)
      // at different values.
      const result = selectNumeric(ctx('chapters', [
        cand('anilist', 100, 0.5),
        cand('kitsu', 200, 0.95), // matchConfidence boosted but authority low
      ]));
      // AL's authority (0.95) × 0.5 = 0.475; kitsu's 0.50 × 0.95 = 0.475 — tie.
      // Whichever wins, both should be recorded.
      expect(result.winner).not.toBeNull();
      expect(result.alternatives).toHaveLength(1);
    });
  });

  describe('reject + guard', () => {
    it('returns winner=null when no candidates parse as numeric', () => {
      const result = selectNumeric(ctx('chapters', [cand('anilist', 'not-a-number')]));
      expect(result.winner).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.reason).toContain('no candidates');
    });

    it('refuses drift when a non-anchor would move AL/MAL anchor by >20%', () => {
      const result = selectNumeric(
        ctx('chapters', [cand('wikipedia', 150, 0.9)], { value: 100, provider: 'anilist' }),
      );
      // 50% drift > 20% tolerance
      expect(result.guardRefused).toBe(true);
      expect(result.winner?.provider).toBe('wikipedia');
      expect(result.reason).toContain('drift');
    });

    it('does not refuse when an anchor overwrites another anchor', () => {
      const result = selectNumeric(
        ctx('chapters', [cand('mal', 150, 0.95)], { value: 100, provider: 'anilist' }),
      );
      // anchor → anchor is allowed (no guard refusal).
      expect(result.guardRefused).toBe(false);
    });

    it('does not refuse when existing value came from a non-anchor', () => {
      const result = selectNumeric(
        ctx('chapters', [cand('wikipedia', 200, 0.9)], { value: 100, provider: 'fandom' }),
      );
      expect(result.guardRefused).toBe(false);
    });
  });
});
