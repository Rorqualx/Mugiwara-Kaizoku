import { describe, expect, it } from '@jest/globals';

import { isPlaceholderVolumeTitle } from '../volume-extractors';

describe('isPlaceholderVolumeTitle', () => {
  describe('rejects localized volume labels (placeholders)', () => {
    const placeholders: string[] = [
      'Band 1', 'Band 14', 'band 7',
      'Volume 1', 'Volume 100', 'volume 3',
      'Vol 1', 'Vol. 1', 'Vol.2', 'vol 5',
      'Tome 1', 'Tome 12',
      'Tomo 1', 'Tomo 7',
      'Tankoubon 4', 'Tankobon 2',
      '巻1', '巻12',
      '第1巻', '第 12 巻',
      '제1권', '제 7 권',
    ];

    it.each(placeholders)('strips %p', (input) => {
      expect(isPlaceholderVolumeTitle(input)).toBe(true);
    });

    it('strips when surrounded by whitespace', () => {
      expect(isPlaceholderVolumeTitle('  Band 1  ')).toBe(true);
      expect(isPlaceholderVolumeTitle('\tVolume 7\n')).toBe(true);
    });

    it('strips decimal-suffix placeholders (rare but possible)', () => {
      expect(isPlaceholderVolumeTitle('Volume 1.5')).toBe(true);
      expect(isPlaceholderVolumeTitle('Tome 3.0')).toBe(true);
    });
  });

  describe('keeps real volume subtitles', () => {
    const realTitles: string[] = [
      'Adolla',
      'The Captain of the 8th',
      'Volume 1 - The Captain of the 8th',
      'Band 1 - Adolla Burst',
      'Chapter Zero',
      'The Hunt for Sho',
      "Hero's Beginning",
      'Volume of the Wind',
      '巻ノ一: 風',
      'Volume One',
    ];

    it.each(realTitles)('preserves %p', (input) => {
      expect(isPlaceholderVolumeTitle(input)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for empty string', () => {
      expect(isPlaceholderVolumeTitle('')).toBe(false);
    });

    it('returns false for label without number', () => {
      // Bare "Band" or "Volume" alone is more likely a real title fragment
      expect(isPlaceholderVolumeTitle('Band')).toBe(false);
      expect(isPlaceholderVolumeTitle('Volume')).toBe(false);
    });

    it('returns false for number-only cell', () => {
      expect(isPlaceholderVolumeTitle('1')).toBe(false);
      expect(isPlaceholderVolumeTitle('14')).toBe(false);
    });
  });
});
