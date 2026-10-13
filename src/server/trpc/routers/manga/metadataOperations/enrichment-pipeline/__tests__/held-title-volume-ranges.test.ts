/**
 * @jest-environment node
 *
 * Volume-range defects found refreshing One Piece and Sakamoto Days on a production copy:
 *   - Fandom widened the newest volume over the chapters not yet collected (One Piece vol 115:
 *     1167-1179 -> 1167-1195), because the last volume has no next neighbour to bound it.
 *   - Reconciliation rebuilt a volume 117 above the expected count from stale Chapter.volume on
 *     rows 1145-1152 that the providers' volume 113 (1145-1155) already covers.
 *   - A NULL-numbered "Sakamoto Days V26 C251.cbz" row was homed by its first number (26) into the
 *     volume holding chapter 26.
 *   - Chapter 1195 arrived with a misparsed Chapter.volume of 15; the backfill refused the link but
 *     kept the int, so the row counted under volume 15 and flipped its whole-volume row to PENDING.
 */
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/server/db', () => ({ prisma: {} }));

import { acceptsFandomWidening, lastVolumeSpanCapFor } from '../fandom-volume-helpers/range-updates';
import { planLegacyVolumeLinks } from '../phase-finalize/volume-id-backfill';
import { resolveNullRowVolume } from '../phase-volume-reconciliation';
import { isStaleOrphanCoveredByRanges } from '../phase-volume-reconciliation/stale-orphan';

// One Piece volumes 110-115 as the providers give them.
const OP_RANGES = [
  { start: 1111, end: 1121 },
  { start: 1122, end: 1133 },
  { start: 1134, end: 1144 },
  { start: 1145, end: 1155 },
  { start: 1156, end: 1166 },
  { start: 1167, end: 1179 },
];

describe('last volume widening', () => {
  it('does not widen the last volume over uncollected chapters (One Piece vol 115 1167-1179 -> 1167-1195)', () => {
    const cap = lastVolumeSpanCapFor(OP_RANGES);
    expect(acceptsFandomWidening({ start: 1167, end: 1179 }, { start: 1167, end: 1195 }, 1166, null, cap)).toBe(false);
  });

  it('still widens a last volume whose stored range undercounted by a volume-sized span', () => {
    const cap = lastVolumeSpanCapFor(OP_RANGES);
    expect(acceptsFandomWidening({ start: 1167, end: 1172 }, { start: 1167, end: 1179 }, 1166, null, cap)).toBe(true);
  });

  it('computes the cap from the median span', () => {
    expect(lastVolumeSpanCapFor([{ start: 1, end: 9 }, { start: 10, end: 20 }, { start: 21, end: 31 }])).toBe(15);
    expect(lastVolumeSpanCapFor([])).toBeNull();
  });
});

describe('isStaleOrphanCoveredByRanges', () => {
  const existing = [
    { number: 113, chapterStart: 1145, chapterEnd: 1155 },
    { number: 114, chapterStart: 1156, chapterEnd: 1166 },
    { number: 115, chapterStart: 1167, chapterEnd: 1179 },
  ];

  it('does not rebuild a volume above the expected count from stale Chapter.volume when volume 113 covers its chapters', () => {
    expect(isStaleOrphanCoveredByRanges({ volume: 117, min_ch: 1145, max_ch: 1152 }, existing, 115)).toBe(true);
  });

  it('still rebuilds a next volume whose chapters no provider volume covers', () => {
    expect(isStaleOrphanCoveredByRanges({ volume: 116, min_ch: 1180, max_ch: 1190 }, existing, 115)).toBe(false);
  });

  it('still rebuilds a volume within the expected count', () => {
    expect(isStaleOrphanCoveredByRanges({ volume: 115, min_ch: 1145, max_ch: 1150 }, existing.slice(0, 2), 116)).toBe(false);
  });

  it('leaves an orphan with only un-numbered rows alone', () => {
    expect(isStaleOrphanCoveredByRanges({ volume: 117, min_ch: null, max_ch: null }, existing, 115)).toBe(false);
  });
});

describe('resolveNullRowVolume chapter token', () => {
  const volumes = [
    { id: 4, number: 4, chapterStart: 26, chapterEnd: 30 },
    { id: 28, number: 28, chapterStart: 246, chapterEnd: 255 },
  ];
  const byNumber = new Map(volumes.map(v => [v.number, v.id]));

  it('homes "V26 C251" by its chapter token, not by the volume label 26 (was volume 4)', () => {
    expect(resolveNullRowVolume('Sakamoto Days V26 C251.cbz', volumes, byNumber)).toEqual({ id: 28, number: 28 });
  });

  it('returns null when the chapter token falls in no volume range', () => {
    expect(resolveNullRowVolume('Sakamoto Days V26 C260.cbz', volumes, byNumber)).toBeNull();
  });
});

describe('planLegacyVolumeLinks', () => {
  const volumes = new Map([
    [15, { id: 15, number: 15, chapterStart: 127, chapterEnd: 136 }],
    [115, { id: 115, number: 115, chapterStart: 1167, chapterEnd: 1179 }],
    [200, { id: 200, number: 200, chapterStart: null, chapterEnd: null }],
  ]);

  it('clears a legacy volume int whose volume range excludes the chapter (One Piece 1195 tagged volume 15)', () => {
    const plan = planLegacyVolumeLinks([
      { id: 1, volume: 15, chapterNumber: 1195 },
      { id: 2, volume: 115, chapterNumber: 1186 },
    ], volumes);
    expect(plan.staleIntIds).toEqual([1, 2]);
    expect(plan.links).toEqual([]);
  });

  it('links a row whose chapter (or decimal extra like 255.5) fits its volume, or whose volume has no range', () => {
    const plan = planLegacyVolumeLinks([
      { id: 3, volume: 115, chapterNumber: 1170 },
      { id: 4, volume: 200, chapterNumber: 5000 },
      { id: 5, volume: 999, chapterNumber: 1 },
      { id: 6, volume: 115, chapterNumber: 1179.5 },
    ], volumes);
    expect(plan.links).toEqual([{ id: 3, volumeId: 115 }, { id: 4, volumeId: 200 }, { id: 6, volumeId: 115 }]);
    expect(plan.staleIntIds).toEqual([]);
  });
});
