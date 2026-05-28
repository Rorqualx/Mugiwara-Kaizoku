/**
 * @jest-environment node
 *
 * Series-page candidate generation — ensures a spin-off whose DB title uses a
 * dash ("Attack on Titan - Before the Fall") still produces the wiki's actual
 * colon + "(Manga)" page title, and that dice scoring ranks the spin-off page
 * above the franchise root page.
 */

import { describe, it, expect } from '@jest/globals';

import { buildSeriesPageCandidates } from '@/server/services/fandom/adaptive/series-page-resolver';
import { diceCoefficient, normalizeTitle } from '@/server/utils/string';

describe('buildSeriesPageCandidates', () => {
  it('produces the colon + (Manga) variant from a dashed spin-off title', () => {
    const cands = buildSeriesPageCandidates('Attack on Titan - Before the Fall');
    expect(cands).toContain('Attack on Titan: Before the Fall (Manga)');
    expect(cands).toContain('Attack on Titan: Before the Fall');
  });

  it('includes lowercase + capitalised disambiguation suffixes', () => {
    const cands = buildSeriesPageCandidates('Attack on Titan - Before the Fall');
    expect(cands).toContain('Attack on Titan: Before the Fall (manga)');
  });

  it('threads alt-titles (romaji) through candidate generation', () => {
    const cands = buildSeriesPageCandidates('Attack on Titan - Before the Fall', [
      'Shingeki no Kyojin: Before the Fall',
    ]);
    expect(cands).toContain('Shingeki no Kyojin: Before the Fall (Manga)');
  });
});

describe('dice scoring ranks spin-off page above franchise root', () => {
  it('"Before the Fall (Manga)" beats the bare "Attack on Titan" root', () => {
    const query = normalizeTitle('Attack on Titan - Before the Fall');
    // resolveSeriesPageUrl strips a trailing "(Manga)" before scoring.
    const spinoff = normalizeTitle('Attack on Titan: Before the Fall');
    const root = normalizeTitle('Attack on Titan');
    expect(diceCoefficient(spinoff, query)).toBeGreaterThan(diceCoefficient(root, query));
    // exact match after dash↔colon + paren strip
    expect(diceCoefficient(spinoff, query)).toBe(1);
  });
});
