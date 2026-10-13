/**
 * @jest-environment node
 *
 * Chapters released past the last volume (Sakamoto Days 256-278 after volume
 * 28 ending at 255) are tagged volume = -1, "awaiting their volume", in one
 * pass and stay tagged: no volume or range is written for them.
 */
import {
  AWAITING_VOLUME, isAwaitingVolume, lastRangedVolumeEnd, planAwaitingVolumeTags,
  type AwaitingCandidateRow, type AwaitingVolumeRow,
} from '../awaiting-volume';

const SAKAMOTO_VOLUMES: AwaitingVolumeRow[] = [
  { number: 26, chapterStart: 227, chapterEnd: 235 },
  { number: 27, chapterStart: 236, chapterEnd: 245 },
  { number: 28, chapterStart: 246, chapterEnd: 255 },
];

function row(id: number, chapterNumber: number | null, volume: number | null, extra: Partial<AwaitingCandidateRow> = {}): AwaitingCandidateRow {
  return { id, chapterNumber, volume, volumeId: null, filePath: null, ...extra };
}

describe('planAwaitingVolumeTags', () => {
  it('tags chapters past the last volume that have no volume number (Sakamoto Days 256-278)', () => {
    const rows = [row(1, 256, null), row(2, 278, null)];
    expect(planAwaitingVolumeTags(rows, SAKAMOTO_VOLUMES)).toEqual([1, 2]);
  });

  it('tags a file-less chapter whose stale number names a volume that ends before it, in the same run (no NULL first, -1 next refresh)', () => {
    // Fandom said volume 28 for chapter 256; volume 28 ends at 255.
    expect(planAwaitingVolumeTags([row(1, 256, 28)], SAKAMOTO_VOLUMES)).toEqual([1]);
  });

  it('tags a file-less chapter numbered for a volume that does not exist (a deleted "Vol 29 (placeholder)")', () => {
    expect(planAwaitingVolumeTags([row(1, 260, 29)], SAKAMOTO_VOLUMES)).toEqual([1]);
  });

  it('leaves a decimal extra right after the last volume for the decimal placement pass (255.5 belongs to volume 28)', () => {
    expect(planAwaitingVolumeTags([row(1, 255.5, null), row(2, 255.5, 28)], SAKAMOTO_VOLUMES)).toEqual([]);
  });

  it('keeps the volume a downloaded file was imported with', () => {
    expect(planAwaitingVolumeTags([row(1, 256, 29, { filePath: '/lib/v29/c256.cbz' })], SAKAMOTO_VOLUMES)).toEqual([]);
  });

  it('leaves a number naming a volume without a range for the backfill to link', () => {
    const volumes = [...SAKAMOTO_VOLUMES, { number: 29, chapterStart: null, chapterEnd: null }];
    expect(planAwaitingVolumeTags([row(1, 256, 29)], volumes)).toEqual([]);
  });

  it('is idempotent: rows already tagged -1 or linked to a volume are not written again', () => {
    const rows = [row(1, 256, AWAITING_VOLUME), row(2, 257, 28, { volumeId: 900 })];
    expect(planAwaitingVolumeTags(rows, SAKAMOTO_VOLUMES)).toEqual([]);
  });

  it('never tags chapters inside the volumes or a finished series\' own counted chapters', () => {
    expect(planAwaitingVolumeTags([row(1, 250, null)], SAKAMOTO_VOLUMES)).toEqual([]);
    expect(planAwaitingVolumeTags([row(1, 256, null)], SAKAMOTO_VOLUMES, n => n <= 260)).toEqual([]);
  });

  it('tags nothing when no volume has a range', () => {
    expect(planAwaitingVolumeTags([row(1, 256, null)], [{ number: 1, chapterStart: null, chapterEnd: null }])).toEqual([]);
  });
});

describe('lastRangedVolumeEnd', () => {
  it('uses the furthest range end, so a stray "0-0" range on a high volume number does not make every chapter overflow', () => {
    const volumes = [...SAKAMOTO_VOLUMES, { number: 118, chapterStart: 0, chapterEnd: 0 }];
    expect(lastRangedVolumeEnd(volumes)).toBe(255);
  });

  it('ignores volume 0 and range-less volumes', () => {
    expect(lastRangedVolumeEnd([{ number: 0, chapterStart: 0, chapterEnd: 900 }, { number: 3, chapterStart: null, chapterEnd: 20 }])).toBeNull();
  });
});

describe('isAwaitingVolume', () => {
  it('is true only for the -1 tag, not for an unknown (NULL) volume', () => {
    expect(isAwaitingVolume(-1)).toBe(true);
    expect(isAwaitingVolume(null)).toBe(false);
    expect(isAwaitingVolume(0)).toBe(false);
  });
});
