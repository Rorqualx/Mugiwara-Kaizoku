import { afterAll, describe, expect, it, jest } from '@jest/globals';

// The shared test setup replaces this module with a mock; this test is about
// the real one.
jest.unmock('@/server/db');

type DbModule = typeof import('@/server/db');

function loadDbModule(): DbModule {
  let loaded: DbModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module copy per call is the point of the test
    loaded = require('@/server/db') as DbModule;
  });
  if (!loaded) throw new Error('db module did not load');
  return loaded;
}

describe('database clients across two copies of the module', () => {
  const originalEnv = process.env['NODE_ENV'];

  afterAll(() => {
    Object.assign(process.env, { NODE_ENV: originalEnv });
  });

  it('shares one UI client and one background client per process', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });

    const first = loadDbModule();
    const second = loadDbModule();

    expect(second.prisma).toBe(first.prisma);
    expect(second.backgroundPrisma).toBe(first.backgroundPrisma);
    expect(first.backgroundPrisma).not.toBe(first.prisma);
  });
});
