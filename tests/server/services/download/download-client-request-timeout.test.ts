/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  DOWNLOAD_CLIENT_REQUEST_TIMEOUT_MS,
  downloadClientRequestSignal,
} from '@/server/services/download/clients/request-timeout';
import { directRequest, proxyRequest } from '@/server/services/download/clients/sabnzbd-api';

describe('download client request time limit', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>();
  const config = {
    apiKey: 'key',
    proxyMode: false,
    proxyPath: '/api/proxy/download-client',
    buildUrl: (path: string): string => `http://sab.local:8080${path}`,
    buildAuthHeaders: (): Record<string, string> => ({}),
  };

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: true }) } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('gives each request its own signal that has not fired yet', () => {
    const first = downloadClientRequestSignal();
    const second = downloadClientRequestSignal();

    expect(DOWNLOAD_CLIENT_REQUEST_TIMEOUT_MS).toBe(30_000);
    expect(first).not.toBe(second);
    expect(first.aborted).toBe(false);
  });

  it('sends SABnzbd requests with a time limit', async () => {
    await directRequest(config, 'queue');
    await proxyRequest(config, 'queue');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('rejects when the client never answers', async () => {
    // Stand in for the 30-second signal with one that is already aborted:
    // fetch must reject rather than wait for a reply.
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal) signal.addEventListener('abort', () => { reject(new Error('timed out')); });
    }));
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const controller = new AbortController();
      setTimeout(() => { controller.abort(); }, 20);
      return controller.signal;
    });

    try {
      await expect(directRequest(config, 'queue')).rejects.toBeDefined();
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});
