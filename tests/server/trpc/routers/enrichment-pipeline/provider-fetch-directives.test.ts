/** @jest-environment node */
/**
 * Fetchers honour the user's binding decisions: manual pins are fetched by id
 * with the matcher skipped, unbound providers are not fetched, and rejected
 * ids are never picked — not even when they are the only candidates.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockMu = { searchSeries: jest.fn<(q: string, n: number) => Promise<unknown[]>>(), getSeriesDetails: jest.fn<(id: number) => Promise<unknown>>() };
const mockKitsu = { searchManga: jest.fn<(q: string, n: number) => Promise<unknown[]>>(), getMangaDetails: jest.fn<(id: string) => Promise<unknown>>() };
const mockMdClient = {
  searchManga: jest.fn<(q: { title: string }) => Promise<{ data: unknown[] }>>(),
  getManga: jest.fn<(id: string) => Promise<{ data: unknown }>>(),
  getEnglishTitle: jest.fn((m: { attributes: { title: { en?: string } } }) => m.attributes.title.en ?? ''),
};
const mockCv = {
  initialize: jest.fn<() => Promise<boolean>>(),
  getCompleteVolumeInfo: jest.fn<(id: number) => Promise<unknown>>(),
  getAllVolumeIssues: jest.fn<(id: number) => Promise<unknown[]>>(),
};
const mockFindCvMatch = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('@/server/services/mangaupdates/service', () => ({ mangaUpdatesService: mockMu }));
jest.mock('@/server/services/kitsu', () => ({ kitsuService: mockKitsu }));
jest.mock('@/server/services/mangadex/ts-client-factory', () => ({ getTsMangadexClient: jest.fn(async () => mockMdClient) }));
jest.mock('@/server/services/comicvine/service', () => ({ comicvineService: mockCv }));
jest.mock('@/server/services/comicvine/configService', () => ({
  comicvineConfigService: { loadConfig: jest.fn(async () => ({ preferredLanguage: 'en' })) },
}));
jest.mock('@/server/services/comicvine/discovery/language-aware-matcher', () => ({ findComicVineMatchForAniList: mockFindCvMatch }));
jest.mock('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/mangadex-aggregate', () => ({
  fetchMangaDexAggregate: jest.fn(async () => null),
}));
jest.mock('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/mangadex-chapter-list', () => ({
  fetchMangaDexChapters: jest.fn(async () => []),
}));
jest.mock('@/server/db', () => ({ prisma: {} }));

import {
  pickNonRejectedComicVineCandidate,
  runLanguageAwareComicVineMatch,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/comicvine-fetch';
import { fetchKitsuDirect } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/kitsu-fetch';
import { fetchMangaDexDirect, verifyMangaDexWithAniList } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/mangadex-fetch';
import { fetchMangaUpdatesDirect, verifyMUWithAniList } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/mangaupdates-fetch';
import type { ProviderDirective, ProviderPin } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/provider-pins';

function directive<T>(pin: ProviderPin<T>, rejected: string[] = []): ProviderDirective<T> {
  return { pin, rejectedIds: new Set(rejected) };
}

// ---------------------------------------------------------------- MangaUpdates
function muHit(seriesId: number, title: string, votes = 100): unknown {
  return { hit_title: title, record: { series_id: seriesId, title, type: 'Manga', year: '2011', rating_votes: votes } };
}
function muDetails(seriesId: number, title: string, slug: string): unknown {
  return {
    series_id: seriesId, title, url: `https://www.mangaupdates.com/series/${slug}/x`,
    publishers: [], categories: [], genres: [], status: 'Complete', licensed: true, completed: true,
    type: 'Manga', year: '2011', bayesian_rating: 8, rating_votes: 10, latest_chapter: 85,
    authors: [], publications: [], related_series: [], recommendations: [], associated: [],
    anime: { start: '', end: '' },
  };
}

describe('fetchMangaUpdatesDirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMu.searchSeries.mockResolvedValue([muHit(1, 'Blood Lad', 5000), muHit(2, 'Blood Lad', 10)]);
    mockMu.getSeriesDetails.mockImplementation(async (id) => muDetails(id, 'Blood Lad', id.toString(36)));
  });

  it('skips a rejected series and binds the next candidate', async () => {
    const result = await fetchMangaUpdatesDirect('Blood Lad', undefined, directive({ kind: 'none' }, ['1']));
    expect(result?.seriesId).toBe(2);
  });

  it('returns null when every candidate is rejected — never the rejected id', async () => {
    const result = await fetchMangaUpdatesDirect('Blood Lad', undefined, directive({ kind: 'none' }, ['1', '2']));
    expect(result).toBeNull();
    expect(mockMu.getSeriesDetails).not.toHaveBeenCalled();
  });

  it('fetches a manual pin by id without searching', async () => {
    const result = await fetchMangaUpdatesDirect(
      'Blood Lad', undefined, directive({ kind: 'pinned', id: { seriesId: 64884662872, slug: 'tt2niag' }, raw: 'tt2niag' }),
    );
    expect(mockMu.searchSeries).not.toHaveBeenCalled();
    expect(mockMu.getSeriesDetails).toHaveBeenCalledWith(64884662872);
    expect(result).toMatchObject({ seriesId: 64884662872, manualPin: true });
    expect(result?.matchScore).toBeUndefined();
  });

  it('does not let a rejection block the manual pin', async () => {
    const result = await fetchMangaUpdatesDirect(
      'Blood Lad', undefined, directive({ kind: 'pinned', id: { seriesId: 1, slug: null }, raw: '1' }, ['1']),
    );
    expect(result).toMatchObject({ seriesId: 1, manualPin: true });
  });

  it('falls back to the matcher when the pinned series is not found', async () => {
    mockMu.getSeriesDetails.mockImplementation(async (id) => (id === 999 ? null : muDetails(id, 'Blood Lad', 'x')));
    const result = await fetchMangaUpdatesDirect(
      'Blood Lad', undefined, directive({ kind: 'pinned', id: { seriesId: 999, slug: null }, raw: '999' }),
    );
    expect(result?.seriesId).toBe(1);
    expect(result?.manualPin).toBeUndefined();
  });

  it('distrusts a decoded slug whose fetched series carries a different slug', async () => {
    mockMu.getSeriesDetails.mockImplementation(async (id) => muDetails(id, 'Blood Lad', id === 64884662872 ? 'other' : 'x'));
    const result = await fetchMangaUpdatesDirect(
      'Blood Lad', undefined, directive({ kind: 'pinned', id: { seriesId: 64884662872, slug: 'tt2niag' }, raw: 'tt2niag' }),
    );
    expect(result?.seriesId).toBe(1);
    expect(result?.manualPin).toBeUndefined();
  });

  it('does not fetch an unbound provider', async () => {
    expect(await fetchMangaUpdatesDirect('Blood Lad', undefined, directive({ kind: 'unbound' }))).toBeNull();
    expect(mockMu.searchSeries).not.toHaveBeenCalled();
    expect(mockMu.getSeriesDetails).not.toHaveBeenCalled();
  });

  it('keeps rejections in the AniList-hinted re-search', async () => {
    const result = await verifyMUWithAniList('Blood Lad', { year: 2011, countryOfOrigin: 'JP', alternativeTitles: ['Blood Lad'] }, null, new Set(['1']));
    expect(result?.seriesId).toBe(2);
  });
});

// ----------------------------------------------------------------------- Kitsu
function kitsuHit(id: string, title: string, favoritesCount = 10): unknown {
  return { id, attributes: { slug: `slug-${id}`, canonicalTitle: title, titles: { en: title }, status: 'finished', subtype: 'manga', userCount: 1, favoritesCount } };
}

describe('fetchKitsuDirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockKitsu.searchManga.mockResolvedValue([kitsuHit('10', 'Blood Lad', 500), kitsuHit('20', 'Blood Lad', 1)]);
    mockKitsu.getMangaDetails.mockImplementation(async (id) => kitsuHit(id, 'Pinned Title'));
  });

  it('skips a rejected entry and binds the next candidate', async () => {
    expect((await fetchKitsuDirect('Blood Lad', undefined, directive({ kind: 'none' }, ['10'])))?.kitsuId).toBe('20');
  });

  it('returns null when every candidate is rejected', async () => {
    expect(await fetchKitsuDirect('Blood Lad', undefined, directive({ kind: 'none' }, ['10', '20']))).toBeNull();
  });

  it('fetches a manual numeric pin by id without searching', async () => {
    const result = await fetchKitsuDirect('Blood Lad', undefined, directive({ kind: 'pinned', id: '59289', raw: '59289' }));
    expect(mockKitsu.searchManga).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kitsuId: '59289', canonicalTitle: 'Pinned Title', manualPin: true });
  });

  it('runs the matcher for a slug pin, which cannot be fetched by id', async () => {
    const result = await fetchKitsuDirect(
      'Blood Lad', undefined, directive({ kind: 'unusable', raw: 'blood-lad', reason: 'slug' }),
    );
    expect(mockKitsu.getMangaDetails).not.toHaveBeenCalled();
    expect(result?.kitsuId).toBe('10');
  });

  it('does not fetch an unbound provider', async () => {
    expect(await fetchKitsuDirect('Blood Lad', undefined, directive({ kind: 'unbound' }))).toBeNull();
    expect(mockKitsu.searchManga).not.toHaveBeenCalled();
  });
});

// -------------------------------------------------------------------- MangaDex
const MD_A = '11111111-1111-4111-8111-111111111111';
const MD_B = '22222222-2222-4222-8222-222222222222';
function mdManga(id: string, title: string, al?: string): unknown {
  return {
    id,
    attributes: {
      title: { en: title }, altTitles: [], status: 'completed', lastVolume: '17', lastChapter: '85',
      description: { en: 'desc' }, links: al ? { al } : {}, contentRating: 'safe', publicationDemographic: 'seinen', year: 2009,
    },
  };
}

describe('fetchMangaDexDirect / verifyMangaDexWithAniList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMdClient.searchManga.mockResolvedValue({ data: [mdManga(MD_A, 'Blood Lad', '51614'), mdManga(MD_B, 'Blood Lad')] });
    mockMdClient.getManga.mockImplementation(async (id) => ({ data: mdManga(id, 'Pinned Manga') }));
  });

  it('skips a rejected manga and binds the next candidate', async () => {
    expect((await fetchMangaDexDirect('Blood Lad', directive({ kind: 'none' }, [MD_A])))?.mangaId).toBe(MD_B);
  });

  it('returns null when every candidate is rejected', async () => {
    expect(await fetchMangaDexDirect('Blood Lad', directive({ kind: 'none' }, [MD_A, MD_B]))).toBeNull();
  });

  it('fetches a manual pin by UUID without searching', async () => {
    const result = await fetchMangaDexDirect('Blood Lad', directive({ kind: 'pinned', id: MD_B, raw: MD_B }));
    expect(mockMdClient.searchManga).not.toHaveBeenCalled();
    expect(mockMdClient.getManga).toHaveBeenCalledWith(MD_B);
    expect(result).toMatchObject({ mangaId: MD_B, manualPin: true });
    expect(result?.matchScore).toBeUndefined();
  });

  it('falls back to the matcher when the pinned fetch throws', async () => {
    mockMdClient.getManga.mockRejectedValue(new Error('404'));
    const result = await fetchMangaDexDirect('Blood Lad', directive({ kind: 'pinned', id: MD_B, raw: MD_B }));
    expect(result?.mangaId).toBe(MD_A);
    expect(result?.manualPin).toBeUndefined();
  });

  it('does not fetch an unbound provider', async () => {
    expect(await fetchMangaDexDirect('Blood Lad', directive({ kind: 'unbound' }))).toBeNull();
    expect(mockMdClient.searchManga).not.toHaveBeenCalled();
  });

  it('does not let links.al pull a rejected manga back in during verify', async () => {
    const anilist = { id: 51614, details: { id: 51614, title: { romaji: 'Blood Lad' } } };
    // Unrejected, the links.al cross-reference picks MD_A.
    expect((await verifyMangaDexWithAniList('Blood Lad', anilist, null))?.mangaId).toBe(MD_A);
    expect((await verifyMangaDexWithAniList('Blood Lad', anilist, null, new Set([MD_A])))?.mangaId).toBe(MD_B);
  });
});

// ------------------------------------------------------------------- ComicVine
function cvCandidate(volumeId: number, finalScore: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    volumeId, name: `Volume ${volumeId}`, publisherName: 'Yen Press', startYear: 2012, countOfIssues: 17,
    titleSimilarity: 0.9, detectedLanguage: 'en', languageConfidence: 0.9, languageReasons: [],
    matchesPreferredLanguage: true, finalScore, ...extra,
  };
}
const anilistDetails = { id: 51614, title: { english: 'Blood Lad', romaji: 'Blood Lad' } };

describe('ComicVine rejections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCv.initialize.mockResolvedValue(true);
    mockCv.getAllVolumeIssues.mockResolvedValue([]);
    mockCv.getCompleteVolumeInfo.mockImplementation(async (id) => ({ id, name: `Volume ${id}`, publisher: { name: 'Yen Press' } }));
  });

  it('picks the next qualifying candidate when the best one is rejected', () => {
    const allCandidates = [
      cvCandidate(1, 1.2), cvCandidate(2, 1.1),
      cvCandidate(3, 1.15, { matchesPreferredLanguage: false }),
      cvCandidate(4, 1.18, { titleSimilarity: 0.4 }),
    ] as never;
    expect(pickNonRejectedComicVineCandidate({ allCandidates, matchStrategy: 'english' }, new Set(['1']))?.volumeId).toBe(2);
    expect(pickNonRejectedComicVineCandidate({ allCandidates, matchStrategy: 'english' }, new Set(['1', '2']))).toBeNull();
  });

  it('has no replacement for a rejected origin-language fallback pick', () => {
    const allCandidates = [cvCandidate(1, 1.2), cvCandidate(2, 1.1)] as never;
    expect(pickNonRejectedComicVineCandidate({ allCandidates, matchStrategy: 'language-fallback' }, new Set(['1']))).toBeNull();
  });

  it('replaces a rejected matcher pick with the next candidate', async () => {
    mockFindCvMatch.mockResolvedValue({
      matched: cvCandidate(1, 1.2), matchedVolume: { id: 1 }, rejectedForLanguage: [],
      allCandidates: [cvCandidate(1, 1.2), cvCandidate(2, 1.1)], matchStrategy: 'english',
    });
    const result = await runLanguageAwareComicVineMatch(anilistDetails, 37, directive<number>({ kind: 'none' }, ['1']));
    expect(result?.volumeId).toBe(2);
    expect(result?.matchScore).toBe(0.9);
  });

  it('leaves ComicVine unbound when the only candidate is rejected', async () => {
    mockFindCvMatch.mockResolvedValue({
      matched: cvCandidate(1, 1.2), matchedVolume: { id: 1 }, rejectedForLanguage: [],
      allCandidates: [cvCandidate(1, 1.2)], matchStrategy: 'english',
    });
    expect(await runLanguageAwareComicVineMatch(anilistDetails, 37, directive<number>({ kind: 'none' }, ['1']))).toBeNull();
    expect(mockCv.getAllVolumeIssues).not.toHaveBeenCalled();
  });

  it('skips the matcher for an unbound sentinel and for a manual pin', async () => {
    expect(await runLanguageAwareComicVineMatch(anilistDetails, 37, directive<number>({ kind: 'unbound' }))).toBeNull();
    const pinned = await runLanguageAwareComicVineMatch(anilistDetails, 37, directive({ kind: 'pinned', id: 50244, raw: '4050-50244' }));
    expect(pinned?.volumeId).toBe(50244);
    expect(pinned?.matchScore).toBeUndefined();
    expect(mockFindCvMatch).not.toHaveBeenCalled();
  });
});
