/**
 * @jest-environment node
 *
 * Sakamoto Days' ComicVine descriptions number their chapters "Days 116:
 * Friends". Read as unnumbered titles, each volume's chapters were counted
 * from 1 and the cumulative ranges drifted one chapter from volume 14 on.
 */
import { parseChaptersFromDescription } from '@/utils/comicvine-chapter-parser';

jest.mock('@/utils/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const SAKAMOTO_VOL_14 =
  '<h2>Chapter Titles</h2><ul>' +
  ['Friends', 'A Bad Feeling', 'Hide and Seek', 'Big Shot', 'Shopping', 'Duel', 'Jeers', 'Paradise', 'Kumanomi']
    .map((title, i) => `<li>Days ${116 + i}: ${title}</li>`).join('') +
  '</ul>';

describe('parseChaptersFromDescription — "Days N:" chapter labels', () => {
  it('reads "Days 116: Friends" as chapter 116 with a real number (bug: numbered 1-9 within each volume)', () => {
    const parsed = parseChaptersFromDescription(SAKAMOTO_VOL_14);
    expect(parsed.map(c => c.chapterNumber)).toEqual([116, 117, 118, 119, 120, 121, 122, 123, 124]);
    expect(parsed.every(c => c.hasRealNumber)).toBe(true);
    expect(parsed[0]?.title).toBe('Friends');
  });
});
