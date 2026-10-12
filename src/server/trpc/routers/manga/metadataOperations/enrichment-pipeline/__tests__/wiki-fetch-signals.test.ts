/**
 * @jest-environment node
 */
import { adaptiveParse } from '@/server/services/fandom/adaptive';

import { isManuallyUnbound } from '../manual-binding-sentinel';
import { buildProviderDirectives } from '../phase-provider-fetch/provider-pins';
import { fetchFandomChapterData, fetchWikipediaChapterData } from '../wiki-discovery';

jest.mock('@/server/db', () => ({ prisma: {} }));
jest.mock('@/server/services/fandom/adaptive', () => ({ adaptiveParse: jest.fn() }));
jest.mock('../manual-binding-sentinel', () => ({
  isManuallyUnbound: jest.fn(),
  isManuallyUnboundFromMetadata: jest.fn(() => false),
}));
jest.mock('../wiki-discovery/direct-chapter-extract', () => ({ directChapterExtract: jest.fn(() => Promise.resolve([])) }));

const mockedParse = jest.mocked(adaptiveParse);
const mockedUnbound = jest.mocked(isManuallyUnbound);

describe('fetchWikipediaChapterData — failure signal', () => {
  it('tells the caller when the fetch threw, so its null is not read as "no article"', async () => {
    mockedUnbound.mockRejectedValue(new Error('connection reset'));
    const onFailure = jest.fn();

    await expect(fetchWikipediaChapterData('Bleach', 73, undefined, onFailure)).resolves.toBeNull();

    expect(onFailure).toHaveBeenCalledWith('connection reset');
  });

  it('stays silent when Wikipedia was skipped because the user unbound it', async () => {
    mockedUnbound.mockResolvedValue(true);
    const onFailure = jest.fn();

    await expect(fetchWikipediaChapterData('Bleach', 73, undefined, onFailure)).resolves.toBeNull();

    expect(onFailure).not.toHaveBeenCalled();
  });
});

describe('fetchFandomChapterData — chapter page tally', () => {
  it('adds every batch of chapter pages the parser reports to the caller\'s tally', async () => {
    mockedParse.mockImplementation((_input, options) => {
      options?.onChapterPages?.(110, 0);
      options?.onChapterPages?.(110, 110);
      return Promise.reject(new Error('stop after reporting'));
    });
    const pages = { requested: 0, fetched: 0 };

    await fetchFandomChapterData('https://bleach.fandom.com', 'Bleach', undefined, pages);

    expect(pages).toEqual({ requested: 220, fetched: 110 });
  });

  it('does not ask the parser to report when the caller keeps no tally', async () => {
    mockedParse.mockRejectedValue(new Error('stop'));

    await fetchFandomChapterData('https://bleach.fandom.com', 'Bleach');

    const options = mockedParse.mock.calls[mockedParse.mock.calls.length - 1]?.[1];
    expect(options?.onChapterPages).toBeUndefined();
  });
});

describe('buildProviderDirectives — failure sinks', () => {
  const noRejections = (): ReadonlySet<string> => new Set<string>();

  it('gives Kitsu and MangaUpdates a sink that names the provider', () => {
    const onFailure = jest.fn();
    const directives = buildProviderDirectives({}, noRejections, onFailure);

    directives.kitsu.onFailure?.('Kitsu 503');
    directives.mangaupdates.onFailure?.('MU 502');

    expect(onFailure.mock.calls).toEqual([['kitsu', 'Kitsu 503'], ['mangaupdates', 'MU 502']]);
  });

  it('leaves the directives without a sink when the phase has none to give', () => {
    const directives = buildProviderDirectives({}, noRejections);
    expect(directives.kitsu.onFailure).toBeUndefined();
    expect(directives.mangaupdates.onFailure).toBeUndefined();
  });
});
