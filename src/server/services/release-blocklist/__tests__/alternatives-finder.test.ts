/**
 * Tests for the release-blocklist alternatives finder.
 *
 * Regression: prior implementation read `result['chapters']` from the
 * Prowlarr search-result shape, but `ProwlarrSearchResult` has no
 * `chapters` field — the parsed coverage lives elsewhere. Result: every
 * Prowlarr hit was filtered out, and the retry pipeline always reported
 * "No alternative releases found." The fix: parse coverage from the
 * release title via `parseReleaseCoverage`.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import type { ProwlarrSearchResult } from '@/types/prowlarr';

import { findAlternativeReleases } from '../alternatives-finder';

const searchMangaMock = jest.fn() as jest.Mock;

jest.mock('@/server/services/prowlarr/mangaSearch', () => ({
  ProwlarrMangaSearch: jest.fn().mockImplementation(() => ({
    searchManga: (...args: unknown[]) => searchMangaMock(...args),
  })),
}));

interface MockPrisma {
  manga: { findUnique: jest.Mock };
}

function buildMockPrisma(synonyms: string[] = []): MockPrisma {
  const findUnique = jest.fn() as jest.Mock;
  findUnique.mockImplementation(() =>
    Promise.resolve({
      title: 'A Certain Magical Index SS',
      Metadata: { synonyms },
    }),
  );
  return { manga: { findUnique } };
}

function buildResult(title: string, overrides: Partial<ProwlarrSearchResult> = {}): ProwlarrSearchResult {
  return {
    guid: `guid-${title}`,
    id: 0,
    title,
    indexerName: 'TorrentDownload',
    indexerId: 1,
    size: 1024 * 1024,
    publishDate: '2024-01-01',
    protocol: 'torrent',
    categories: [],
    seeders: 5,
    leechers: 0,
    downloadUrl: `https://example.test/${title}`,
    ...overrides,
  };
}

describe('findAlternativeReleases', () => {
  beforeEach(() => {
    searchMangaMock.mockReset();
  });

  it('returns volume-pack alternatives when only volume coverage is parseable', async () => {
    const prisma = buildMockPrisma();
    searchMangaMock.mockImplementation(() =>
      Promise.resolve({
        status: 'success',
        data: {
          results: [
            buildResult('A Certain Magical Index SS v01-v02 (2024) (Digital) (Group)'),
            buildResult('A Certain Magical Index SS v02 [Yen Press] [Other]'),
          ],
        },
      }),
    );

    const result = await findAlternativeReleases(
      prisma as unknown as Parameters<typeof findAlternativeReleases>[0],
      4055,
      '8',
      ['A Certain Magical Index SS v01 [Yen Press] [LuCaZ]'],
    );

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.map(a => a.releaseTitle)).toEqual(
      expect.arrayContaining([
        'A Certain Magical Index SS v01-v02 (2024) (Digital) (Group)',
      ]),
    );
  });

  it('matches packs that explicitly list the target chapter range', async () => {
    const prisma = buildMockPrisma();
    searchMangaMock.mockImplementation(() =>
      Promise.resolve({
        status: 'success',
        data: {
          results: [
            buildResult('My Manga c001-c050 (Digital)'),
            buildResult('My Manga c100-c150 (Digital)'),
          ],
        },
      }),
    );

    const result = await findAlternativeReleases(
      prisma as unknown as Parameters<typeof findAlternativeReleases>[0],
      1,
      '8',
      [],
    );

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    const titles = result.data.map(a => a.releaseTitle);
    // c001-c050 covers chapter 8; c100-c150 does not
    expect(titles).toContain('My Manga c001-c050 (Digital)');
    expect(titles).not.toContain('My Manga c100-c150 (Digital)');
  });

  it('handles decimal chapter numbers by matching the integer base', async () => {
    const prisma = buildMockPrisma();
    searchMangaMock.mockImplementation(() =>
      Promise.resolve({
        status: 'success',
        data: {
          results: [
            // Twin Star-style decimal chapter: 27.1, 27.2 belong to ch 27
            buildResult('Twin Star Exorcists c020-c050 (Digital)'),
          ],
        },
      }),
    );

    const result = await findAlternativeReleases(
      prisma as unknown as Parameters<typeof findAlternativeReleases>[0],
      2224,
      '27.1',
      [],
    );

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('excludes already-blocklisted titles', async () => {
    const prisma = buildMockPrisma();
    searchMangaMock.mockImplementation(() =>
      Promise.resolve({
        status: 'success',
        data: {
          results: [
            buildResult('My Manga c001-c050 (Digital)'),
          ],
        },
      }),
    );

    const result = await findAlternativeReleases(
      prisma as unknown as Parameters<typeof findAlternativeReleases>[0],
      1,
      '8',
      ['My Manga c001-c050 (Digital)'],
    );

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.data).toEqual([]);
  });

  it('rejects packs whose parsed coverage clearly excludes the target', async () => {
    const prisma = buildMockPrisma();
    searchMangaMock.mockImplementation(() =>
      Promise.resolve({
        status: 'success',
        data: {
          results: [
            buildResult('My Manga c100-c200 (Digital)'),
          ],
        },
      }),
    );

    const result = await findAlternativeReleases(
      prisma as unknown as Parameters<typeof findAlternativeReleases>[0],
      1,
      '8',
      [],
    );

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.data).toEqual([]);
  });
});
