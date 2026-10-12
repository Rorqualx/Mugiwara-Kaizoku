/**
 * @jest-environment node
 *
 * Chapter hrefs scraped from Fandom list pages are site-relative. adaptiveParse
 * used to hand them to the chapter-detail service unresolved, so every fetch in
 * its first pass failed (220 for Vinland Saga, ~32 s) before a later call site
 * resolved them and fetched the same pages again.
 */

import { describe, it, expect } from '@jest/globals';

import { resolveChapterUrl, resolveChapterUrlsInPlace } from '@/server/services/fandom/adaptive/chapter-url-resolver';

describe('resolveChapterUrl', () => {
  it('resolves a site-relative href against the canonical wiki domain so the detail fetch does not fail URL validation', () => {
    expect(resolveChapterUrl('/wiki/Chapter_15', 'vinlandsaga.fandom.com'))
      .toBe('https://vinlandsaga.fandom.com/wiki/Chapter_15');
  });

  it('joins the path verbatim, keeping anchors and existing percent-encoding, so cache keys match earlier runs', () => {
    expect(resolveChapterUrl('/wiki/Volume_1#Chapter_3', 'x.fandom.com')).toBe('https://x.fandom.com/wiki/Volume_1#Chapter_3');
    expect(resolveChapterUrl('/wiki/Chapter_%C3%A9', 'x.fandom.com')).toBe('https://x.fandom.com/wiki/Chapter_%C3%A9');
  });

  it('leaves an absolute URL untouched, even when it points at another wiki', () => {
    expect(resolveChapterUrl('https://other.fandom.com/wiki/Chapter_1', 'x.fandom.com'))
      .toBe('https://other.fandom.com/wiki/Chapter_1');
  });

  it('gives a protocol-relative href the https scheme rather than treating it as a path', () => {
    expect(resolveChapterUrl('//x.fandom.com/wiki/Chapter_1', 'x.fandom.com')).toBe('https://x.fandom.com/wiki/Chapter_1');
  });
});

describe('resolveChapterUrl without a domain', () => {
  it('returns a relative href unchanged when the domain is empty instead of building a host-less URL', () => {
    expect(resolveChapterUrl('/wiki/Chapter_1', '')).toBe('/wiki/Chapter_1');
  });
});

describe('resolveChapterUrlsInPlace', () => {
  it('rewrites only relative URLs and reports how many, so chapters and fetched details stay keyed by the same URL', () => {
    const chapters: Array<{ number: number; url?: string }> = [
      { number: 1, url: '/wiki/Chapter_1' },
      { number: 2, url: 'https://x.fandom.com/wiki/Chapter_2' },
      { number: 3 },
      { number: 4, url: '' },
    ];
    expect(resolveChapterUrlsInPlace(chapters, 'x.fandom.com')).toBe(1);
    expect(chapters.map((c) => c.url)).toEqual([
      'https://x.fandom.com/wiki/Chapter_1',
      'https://x.fandom.com/wiki/Chapter_2',
      undefined,
      '',
    ]);
  });
});
