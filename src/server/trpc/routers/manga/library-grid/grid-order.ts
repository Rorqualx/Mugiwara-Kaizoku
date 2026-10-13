/**
 * Orders a library for the paged grid.
 *
 * The grid used to load every title and run `filterAndSortManga` in the
 * browser. The server now runs that SAME function over a slim projection of
 * the library (only the fields the active view reads) and hands back one page
 * of the result, so search, filters and sort give exactly the results they gave
 * before. The sort could not move into SQL: titles are compared with ICU
 * `localeCompare(numeric, base)`, which Postgres can only reproduce with a
 * custom collation (a migration), and the database collation here is `C`.
 *
 * @module server/trpc/routers/manga/library-grid/grid-order
 */
import type { MangaChapterStats } from '@/components/library/utils/chapter-stats-builder';
import { filterAndSortManga } from '@/components/library/utils/libraryUtils';
import type { AdvancedFilter, SearchField } from '@/store/libraryViewSlice';
import { viewDependsOnChapters, type GridAdvancedFilter, type LibraryGridView } from '@/utils/library/grid-view';

import type { MangaPublicationStatus, Prisma } from '@prisma/client';

/** Metadata columns the grid's search, filters and sort can read. */
export type GridMetadataField = 'synonyms' | 'authors' | 'artists' | 'genres' | 'tags' | 'rating' | 'countryOfOrigin';

/** The Metadata a candidate carries: only the projected columns are present. */
export interface GridCandidateMetadata {
  synonyms?: string[];
  authors?: string[];
  artists?: string[];
  genres?: string[];
  tags?: string[];
  rating?: Prisma.JsonValue;
  countryOfOrigin?: string | null;
}

/** One library title, reduced to what ordering it needs. */
export interface GridCandidate {
  id: number;
  title: string;
  createdAt: Date;
  publicationStatus: MangaPublicationStatus;
  Metadata?: GridCandidateMetadata | null;
  chapterStats?: MangaChapterStats;
}

/** What to load for a view. */
export interface GridProjection {
  metadata: GridMetadataField[];
  chapterStats: boolean;
}

const SEARCH_FIELD_COLUMNS: Record<SearchField, GridMetadataField[]> = {
  title: ['synonyms'],
  author: ['authors'],
  artist: ['artists'],
  genre: ['genres'],
  tag: ['tags'],
  all: ['synonyms', 'authors', 'artists', 'genres', 'tags'],
};

/** The columns (and whether chapter stats) the given view reads. */
export function gridProjection(view: LibraryGridView): GridProjection {
  const fields = new Set<GridMetadataField>();
  if (view.searchQuery !== '') {
    for (const f of SEARCH_FIELD_COLUMNS[view.searchField]) fields.add(f);
  }
  const a = view.advancedFilters;
  if (a.genres !== undefined || a.excludeGenres !== undefined) fields.add('genres');
  if (a.tags !== undefined || a.excludeTags !== undefined) fields.add('tags');
  if (view.sortBy === 'rating' || a.ratingMin !== undefined || a.ratingMax !== undefined) fields.add('rating');
  if (a.countryOfOrigin !== undefined) fields.add('countryOfOrigin');
  return { metadata: [...fields].sort(), chapterStats: viewDependsOnChapters(view) };
}

/**
 * Reduces a full row to the projection: what the server-side ordering will see.
 * Used by the tests to prove a projection carries every field a view reads.
 */
export function projectForView(row: GridCandidate, projection: GridProjection): GridCandidate {
  const out: GridCandidate = { id: row.id, title: row.title, createdAt: row.createdAt, publicationStatus: row.publicationStatus };
  if (projection.metadata.length > 0) {
    const meta = row.Metadata;
    out.Metadata = meta ? Object.fromEntries(projection.metadata.map((f) => [f, meta[f]])) as GridCandidateMetadata : null;
  }
  if (projection.chapterStats && row.chapterStats) out.chapterStats = row.chapterStats;
  return out;
}

/** Wire advanced filters back to the store's shape (dates as Date). */
export function toAdvancedFilter(wire: GridAdvancedFilter): AdvancedFilter {
  const { dateAddedFrom, dateAddedTo, lastReadFrom, lastReadTo, ...rest } = wire;
  const out: AdvancedFilter = { ...rest };
  if (dateAddedFrom !== undefined) out.dateAddedFrom = new Date(dateAddedFrom);
  if (dateAddedTo !== undefined) out.dateAddedTo = new Date(dateAddedTo);
  if (lastReadFrom !== undefined) out.lastReadFrom = new Date(lastReadFrom);
  if (lastReadTo !== undefined) out.lastReadTo = new Date(lastReadTo);
  return out;
}

type FilterSortInput = Parameters<typeof filterAndSortManga>[0];

/**
 * Filters, searches and sorts the candidates with the grid's own
 * `filterAndSortManga` (regex off: the server never runs a regex search).
 * The media-type toggle is applied by the caller's query.
 */
export function orderGridCandidates(candidates: GridCandidate[], view: LibraryGridView): GridCandidate[] {
  const ordered = filterAndSortManga(candidates as unknown as FilterSortInput, {
    sortBy: view.sortBy,
    filterBy: view.filterBy,
    searchQuery: view.searchQuery,
    searchField: view.searchField,
    enableRegexSearch: false,
    advancedFilters: toAdvancedFilter(view.advancedFilters),
  });
  return ordered as unknown as GridCandidate[];
}
