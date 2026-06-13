/**
 * @jest-environment node
 *
 * Coverage-resolver native fallback — unfulfilledChapterIds()
 *
 * The durable fix for "a broken Prowlarr pack starves a working native source":
 * when a pack claim resolves partial/empty, the chapters it claimed but never
 * delivered (scoped minus fulfilled) get re-dispatched native-only. This unit
 * pins the set-difference that decides exactly which chapters fall back.
 */

import { unfulfilledChapterIds } from '@/server/services/download/download-monitor/chapter-manager';

describe('unfulfilledChapterIds', () => {
  it('returns every scoped chapter when the pack delivered nothing (empty)', () => {
    expect(unfulfilledChapterIds([1, 2, 3, 4], [])).toEqual([1, 2, 3, 4]);
  });

  it('returns only the gap when the pack partially delivered', () => {
    expect(unfulfilledChapterIds([1, 2, 3, 4, 5], [2, 4])).toEqual([1, 3, 5]);
  });

  it('returns nothing when the pack fully delivered', () => {
    expect(unfulfilledChapterIds([1, 2, 3], [1, 2, 3])).toEqual([]);
  });

  it('ignores fulfilled ids outside the claimed scope', () => {
    // A chapter that completed via another path but wasn't in this pack's scope
    // must not mask a genuinely-missing scoped chapter.
    expect(unfulfilledChapterIds([10, 11], [11, 99])).toEqual([10]);
  });

  it('returns empty for an unscopeable claim', () => {
    expect(unfulfilledChapterIds([], [1, 2])).toEqual([]);
  });

  it('preserves scoped order and does not dedupe input', () => {
    expect(unfulfilledChapterIds([5, 3, 9, 3], [9])).toEqual([5, 3, 3]);
  });
});
