/**
 * @jest-environment node
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { fetchMangaById } from '@/server/services/jikan/client';

const realFetch = globalThis.fetch;

function stubFetch(impl: () => Promise<Response>): void {
  globalThis.fetch = jest.fn(impl) as unknown as typeof fetch;
}

function response(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('Jikan client — telling an outage from "no such manga"', () => {
  it('reports a failure when the request cannot be completed', async () => {
    stubFetch(async () => { throw new Error('This operation was aborted'); });
    const onFailure = jest.fn();

    await expect(fetchMangaById(12, 1, onFailure)).resolves.toBeNull();

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith('This operation was aborted');
  });

  it('reports a failure on a server error', async () => {
    stubFetch(async () => response(503));
    const onFailure = jest.fn();

    await expect(fetchMangaById(12, 1, onFailure)).resolves.toBeNull();

    expect(onFailure).toHaveBeenCalledWith('http_503');
  });

  it('does not report a failure when Jikan answers that the manga does not exist', async () => {
    stubFetch(async () => response(404));
    const onFailure = jest.fn();

    await expect(fetchMangaById(12, 1, onFailure)).resolves.toBeNull();

    expect(onFailure).not.toHaveBeenCalled();
  });

  it('does not report a failure when Jikan returns the manga', async () => {
    stubFetch(async () => response(200, { data: { mal_id: 12, title: 'Bleach' } }));
    const onFailure = jest.fn();

    const result = await fetchMangaById(12, 1, onFailure);

    expect(result?.data?.mal_id).toBe(12);
    expect(onFailure).not.toHaveBeenCalled();
  });
});
