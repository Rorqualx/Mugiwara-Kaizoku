/**
 * @jest-environment node
 *
 * An orphan volume rebuilt from its own rows holds only the chapters no other
 * volume's range holds. Bug protected: "Why Does Nobody Remember Me in this
 * World" rows 48-59 still carried volume 13 after MangaDex's volume 11 took
 * chapter 48 (46-48); rebuilding 48-59 overlapped volume 11, and rows 27-30.3
 * still carrying volume 12 rebuilt a volume entirely inside volumes 6-7.
 */
import { describe, expect, it } from '@jest/globals';

import { uncoveredOrphanSpan } from '../phase-volume-reconciliation/stale-orphan';

const existing = [
  { number: 6, chapterStart: 25, chapterEnd: 28 },
  { number: 7, chapterStart: 29, chapterEnd: 31 },
  { number: 11, chapterStart: 46, chapterEnd: 48 },
];

describe('uncoveredOrphanSpan', () => {
  it('trims the chapter another volume already holds off the front (volume 13: 48-59 -> 49-59)', () => {
    expect(uncoveredOrphanSpan({ min_ch: 48, max_ch: 59 }, existing)).toEqual({ start: 49, end: 59 });
  });

  it('leaves nothing when every chapter sits in other volumes (volume 12: 27-30.3)', () => {
    expect(uncoveredOrphanSpan({ min_ch: 27, max_ch: 30.3 }, existing)).toBeNull();
  });

  it('keeps an orphan no range touches as it is, and has no span for numberless rows', () => {
    expect(uncoveredOrphanSpan({ min_ch: 60, max_ch: 66 }, existing)).toEqual({ start: 60, end: 66 });
    expect(uncoveredOrphanSpan({ min_ch: null, max_ch: null }, existing)).toBeNull();
  });
});
