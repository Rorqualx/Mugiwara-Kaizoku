/**
 * @jest-environment node
 *
 * The last volume of a finished series that no provider gives a range.
 */
import { describe, it, expect } from '@jest/globals';

import { finalVolumeFill, type FinalFillVolumeRow } from '../phase-volume-reconciliation/final-volume-fill';

const rows = (lastStart: number | null): FinalFillVolumeRow[] => [
  { id: 1, number: 25, chapterStart: 215, chapterEnd: 223 },
  { id: 2, number: 26, chapterStart: 224, chapterEnd: 232 },
  { id: 3, number: 27, chapterStart: lastStart, chapterEnd: lastStart === null ? null : lastStart + 2 },
];

describe('finalVolumeFill', () => {
  it('spans the chapters after the previous volume up to the stored count (Dr. STONE volume 27 = 233-236)', () => {
    expect(finalVolumeFill(rows(null), { status: 'COMPLETED', chapters: 236, volumes: 27 }))
      .toEqual({ id: 3, volNumber: 27, chapterStart: 233, chapterEnd: 236 });
  });

  it('leaves an ongoing series\' newest volume open (Dandadan: chapters past the last volume are in no volume yet)', () => {
    expect(finalVolumeFill(rows(null), { status: 'ONGOING', chapters: 249, volumes: 27 })).toBeNull();
  });

  it('does not touch a last volume that already has a range', () => {
    expect(finalVolumeFill(rows(233), { status: 'COMPLETED', chapters: 236, volumes: 27 })).toBeNull();
  });

  it('does nothing when the stored volume count does not name the last volume, or the count is inside the previous volume', () => {
    expect(finalVolumeFill(rows(null), { status: 'COMPLETED', chapters: 236, volumes: 28 })).toBeNull();
    expect(finalVolumeFill(rows(null), { status: 'COMPLETED', chapters: 232, volumes: 27 })).toBeNull();
  });
});
