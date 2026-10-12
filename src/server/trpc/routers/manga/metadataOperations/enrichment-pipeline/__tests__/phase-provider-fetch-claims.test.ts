/**
 * @jest-environment node
 *
 * Call-site wiring: the provider-fetch phase must hand the run's recorder the
 * MAL failure, the cross-series gate, the selector's decision and the fetch
 * outcomes. Removing any one of those calls from the phase fails a test here.
 */
import { anilistService } from '@/server/services/anilist/service';

import { phaseProviderFetch } from '../phase-provider-fetch';
import { fetchMALDirect } from '../phase-provider-fetch/mal-fetch';
import { discoverFandomWikiUrl, fetchFandomChapterData, fetchWikipediaChapterData } from '../wiki-discovery';

import type { ClaimRecorder } from '../claim-run/recorder';

jest.mock('@/server/db', () => ({
  prisma: { manga: { findUnique: jest.fn(() => Promise.resolve({ selectedSourceId: '30012', providerMetadata: {}, mediaType: null })) } },
}));
jest.mock('@/server/utils/configReader', () => ({
  // Every provider at its default, plus MAL switched on.
  getConfigBoolean: jest.fn((key: string, fallback: boolean) => Promise.resolve(key === 'mal.enabled' ? true : fallback)),
}));
jest.mock('@/server/services/anilist/service', () => ({
  anilistService: { initialize: jest.fn(), searchManga: jest.fn(), getMangaDetails: jest.fn() },
}));
jest.mock('@/server/services/metadata/binding-record', () => ({
  getRejectedIdsByProvider: jest.fn(() => Promise.resolve(new Map())),
  rejectedIdsFor: jest.fn(() => new Set<string>()),
  recordBinding: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/server/services/metadata/binding-validators/freshness-check', () => ({ validateBindingFreshness: jest.fn() }));
jest.mock('@/server/services/metadata/field-review', () => ({
  writeFieldReview: jest.fn(() => Promise.resolve()),
  OBJECTIVE_REVIEW_FIELDS: new Set(['status', 'chapters', 'volumes']),
}));
jest.mock('@/server/services/metadata/selectors/persist-attempt', () => ({ persistSelectionAttempt: jest.fn(() => Promise.resolve()) }));
jest.mock('../phase-provider-fetch/mangadex-fetch', () => ({
  fetchMangaDexDirect: jest.fn(() => Promise.resolve(null)),
  verifyMangaDexWithAniList: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../phase-provider-fetch/comicvine-fetch', () => ({
  runLanguageAwareComicVineMatch: jest.fn(() => Promise.resolve(null)),
  buildTitleOnlyAniListDetails: jest.fn(),
}));
jest.mock('../phase-provider-fetch/mangaupdates-fetch', () => ({
  fetchMangaUpdatesDirect: jest.fn(() => Promise.resolve(null)),
  verifyMUWithAniList: jest.fn(() => Promise.resolve(null)),
  buildMangaUpdatesMetadataSupplements: jest.fn(() => ({})),
}));
jest.mock('../phase-provider-fetch/kitsu-fetch', () => ({
  fetchKitsuDirect: jest.fn(() => Promise.resolve(null)),
  mapKitsuToUnifiedResult: jest.fn(),
}));
jest.mock('../phase-provider-fetch/mal-fetch', () => ({ fetchMALDirect: jest.fn() }));
jest.mock('../phase-provider-fetch/enrichment-result-builder', () => ({
  buildEnrichmentResult: jest.fn(() => ({ status: 'enriched', appliedMatch: { metadata: {}, perFieldProvenance: {} } })),
}));
jest.mock('../wiki-discovery', () => ({
  discoverFandomWikiUrl: jest.fn(),
  fetchFandomChapterData: jest.fn(),
  fetchWikipediaChapterData: jest.fn(),
  updateCachedFandomUrl: jest.fn(() => Promise.resolve()),
}));

const ANILIST_DETAILS = {
  id: 30012, idMal: 12, title: { english: 'Bleach', romaji: 'Bleach', native: null },
  chapters: 50, volumes: 5, status: 'FINISHED', format: 'MANGA', synonyms: [], externalLinks: [],
};

type Spied = { [K in keyof Omit<ClaimRecorder, 'runId'>]: jest.Mock } & { runId: string };

function spyRecorder(): Spied {
  return {
    runId: 'run-under-test',
    noteFetchFailure: jest.fn(), noteGated: jest.fn(), noteFetchPhase: jest.fn(), noteSelection: jest.fn(),
    noteStage: jest.fn(), noteManifests: jest.fn(), noteValidatedRanges: jest.fn(),
  };
}

async function runPhase(): Promise<Spied> {
  const recorder = spyRecorder();
  await phaseProviderFetch(73, 'Bleach', undefined, { claimRun: recorder as unknown as ClaimRecorder });
  return recorder;
}

beforeEach(() => {
  jest.mocked(anilistService.getMangaDetails).mockResolvedValue(ANILIST_DETAILS as never);
  jest.mocked(anilistService.searchManga).mockResolvedValue([]);
  // Jikan is down: the client reports it and returns nothing.
  jest.mocked(fetchMALDirect).mockImplementation((_malId, onFailure) => {
    onFailure?.('The operation was aborted.');
    return Promise.resolve(null);
  });
  // Fandom returns a 500-chapter list for a 50-chapter title: the cross-series gate fires.
  jest.mocked(discoverFandomWikiUrl).mockResolvedValue('https://bleach.fandom.com');
  jest.mocked(fetchFandomChapterData).mockImplementation((_url, _title, _alt, pageCounts) => {
    if (pageCounts) Object.assign(pageCounts, { requested: 110, fetched: 0 });
    return Promise.resolve({
      chapterList: Array.from({ length: 500 }, (_, i) => ({ number: i + 1 })),
      volumeList: [{ number: 1, chapterStart: 1, chapterEnd: 7 }],
      parseSuccess: true,
    });
  });
  jest.mocked(fetchWikipediaChapterData).mockResolvedValue(null);
});

describe('phaseProviderFetch — what it tells the claims recorder', () => {
  it('reports the MAL outage through the failure callback it hands the MAL fetch', async () => {
    const recorder = await runPhase();
    expect(jest.mocked(fetchMALDirect)).toHaveBeenCalledWith(12, expect.any(Function));
    expect(recorder.noteFetchFailure).toHaveBeenCalledWith('mal', 'The operation was aborted.');
  });

  it('reports a Wikipedia failure through the callback it hands the Wikipedia fetch', async () => {
    jest.mocked(fetchWikipediaChapterData).mockImplementation((_title, _id, _hints, onFailure) => {
      onFailure?.('connection reset');
      return Promise.resolve(null);
    });
    const recorder = await runPhase();
    expect(recorder.noteFetchFailure).toHaveBeenCalledWith('wikipedia', 'connection reset');
  });

  it('reports an AniList failure through the callback it hands the AniList service', async () => {
    jest.mocked(anilistService.getMangaDetails).mockImplementation((_id, onFailure) => {
      onFailure?.('AniList 500');
      return Promise.resolve(null);
    });
    const recorder = await runPhase();
    expect(recorder.noteFetchFailure).toHaveBeenCalledWith('anilist', 'AniList 500');
  });

  it('notes the cross-series gate with the lists as they were before it emptied them', async () => {
    const recorder = await runPhase();

    expect(recorder.noteGated).toHaveBeenCalledTimes(1);
    const [provider, reason, preGate] = recorder.noteGated.mock.calls[0] as [string, string, { fandom?: { chapterList: unknown[]; volumeList: unknown[] } }];
    expect(provider).toBe('fandom');
    expect(reason).toContain('500 vs 50');
    expect(preGate.fandom?.chapterList).toHaveLength(500);
    expect(preGate.fandom?.volumeList).toHaveLength(1);
  });

  it('notes the claims the selector was given together with its decision', async () => {
    const recorder = await runPhase();

    expect(recorder.noteSelection).toHaveBeenCalledTimes(1);
    const [claims, shadow] = recorder.noteSelection.mock.calls[0] as [Array<{ provider: string; fields: Record<string, unknown> }>, { outcomes: Map<string, { winnerProvider: string | null }> }];
    expect(claims.find(c => c.provider === 'anilist')?.fields['chapters']).toBe(50);
    expect(shadow.outcomes.get('chapters')?.winnerProvider).toBe('anilist');
  });

  it('notes the fetch outcomes once, after the gate, with every provider and the parser\'s page tally', async () => {
    const recorder = await runPhase();

    expect(recorder.noteFetchPhase).toHaveBeenCalledTimes(1);
    const [snapshot] = recorder.noteFetchPhase.mock.calls[0] as [{
      providerStatus: Record<string, string>;
      anilist: { id: number } | null;
      mal: unknown;
      fandom: { chapterList: unknown[]; chapterPages?: { requested: number; fetched: number } } | null;
    }];
    expect(Object.keys(snapshot.providerStatus).sort()).toEqual(
      ['anilist', 'comicvine', 'fandom', 'kitsu', 'mal', 'mangadex', 'mangaupdates', 'wikipedia'],
    );
    expect(snapshot.providerStatus['mal']).toBe('no_match');
    expect(snapshot.anilist?.id).toBe(30012);
    expect(snapshot.mal).toBeNull();
    expect(snapshot.fandom?.chapterList).toEqual([]);
    expect(snapshot.fandom?.chapterPages).toEqual({ requested: 110, fetched: 0 });
    // The gate is noted before the outcomes, so the outcome can say "gated".
    expect(recorder.noteGated.mock.invocationCallOrder[0]).toBeLessThan(recorder.noteFetchPhase.mock.invocationCallOrder[0] ?? 0);
  });

  it('runs the same without a recorder', async () => {
    await expect(phaseProviderFetch(73, 'Bleach')).resolves.toMatchObject({ providerStatus: { anilist: 'ok' } });
  });
});
