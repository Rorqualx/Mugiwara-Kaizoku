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

  it('reads no title from a quote that does not open a closed title, but the item keeps its number', () => {
    expect(titles('<li>5" tall</li><li>"Real"</li>')).toEqual([['1', ''], ['2', 'Real']]);
  });

  it('numbers items by position when a title cannot be read (bug: Dandadan chapters after an unread item were numbered one too low)', () => {
    expect(titles('<li>no title here</li><li>"Two"</li><li>"Three"</li>', 6)).toEqual([
      ['6', ''],
      ['7', 'Two'],
      ['8', 'Three'],
    ]);
  });

  it("reads a title whose opening quote sits in a <span> (bug: Dandadan's \"'Acrobatic Silky' Is Kinda Long\" was skipped)", () => {
    const html = '<li>"One"</li><li><span style="padding-right:.15em;">"</span>\'Acrobatic Silky\' Is Kinda Long"<span> (<span lang="ja">アクロ</span>)</span></li>';
    expect(titles(html, 13)).toEqual([
      ['13', 'One'],
      ['14', "'Acrobatic Silky' Is Kinda Long"],
    ]);
  });

  it("reads a title with markup inside it as one item (bug: Dandadan's 'Acro-Silky' title merged with the next item)", () => {
    const html = '<li>"Let\'s Just Call Her \'Acro-Silky<span>\'</span>"<span> (x)</span></li><li>"Acro-Silky"</li>';
    expect(titles(html, 15)).toEqual([
      ['15', "Let's Just Call Her 'Acro-Silky'"],
      ['16', 'Acro-Silky'],
    ]);
  });

  it('reads a title whose closing quote the page left out (bug: Demon Slayer volume 4 read as 26-35, then 27-35, instead of 26-34)', () => {
    const html = '<li>"Barehanded Fight (<span lang="ja">素手喧嘩</span>, <i>Sutegoro</i>)</li><li>"Inosuke Hashibira" (x)</li>';
    expect(titles(html, 26)).toEqual([
      ['26', 'Barehanded Fight'],
      ['27', 'Inosuke Hashibira'],
    ]);
  });

  it('matches uppercase tags', () => {
    expect(titles('<LI>"Upper"</LI>')).toEqual([['1', 'Upper']]);
  });
});
