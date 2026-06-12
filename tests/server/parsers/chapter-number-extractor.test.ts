/**
 * @jest-environment node
 *
 * Shared chapter-number extraction primitives (audit #3) — the single
 * normalization funnel for all eight parser sites.
 */

import { describe, it, expect } from '@jest/globals';

import {
  parseChapterToken,
  parsePrequelMinor,
  parseVolumeToken,
  extractChapterNumberFromText,
} from '@/server/parsers/chapter-number-extractor';

describe('parseChapterToken', () => {
  it('parses integers, decimals, and leading zeros', () => {
    expect(parseChapterToken('42')).toBe(42);
    expect(parseChapterToken('100.5')).toBe(100.5);
    expect(parseChapterToken('042.5')).toBe(42.5);
    expect(parseChapterToken('001')).toBe(1);
    expect(parseChapterToken('0')).toBe(0);
  });

  it('rejects implausible or invalid tokens', () => {
    expect(parseChapterToken('abc')).toBeNull();
    expect(parseChapterToken('99999')).toBeNull();
    expect(parseChapterToken('20240101')).toBeNull();
  });
});

describe('parsePrequelMinor', () => {
  it('maps Volume 0 prequel minors to 0.N', () => {
    expect(parsePrequelMinor('1')).toBe(0.1);
    expect(parsePrequelMinor('4')).toBe(0.4);
  });
});

describe('parseVolumeToken', () => {
  it('keeps volumes integral', () => {
    expect(parseVolumeToken('01')).toBe(1);
    expect(parseVolumeToken('36')).toBe(36);
    expect(parseVolumeToken('3.5')).toBe(3);
  });

  it('rejects implausible tokens', () => {
    expect(parseVolumeToken('2024555')).toBeNull();
  });
});

describe('extractChapterNumberFromText', () => {
  it('resolves prequel notation before the plain chapter branch', () => {
    expect(extractChapterNumberFromText('Chapter 0-1')).toBe(0.1);
    expect(extractChapterNumberFromText('000-2. Title')).toBe(0.2);
    expect(extractChapterNumberFromText('see 000-3 here')).toBe(0.3);
  });

  it('handles the dot format including decimal numbers', () => {
    expect(extractChapterNumberFromText('11. Foo')).toBe(11);
    expect(extractChapterNumberFromText('11.5. Interlude')).toBe(11.5);
  });

  it('handles Chapter markers including decimals', () => {
    expect(extractChapterNumberFromText('Chapter 12')).toBe(12);
    expect(extractChapterNumberFromText('Chapter 12.5')).toBe(12.5);
    expect(extractChapterNumberFromText('chapter 7: The Fall')).toBe(7);
  });

  it('falls back to a bare leading number', () => {
    expect(extractChapterNumberFromText('42 The Answer')).toBe(42);
  });

  it('returns null for non-chapter text', () => {
    expect(extractChapterNumberFromText('Characters')).toBeNull();
    expect(extractChapterNumberFromText('Volume covers')).toBeNull();
  });
});
