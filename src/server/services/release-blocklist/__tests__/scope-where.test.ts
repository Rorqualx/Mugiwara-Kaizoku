/**
 * Tests for the shared blocklist scope-WHERE builder.
 *
 * Both `blocklist-checker.ts` (per-release path) and
 * `prowlarr/batch-blocklist.ts` (batch path) consume this builder, so any
 * change to the NULL-wildcard semantics MUST be caught here before it
 * silently diverges one path from the other (the bug Fix 2 was written
 * to prevent).
 */

import { describe, it, expect } from '@jest/globals';

import { buildBlocklistScopeWhere } from '../scope-where';

import type { Prisma } from '@prisma/client';

function getAnds(where: Prisma.ReleaseBlocklistWhereInput): Prisma.ReleaseBlocklistWhereInput[] {
  const ands = where.AND;
  if (Array.isArray(ands)) return ands;
  if (ands !== undefined) return [ands];
  return [];
}

describe('buildBlocklistScopeWhere', () => {
  it('returns an empty WHERE when no scope is given (legacy global behavior)', () => {
    const where = buildBlocklistScopeWhere({});
    expect(where).toEqual({});
  });

  it('source-only: matches rows with that source OR source=null', () => {
    const where = buildBlocklistScopeWhere({ source: 'Nyaa.si' });
    const ands = getAnds(where);
    expect(ands).toHaveLength(1);
    expect(ands[0]).toEqual({ OR: [{ source: 'Nyaa.si' }, { source: null }] });
  });

  it('mangaId-only: matches rows with that mangaId OR mangaId=null', () => {
    const where = buildBlocklistScopeWhere({ mangaId: 80 });
    const ands = getAnds(where);
    expect(ands).toHaveLength(1);
    expect(ands[0]).toEqual({ OR: [{ mangaId: 80 }, { mangaId: null }] });
  });

  it('source + mangaId: both clauses are ANDed together', () => {
    const where = buildBlocklistScopeWhere({ source: 'Nyaa.si', mangaId: 80 });
    const ands = getAnds(where);
    expect(ands).toHaveLength(2);
    expect(ands).toContainEqual({ OR: [{ source: 'Nyaa.si' }, { source: null }] });
    expect(ands).toContainEqual({ OR: [{ mangaId: 80 }, { mangaId: null }] });
  });

  it('treats mangaId=0 as a real scope, not a wildcard', () => {
    // Guard against accidentally falsy-checking mangaId — 0 is a valid id
    // in some environments (it isn't in this codebase today, but the
    // builder shouldn't make that assumption).
    const where = buildBlocklistScopeWhere({ mangaId: 0 });
    const ands = getAnds(where);
    expect(ands).toHaveLength(1);
    expect(ands[0]).toEqual({ OR: [{ mangaId: 0 }, { mangaId: null }] });
  });
});
