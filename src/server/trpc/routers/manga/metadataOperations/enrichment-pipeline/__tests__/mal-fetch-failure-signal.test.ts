/**
 * @jest-environment node
 */
import { jikanService } from '@/server/services/jikan';

import { fetchMALDirect } from '../phase-provider-fetch/mal-fetch';

jest.mock('@/server/services/jikan', () => ({
  jikanService: { getMangaByMALId: jest.fn(), getMangaRecommendationsByMALId: jest.fn() },
}));
jest.mock('@/server/utils/configReader', () => ({ getConfigBoolean: jest.fn() }));

const mockedGet = jest.mocked(jikanService.getMangaByMALId);

describe('fetchMALDirect — passing on the "Jikan did not answer" signal', () => {
  it('tells the caller when Jikan was unreachable, so null is not read as "MAL has no data"', async () => {
    mockedGet.mockImplementation((_malId, onFailure) => {
      onFailure?.('This operation was aborted');
      return Promise.resolve(null);
    });
    const onFailure = jest.fn();

    await expect(fetchMALDirect(12, onFailure)).resolves.toBeNull();

    expect(onFailure).toHaveBeenCalledWith('This operation was aborted');
  });

  it('stays silent when Jikan answered with nothing', async () => {
    mockedGet.mockResolvedValue(null);
    const onFailure = jest.fn();

    await expect(fetchMALDirect(12, onFailure)).resolves.toBeNull();

    expect(onFailure).not.toHaveBeenCalled();
  });
});
