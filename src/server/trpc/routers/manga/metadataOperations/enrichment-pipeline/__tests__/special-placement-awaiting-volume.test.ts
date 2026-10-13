/**
 * @jest-environment node
 *
 * A decimal chapter past the last volume that is tagged "awaiting its volume"
 * (volume = -1) is not a stale assignment: the special-chapter pass must not
 * clear it to NULL, or every refresh flips it between -1 and NULL.
 */
jest.mock('@/server/db', () => ({ prisma: {} }));

import { partitionPlacements } from '../special-chapter-placement';

const VOLUMES = [
  { id: 927, number: 27, chapterStart: 236, chapterEnd: 245 },
  { id: 928, number: 28, chapterStart: 246, chapterEnd: 255 },
];

describe('partitionPlacements and the awaiting-volume tag', () => {
  it('leaves a -1 tagged decimal past the last volume alone', () => {
    const { orphans, decimalPlacements } = partitionPlacements(
      [{ id: 1, chapterNumber: 278.5, volume: -1, volumeId: null, filePath: null }], VOLUMES, null,
    );
    expect(orphans).toEqual([]);
    expect(decimalPlacements).toEqual([]);
  });

  it('still clears a stale real volume number on a decimal no volume holds', () => {
    const { orphans } = partitionPlacements(
      [{ id: 2, chapterNumber: 278.5, volume: 28, volumeId: null, filePath: null }], VOLUMES, null,
    );
    expect(orphans.map(o => o.id)).toEqual([2]);
  });

  it('places a tagged decimal whose integer part a volume now holds into that volume (255.5 → 28)', () => {
    const { decimalPlacements } = partitionPlacements(
      [{ id: 3, chapterNumber: 255.5, volume: -1, volumeId: null, filePath: null }], VOLUMES, null,
    );
    expect(decimalPlacements).toEqual([{ id: 3, volume: 28, volumeId: 928 }]);
  });
});
