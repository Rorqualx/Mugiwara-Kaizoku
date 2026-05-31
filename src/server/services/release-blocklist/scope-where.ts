/**
 * Shared blocklist scope-WHERE builder.
 *
 * A manga-scoped or source-scoped `ReleaseBlocklist` row must not match
 * releases outside that scope, but rows with `mangaId = NULL` (or
 * `source = NULL`) ARE the "any" wildcard and must match every release.
 * That semantic was originally implemented in `blocklist-checker.ts` and
 * was duplicated nowhere — so the parallel batch path
 * (`prowlarr/batch-blocklist.ts`) silently diverged into a fully
 * scope-blind global lookup. This module is the single source of truth
 * both paths now import from.
 *
 * Returns a `WhereInput` fragment intended to be ANDed onto whatever
 * primary predicate the caller has (title/hash/pattern/group). The
 * fragment is empty when neither scope dimension is given, so it stays
 * a no-op in the legacy global-only call shape.
 */

import type { Prisma } from '@prisma/client';

export interface BlocklistScope {
  /** Identifier source (e.g. 'Nyaa.si', 'getcomics', 'prowlarr'). */
  source?: string | undefined;
  /** Numeric Manga id; pass `undefined` to skip manga-scoping entirely. */
  mangaId?: number | undefined;
}

/**
 * Build the scope-WHERE fragment for `releaseBlocklist.findMany/findFirst`.
 *
 * - `source: 'X'`     → matches rows with source='X' OR source=null
 * - `mangaId: 80`     → matches rows with mangaId=80 OR mangaId=null
 * - neither           → empty (matches everything; preserves legacy behavior)
 *
 * Both clauses are ANDed when both are present.
 */
export function buildBlocklistScopeWhere(scope: BlocklistScope): Prisma.ReleaseBlocklistWhereInput {
  const out: Prisma.ReleaseBlocklistWhereInput = {};
  const ands: Prisma.ReleaseBlocklistWhereInput[] = [];

  if (scope.source !== undefined) {
    ands.push({ OR: [{ source: scope.source }, { source: null }] });
  }
  if (scope.mangaId !== undefined) {
    ands.push({ OR: [{ mangaId: scope.mangaId }, { mangaId: null }] });
  }

  if (ands.length > 0) {
    out.AND = ands;
  }
  return out;
}
