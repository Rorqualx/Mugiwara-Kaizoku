/**
 * @jest-environment node
 *
 * Hardening plan 3.1 B/C/D: count consensus must not depend on candidate
 * order, must report an even split as 'low', and must count each provider's
 * own number exactly once.
 */

import { describe, it, expect } from '@jest/globals';

import {
  aggregateChapterConsensus,
  resolveExpectedChapterCount,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/chapter-consensus-resolver';
import {
  aggregateConsensus,
  resolveExpectedVolumeCount,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/consensus-resolver';
import {
  softCountCeiling,
  type CountCandidate,
  type CountConsensus,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/count-consensus';
import type { UnifiedProviderResults } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';

function rng(seed: number): () => number {
  let a = seed;
  return (): number => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** `raw` echoes the input and `sources` lists members in input order; neither is part of the decision. */
function decision(c: CountConsensus): { count: number; confidence: string; sources: string[] } {
  return { count: c.count, confidence: c.confidence, sources: [...c.sources].sort() };
}

const SOURCES = ['anilist', 'mangadex', 'mal', 'wikipedia', 'kitsu', 'mangaupdates'];

describe('count consensus is independent of candidate order', () => {
  it.each([
    ['volumes', aggregateConsensus],
    ['chapters', aggregateChapterConsensus],
  ] as Array<[string, (c: CountCandidate[]) => CountConsensus]>)('%s: every permutation agrees', (_name, aggregate) => {
    for (let seed = 1; seed <= 400; seed++) {
      const next = rng(seed);
      const size = 1 + Math.floor(next() * SOURCES.length);
      // A narrow value range so clusters, overlaps and ties all occur often.
      const candidates = shuffle(SOURCES, next).slice(0, size)
        .map(source => ({ source, count: 1 + Math.floor(next() * 12) }));
      const expected = decision(aggregate(candidates));
      for (let i = 0; i < 4; i++) {
        expect({ seed, d: decision(aggregate(shuffle(candidates, next))) }).toEqual({ seed, d: expected });
      }
    }
  });

  it('[2, 2, 34, 34] no longer flips with input order', () => {
    const wrong: CountCandidate[] = [{ source: 'anilist', count: 2 }, { source: 'mal', count: 2 }];
    const right: CountCandidate[] = [{ source: 'mangadex', count: 34 }, { source: 'wikipedia', count: 34 }];
    const a = aggregateConsensus([...wrong, ...right]);
    const b = aggregateConsensus([...right, ...wrong]);
    // Two independent witnesses beat the anchor pair, which shares one binding.
    expect(a.count).toBe(34);
    expect(b.count).toBe(34);
    expect(a.confidence).toBe('low');
    expect(b.confidence).toBe('low');
  });
});

describe('tied clusters', () => {
  it('reports an even split between disjoint clusters as low', () => {
    const c: CountCandidate[] = [
      { source: 'mangadex', count: 100 }, { source: 'kitsu', count: 100 },
      { source: 'wikipedia', count: 60 }, { source: 'mangaupdates', count: 60 },
    ];
    expect(aggregateChapterConsensus(c).confidence).toBe('low');
    expect(aggregateConsensus(c).confidence).toBe('low');
  });

  it('falls back to source priority when non-anchor support is equal', () => {
    const c: CountCandidate[] = [
      { source: 'wikipedia', count: 60 }, { source: 'kitsu', count: 60 },
      { source: 'mangadex', count: 100 }, { source: 'mangaupdates', count: 100 },
    ];
    // mangadex heads the priority list, so its cluster wins from either side.
    expect(aggregateChapterConsensus(c).count).toBe(100);
    expect(aggregateChapterConsensus([...c].reverse()).count).toBe(100);
  });

  it('keeps medium for overlapping clusters: a spread, not a split', () => {
    const c: CountCandidate[] = [
      { source: 'anilist', count: 10 }, { source: 'mangadex', count: 11 },
      { source: 'mal', count: 12 }, { source: 'wikipedia', count: 13 },
    ];
    const forward = aggregateConsensus(c);
    expect(forward.confidence).toBe('medium');
    expect(decision(aggregateConsensus([...c].reverse()))).toEqual(decision(forward));
  });

  it('still reports a clear majority as medium', () => {
    const c: CountCandidate[] = [
      { source: 'anilist', count: 34 }, { source: 'mangadex', count: 34 }, { source: 'mal', count: 34 },
      { source: 'wikipedia', count: 2 }, { source: 'kitsu', count: 2 },
    ];
    expect(aggregateConsensus(c)).toMatchObject({ count: 34, confidence: 'medium' });
  });
});

type Overrides = Partial<Omit<UnifiedProviderResults, 'enrichmentResult'>> & {
  metadata?: Record<string, unknown>;
  perFieldProvenance?: Record<string, string>;
};

function results(o: Overrides): UnifiedProviderResults {
  const { metadata, perFieldProvenance, ...rest } = o;
  return {
    enrichmentResult: {
      status: 'enriched',
      manga: { id: 1, title: 'T' },
      appliedMatch: {
        id: 'anilist-1', provider: 'anilist', providerId: '1', title: 'T', confidence: 0.9,
        metadata: metadata ?? {},
        ...(perFieldProvenance ? { perFieldProvenance } : {}),
      },
    },
    fandomResult: null, wikipediaResult: null, comicvineResult: null, mangaupdatesResult: null,
    mangadexAggregate: null, mangadexChapterList: null, malResult: null, kitsuResult: null,
    ...rest,
  } as unknown as UnifiedProviderResults;
}

const mangaupdates = (latestChapter: number): UnifiedProviderResults['mangaupdatesResult'] =>
  ({ latestChapter } as unknown as UnifiedProviderResults['mangaupdatesResult']);

const wikipedia = (listed: number, own?: number): UnifiedProviderResults['wikipediaResult'] => ({
  data: { volumeList: [] } as unknown as NonNullable<UnifiedProviderResults['wikipediaResult']>['data'],
  chapterList: Array.from({ length: listed }, (_, i) => ({ number: i + 1 })),
  ...(own === undefined ? {} : { ownChapterCount: own }),
});

describe('each provider is counted once, with its own number', () => {
  it('does not count a MangaUpdates-only chapter number twice', () => {
    // Ongoing series: AniList has no count, so the applied value IS the
    // MangaUpdates number. It used to enter as both "anilist" and "mangaupdates"
    // and corroborate itself at high confidence.
    const consensus = resolveExpectedChapterCount(results({
      anilistCounts: { chapters: null, volumes: null },
      metadata: { chapters: 139 },
      perFieldProvenance: { chapters: 'mangaupdates' },
      mangaupdatesResult: mangaupdates(139),
    }));
    expect(consensus.raw).toEqual([{ source: 'mangaupdates', count: 139 }]);
    expect(consensus.confidence).toBe('low');
  });

  it('reads provenance when the raw AniList counts are not on the result', () => {
    const fromMangaUpdates = resolveExpectedChapterCount(results({
      metadata: { chapters: 139 }, perFieldProvenance: { chapters: 'mangaupdates' }, mangaupdatesResult: mangaupdates(139),
    }));
    expect(fromMangaUpdates.raw.map(c => c.source)).toEqual(['mangaupdates']);

    const fromAniList = resolveExpectedChapterCount(results({
      metadata: { chapters: 139 }, perFieldProvenance: { chapters: 'anilist' }, mangaupdatesResult: mangaupdates(139),
    }));
    expect(fromAniList.raw.map(c => c.source)).toEqual(['anilist', 'mangaupdates']);
    expect(fromAniList.confidence).toBe('high');
  });

  it('uses the raw AniList count even when the selector overlaid another value', () => {
    const consensus = resolveExpectedChapterCount(results({
      anilistCounts: { chapters: 110, volumes: null },
      metadata: { chapters: 66 },
      perFieldProvenance: { chapters: 'mangaupdates' },
      mangaupdatesResult: mangaupdates(66),
    }));
    expect(consensus.raw).toEqual([{ source: 'anilist', count: 110 }, { source: 'mangaupdates', count: 66 }]);
  });

  it('does not let a MAL-supplied volume count stand in for AniList', () => {
    const consensus = resolveExpectedVolumeCount(results({
      anilistCounts: { chapters: null, volumes: null },
      metadata: { volumes: 14 },
      perFieldProvenance: { volumes: 'mal' },
      malResult: { volumes: 14 } as unknown as UnifiedProviderResults['malResult'],
    }), 14);
    // Neither as "anilist" nor through the stored-value fallback.
    expect(consensus.raw).toEqual([{ source: 'mal', count: 14 }]);
    expect(consensus.confidence).toBe('low');
  });

  it('still falls back to the stored volume count when the run produced none', () => {
    const consensus = resolveExpectedVolumeCount(results({ anilistCounts: null }), 27);
    expect(consensus.raw).toEqual([{ source: 'anilist-db', count: 27 }]);
  });

  it('counts only the chapters Wikipedia itself listed, not the padding', () => {
    // 40 extracted, padded to MangaUpdates' 139: the padded length used to
    // agree with MangaUpdates by construction.
    const consensus = resolveExpectedChapterCount(results({
      anilistCounts: { chapters: null, volumes: null },
      mangaupdatesResult: mangaupdates(139),
      wikipediaResult: wikipedia(139, 40),
    }));
    expect(consensus.raw).toEqual([{ source: 'wikipedia', count: 40 }, { source: 'mangaupdates', count: 139 }]);
    expect(consensus.confidence).toBe('low');
  });

  it('drops the Wikipedia witness when nothing was extracted or the list was gated away', () => {
    const allPadding = resolveExpectedChapterCount(results({ mangaupdatesResult: mangaupdates(139), wikipediaResult: wikipedia(139, 0) }));
    expect(allPadding.raw.map(c => c.source)).toEqual(['mangaupdates']);
    const gated = resolveExpectedChapterCount(results({ mangaupdatesResult: mangaupdates(139), wikipediaResult: wikipedia(0, 120) }));
    expect(gated.raw.map(c => c.source)).toEqual(['mangaupdates']);
  });

  it('accepts a stated Wikipedia total larger than the extracted list', () => {
    // 100 chapters listed, article states 139: Wikipedia's own number is 139.
    const consensus = resolveExpectedChapterCount(results({ mangaupdatesResult: mangaupdates(139), wikipediaResult: wikipedia(139, 139) }));
    expect(consensus).toMatchObject({ count: 139, confidence: 'high' });
  });

  it('treats a result without an extracted count as unpadded', () => {
    const consensus = resolveExpectedChapterCount(results({ wikipediaResult: wikipedia(66) }));
    expect(consensus.raw).toEqual([{ source: 'wikipedia', count: 66 }]);
  });
});

describe('softCountCeiling (the bound that survives a low consensus)', () => {
  const c = (...counts: number[]): CountCandidate[] => counts.map((count, i) => ({ source: `s${i}`, count }));

  it('is the largest candidate when all sit within 10% of it', () => {
    // One Piece: Wikipedia 1171 listed, MangaUpdates 1194 — no ±2 cluster, but no source claims more than 1194.
    expect(softCountCeiling(c(1171, 1194))).toBe(1194);
    expect(softCountCeiling(c(1171, 1185, 1194))).toBe(1194);
    expect(softCountCeiling(c(90, 100))).toBe(100);
  });

  it('is null when the candidates really disagree, or there is only one', () => {
    expect(softCountCeiling(c(2, 2, 34, 34))).toBeNull();
    expect(softCountCeiling(c(66, 110))).toBeNull();
    expect(softCountCeiling(c(89, 100))).toBeNull();
    expect(softCountCeiling(c(1194))).toBeNull();
    expect(softCountCeiling([])).toBeNull();
  });

  it('does not depend on candidate order', () => {
    expect(softCountCeiling(c(1194, 1171, 1185))).toBe(softCountCeiling(c(1171, 1185, 1194)));
  });
});
