/**
 * @jest-environment node
 *
 * Regression for the manual-BULK native↔Prowlarr handoff gap (Chainsaw Man
 * Official Colored): native yields a chapter to the *estimated* Prowlarr
 * coverage, Prowlarr then rejects the pack at dispatch, and nothing reclaims it.
 * selectReclaimableChapters identifies exactly those orphaned chapters so a
 * trailing native fill can pick them up.
 */
import { describe, it, expect } from '@jest/globals';

import { selectReclaimableChapters } from '@/server/services/library/releaseDispatcher/chapter-selection';

const ch = (...nums: Array<number | null>): Array<{ chapterNumber: number | null }> =>
  nums.map(n => ({ chapterNumber: n }));

describe('selectReclaimableChapters', () => {
  it('reclaims chapters yielded to Prowlarr that were never enqueued, dispatched, or uncovered', () => {
    // Chainsaw shape: ch 1-3 missing, none natively enqueued, Prowlarr dispatched
    // nothing, none marked uncovered → all 3 were yielded-then-orphaned.
    const out = selectReclaimableChapters(ch(1, 2, 3), new Set(), new Set(), new Set());
    expect(out).toEqual([1, 2, 3]);
  });

  it('skips chapters already enqueued natively', () => {
    expect(selectReclaimableChapters(ch(1, 2, 3), new Set([2]), new Set(), new Set())).toEqual([1, 3]);
  });

  it('skips chapters Prowlarr actually dispatched', () => {
    expect(selectReclaimableChapters(ch(1, 2, 3), new Set(), new Set([3]), new Set())).toEqual([1, 2]);
  });

  it('skips chapters already marked uncovered (no source has them)', () => {
    expect(selectReclaimableChapters(ch(1, 2, 3), new Set(), new Set(), new Set([1]))).toEqual([2, 3]);
  });

  it('skips null chapter numbers (volume-file rows)', () => {
    expect(selectReclaimableChapters(ch(null, 5, null), new Set(), new Set(), new Set())).toEqual([5]);
  });

  it('returns nothing when every chapter is accounted for', () => {
    expect(selectReclaimableChapters(ch(1, 2), new Set([1]), new Set([2]), new Set())).toEqual([]);
  });
});
