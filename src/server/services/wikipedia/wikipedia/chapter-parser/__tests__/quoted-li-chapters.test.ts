/**
 * @jest-environment node
 *
 * Guards the quoted-<li> chapter extractor against catastrophic backtracking.
 *
 * Regression target: the previous pattern `(?:[^<]*?|<[^>]*>)*?` was
 * exponential on any <li> without a quoted title (Kaguya-sama style lists,
 * nested note items). On Node it never returned; on Bun it stalled ~0.7s per
 * <ol>, blocking the event loop for ~20s on a page of unquoted lists.
 */
import { extractQuotedLiChapters } from '../index';

const titles = (html: string, start = 1): Array<[string, string]> =>
  extractQuotedLiChapters(html, start).map(c => [c.chapterNumber, c.chapterTitle]);

describe('extractQuotedLiChapters', () => {
  it('returns quickly on a long unquoted item', () => {
    const html = `<li>${'a'.repeat(5000)}</li>`;
    const started = performance.now();
    const result = extractQuotedLiChapters(html, 1);
    expect(performance.now() - started).toBeLessThan(200);
    expect(result).toEqual([]);
  });

  it('returns quickly on a page of unquoted items', () => {
    const html = '<li>I Will Make You Invite Me to a Movie<span lang="ja">映画</span></li>\n'.repeat(300);
    const started = performance.now();
    const result = extractQuotedLiChapters(html, 1);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(result).toEqual([]);
  });

  it('extracts straight- and curly-quoted titles in order', () => {
    expect(titles('<li>"One"</li><li>“Two”</li><li>"Three"</li>')).toEqual([
      ['1', 'One'],
      ['2', 'Two'],
      ['3', 'Three'],
    ]);
  });

  it('honors the start number and value attributes', () => {
    expect(titles('<li>"First"</li><li value="12">"Twelfth"</li><li>"Next"</li>', 5)).toEqual([
      ['5', 'First'],
      ['12', 'Twelfth'],
      ['13', 'Next'],
    ]);
  });

  it('skips tags and references before the title', () => {
    expect(titles('<li><sup>[1]</sup><span class="x">"Titled"</span><span lang="ja">題</span></li>')).toEqual([
      ['1', 'Titled'],
    ]);
  });

  it('keeps quoted items that precede a nested unquoted note', () => {
    const html = '<li>"One"</li><li>"Two"<ul><li>a nested unquoted note that is fairly long text</li></ul></li>';
    expect(titles(html)).toEqual([
      ['1', 'One'],
      ['2', 'Two'],
    ]);
  });

  it('ignores a quote that does not open a closed title', () => {
    expect(titles('<li>5" tall</li><li>"Real"</li>')).toEqual([['1', 'Real']]);
  });

  it('matches uppercase tags', () => {
    expect(titles('<LI>"Upper"</LI>')).toEqual([['1', 'Upper']]);
  });
});
