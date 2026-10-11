import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  invalidateSuwayomiReachabilityCache,
  probeSuwayomiResponsive,
  setSuwayomiProbePort,
} from '@/server/services/suwayomi/server-reachable';

describe('Suwayomi reachability probe port', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    setSuwayomiProbePort(4567);
    invalidateSuwayomiReachabilityCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setSuwayomiProbePort(4567);
  });

  it('probes the default port until told otherwise', async () => {
    await probeSuwayomiResponsive();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:4567/api/graphql');
  });

  it('probes the configured port once it is set', async () => {
    setSuwayomiProbePort(4999);
    await probeSuwayomiResponsive();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:4999/api/graphql');
  });
});
