/** @jest-environment node */
/**
 * Parity of the server-side library grid ordering with the client pipeline it
 * replaces. The library page used to load every title and run
 * `filterAndSortManga` (after its media-type toggle) in the browser; the
 * server now orders a slim projection of the library. For every view the two
 * must list the same titles in the same order.
 */
import { describe, expect, it } from '@jest/globals';

import type { MangaChapterStats } from '@/components/library/utils/chapter-stats-builder';
import { filterAndSortManga } from '@/components/library/utils/libraryUtils';
import {
  gridProjection,
  orderGridCandidates,
  projectForView,
  toAdvancedFilter,
  type GridCandidate,
  type GridCandidateMetadata,
} from '@/server/trpc/routers/manga/library-grid/grid-order';
import type { AdvancedFilter, FilterOption, SearchField, SortOption } from '@/store/libraryViewSlice';
import { buildServerView, findLetterIndex, type GridMediaType, type GridViewSettings } from '@/utils/library/grid-view';

import type { MangaPublicationStatus } from '@prisma/client';

type FullMeta = Required<GridCandidateMetadata> & { status: string; cover: string | null };
type Row = GridCandidate & { mediaType: 'MANGA' | 'COMICBOOK'; Metadata: FullMeta | null; chapterStats: MangaChapterStats };

function stats(real: number, read: number, downloaded: number, lastReadAt: string | null, monitored: boolean): MangaChapterStats {
  return {
    realChapterCount: real, readCount: read, downloadedCount: downloaded, hasErrors: false,
    latestChapterNumber: real > 0 ? String(real) : null, lastReadAt, isMonitored: monitored,
    tally: { downloadedChapters: downloaded, totalChapters: real, downloadedVolumes: 0, totalVolumes: 0 },
  };
}

function meta(p: Partial<FullMeta>): FullMeta {
  return { synonyms: [], authors: [], artists: [], genres: [], tags: [], rating: null, countryOfOrigin: null, status: 'UNKNOWN', cover: null, ...p };
}

let nextId = 1;
function row(title: string, createdAt: string, status: MangaPublicationStatus, m: FullMeta | null, s: MangaChapterStats, mediaType: Row['mediaType'] = 'MANGA'): Row {
  return { id: nextId++, title, createdAt: new Date(createdAt), publicationStatus: status, mediaType, Metadata: m, chapterStats: s };
}

// Input order = the database's title order (as the grid's pages arrived).
const ROWS: Row[] = [
  row('.hack//Link', '2024-01-05T00:00:00Z', 'COMPLETED', meta({ genres: ['Action', 'Sci-Fi'], tags: ['Virtual World'], rating: 61, countryOfOrigin: 'JP', authors: ['Tatsuya Hamazaki'] }), stats(30, 30, 30, '2024-06-01T10:00:00.000Z', false)),
  row('100 Ghosts', '2024-02-10T00:00:00Z', 'ONGOING', meta({ genres: ['Horror'], rating: { value: 72, source: 'anilist' }, countryOfOrigin: 'KR' }), stats(12, 0, 5, null, true), 'COMICBOOK'),
  row('Akira', '2024-01-05T00:00:00Z', 'COMPLETED', meta({ genres: ['Action', 'Drama'], tags: ['Cyberpunk'], rating: { value: 85 }, countryOfOrigin: 'JP', authors: ['Katsuhiro Otomo'], artists: ['Katsuhiro Otomo'] }), stats(120, 60, 120, '2024-07-01T09:00:00.000Z', true)),
  row('Berserk', '2023-11-20T00:00:00Z', 'ONGOING', meta({ genres: ['Action', 'Drama', 'Horror'], tags: ['Gore'], rating: 92, countryOfOrigin: 'JP', synonyms: ['Beruseruku'], authors: ['Kentaro Miura'] }), stats(370, 370, 300, '2024-08-15T12:00:00.000Z', true)),
  row('One Piece', '2023-10-01T00:00:00Z', 'ONGOING', meta({ genres: ['Action', 'Adventure', 'Comedy'], tags: ['Pirates'], rating: { value: 88, scoredBy: 1000 }, countryOfOrigin: 'JP', authors: ['Eiichiro Oda'] }), stats(1100, 400, 1100, '2024-08-20T08:00:00.000Z', true)),
  row('Solo Leveling', '2024-03-01T00:00:00Z', 'COMPLETED', meta({ genres: ['Action', 'Fantasy'], tags: ['Dungeon'], rating: 80, countryOfOrigin: 'KR', synonyms: ['Na Honjaman Level Up'] }), stats(200, 0, 0, null, false)),
  row('Vol 10 Stories', '2024-03-01T00:00:00Z', 'UNKNOWN', null, stats(0, 0, 0, null, false)),
  row('Vol 2 Stories', '2024-04-01T00:00:00Z', 'HIATUS', meta({ genres: ['Romance'], tags: [], rating: null }), stats(3, 1, 3, '2024-05-01T00:00:00.000Z', false)),
  row('alpha Romance', '2024-04-02T00:00:00Z', 'ONGOING', meta({ genres: ['Romance', 'Comedy'], tags: ['School'], rating: 55, countryOfOrigin: 'CN', artists: ['Oda Studio'] }), stats(40, 10, 40, '2024-08-20T08:00:00.000Z', false)),
  row('Élan Vital', '2024-05-01T00:00:00Z', 'CANCELLED', meta({ genres: ['Drama'], tags: ['Music'], rating: 70, countryOfOrigin: 'FR' }), stats(8, 8, 0, '2024-01-01T00:00:00.000Z', false)),
  row('Zetman', '2024-05-01T00:00:00Z', 'COMPLETED', meta({ genres: ['Action', 'Sci-Fi'], tags: ['Gore', 'Superhero'], rating: { value: 70 } }), { ...stats(1, 0, 1, null, true), hasErrors: true }),
];

