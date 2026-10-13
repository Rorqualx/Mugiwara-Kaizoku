/**
 * Database side of the paged library grid.
 *
 * `loadOrderedGrid` loads the caller's library as slim candidates (only the
 * columns the view reads, plus chapter stats when it needs them), and orders
 * them with `orderGridCandidates`. manga.query then fetches full rows for one
 * page of that order; the summary procedure reports its length and where a
 * letter starts.
 *
 * @module server/trpc/routers/manga/library-grid/grid-query
 */
import { Prisma } from '@prisma/client';

import type { MangaChapterStats } from '@/components/library/utils/chapter-stats-builder';
import { membershipInLibraryWhere } from '@/server/trpc/routers/_shared/library-access';
import { buildChapterStatsSql } from '@/server/trpc/routers/manga/chapter-stats-sql';
import type { LibraryGridView } from '@/utils/library/grid-view';

import { gridProjection, orderGridCandidates, type GridCandidate, type GridProjection } from './grid-order';

import type { PrismaClient } from '@prisma/client';

/** Ids per IN (...) list: keeps far below Postgres' bind-parameter limit. */
const ID_CHUNK = 2000;

/**
 * Titles the user placed in this library, by LibraryMembership (a linked title
 * keeps another owner's Manga.libraryId). Memberships without a library are
 * folded into the user's first library, exactly as manga.query does.
 */
export async function libraryScopeWhere(
  prisma: PrismaClient,
  userId: string,
  libraryId: number,
): Promise<Prisma.MangaWhereInput> {
  const first = await prisma.library.findFirst({ where: { ownerId: userId }, orderBy: { id: 'asc' }, select: { id: true } });
  return membershipInLibraryWhere(userId, libraryId, first?.id === libraryId);
}

/** Adds the comicbook media toggle to a scope. */
export function withMediaType(where: Prisma.MangaWhereInput, view: LibraryGridView): Prisma.MangaWhereInput {
  if (view.mediaType === 'all') return where;
  return { AND: [where, { mediaType: view.mediaType === 'manga' ? 'MANGA' : 'COMICBOOK' }] };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Chapter stats for every candidate (the parity-validated SQL aggregate). */
async function loadChapterStats(ids: number[], userId: string): Promise<Map<number, MangaChapterStats>> {
  const out = new Map<number, MangaChapterStats>();
  for (const part of chunk(ids, ID_CHUNK)) {
    // eslint-disable-next-line no-await-in-loop -- one aggregate at a time keeps the DB pool free for other requests
    const stats = await buildChapterStatsSql(part, userId);
    for (const [id, s] of stats) out.set(id, s);
  }
  return out;
}

function metadataSelect(projection: GridProjection): Prisma.MetadataSelect | null {
  if (projection.metadata.length === 0) return null;
  return Object.fromEntries(projection.metadata.map((f) => [f, true])) as Prisma.MetadataSelect;
}

/**
 * Loads the library's candidates for a view. Rows come in title order (by id
 * for ties), the order the grid's pages were fetched in before, so a sort
 * that leaves titles tied keeps them in the same relative order.
 */
export async function loadGridCandidates(
  prisma: PrismaClient,
  where: Prisma.MangaWhereInput,
  userId: string,
  view: LibraryGridView,
): Promise<GridCandidate[]> {
  const projection = gridProjection(view);
  const metaSelect = metadataSelect(projection);
  const rows = await prisma.manga.findMany({
    where: withMediaType(where, view),
    select: {
      id: true,
      title: true,
      createdAt: true,
      publicationStatus: true,
      ...(metaSelect ? { Metadata: { select: metaSelect } } : {}),
    },
    orderBy: [{ title: 'asc' }, { id: 'asc' }],
  });
  const candidates = rows as unknown as GridCandidate[];
  if (!projection.chapterStats) return candidates;
  const stats = await loadChapterStats(candidates.map((c) => c.id), userId);
  return candidates.map((c) => {
    const s = stats.get(c.id);
    return s ? { ...c, chapterStats: s } : c;
  });
}

/** Rows rearranged into the order of `ids` (rows whose id is not listed are dropped). */
export function inIdOrder<T extends { id: number }>(rows: T[], ids: readonly number[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) out.push(row);
  }
  return out;
}

/** The library filtered, searched and sorted for a view: the grid's full order. */
export async function loadOrderedGrid(
  prisma: PrismaClient,
  where: Prisma.MangaWhereInput,
  userId: string,
  view: LibraryGridView,
): Promise<GridCandidate[]> {
  return orderGridCandidates(await loadGridCandidates(prisma, where, userId, view), view);
}

/**
 * Distinct genres and tags across the library, sorted as the filter panel
 * sorted them (`Array.prototype.sort`, code-unit order).
 */
export async function loadLibraryFacets(
  prisma: PrismaClient,
  where: Prisma.MangaWhereInput,
): Promise<{ genres: string[]; tags: string[] }> {
  const ids = (await prisma.manga.findMany({ where, select: { id: true } })).map((m) => m.id);
  const genres = new Set<string>();
  const tags = new Set<string>();
  for (const part of chunk(ids, ID_CHUNK)) {
    // eslint-disable-next-line no-await-in-loop -- one chunk at a time keeps the DB pool free for other requests
    const rows = await prisma.$queryRaw<Array<{ kind: string; value: string }>>(Prisma.sql`
      SELECT DISTINCT 'g' AS kind, g AS value
      FROM "Manga" m JOIN "Metadata" md ON md."id" = m."metadataId", unnest(md."genres") AS g
      WHERE m."id" IN (${Prisma.join(part)})
      UNION
      SELECT DISTINCT 't' AS kind, t AS value
      FROM "Manga" m JOIN "Metadata" md ON md."id" = m."metadataId", unnest(md."tags") AS t
      WHERE m."id" IN (${Prisma.join(part)})
    `);
    for (const r of rows) (r.kind === 'g' ? genres : tags).add(r.value);
  }
  return { genres: [...genres].sort(), tags: [...tags].sort() };
}
