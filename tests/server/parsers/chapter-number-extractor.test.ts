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
  extractWikiListChapterNumber,
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

// Hardening plan 3.4 d: both Fandom `extractChapterNumber` copies route here.
describe('extractWikiListChapterNumber', () => {
  const perVolume = (text: string): number | null => extractWikiListChapterNumber(text, { bareNumber: 'leading' });
  const bulleted = (text: string): number | null =>
    extractWikiListChapterNumber(text, { stageMarker: true, bareNumber: 'delimited' });

  const variants: Array<[string, (text: string) => number | null]> = [['per-volume', perVolume], ['bulleted', bulleted]];
  describe.each(variants)('%s options', (_name, extract) => {
    it.each([
      ['Chapter 5: Title', 5],
      ['5. Title', 5],
      ['Ch. 12', 12],
      ['Chapter 10.5 - Extra', 10.5],
      ['Chapter 0-1', 0.1],
      ['000-2', 0.2],
      ['978. The Brats Arrive', 978],
      ['Chapter 978', 978],
      ['5. Title (March 4, 2016)', 5],
      ['Chapter 7 (192 pages, ISBN 978-4-08-880000-0)', 7],
    ] as Array<[string, number]>)('%p -> %p', (text, expected) => {
      expect(extract(text)).toBe(expected);
    });

    it.each([
      'March 4, 2016',
      'Released March 4, 2016',
      '4 March 2016',
      '4th of March, 2016',
      '2016-03-04',
      '3/4/2016',
      '04.03.2016',
      '192 pages',
      '192 pp.',
      '978-4-08-882029-3',
      'ISBN 978-4-08-882029-3',
      '978-0-123-45678-9',
      '4-08-882029-X',
      'Search results',
    ])('%p is not a chapter', (text) => {
      expect(extract(text)).toBeNull();
    });
  });

  it('reads "ch" only as a word, not inside one', () => {
    expect(perVolume('Launch 3')).toBeNull();
    expect(perVolume('Ch 3')).toBe(3);
  });

  it('keeps each parser\'s own bare-number rule', () => {
    expect(perVolume('12 Title')).toBe(12);
    expect(bulleted('12 Title')).toBe(12);
    expect(perVolume('12th Division')).toBe(12);
    expect(bulleted('12th Division')).toBeNull();
    expect(bulleted('001')).toBe(1);
  });

  it('accepts the Stage marker only where asked', () => {
    expect(bulleted('Stage.01 Angel Attack')).toBe(1);
    expect(perVolume('Stage.01 Angel Attack')).toBeNull();
  });

  it('keeps a title that opens with a number and a month-like word', () => {
    expect(perVolume('12 May Flowers')).toBe(12);
  });
});
