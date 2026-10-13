/**
 * @jest-environment node
 */
/**
 * cachingMiddleware keys on each call's own input and on the caller.
 *
 * Runs through tRPC's real HTTP handling (fetch adapter), including batched
 * requests, because the bug it guards against only appeared there: the key
 * used the whole request's input, so two calls to one procedure in a batch
 * shared a cache entry and one got the other's answer.
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { z } from 'zod';

import { cache } from '@/server/cache/cache-adapter';
import { cachingMiddleware } from '@/server/trpc/middleware';
import { procedure, router } from '@/server/trpc/trpc';

// superjson is ESM-only under Jest; the existing tRPC suites use this same pass-through.
jest.mock('superjson', () => ({
  __esModule: true,
  default: {
    serialize: jest.fn((data: unknown) => ({ json: data, meta: undefined })),
    deserialize: jest.fn((data: { json: unknown }) => data.json),
    parse: jest.fn((str: string) => JSON.parse(str) as unknown),
    stringify: jest.fn((data: unknown) => JSON.stringify(data)),
    registerClass: jest.fn(),
    registerCustom: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

let executions = 0;

const testRouter = router({
  echo: procedure
    .use(cachingMiddleware(30_000))
    .input(z.object({ genre: z.string() }))
    .query(({ input, ctx }) => {
      executions++;
      const user = (ctx as { user?: { id?: string } }).user?.id ?? 'anon';
      return `${input.genre} for ${user}`;
    }),
});

async function call(url: string, userId?: string): Promise<unknown> {
  const res = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req: new Request(`http://test/api/trpc/${url}`),
    router: testRouter,
    createContext: () => (userId ? { user: { id: userId } } : {}) as never,
  });
  return res.json();
}

function batchUrl(genres: string[]): string {
  const input = Object.fromEntries(genres.map((g, i) => [String(i), { json: { genre: g } }]));
  return `${genres.map(() => 'echo').join(',')}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;
}

function results(body: unknown): unknown[] {
  return (body as Array<{ result: { data: { json: unknown } } }>).map(r => r.result.data.json);
}

describe('cachingMiddleware', () => {
  beforeEach(async () => {
    executions = 0;
    await cache.clear('trpc:echo*');
  });

  it('answers each call of a repeated batch with its own result', async () => {
    const url = batchUrl(['Mystery', 'Drama']);
    expect(results(await call(url, 'u1'))).toEqual(['Mystery for u1', 'Drama for u1']);
    // The second identical batch is served from the cache, still per call.
    expect(results(await call(url, 'u1'))).toEqual(['Mystery for u1', 'Drama for u1']);
  });

  it('does not serve one user the result cached for another', async () => {
    const url = batchUrl(['Mystery']);
    expect(results(await call(url, 'u1'))).toEqual(['Mystery for u1']);
    expect(results(await call(url, 'u2'))).toEqual(['Mystery for u2']);
  });

  it('still caches a repeated call from the same user', async () => {
    const url = batchUrl(['Mystery']);
    await call(url, 'u1');
    await call(url, 'u1');
    expect(executions).toBe(1);
  });
});
