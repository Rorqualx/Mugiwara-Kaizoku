/**
 * Tests for binding-plausibility detection. Cases are drawn from the
 * metadata-accuracy harness so the thresholds stay pinned to real data.
 */

import {
  detectImplausibleCount,
  type CountCandidate,
} from '@/server/services/metadata/plausibility-check';

const nonAnchors = (...vals: number[]): CountCandidate[] =>
  vals.map((value, i) => ({ provider: ['mangadex', 'kitsu', 'mangaupdates', 'wikipedia'][i] ?? 'x', value }));

describe('detectImplausibleCount', () => {
  describe('flags true binding errors', () => {
    it('Attack on Titan: stored 2 vs consensus 34 (17×)', () => {
      const f = detectImplausibleCount('volumes', 2, nonAnchors(34, 34, 34));
      expect(f).not.toBeNull();
      expect(f?.consensus).toBe(34);
      expect(f?.ratio).toBe(17);
      expect(f?.agree).toBe(3);
    });

    it('Black Clover: stored 1 vs consensus 392 (392×)', () => {
      const f = detectImplausibleCount('chapters', 1, nonAnchors(392, 392, 392));
      expect(f).not.toBeNull();
      expect(f?.consensus).toBe(392);
    });
  });

  describe('does NOT flag edition ambiguity / rounding noise', () => {
    it('Tomie: stored 1 vs consensus 3 (3× < 4×)', () => {
      expect(detectImplausibleCount('volumes', 1, nonAnchors(3, 3, 3))).toBeNull();
    });

    it('Tatsuki one-shot: stored 1 vs consensus 2 (2×)', () => {
      expect(detectImplausibleCount('volumes', 1, nonAnchors(2, 2))).toBeNull();
    });

    it('Hellsing: stored 92 vs consensus 95 (~1×)', () => {
      expect(detectImplausibleCount('chapters', 92, nonAnchors(95, 95, 95))).toBeNull();
    });
  });

  describe('guards', () => {
    it('returns null when stored is null/zero', () => {
      expect(detectImplausibleCount('volumes', null, nonAnchors(34, 34))).toBeNull();
      expect(detectImplausibleCount('volumes', 0, nonAnchors(34, 34))).toBeNull();
    });

    it('returns null with fewer than 2 non-anchor sources', () => {
      expect(detectImplausibleCount('volumes', 2, nonAnchors(34))).toBeNull();
    });

    it('excludes anchor sources from consensus', () => {
      // Two anchors say 34 but they are the wrong-bound suspects — not counted.
      const cands: CountCandidate[] = [
        { provider: 'anilist', value: 34 },
        { provider: 'mal', value: 34 },
        { provider: 'kitsu', value: 34 },
      ];
      // only 1 non-anchor (kitsu) → below MIN_AGREE → null
      expect(detectImplausibleCount('volumes', 2, cands)).toBeNull();
    });

    it('returns null when non-anchors disagree (no 2 agree)', () => {
      expect(detectImplausibleCount('chapters', 2, nonAnchors(34, 80))).toBeNull();
    });
  });
});
