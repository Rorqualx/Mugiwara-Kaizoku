/**
 * @jest-environment node
 *
 * Hardening plan 3.4 c: the `N. "Title"` pattern stopped at three digits
 * ("1050." became chapter "050") and its quote classes had lost their curly
 * quotes.
 */
import { extractNumberedQuotedChapters } from '../index';

const pairs = (html: string): Array<[string, string]> =>
  extractNumberedQuotedChapters(html).map(c => [c.chapterNumber, c.chapterTitle]);

describe('extractNumberedQuotedChapters', () => {
  it('reads one- to three-digit rows as before', () => {
    expect(pairs('<li>00. "Zero"</li><li>7. "Seven"</li><li>123. "Big"</li>')).toEqual([
      ['00', 'Zero'], ['7', 'Seven'], ['123', 'Big'],
    ]);
  });

  it('reads four-digit chapters whole, not as their last three digits', () => {
    expect(pairs('<li>1049. "A"</li><li>1050. "B"</li><li>1051. "C"</li>')).toEqual([
      ['1049', 'A'], ['1050', 'B'], ['1051', 'C'],
    ]);
  });

  it('crosses from three to four digits', () => {
    expect(pairs('998. "A" 999. "B" 1000. "C"').map(p => p[0])).toEqual(['998', '999', '1000']);
  });

  it('matches curly-quoted titles', () => {
    expect(pairs('12. “Curly” 13. "Straight"')).toEqual([['12', 'Curly'], ['13', 'Straight']]);
  });

  it('keeps decimal chapters', () => {
    expect(pairs('12.5. "Extra"')).toEqual([['12.5', 'Extra']]);
  });

  it('drops a year that only looks like a chapter row', () => {
    const html = '<li>1. "One"</li><li>2. "Two"</li><li>3. "Three"</li><p>Reprinted in 2019. "Collected Works" followed.</p>';
    expect(pairs(html).map(p => p[0])).toEqual(['1', '2', '3']);
  });

  it('drops a lone four-digit number but keeps a run that reaches it', () => {
    expect(pairs('2019. "Award"')).toEqual([]);
    expect(pairs('2018. "A" 2019. "B"').map(p => p[0])).toEqual(['2018', '2019']);
  });

  it('does not start a match inside a longer number', () => {
    expect(pairs('12345. "Serial"')).toEqual([]);
  });
});
