/**
 * @jest-environment node
 *
 * A finished series' downloaded rows numbered past its last chapter are
 * mis-numbered files, not chapters awaiting a volume. Tokyo Ghoul (144
 * chapters, 14 volumes) had archive rows numbered 145-159; once no volume 15
 * was rebuilt for them, the overflow pass tagged them -1 and the volume browser
 * listed them as "Not yet in a volume (145-159)" after the final volume of a
 * series that ended in 2014.
 */
import { isMisnumberedFile } from '../phase-volume-overflow';

const file = '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul V10/Tokyo Ghoul V10.cbz';

describe('isMisnumberedFile', () => {
  it('flags a downloaded row numbered past a finished series\' chapter count (Tokyo Ghoul 145-159 of 144)', () => {
    expect(isMisnumberedFile({ chapterNumber: 145, filePath: file }, 144)).toBe(true);
    expect(isMisnumberedFile({ chapterNumber: 159, filePath: file }, 144)).toBe(true);
  });

  it('does not flag the series\' own chapters, a decimal extra of its last chapter, or a row with no file', () => {
    expect(isMisnumberedFile({ chapterNumber: 144, filePath: file }, 144)).toBe(false);
    expect(isMisnumberedFile({ chapterNumber: 144.5, filePath: file }, 144)).toBe(false);
    expect(isMisnumberedFile({ chapterNumber: 150, filePath: null }, 144)).toBe(false);
  });

  it('never flags anything for a running series (no final chapter count)', () => {
    expect(isMisnumberedFile({ chapterNumber: 300, filePath: file }, null)).toBe(false);
  });
});
