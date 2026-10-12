/**
 * @jest-environment node
 *
 * Kitsu and MangaUpdates services answer "nothing" when their client throws.
 * The optional callback is how a caller learns that "nothing" was an error.
 */
import { describe, expect, it, jest } from '@jest/globals';

import * as kitsuClient from '@/server/services/kitsu/client';
import { kitsuService } from '@/server/services/kitsu/service';
import * as muClient from '@/server/services/mangaupdates/client';
import { mangaUpdatesService } from '@/server/services/mangaupdates/service';

jest.mock('@/server/services/kitsu/client');
jest.mock('@/server/services/mangaupdates/client');

const kitsu = jest.mocked(kitsuClient);
const mangaUpdates = jest.mocked(muClient);

describe('Kitsu service — telling an error from an empty answer', () => {
  it('reports the error when a search fails, and still returns an empty list', async () => {
    kitsu.searchManga.mockRejectedValue(new Error('Kitsu 503'));
    const onFailure = jest.fn();

    await expect(kitsuService.searchManga('Bleach', 5, onFailure)).resolves.toEqual([]);

    expect(onFailure).toHaveBeenCalledWith('Kitsu 503');
  });

  it('reports the error when a fetch by id fails, and still returns null', async () => {
    kitsu.getMangaDetails.mockRejectedValue(new Error('socket hang up'));
    const onFailure = jest.fn();

    await expect(kitsuService.getMangaDetails('37', onFailure)).resolves.toBeNull();

    expect(onFailure).toHaveBeenCalledWith('socket hang up');
  });

  it('stays silent when the search answers with no results', async () => {
    kitsu.searchManga.mockResolvedValue({ data: [] } as never);
    const onFailure = jest.fn();

    await expect(kitsuService.searchManga('Bleach', 5, onFailure)).resolves.toEqual([]);

    expect(onFailure).not.toHaveBeenCalled();
  });
});

describe('MangaUpdates service — telling an error from an empty answer', () => {
  it('reports the error when a search fails, and still returns an empty list', async () => {
    mangaUpdates.searchSeries.mockRejectedValue(new Error('MU 502'));
    const onFailure = jest.fn();

    await expect(mangaUpdatesService.searchSeries('Bleach', 10, onFailure)).resolves.toEqual([]);

    expect(onFailure).toHaveBeenCalledWith('MU 502');
  });

  it('reports the error when a fetch by id fails, and still returns null', async () => {
    mangaUpdates.getSeriesDetails.mockRejectedValue(new Error('timeout'));
    const onFailure = jest.fn();

    await expect(mangaUpdatesService.getSeriesDetails(777, onFailure)).resolves.toBeNull();

    expect(onFailure).toHaveBeenCalledWith('timeout');
  });

  it('stays silent when the search answers with no results', async () => {
    mangaUpdates.searchSeries.mockResolvedValue({ results: [] } as never);
    const onFailure = jest.fn();

    await expect(mangaUpdatesService.searchSeries('Bleach', 10, onFailure)).resolves.toEqual([]);

    expect(onFailure).not.toHaveBeenCalled();
  });
});
