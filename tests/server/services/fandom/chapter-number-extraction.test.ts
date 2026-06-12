/**
 * @jest-environment node
 *
 * Regression tests for chapter-number extraction bugs found in the
 * 2026-06-11 audit (task #3):
 *
 * 1. paragraph-link-parser truncated decimal chapters — parseInt plus
 *    integer-only regexes turned "Chapter 1.5" into chapter 1, silently
 *    colliding with (and being deduplicated against) the real chapter 1.
 * 2. category-chapter-discovery had no prequel "Chapter 0-N" handling —
 *    every "Chapter 0-N" page title collapsed to chapter 0.
 */

import { describe, it, expect } from '@jest/globals';

import { extractChapterNumber } from '@/server/services/fandom/adaptive/category-chapter-discovery';
import { parseParagraphLinkStructure } from '@/server/services/fandom/adaptive/paragraph-link-parser';

/** Wrap anchor markup in the minimal page shape the parser scans (`p a`). */
function pageWithLinks(...anchors: string[]): string {
  return `<div class="mw-parser-output">${anchors
    .map((a) => `<p>${a}</p>`)
    .join('')}</div>`;
}

describe('paragraph-link-parser decimal chapters', () => {
  it('keeps the fraction in "Chapter N.5" link text', () => {
    const html = pageWithLinks(
      '<a href="/wiki/Chapter_1">Chapter 1</a>',
      '<a href="/wiki/Chapter_1.5">Chapter 1.5</a>',
      '<a href="/wiki/Chapter_2">Chapter 2</a>',
    );
    const result = parseParagraphLinkStructure(html);
    const numbers = result.chapters.map((c) => c.number);
    expect(numbers).toEqual([1, 1.5, 2]);
  });

  it('keeps the fraction in "NN.5. Title" (Erased-style) link text', () => {
    const html = pageWithLinks(
      '<a href="/wiki/11._Foo">11. Foo</a>',
      '<a href="/wiki/11.5._Interlude">11.5. Interlude</a>',
    );
    const result = parseParagraphLinkStructure(html);
    const numbers = result.chapters.map((c) => c.number);
    expect(numbers).toEqual([11, 11.5]);
    const interlude = result.chapters.find((c) => c.number === 11.5);
    expect(interlude?.title).toBe('Interlude');
  });

  it('does not deduplicate a decimal chapter into its integer neighbor', () => {
    // Pre-fix, "Chapter 12.5" parsed as 12 and was dropped by the
    // seen-numbers dedup against the real chapter 12.
    const html = pageWithLinks(
      '<a href="/wiki/Chapter_12">Chapter 12</a>',
      '<a href="/wiki/Chapter_12.5">Chapter 12.5</a>',
    );
    const result = parseParagraphLinkStructure(html);
    expect(result.chapters).toHaveLength(2);
  });

  it('still resolves prequel "chapter 0-N" link text to 0.N', () => {
    const html = pageWithLinks('<a href="/wiki/Chapter_0-1">Chapter 0-1</a>');
    const result = parseParagraphLinkStructure(html);
    expect(result.chapters.map((c) => c.number)).toEqual([0.1]);
  });
});

describe('category-chapter-discovery page-title extraction', () => {
  it('maps prequel "Chapter 0-N" page titles to 0.N instead of collapsing to 0', () => {
    expect(extractChapterNumber('Chapter 0-1')).toBe(0.1);
    expect(extractChapterNumber('Chapter_0-2')).toBe(0.2);
    expect(extractChapterNumber('Manga Chapter 0-3')).toBe(0.3);
  });

  it('keeps standard, decimal, and convention titles working', () => {
    expect(extractChapterNumber('Chapter 42')).toBe(42);
    expect(extractChapterNumber('Chapter_001')).toBe(1);
    expect(extractChapterNumber('Manga Chapter 2.5')).toBe(2.5);
    expect(extractChapterNumber('Re: Chapter 1')).toBe(1);
    expect(extractChapterNumber('Act 255')).toBe(255);
    expect(extractChapterNumber('File 18')).toBe(18);
    expect(extractChapterNumber('Pandora Hearts 18.5: Evidence')).toBe(18.5);
    expect(extractChapterNumber('Characters')).toBeNull();
  });
});
