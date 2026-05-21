/**
 * @jest-environment node
 *
 * Volume Range Parser Tests
 *
 * Covers:
 * - English forms (v01-v15, Vol 1-30, Volume 5, etc.)
 * - Japanese forms (第01-04巻, 第5巻, 第1〜10巻)
 * - Mixed-language titles where Japanese and English disagree —
 *   the Japanese form wins (canonical for raw releases)
 */

import {
  parseVolumeRange,
  isVolumeInRange,
  doRangesOverlap,
  formatVolumeRange,
} from '@/server/utils/volumeRangeParser';

describe('parseVolumeRange', () => {
  describe('English ranges', () => {
    it('parses v01-v15 form', () => {
      expect(parseVolumeRange('Naruto v01-v15 (Digital)')).toEqual({
        start: 1,
        end: 15,
        isSingleVolume: false,
      });
    });

    it('parses "Vol 1-30" form', () => {
      expect(parseVolumeRange('Bleach Vol 1-30')).toEqual({
        start: 1,
        end: 30,
        isSingleVolume: false,
      });
    });

    it('parses "Volume 1 - Volume 30" form', () => {
      expect(parseVolumeRange('One Piece Volume 1 - Volume 30')).toEqual({
        start: 1,
        end: 30,
        isSingleVolume: false,
      });
    });

    it('parses "v01-30" without repeated prefix', () => {
      expect(parseVolumeRange('Series v01-30 Complete')).toEqual({
        start: 1,
        end: 30,
        isSingleVolume: false,
      });
    });
  });

  describe('English single volume', () => {
    it('parses "Vol 5"', () => {
      expect(parseVolumeRange('Title Vol 5 (Digital)')).toEqual({
        start: 5,
        end: 5,
        isSingleVolume: true,
      });
    });

    it('parses "v01"', () => {
      expect(parseVolumeRange('Series v01 Complete')).toEqual({
        start: 1,
        end: 1,
        isSingleVolume: true,
      });
    });
  });

  describe('Japanese kanji forms', () => {
    it('parses 第01-04巻 range', () => {
      expect(parseVolumeRange('圧勝 第01-04巻 (Raw)')).toEqual({
        start: 1,
        end: 4,
        isSingleVolume: false,
      });
    });

    it('parses 第1〜10巻 with full-width tilde', () => {
      expect(parseVolumeRange('進撃の巨人 第1〜10巻')).toEqual({
        start: 1,
        end: 10,
        isSingleVolume: false,
      });
    });

    it('parses 第5巻 single', () => {
      expect(parseVolumeRange('鬼滅の刃 第5巻')).toEqual({
        start: 5,
        end: 5,
        isSingleVolume: true,
      });
    });

    it('parses 第 12 巻 with internal whitespace', () => {
      expect(parseVolumeRange('Title 第 12 巻')).toEqual({
        start: 12,
        end: 12,
        isSingleVolume: true,
      });
    });
  });

  describe('Mixed-language titles (Japanese wins)', () => {
    it('prefers Japanese 第01-04巻 over English [vol 02-04] when they conflict', () => {
      // Real-world DLraw release where the bracketed English subtitle is
      // a typo'd label — Japanese is canonical.
      expect(parseVolumeRange('圧勝 第01-04巻 [Asshou vol 02-04]')).toEqual({
        start: 1,
        end: 4,
        isSingleVolume: false,
      });
    });

    it('prefers Japanese single 第5巻 over English vol number', () => {
      expect(parseVolumeRange('Title 第5巻 [vol 7]')).toEqual({
        start: 5,
        end: 5,
        isSingleVolume: true,
      });
    });
  });

  describe('No match', () => {
    it('returns null for empty string', () => {
      expect(parseVolumeRange('')).toBeNull();
    });

    it('returns null for plain title with no volume info', () => {
      expect(parseVolumeRange('Random Manga Title')).toBeNull();
    });
  });
});

describe('isVolumeInRange', () => {
  it('returns true when volume is within range', () => {
    expect(isVolumeInRange(5, { start: 1, end: 10, isSingleVolume: false })).toBe(true);
  });

  it('returns false when volume is below range', () => {
    expect(isVolumeInRange(0, { start: 1, end: 10, isSingleVolume: false })).toBe(false);
  });

  it('returns false when volume is above range', () => {
    expect(isVolumeInRange(11, { start: 1, end: 10, isSingleVolume: false })).toBe(false);
  });
});

describe('doRangesOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(
      doRangesOverlap(
        { start: 1, end: 5, isSingleVolume: false },
        { start: 3, end: 8, isSingleVolume: false }
      )
    ).toBe(true);
  });

  it('detects non-overlapping ranges', () => {
    expect(
      doRangesOverlap(
        { start: 1, end: 5, isSingleVolume: false },
        { start: 6, end: 10, isSingleVolume: false }
      )
    ).toBe(false);
  });
});

describe('formatVolumeRange', () => {
  it('formats single volume', () => {
    expect(formatVolumeRange({ start: 5, end: 5, isSingleVolume: true })).toBe('v05');
  });

  it('formats range', () => {
    expect(formatVolumeRange({ start: 1, end: 30, isSingleVolume: false })).toBe('v01-v30');
  });
});