/** What the library page did before: media toggle, then filterAndSortManga. */
function clientOrder(settings: GridViewSettings): number[] {
  const media = settings.mediaType === 'all'
    ? ROWS
    : ROWS.filter((r) => (settings.mediaType === 'manga' ? r.mediaType === 'MANGA' : r.mediaType === 'COMICBOOK'));
  const out = filterAndSortManga(media as unknown as Parameters<typeof filterAndSortManga>[0], settings);
  return out.map((m) => m.id);
}

/** The new path: wire view → media filter (SQL) → projection → server ordering. */
function serverOrder(settings: GridViewSettings): number[] {
  const view = buildServerView(settings);
  const projection = gridProjection(view);
  const media = view.mediaType === 'all'
    ? ROWS
    : ROWS.filter((r) => r.mediaType === (view.mediaType === 'manga' ? 'MANGA' : 'COMICBOOK'));
  return orderGridCandidates(media.map((r) => projectForView(r, projection)), view).map((c) => c.id);
}

const SORTS: SortOption[] = ['alphabetical', 'alphabetical-desc', 'date-added', 'date-added-desc', 'last-read', 'progress', 'rating'];

interface Case { name: string; filterBy?: FilterOption[]; searchQuery?: string; searchField?: SearchField; advancedFilters?: AdvancedFilter; mediaType?: GridMediaType }

const CASES: Case[] = [
  { name: 'nothing filtered' },
  { name: 'search all "oda"', searchQuery: 'oda', searchField: 'all' },
  { name: 'search title hits a synonym', searchQuery: 'level up', searchField: 'title' },
  { name: 'search author', searchQuery: 'OTOMO', searchField: 'author' },
  { name: 'search artist', searchQuery: 'studio', searchField: 'artist' },
  { name: 'search genre', searchQuery: 'ror', searchField: 'genre' },
  { name: 'search tag', searchQuery: 'gore', searchField: 'tag' },
  { name: 'search with spaces only', searchQuery: '  ', searchField: 'all' },
  { name: 'filter completed', filterBy: ['completed'] },
  { name: 'filter read', filterBy: ['read'] },
  { name: 'filter unread', filterBy: ['unread'] },
  { name: 'filter in-progress', filterBy: ['in-progress'] },
  { name: 'filter downloaded', filterBy: ['downloaded'] },
  { name: 'filter has-issues', filterBy: ['has-issues'] },
  { name: 'filters read + downloaded', filterBy: ['read', 'downloaded'] },
  { name: 'include genres', advancedFilters: { genres: ['Horror', 'Romance'] } },
  { name: 'include tags + exclude genres', advancedFilters: { tags: ['Gore', 'Pirates'], excludeGenres: ['Horror'] } },
  { name: 'exclude tags', advancedFilters: { excludeTags: ['Gore'] } },
  { name: 'date added range (Date objects)', advancedFilters: { dateAddedFrom: new Date('2024-01-05T00:00:00Z'), dateAddedTo: new Date('2024-04-01T00:00:00Z') } },
  { name: 'date added from (persisted string)', advancedFilters: { dateAddedFrom: '2024-03-01T00:00:00.000Z' as unknown as Date } },
  { name: 'last read range', advancedFilters: { lastReadFrom: new Date('2024-06-01T00:00:00Z'), lastReadTo: new Date('2024-08-16T00:00:00Z') } },
  { name: 'chapters min/max', advancedFilters: { chaptersMin: 3, chaptersMax: 200 } },
  { name: 'chapters min 0 and nulls', advancedFilters: { chaptersMin: 0, chaptersMax: null, ratingMin: null } },
  { name: 'publication status', advancedFilters: { publicationStatus: ['ONGOING', 'HIATUS'] } },
  { name: 'reading status', advancedFilters: { readingStatus: ['partially-read', 'no-chapters'] } },
  { name: 'reading status has-downloaded + chaptersMin (preset)', advancedFilters: { readingStatus: ['has-downloaded'], chaptersMin: 1 } },
  { name: 'rating range', advancedFilters: { ratingMin: 70, ratingMax: 88 } },
  { name: 'monitored yes', advancedFilters: { monitored: true } },
  { name: 'monitored no', advancedFilters: { monitored: false } },
  { name: 'country', advancedFilters: { countryOfOrigin: ['KR', 'FR'] } },
  { name: 'empty lists are no-ops', advancedFilters: { genres: [], tags: [], countryOfOrigin: [] } },
  { name: 'media: manga only', mediaType: 'manga' },
  { name: 'media: comics only', mediaType: 'comicbook' },
  { name: 'combined', filterBy: ['completed'], searchQuery: 'a', searchField: 'all', advancedFilters: { genres: ['Action'], ratingMin: 60 }, mediaType: 'manga' },
];

