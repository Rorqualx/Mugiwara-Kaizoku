/**
 * @jest-environment node
 *
 * One Piece refresh 2026-10-13: reconciliation built a volume past the last
 * provider-ranged volume (115, ends 1179) from chapters' leftover volume
 * numbers, then the awaiting-volume tagger moved those chapters to -1 and left
 * the volume empty. The tagger now runs first.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { planAwaitingVolumeTags } from '@/lib/metadata/awaiting-volume';

const calls: string[] = [];

jest.mock('../phase-volume-overflow', () => ({
  tagChaptersAwaitingVolume: jest.fn(() => { calls.push('tag'); return Promise.resolve(0); }),
}));
jest.mock('../phase-volume-reconciliation', () => ({
  reassignNullNumberedVolumeArchives: jest.fn(() => { calls.push('archives'); return Promise.resolve(); }),
  reconcileMissingVolumeRecords: jest.fn(() => { calls.push('reconcile'); return Promise.resolve(); }),
}));

import { rebuildMissingVolumes } from '../phase-volume-safety-net';

/** Volumes 1-82, nine chapters each: the last range ends at chapter 738. */
const VOLUMES = Array.from({ length: 82 }, (_, i) => ({ number: i + 1, chapterStart: i * 9 + 1, chapterEnd: (i + 1) * 9 }));

describe('rebuildMissingVolumes', () => {
  beforeEach(() => { calls.length = 0; });

  it('tags chapters awaiting their volume before reconciliation can build a volume from their leftover numbers', async () => {
    await rebuildMissingVolumes(81, 115);
    expect(calls).toEqual(['archives', 'tag', 'reconcile']);
  });
});

describe('which leftover numbers past the last range reach reconciliation', () => {
  it('tags file-less chapters 739-747 still numbered volume 83 (no volume 83 exists), so no volume 83 is built for them', () => {
    const rows = [739, 740, 747].map(n => ({ id: n, chapterNumber: n, volume: 83, volumeId: null, filePath: null }));
    expect(planAwaitingVolumeTags(rows, VOLUMES)).toEqual([739, 740, 747]);
  });

  it('leaves downloaded chapters numbered volume 83 by their import alone, so reconciliation still builds the next volume for them', () => {
    const rows = [739, 740].map(n => ({ id: n, chapterNumber: n, volume: 83, volumeId: null, filePath: `/library/v83/c${n}.cbz` }));
    expect(planAwaitingVolumeTags(rows, VOLUMES)).toEqual([]);
  });
});
