/**
 * Properties of the weighted-vote confidence (hardening plan 3.1 A):
 *   - another source agreeing with the winner never lowers confidence;
 *   - the outcome never depends on the order candidates arrive in.
 * Checked over seeded random candidate sets rather than a few hand-picked rows.
 */

import { selectField } from '@/server/services/metadata/selectors';
import { getFieldType, type Candidate, type SelectorResult } from '@/server/services/metadata/selectors/types';
import { computeAgreementConfidence } from '@/server/services/metadata/selectors/weighted-winner';

import type { MetadataField, SourceName } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

const PROVIDERS: SourceName[] = ['anilist', 'mal', 'mangadex', 'mangaupdates', 'kitsu', 'comicvine', 'wikipedia', 'fandom'];
const STATUSES = ['RELEASING', 'FINISHED', 'HIATUS', 'CANCELLED'];
const COUNTS = [12, 34, 100, 104, 139, 250];

/** mulberry32 — a small seeded PRNG so a failing case can be replayed by seed. */
function rng(seed: number): () => number {
  let a = seed;
  return (): number => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], next: () => number): T {
  return items[Math.floor(next() * items.length)] as T;
}

function shuffle<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** One candidate per provider, for a random subset of providers. */
function randomCandidates(field: MetadataField, values: readonly unknown[], next: () => number): Candidate[] {
  const size = 1 + Math.floor(next() * (PROVIDERS.length - 1));
  return shuffle(PROVIDERS, next).slice(0, size).map(provider => ({
    field, provider, value: pick(values, next), matchConfidence: 0.5 + next() * 0.5,
  }));
}

function run(field: MetadataField, candidates: Candidate[]): SelectorResult {
  return selectField({
    mangaId: 0, field, fieldType: getFieldType(field), candidates, existingValue: null, existingProvider: null,
  });
}

const CASES: Array<{ field: MetadataField; values: readonly unknown[] }> = [
  { field: 'chapters', values: COUNTS },
  { field: 'status', values: STATUSES },
];

describe.each(CASES)('weighted-vote selector properties ($field)', ({ field, values }) => {
  it('never lowers confidence when another source agrees with the winner', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const next = rng(seed);
      const base = randomCandidates(field, values, next);
      const before = run(field, base);
      const winnerProvider = before.winner?.provider;
      const agreed = base.find(c => c.provider === winnerProvider);
      const unused = PROVIDERS.filter(p => !base.some(c => c.provider === p));
      if (!agreed || unused.length === 0) continue;

      const joiner: Candidate = { field, provider: pick(unused, next), value: agreed.value, matchConfidence: 0.5 + next() * 0.5 };
      const after = run(field, [...base, joiner]);
      expect({ seed, ok: after.confidence >= before.confidence - 1e-12 }).toEqual({ seed, ok: true });
    }
  });

  it('gives the same result for every ordering of the candidates', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const next = rng(seed);
      const base = randomCandidates(field, values, next);
      const expected = run(field, base);
      for (let i = 0; i < 4; i++) {
        expect({ seed, result: run(field, shuffle(base, next)) }).toEqual({ seed, result: expected });
      }
    }
  });
});

describe('computeAgreementConfidence', () => {
  it('scales agreement by f(k): 0.60 for one witness, 0.85 for two, 1 for three or more', () => {
    expect(computeAgreementConfidence(1, ['anilist'])).toBeCloseTo(0.6, 10);
    expect(computeAgreementConfidence(1, ['anilist', 'mangadex'])).toBeCloseTo(0.85, 10);
    expect(computeAgreementConfidence(1, ['anilist', 'mangadex', 'kitsu'])).toBe(1);
    expect(computeAgreementConfidence(1, ['anilist', 'mangadex', 'kitsu', 'mangaupdates'])).toBe(1);
    expect(computeAgreementConfidence(0.5, ['mangadex', 'kitsu'])).toBeCloseTo(0.425, 10);
  });

  it('counts AniList and MAL as a single witness', () => {
    expect(computeAgreementConfidence(1, ['anilist', 'mal'])).toBeCloseTo(0.6, 10);
    expect(computeAgreementConfidence(1, ['mal', 'anilist', 'kitsu'])).toBeCloseTo(0.85, 10);
  });

  it('drops an equal-weight one-against-one disagreement below both reject thresholds', () => {
    expect(computeAgreementConfidence(0.5, ['anilist'])).toBeCloseTo(0.3, 10);
  });
});

describe('numeric drift guard', () => {
  it('judges the provider that won, whatever position it was pushed in', () => {
    const field: MetadataField = 'chapters';
    const candidates: Candidate[] = [
      { field, provider: 'anilist', value: 100, matchConfidence: 0.2 },
      { field, provider: 'mangadex', value: 150, matchConfidence: 0.95 },
      { field, provider: 'kitsu', value: 150, matchConfidence: 0.95 },
    ];
    const ctx = { mangaId: 0, field, fieldType: getFieldType(field), existingValue: 100, existingProvider: 'anilist' as const };
    const forward = selectField({ ...ctx, candidates });
    const reversed = selectField({ ...ctx, candidates: [...candidates].reverse() });
    expect(forward.winner?.provider).toBe('mangadex');
    expect(forward.guardRefused).toBe(true);
    expect(reversed.guardRefused).toBe(true);
  });
});