function settingsFor(c: Case, sortBy: SortOption): GridViewSettings {
  return {
    sortBy,
    filterBy: c.filterBy ?? [],
    searchQuery: c.searchQuery ?? '',
    searchField: c.searchField ?? 'all',
    enableRegexSearch: false,
    advancedFilters: c.advancedFilters ?? {},
    mediaType: c.mediaType ?? 'all',
  };
}

describe('library grid server ordering parity', () => {
  for (const c of CASES) {
    for (const sortBy of SORTS) {
      it(`${c.name} / ${sortBy}`, () => {
        const settings = settingsFor(c, sortBy);
        expect(serverOrder(settings)).toEqual(clientOrder(settings));
      });
    }
  }

  it('the parity cases are not vacuous', () => {
    expect(clientOrder(settingsFor({ name: 'x' }, 'alphabetical'))).toHaveLength(ROWS.length);
    expect(clientOrder(settingsFor(CASES[1] as Case, 'alphabetical')).length).toBeGreaterThan(0);
    // Natural (numeric) title order, which SQL's C collation would not give.
    const titles = clientOrder(settingsFor({ name: 'x' }, 'alphabetical')).map((id) => ROWS.find((r) => r.id === id)?.title);
    expect(titles.indexOf('Vol 2 Stories')).toBeLessThan(titles.indexOf('Vol 10 Stories'));
  });
});

describe('chapter-state toolbar filters read the rows\' chapter stats', () => {
  // Grid rows carry chapterStats and no Chapter array; these filters used to match nothing.
  function titlesFor(filterBy: FilterOption[]): string[] {
    const settings = settingsFor({ name: 'x', filterBy }, 'alphabetical');
    return serverOrder(settings).map((id) => ROWS.find((r) => r.id === id)?.title ?? '');
  }

  it.each<[FilterOption, string[]]>([
    ['read', ['.hack//Link', 'Berserk', 'Élan Vital']],
    ['unread', ['100 Ghosts', 'Solo Leveling', 'Zetman']],
    ['in-progress', ['Akira', 'alpha Romance', 'One Piece', 'Vol 2 Stories']],
    ['downloaded', ['.hack//Link', '100 Ghosts', 'Akira', 'alpha Romance', 'Berserk', 'One Piece', 'Vol 2 Stories', 'Zetman']],
    ['has-issues', ['Zetman']],
  ])('%s', (filter, expected) => {
    expect(titlesFor([filter]).sort()).toEqual([...expected].sort());
  });

  it('the server loads chapter stats when one of them is on', () => {
    expect(gridProjection(buildServerView(settingsFor({ name: 'x', filterBy: ['unread'] }, 'alphabetical'))).chapterStats).toBe(true);
    expect(gridProjection(buildServerView(settingsFor({ name: 'x', filterBy: ['completed'] }, 'alphabetical'))).chapterStats).toBe(false);
  });
});

describe('gridProjection', () => {
  it('loads nothing extra for the default view', () => {
    const view = buildServerView(settingsFor({ name: 'x' }, 'alphabetical'));
    expect(gridProjection(view)).toEqual({ metadata: [], chapterStats: false });
  });

  it('loads only the columns and stats the view reads', () => {
    const view = buildServerView({ ...settingsFor({ name: 'x', searchQuery: 'a', searchField: 'author', advancedFilters: { excludeTags: ['x'], countryOfOrigin: ['JP'] } }, 'progress') });
    expect(gridProjection(view)).toEqual({ metadata: ['authors', 'countryOfOrigin', 'tags'], chapterStats: true });
  });
});

describe('toAdvancedFilter', () => {
  it('turns wire dates back into Dates and keeps the rest', () => {
    expect(toAdvancedFilter({ dateAddedFrom: '2024-01-01T00:00:00.000Z', genres: ['A'], monitored: false })).toEqual({
      dateAddedFrom: new Date('2024-01-01T00:00:00.000Z'), genres: ['A'], monitored: false,
    });
  });
});

describe('findLetterIndex over the server order', () => {
  it('finds where a letter starts in the ordered library', () => {
    const view = buildServerView(settingsFor({ name: 'x' }, 'alphabetical'));
    const ordered = orderGridCandidates(ROWS.map((r) => projectForView(r, gridProjection(view))), view);
    expect(ordered[findLetterIndex(ordered, 'B')]?.title).toBe('Berserk');
    expect(ordered[findLetterIndex(ordered, '#')]?.title).toBe('.hack//Link');
    expect(findLetterIndex(ordered, 'Q')).toBe(-1);
  });
});
