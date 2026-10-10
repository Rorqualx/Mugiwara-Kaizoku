/**
 * @jest-environment node
 *
 * Hardening plan 3.4 b: chapters 978 and 979 were dropped unconditionally as
 * ISBN-13 prefixes, which also removed them from series that reach them.
 */

import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@/server/db', () => ({ prisma: {} }));

import type { WikipediaChapter, WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/types';
import {
  isIsbnPrefixFragment,
  normalizeFandomChapters,
  normalizeWikipediaChapters,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/wiki-discovery/chapter-normalization';

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const wikipedia = (numbers: number[]): WikipediaMangaData =>
  ({ title: 'Series', chapterList: numbers.map((n): WikipediaChapter => ({ number: n, title: `T${n}` })) }) as WikipediaMangaData;

describe('isIsbnPrefixFragment', () => {
  it('flags 978/979 only when neither 977 nor 980 is listed', () => {
    expect(isIsbnPrefixFragment(978, new Set([1, 2, 978]))).toBe(true);
    expect(isIsbnPrefixFragment(979, new Set([979]))).toBe(true);
    expect(isIsbnPrefixFragment(978, new Set([977, 978]))).toBe(false);
    expect(isIsbnPrefixFragment(979, new Set([979, 980]))).toBe(false);
    expect(isIsbnPrefixFragment(977, new Set([977]))).toBe(false);
  });
});

describe('normalizeWikipediaChapters', () => {
  it('keeps 978 and 979 in a list that runs 970..985', () => {
    const numbers = normalizeWikipediaChapters(wikipedia(range(970, 985))).map(c => c.number);
    expect(numbers).toEqual(range(970, 985));
  });

  it('drops an isolated 978 from [1..50, 978]', () => {
    const numbers = normalizeWikipediaChapters(wikipedia([...range(1, 50), 978])).map(c => c.number);
    expect(numbers).toEqual(range(1, 50));
  });
});

describe('normalizeFandomChapters', () => {
  const flat = (numbers: number[]): Array<Record<string, unknown>> => numbers.map(n => ({ chapterNumber: n, title: `T${n}` }));

  it('keeps 978 and 979 in a flat list that runs 970..985', () => {
    expect(normalizeFandomChapters({ chapterList: flat(range(970, 985)) }).map(c => c.number)).toEqual(range(970, 985));
  });

  it('drops an isolated 978 from the flat list and from volume lists', () => {
    const data = {
      chapterList: flat([...range(1, 50), 978]),
      volumeList: [{ volumeNumber: 1, chapters: flat([51, 52, 979]) }],
    };
    expect(normalizeFandomChapters(data).map(c => c.number)).toEqual(range(1, 52));
  });

  it('keeps 978/979 listed under a volume when the flat list has their neighbours', () => {
    const data = {
      chapterList: flat(range(970, 977)),
      volumeList: [{ volumeNumber: 97, chapters: flat([978, 979]) }],
    };
    expect(normalizeFandomChapters(data).map(c => c.number)).toEqual(range(970, 979));
  });
});
