/**
 * @jest-environment node
 *
 * Guards the extras-loop DH3 pre-pass: NULL-numbered file rows are homed to a REAL volume
 * (whole-volume archive -> filename volume; chapter file -> volume range containing floor(number)),
 * and a volume is never invented from a filename.
 */
import { resolveNullRowVolume, type VolumeRange } from '../phase-volume-reconciliation';

// Dorohedoro-shaped: vols 1..23, vol 23 = chapters 156-167.
const VOLUMES: VolumeRange[] = [
  { id: 119, number: 19, chapterStart: 118, chapterEnd: 127 },
  { id: 120, number: 20, chapterStart: 128, chapterEnd: 137 },
  { id: 123, number: 23, chapterStart: 156, chapterEnd: 167 },
];
const VOL_ID_BY_NUMBER = new Map(VOLUMES.map(v => [v.number, v.id]));

describe('resolveNullRowVolume', () => {
  it('maps a whole-volume archive to its filename volume', () => {
    expect(resolveNullRowVolume('v20.zip', VOLUMES, VOL_ID_BY_NUMBER)).toEqual({ id: 120, number: 20 });
  });

  it('maps an un-numbered chapter file by floor(number) into the containing volume range', () => {
    // "Chapter 167.75.cbz" -> floor 167 -> vol 23 (156-167)
    expect(resolveNullRowVolume('Chapter 167.75.cbz', VOLUMES, VOL_ID_BY_NUMBER)).toEqual({ id: 123, number: 23 });
  });

  it('never invents a volume: archive whose filename volume has no record returns null', () => {
    expect(resolveNullRowVolume('v99.zip', VOLUMES, VOL_ID_BY_NUMBER)).toBeNull();
  });

  it('returns null for a chapter number outside every volume range', () => {
    expect(resolveNullRowVolume('Chapter 999.cbz', VOLUMES, VOL_ID_BY_NUMBER)).toBeNull();
  });

  it('returns null for a filename with no numeric token', () => {
    expect(resolveNullRowVolume('Cover.jpg', VOLUMES, VOL_ID_BY_NUMBER)).toBeNull();
  });
});
