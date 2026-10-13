/**
 * Library grid view settings as sent to the server.
 *
 * The library grid is paged: the server filters, searches and sorts the whole
 * library and returns one page at a time (manga.query with `view`). This module
 * turns the library view store's settings into that wire shape and holds the
 * small pure helpers shared by the page and the server.
 *
 * Regex search is the one setting the server does not run (a user-supplied
 * pattern executed on the server can stall it). While a regex search is
 * active the grid loads every page and filters on the client, as before.
 *
 * @module utils/library/grid-view
 */
import type { AdvancedFilter, FilterOption, SearchField, SortOption } from '@/store/libraryViewSlice';

/** Comicbook-tracking media toggle on the library page. */
export type GridMediaType = 'all' | 'manga' | 'comicbook';

/** Reading-status values of the advanced filter. */
export type GridReadingStatus = NonNullable<AdvancedFilter['readingStatus']>[number];

/**
 * Advanced filters on the wire. Dates travel as strings (the persisted store
 * already holds them as ISO strings after a reload); options that filter
 * nothing (null, empty list) are left out.
 */
export interface GridAdvancedFilter {
  dateAddedFrom?: string;
  dateAddedTo?: string;
  lastReadFrom?: string;
  lastReadTo?: string;
  chaptersMin?: number;
  chaptersMax?: number;
  genres?: string[];
  tags?: string[];
  excludeGenres?: string[];
  excludeTags?: string[];
  publicationStatus?: string[];
  readingStatus?: GridReadingStatus[];
  ratingMin?: number;
  ratingMax?: number;
  monitored?: boolean;
  countryOfOrigin?: string[];
}

/** What the server needs to filter, search and sort a library. */
export interface LibraryGridView {
  sortBy: SortOption;
  filterBy: FilterOption[];
  searchQuery: string;
  searchField: SearchField;
  advancedFilters: GridAdvancedFilter;
  mediaType: GridMediaType;
}

/** The library view store settings the grid depends on. */
export interface GridViewSettings {
  sortBy: SortOption;
  filterBy: FilterOption[];
  searchQuery: string;
  searchField: SearchField;
  enableRegexSearch: boolean;
  advancedFilters: AdvancedFilter;
  mediaType: GridMediaType;
}

const DATE_KEYS = ['dateAddedFrom', 'dateAddedTo', 'lastReadFrom', 'lastReadTo'] as const;
const NUMBER_KEYS = ['chaptersMin', 'chaptersMax', 'ratingMin', 'ratingMax'] as const;
const LIST_KEYS = ['genres', 'tags', 'excludeGenres', 'excludeTags', 'publicationStatus', 'countryOfOrigin'] as const;

/**
 * Serializes a filter date. The client filter only checks that the value is
 * truthy and then compares `new Date(value)`, so an unparseable value must
 * still be sent (it filters nothing either way).
 */
function wireDate(value: unknown): string | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  if (typeof value === 'string' && value !== '') return value;
  return undefined;
}

/** Drops the advanced options that filter nothing and serializes dates. */
export function toWireAdvancedFilter(filters: AdvancedFilter): GridAdvancedFilter {
  const out: GridAdvancedFilter = {};
  for (const key of DATE_KEYS) {
    const value = wireDate(filters[key]);
    if (value !== undefined) out[key] = value;
  }
  for (const key of NUMBER_KEYS) {
    const value = filters[key];
    // NaN cannot travel as JSON; the inputs never produce it.
    if (typeof value === 'number' && !Number.isNaN(value)) out[key] = value;
  }
  for (const key of LIST_KEYS) {
    const value = filters[key];
    if (Array.isArray(value) && value.length > 0) out[key] = [...value];
  }
  if (Array.isArray(filters.readingStatus) && filters.readingStatus.length > 0) {
    out.readingStatus = [...filters.readingStatus];
  }
  if (typeof filters.monitored === 'boolean') out.monitored = filters.monitored;
  return out;
}

/** True while a regex search is active: the grid then filters on the client. */
export function needsClientSearch(settings: Pick<GridViewSettings, 'enableRegexSearch' | 'searchQuery'>): boolean {
  return settings.enableRegexSearch && settings.searchQuery !== '';
}

/**
 * The view the server runs. A regex search is left out (the client applies it
 * after loading every page); everything else is sent.
 */
export function buildServerView(settings: GridViewSettings): LibraryGridView {
  return {
    sortBy: settings.sortBy,
    filterBy: [...settings.filterBy],
    searchQuery: needsClientSearch(settings) ? '' : settings.searchQuery,
    searchField: settings.searchField,
    advancedFilters: toWireAdvancedFilter(settings.advancedFilters),
    mediaType: settings.mediaType,
  };
}

/** Stable identity of a view: the grid starts over from the first page when it changes. */
export function gridViewKey(view: LibraryGridView): string {
  const advanced = Object.fromEntries(
    Object.entries(view.advancedFilters).sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify([view.sortBy, view.filterBy, view.searchQuery, view.searchField, advanced, view.mediaType]);
}

/** Library order with nothing filtered: the title skeletons can then predict the next rows. */
export function isUnfilteredAlphabetical(view: LibraryGridView): boolean {
  return view.sortBy === 'alphabetical'
    && view.filterBy.length === 0
    && view.searchQuery === ''
    && Object.keys(view.advancedFilters).length === 0
    && view.mediaType === 'all';
}

/**
 * True when the view's filter or order depends on chapter state (read,
 * downloaded, monitored, counts), so a chapter update can move titles between
 * pages or in and out of the result.
 */
export function viewDependsOnChapters(view: LibraryGridView): boolean {
  const a = view.advancedFilters;
  return view.sortBy === 'last-read'
    || view.sortBy === 'progress'
    || a.lastReadFrom !== undefined
    || a.lastReadTo !== undefined
    || a.chaptersMin !== undefined
    || a.chaptersMax !== undefined
    || a.readingStatus !== undefined
    || a.monitored !== undefined;
}

/**
 * Index of the first title under an alphabet-bar letter ('#' = anything not
 * starting with A–Z), or -1. Same rule the poster view scrolls by.
 */
export function findLetterIndex(rows: ReadonlyArray<{ title: string }>, letter: string): number {
  return rows.findIndex((m) => {
    const firstChar = m.title.charAt(0).toUpperCase();
    if (letter === '#') return firstChar === '' || !/[A-Z]/.test(firstChar);
    return firstChar === letter;
  });
}
