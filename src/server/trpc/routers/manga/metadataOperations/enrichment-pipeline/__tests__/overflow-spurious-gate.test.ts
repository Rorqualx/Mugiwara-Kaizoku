/**
 * @jest-environment node
 *
 * Guards the overflow-deletion gate: spurious integer overflow is only deleted for a FINISHED series
 * with a cross-validated (multi-source) volume structure — never for ongoing or single-source manga,
 * whose overflow may be genuine not-yet-volumized chapters.
 */
import { shouldDeleteSpuriousOverflow, pickDecimalAfter, resolveOmakeParentVolume } from '../phase-volume-overflow';

interface OV { id: number; number: number; chapterEnd: number }
const VOLS: OV[] = [
  { id: 219, number: 21, chapterEnd: 147 },
  { id: 220, number: 22, chapterEnd: 155 },
  { id: 223, number: 23, chapterEnd: 167 },
];
const BY_NUM = new Map(VOLS.map(v => [v.number, v]));

describe('shouldDeleteSpuriousOverflow', () => {
  it('deletes overflow for a finished series with a multi-source final volume (Dorohedoro)', () => {
    expect(shouldDeleteSpuriousOverflow('COMPLETED', 'comicvine+wikipedia+mangadex')).toBe(true);
    expect(shouldDeleteSpuriousOverflow('CANCELLED', 'comicvine+mangadex')).toBe(true);
  });

  it('keeps overflow for an ongoing series (latest chapters may be real)', () => {
    expect(shouldDeleteSpuriousOverflow('ONGOING', 'comicvine+wikipedia+mangadex')).toBe(false);
    expect(shouldDeleteSpuriousOverflow('HIATUS', 'comicvine+wikipedia+mangadex')).toBe(false);
  });

  it('keeps overflow when the final volume is single-source (low confidence it is complete)', () => {
    expect(shouldDeleteSpuriousOverflow('COMPLETED', 'comicvine')).toBe(false);
    expect(shouldDeleteSpuriousOverflow('COMPLETED', 'reconciliation')).toBe(false);
  });

  it('keeps overflow for unknown status or missing source', () => {
    expect(shouldDeleteSpuriousOverflow('UNKNOWN', 'comicvine+mangadex')).toBe(false);
    expect(shouldDeleteSpuriousOverflow(null, null)).toBe(false);
    expect(shouldDeleteSpuriousOverflow('COMPLETED', null)).toBe(false);
  });
});

describe('pickDecimalAfter', () => {
  it('returns the smallest free decimal after the base', () => {
    expect(pickDecimalAfter(147, new Set())).toBe(147.1);
    expect(pickDecimalAfter(147, new Set([147.1, 147.2]))).toBe(147.3);
    expect(pickDecimalAfter(155, new Set([155.5, 155.6]))).toBe(155.1);
  });
  it('returns null when all .1-.9 slots are taken', () => {
    const full = new Set([147.1, 147.2, 147.3, 147.4, 147.5, 147.6, 147.7, 147.8, 147.9]);
    expect(pickDecimalAfter(147, full)).toBeNull();
  });
});

describe('resolveOmakeParentVolume', () => {
  it('uses the volume-archive filename as the authoritative parent (169 in v21.zip → vol 21)', () => {
    expect(resolveOmakeParentVolume('v21.zip', 169, VOLS, BY_NUM)?.number).toBe(21);
    expect(resolveOmakeParentVolume('v22.zip', 178, VOLS, BY_NUM)?.number).toBe(22);
  });
  it('falls back to the nearest preceding volume within 10 when filename is not a volume archive', () => {
    expect(resolveOmakeParentVolume('c169.cbz', 169, VOLS, BY_NUM)?.number).toBe(23); // 169-167=2
  });
  it('returns null when nothing is within 10 chapters', () => {
    expect(resolveOmakeParentVolume('c999.cbz', 999, VOLS, BY_NUM)).toBeNull();
  });
});
