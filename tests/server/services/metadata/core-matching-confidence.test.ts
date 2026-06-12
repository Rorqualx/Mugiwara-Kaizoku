/**
 * @jest-environment node
 *
 * Regression tests for the legacy provider-matching confidence scorer port
 * (2026-06-11 audit task #3). core-matching.ts backs the live
 * ProviderMatchingPanel via providerMatchingService; its scorer had drifted
 * from the enrichment pipeline's matcher:
 *
 * - containment scored 0.8 "very high" — "Berserk of Gluttony" matched
 *   plain "Berserk" as a near-certain hit;
 * - Levenshtein ratio instead of the pipeline's bigram Sørensen-Dice;
 * - no edition/spinoff mismatch gate.
 */

import { describe, it, expect } from '@jest/globals';

import { calculateConfidence } from '@/server/services/metadata/provider-matching/core-matching';

describe('calculateConfidence (pipeline-ported scorer)', () => {
  it('scores exact matches 1.0', () => {
    expect(calculateConfidence('One Piece', 'One Piece')).toBe(1.0);
    expect(calculateConfidence('one-piece', 'One Piece')).toBe(1.0);
  });

  it('no longer treats containment as a very-high match', () => {
    // Pre-port: 0.8 via the containment shortcut. The panel recommended
    // plain "Berserk" for the unrelated "Berserk of Gluttony".
    const score = calculateConfidence('Berserk of Gluttony', 'Berserk');
    expect(score).toBeLessThan(0.7);
  });

  it('hard-rejects spinoff/edition mismatches like the pipeline does', () => {
    expect(calculateConfidence('Overlord', 'Overlord: Shin Sekai-hen')).toBe(0);
    expect(calculateConfidence('Dragon Ball', 'Dragon Ball GT')).toBe(0);
  });

  it('still boosts exact alternative-title matches to at least 0.9', () => {
    const score = calculateConfidence('Shingeki no Kyojin', 'Attack on Titan', {
      title: 'Attack on Titan',
      alternativeTitles: ['Shingeki no Kyojin'],
    });
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it('scores close variants well above unrelated titles', () => {
    const close = calculateConfidence('Frieren Beyond Journeys End', 'Frieren: Beyond Journey\'s End');
    const unrelated = calculateConfidence('Frieren Beyond Journeys End', 'Solo Leveling');
    expect(close).toBeGreaterThan(0.8);
    expect(unrelated).toBeLessThan(0.2);
  });
});
