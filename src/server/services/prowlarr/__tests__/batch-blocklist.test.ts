/**
 * Tests for the scope-aware batch blocklist checker.
 *
 * The earlier shape was scope-blind: a row blocking title `T` for manga A
 * would also suppress same-titled releases for manga B because the WHERE
 * only filtered by `isActive: true` + title/pattern. After Fix 2 the
 * checker delegates to the shared `buildBlocklistScopeWhere` so legitimate
 * cross-manga title collisions no longer silently drop dispatches.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { BatchBlocklistChecker } from '../batch-blocklist';

import type { PrismaClient } from '@prisma/client';

function flattenClauses(where: unknown): Record<string, unknown>[] {
  if (!where || typeof where !== 'object') return [];
  const w = where as Record<string, unknown>;
  const out: Record<string, unknown>[] = [w];
  for (const key of ['AND', 'OR'] as const) {
    const branch = w[key];
    if (Array.isArray(branch)) {
      for (const c of branch) out.push(...flattenClauses(c));
    }
  }
  return out;
}

interface MockedPrisma {
  releaseBlocklist: { findMany: jest.Mock };
}

function buildMockPrisma(): MockedPrisma {
  const findMany = jest.fn() as jest.Mock;
  findMany.mockImplementation(() => Promise.resolve([]));
  return { releaseBlocklist: { findMany } };
}

describe('BatchBlocklistChecker.checkReleases', () => {
  let mocked: MockedPrisma;
  let checker: BatchBlocklistChecker;

  beforeEach(() => {
    mocked = buildMockPrisma();
    checker = new BatchBlocklistChecker(mocked as unknown as PrismaClient);
  });

  it('issues a global WHERE when no scope is given (legacy behavior)', async () => {
    await checker.checkReleases([{ id: 'g1', title: 'Akira v01' }]);
    expect(mocked.releaseBlocklist.findMany).toHaveBeenCalledTimes(1);
    const callArg = mocked.releaseBlocklist.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    const clauses = flattenClauses(callArg.where);
    // No source-scope and no mangaId-scope clauses should appear anywhere
    // in the WHERE tree — only the title/pattern OR + isActive.
    const hasSourceScope = clauses.some(c => 'source' in c);
    const hasMangaScope = clauses.some(c => 'mangaId' in c);
    expect(hasSourceScope).toBe(false);
    expect(hasMangaScope).toBe(false);
  });

  it('threads mangaId into the WHERE so cross-manga title collisions don\'t leak', async () => {
    await checker.checkReleases([{ id: 'g1', title: 'Akira v01' }], { mangaId: 80 });
    const callArg = mocked.releaseBlocklist.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    const clauses = flattenClauses(callArg.where);
    const mangaClause = clauses.find(c => 'mangaId' in c) as { mangaId: unknown } | undefined;
    expect(mangaClause).toBeDefined();
    // The mangaId leaf must be either the literal id or the null wildcard.
    const mangaValues = clauses
      .filter(c => 'mangaId' in c)
      .map(c => (c as { mangaId: unknown }).mangaId);
    expect(mangaValues).toContain(80);
    expect(mangaValues).toContain(null);
  });

  it('threads source into the WHERE so cross-source blocks stay scoped', async () => {
    await checker.checkReleases([{ id: 'g1', title: 'Akira v01' }], { source: 'Nyaa.si' });
    const callArg = mocked.releaseBlocklist.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    const clauses = flattenClauses(callArg.where);
    const sourceValues = clauses
      .filter(c => 'source' in c)
      .map(c => (c as { source: unknown }).source);
    expect(sourceValues).toContain('Nyaa.si');
    expect(sourceValues).toContain(null);
  });

  it('returns an empty result map when no releases are given (early exit)', async () => {
    const out = await checker.checkReleases([]);
    expect(out.size).toBe(0);
    expect(mocked.releaseBlocklist.findMany).not.toHaveBeenCalled();
  });

  it('marks a release blocked when its title exactly matches an active row', async () => {
    (mocked.releaseBlocklist.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'row1', title: 'Akira v01', reason: 'USER_PREFERENCE', pattern: null },
    ] as never);

    const result = await checker.checkReleases(
      [{ id: 'g1', title: 'Akira v01' }, { id: 'g2', title: 'Other Series v01' }],
      { mangaId: 80 },
    );

    expect(result.get('g1')?.isBlocked).toBe(true);
    expect(result.get('g1')?.reason).toBe('USER_PREFERENCE');
    expect(result.get('g2')?.isBlocked).toBe(false);
  });
});
