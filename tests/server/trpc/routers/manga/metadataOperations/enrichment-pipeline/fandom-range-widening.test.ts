/**
 * @jest-environment node
 *
 * Fandom may widen a stored volume range, but not into a neighbouring volume.
 * Found on Dandadan while verifying hardening plan 3.4: once the phantom
 * chapters 249-252 were gone, Fandom's 211-248 became a superset of the open
 * volume 25 (214-248) and was accepted although volume 24 ends at 213.
 */

import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@/server/db', () => ({ prisma: {} }));

import { buildVolRangesFromMap } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/fandom-volume-helpers/range-builders';
import { acceptsFandomWidening } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/fandom-volume-helpers/range-updates';

describe('acceptsFandomWidening', () => {
  it('accepts a wider superset that stays clear of its neighbours', () => {
    expect(acceptsFandomWidening({ start: 10, end: 17 }, { start: 10, end: 19 }, 9, 20)).toBe(true);
    expect(acceptsFandomWidening({ start: 10, end: 17 }, { start: 8, end: 17 }, null, null)).toBe(true);
  });

  it('refuses a range that starts inside the previous volume', () => {
    expect(acceptsFandomWidening({ start: 214, end: 248 }, { start: 211, end: 248 }, 213, null)).toBe(false);
  });

  it('refuses a range that runs into the next volume', () => {
    expect(acceptsFandomWidening({ start: 10, end: 17 }, { start: 10, end: 20 }, 9, 20)).toBe(false);
  });

  it('keeps the earlier rules: superset, strictly wider, not unreasonably wider', () => {
    expect(acceptsFandomWidening({ start: 10, end: 17 }, { start: 11, end: 19 }, null, null)).toBe(false);
    expect(acceptsFandomWidening({ start: 10, end: 17 }, { start: 10, end: 17 }, null, null)).toBe(false);
    expect(acceptsFandomWidening({ start: 69, end: 71 }, { start: 37, end: 98 }, null, null)).toBe(false);
  });
});

describe('buildVolRangesFromMap', () => {
  it('bounds a volume by its whole chapters; a .5 extra only counts toward it', () => {
    // My Hero Academia's wiki files 7.5 in volume 2 (8-17): the range stays 8-17.
    const map: Record<number, number> = { 7: 1, 7.5: 2, 8: 2, 17: 2 };
    expect(buildVolRangesFromMap(map)[2]).toEqual({ start: 8, end: 17, chapterCount: 3 });
  });

  it('uses the extras when a volume has nothing else', () => {
    expect(buildVolRangesFromMap({ 0.5: 1 })[1]).toEqual({ start: 0.5, end: 0.5, chapterCount: 1 });
  });
});
