/**
 * Tests for release blocklist scoping behaviour.
 *
 * Verifies that a manga-scoped or source-scoped blocklist entry doesn't
 * leak across unrelated `Manga` rows / sources. Driven by spying on the
 * Prisma `findFirst`/`findMany` calls and asserting the WHERE clause
 * shape — no real DB needed.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { checkRelease } from '../blocklist-checker';
import { ReleaseBlocklistReason } from '../types';

import type { ReleaseIdentifier } from '../types';
import type { PrismaClient, ReleaseBlocklist } from '@prisma/client';

// Recursively traverse a nested AND/OR tree to collect every leaf clause.
function flattenClauses(where: unknown): Record<string, unknown>[] {
  if (!where || typeof where !== 'object') return [];
  const w = where as Record<string, unknown>;
  const out: Record<string, unknown>[] = [w];
  const ANDs = w['AND'];
  const ORs = w['OR'];
  if (Array.isArray(ANDs)) {
    for (const c of ANDs) out.push(...flattenClauses(c));
  }
  if (Array.isArray(ORs)) {
    for (const c of ORs) out.push(...flattenClauses(c));
  }
  return out;
}

function whereContains(where: unknown, predicate: (c: Record<string, unknown>) => boolean): boolean {
  return flattenClauses(where).some(predicate);
}

interface MockedPrisma {
  releaseBlocklist: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
}

function buildMockPrisma(): MockedPrisma {
  const findFirst = jest.fn() as jest.Mock;
  findFirst.mockImplementation(() => Promise.resolve(null));
  const findMany = jest.fn() as jest.Mock;
  findMany.mockImplementation(() => Promise.resolve([]));
  return {
    releaseBlocklist: { findFirst, findMany },
  };
}

const noopFindAlternatives = (): Promise<{ status: 'success'; data: ReleaseIdentifier[] }> =>
  Promise.resolve({ status: 'success', data: [] });

describe('blocklist-checker scope', () => {
  let mocked: MockedPrisma;

  beforeEach(() => {
    mocked = buildMockPrisma();
  });

  it('passes mangaId scope when release identifier carries one', async () => {
    const release: ReleaseIdentifier = {
      releaseTitle: 'Saga',
      mangaId: 42,
      source: 'getcomics',
    };
    await checkRelease(mocked as unknown as PrismaClient, release, noopFindAlternatives);

    const titleCallArgs = mocked.releaseBlocklist.findFirst.mock.calls.find((args) => {
      const w = (args[0] as { where?: Record<string, unknown> }).where;
      return w?.['title'] === 'Saga';
    });
    expect(titleCallArgs).toBeDefined();
    const where = (titleCallArgs?.[0] as { where: unknown }).where;

    expect(
      whereContains(where, (c) => Array.isArray(c['OR']) && (c['OR'] as Array<Record<string, unknown>>).some((o) => o['mangaId'] === 42)),
    ).toBe(true);
    expect(
      whereContains(where, (c) => Array.isArray(c['OR']) && (c['OR'] as Array<Record<string, unknown>>).some((o) => o['source'] === 'getcomics')),
    ).toBe(true);
  });

  it('omits mangaId scope when release identifier has no mangaId', async () => {
    const release: ReleaseIdentifier = {
      releaseTitle: 'Saga',
      source: 'getcomics',
    };
    await checkRelease(mocked as unknown as PrismaClient, release, noopFindAlternatives);

    const titleCallArgs = mocked.releaseBlocklist.findFirst.mock.calls.find((args) => {
      const w = (args[0] as { where?: Record<string, unknown> }).where;
      return w?.['title'] === 'Saga';
    });
    expect(titleCallArgs).toBeDefined();
    const where = (titleCallArgs?.[0] as { where: unknown }).where;

    expect(
      whereContains(where, (c) => 'mangaId' in c),
    ).toBe(false);
  });

  it('omits source scope when release identifier has no source', async () => {
    const release: ReleaseIdentifier = {
      releaseTitle: 'Saga',
      mangaId: 42,
    };
    await checkRelease(mocked as unknown as PrismaClient, release, noopFindAlternatives);

    const titleCallArgs = mocked.releaseBlocklist.findFirst.mock.calls.find((args) => {
      const w = (args[0] as { where?: Record<string, unknown> }).where;
      return w?.['title'] === 'Saga';
    });
    expect(titleCallArgs).toBeDefined();
    const where = (titleCallArgs?.[0] as { where: unknown }).where;

    expect(
      whereContains(where, (c) => 'source' in c),
    ).toBe(false);
  });

  it('honours title-only blocklist entries (mangaId NULL, source NULL) when caller has both set', async () => {
    // The query uses OR=[mangaId=42, mangaId=null] so a NULL mangaId entry
    // still matches. Same for source. We only need to assert the WHERE
    // shape; Prisma is stubbed.
    const release: ReleaseIdentifier = {
      releaseTitle: 'Saga',
      mangaId: 42,
      source: 'getcomics',
    };
    await checkRelease(mocked as unknown as PrismaClient, release, noopFindAlternatives);

    const titleCallArgs = mocked.releaseBlocklist.findFirst.mock.calls.find((args) => {
      const w = (args[0] as { where?: Record<string, unknown> }).where;
      return w?.['title'] === 'Saga';
    });
    const where = (titleCallArgs?.[0] as { where: unknown }).where;

    expect(
      whereContains(where, (c) => Array.isArray(c['OR']) && (c['OR'] as Array<Record<string, unknown>>).some((o) => o['mangaId'] === null)),
    ).toBe(true);
    expect(
      whereContains(where, (c) => Array.isArray(c['OR']) && (c['OR'] as Array<Record<string, unknown>>).some((o) => o['source'] === null)),
    ).toBe(true);
  });

  it('returns isBlocked=true when title match found and scope matches', async () => {
    mocked.releaseBlocklist.findFirst.mockImplementation((args: unknown) => {
      const where = (args as { where?: Record<string, unknown> }).where;
      if (where?.['hash']) return Promise.resolve(null);
      if (where?.['title'] === 'Saga') {
        const row: ReleaseBlocklist = {
          id: 'block-1',
          title: 'Saga',
          source: 'getcomics',
          mangaId: 42,
          reason: ReleaseBlocklistReason.OTHER,
          details: 'test block',
          isActive: true,
          autoBlocked: false,
          expiryDate: null,
          dateAdded: new Date(),
          hash: null,
          pattern: null,
          group: null,
        };
        return Promise.resolve(row);
      }
      return Promise.resolve(null);
    });

    const result = await checkRelease(
      mocked as unknown as PrismaClient,
      { releaseTitle: 'Saga', mangaId: 42, source: 'getcomics' },
      noopFindAlternatives,
    );

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data.isBlocked).toBe(true);
      expect(result.data.reason).toBe(ReleaseBlocklistReason.OTHER);
      expect(result.data.details).toBe('test block');
    }
  });
});
