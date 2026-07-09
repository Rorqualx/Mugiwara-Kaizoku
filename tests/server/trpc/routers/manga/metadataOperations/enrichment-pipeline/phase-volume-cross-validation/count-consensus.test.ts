/**
 * @jest-environment node
 *
 * Golden-equivalence tests for the shared count-consensus primitive and the
 * two resolvers that adapt it (volumes, chapters). These pin the exact
 * behavior that was previously hand-copied into each resolver, so the
 * structural-lesson-#3 consolidation is provably zero-behavior-change.
 */

import { describe, it, expect } from '@jest/globals';

import {
  aggregateChapterConsensus,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/chapter-consensus-resolver';
import {
  aggregateConsensus,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/consensus-resolver';
import {
  median,
  minFallback,
  priorityThenMinFallback,
  resolveCountConsensus,
  type CountCandidate,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/count-consensus';

describe('median', () => {
  it('handles empty, odd, even, and single-element inputs', () => {
    expect(median([])).toBe(0);
    expect(median([5])).toBe(5);
    expect(median([1, 2, 3])).toBe(2);
    expect(median([10, 11])).toBe(11); // round((10+11)/2) = round(10.5) = 11
    expect(median([2, 4, 6, 8])).toBe(5); // round((4+6)/2) = 5
  });
});

describe('minFallback', () => {
  it('returns the lowest count as a low-confidence pick', () => {
    expect(minFallback([{ source: 'a', count: 50 }, { source: 'b', count: 100 }])).toEqual({
      count: 50,
      confidence: 'low',
      sources: ['a'],
      raw: [{ source: 'a', count: 50 }, { source: 'b', count: 100 }],
    });
  });

  it('returns unknown for an empty candidate list', () => {
    expect(minFallback([])).toEqual({ count: 0, confidence: 'unknown', sources: [], raw: [] });
  });
});

describe('priorityThenMinFallback', () => {
  const fallback = priorityThenMinFallback(['mangadex', 'anilist', 'mal', 'wikipedia']);

  it('prefers the first present source in priority order', () => {
    const cands: CountCandidate[] = [
      { source: 'anilist', count: 27 },
      { source: 'mangadex', count: 19 },
      { source: 'mal', count: 15 },
    ];
    expect(fallback(cands)).toEqual({ count: 19, confidence: 'low', sources: ['mangadex'], raw: cands });
  });

  it('falls through to min when no priority source matches', () => {
    const cands: CountCandidate[] = [{ source: 'kitsu', count: 8 }, { source: 'fandom', count: 3 }];
    expect(fallback(cands)).toEqual({ count: 3, confidence: 'low', sources: ['fandom'], raw: cands });
  });
});

describe('resolveCountConsensus (generic primitive)', () => {
  const opts = {
    window: 1,
    clusterWinner: (m: number): number => m,
    fallback: minFallback,
  };

  it('0 candidates -> unknown', () => {
    expect(resolveCountConsensus([], opts)).toEqual({ count: 0, confidence: 'unknown', sources: [], raw: [] });
  });

  it('1 candidate -> low', () => {
    const c: CountCandidate[] = [{ source: 'mangadex', count: 17 }];
    expect(resolveCountConsensus(c, opts)).toEqual({ count: 17, confidence: 'low', sources: ['mangadex'], raw: c });
  });

  it('all candidates cluster -> high confidence, median winner', () => {
    const c: CountCandidate[] = [{ source: 'a', count: 10 }, { source: 'b', count: 11 }];
    expect(resolveCountConsensus(c, opts)).toEqual({
      count: 11, confidence: 'high', sources: ['a', 'b'], raw: c,
    });
  });

  it('partial cluster -> medium confidence', () => {
    const c: CountCandidate[] = [{ source: 'a', count: 10 }, { source: 'b', count: 10 }, { source: 'c', count: 50 }];
    expect(resolveCountConsensus(c, opts)).toEqual({
      count: 10, confidence: 'medium', sources: ['a', 'b'], raw: c,
    });
  });

  it('no cluster -> fallback', () => {
    const c: CountCandidate[] = [{ source: 'a', count: 10 }, { source: 'b', count: 50 }];
    expect(resolveCountConsensus(c, opts)).toEqual({ count: 10, confidence: 'low', sources: ['a'], raw: c });
  });

  it('clusterWinner can override the median (min-of-cluster rule)', () => {
    const c: CountCandidate[] = [{ source: 'a', count: 100 }, { source: 'b', count: 102 }];
    const minWinner = {
      window: 2,
      clusterWinner: (m: number, members: CountCandidate[]): number => Math.min(m, ...members.map(x => x.count)),
      fallback: minFallback,
    };
    // median([100,102]) = 101, but min(101,100,102) = 100
    expect(resolveCountConsensus(c, minWinner).count).toBe(100);
  });
});

describe('aggregateConsensus (volumes: window 1, median winner, source-priority fallback)', () => {
  it('empty -> unknown', () => {
    expect(aggregateConsensus([])).toEqual({ count: 0, confidence: 'unknown', sources: [], raw: [] });
  });

  it('single source -> low', () => {
    expect(aggregateConsensus([{ source: 'mangadex', count: 17 }])).toEqual({
      count: 17, confidence: 'low', sources: ['mangadex'], raw: [{ source: 'mangadex', count: 17 }],
    });
  });

  it('cluster within ±1 -> median, high confidence', () => {
    const c: CountCandidate[] = [{ source: 'anilist', count: 34 }, { source: 'mangadex', count: 34 }];
    expect(aggregateConsensus(c)).toEqual({ count: 34, confidence: 'high', sources: ['anilist', 'mangadex'], raw: c });
  });

  it('no cluster -> mangadex beats anilist via priority (not min)', () => {
    const c: CountCandidate[] = [{ source: 'anilist', count: 27 }, { source: 'mangadex', count: 19 }];
    expect(aggregateConsensus(c)).toEqual({ count: 19, confidence: 'low', sources: ['mangadex'], raw: c });
  });

  it('no cluster, full spread -> mangadex wins (Cyborg-009 shape)', () => {
    const c: CountCandidate[] = [
      { source: 'anilist', count: 27 },
      { source: 'mangadex', count: 19 },
      { source: 'mal', count: 15 },
    ];
    expect(aggregateConsensus(c).count).toBe(19);
  });
});

describe('aggregateChapterConsensus (chapters: window 2+bonus, min-of-cluster, min fallback)', () => {
  it('empty -> unknown', () => {
    expect(aggregateChapterConsensus([])).toEqual({ count: 0, confidence: 'unknown', sources: [], raw: [] });
  });

  it('cluster within ±2 -> min(median, smallest member)', () => {
    const c: CountCandidate[] = [{ source: 'a', count: 100 }, { source: 'b', count: 102 }];
    // median=101, min(101,100,102)=100
    expect(aggregateChapterConsensus(c)).toEqual({ count: 100, confidence: 'high', sources: ['a', 'b'], raw: c });
  });

  it('no cluster -> plain min fallback (not source-priority)', () => {
    const c: CountCandidate[] = [{ source: 'mangadex', count: 100 }, { source: 'anilist', count: 50 }];
    expect(aggregateChapterConsensus(c)).toEqual({ count: 50, confidence: 'low', sources: ['anilist'], raw: c });
  });

  it('bonus count widens the window so a bonus-inflated source joins the cluster', () => {
    const c: CountCandidate[] = [{ source: 'cv', count: 97 }, { source: 'mal', count: 104 }];
    // default window 2: |97-104|=7 -> no cluster -> min = 97
    expect(aggregateChapterConsensus(c).count).toBe(97);
    expect(aggregateChapterConsensus(c).confidence).toBe('low');
    // bonus 7 -> window 9: they cluster -> min(median,smallest) still 97 but high confidence
    expect(aggregateChapterConsensus(c, 7)).toEqual({ count: 97, confidence: 'high', sources: ['cv', 'mal'], raw: c });
  });
});
