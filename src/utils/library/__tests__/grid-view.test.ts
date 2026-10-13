import {
  buildServerView,
  findLetterIndex,
  gridViewKey,
  isUnfilteredAlphabetical,
  needsClientSearch,
  toWireAdvancedFilter,
  viewDependsOnChapters,
  type GridViewSettings,
} from '@/utils/library/grid-view';

const base: GridViewSettings = {
  sortBy: 'alphabetical',
  filterBy: [],
  searchQuery: '',
  searchField: 'all',
  enableRegexSearch: false,
  advancedFilters: {},
  mediaType: 'all',
};

describe('grid-view', () => {
  it('serializes advanced filters, dropping options that filter nothing', () => {
    expect(toWireAdvancedFilter({
      dateAddedFrom: new Date('2024-01-01T00:00:00.000Z'),
      dateAddedTo: null,
      lastReadFrom: '2024-02-01T00:00:00.000Z' as unknown as Date,
      chaptersMin: 0,
      chaptersMax: null,
      ratingMin: Number.NaN,
      genres: ['Action'],
      tags: [],
      readingStatus: ['fully-read'],
      monitored: false,
    })).toEqual({
      dateAddedFrom: '2024-01-01T00:00:00.000Z',
      lastReadFrom: '2024-02-01T00:00:00.000Z',
      chaptersMin: 0,
      genres: ['Action'],
      readingStatus: ['fully-read'],
      monitored: false,
    });
  });

  it('still sends an unparseable date (it is truthy on the client too)', () => {
    expect(toWireAdvancedFilter({ dateAddedFrom: new Date('nope') })).toEqual({ dateAddedFrom: 'Invalid Date' });
  });

  it('leaves a regex search to the client and sends everything else', () => {
    const regex = { ...base, enableRegexSearch: true, searchQuery: '^A', sortBy: 'rating' as const, filterBy: ['completed' as const] };
    expect(needsClientSearch(regex)).toBe(true);
    expect(buildServerView(regex)).toMatchObject({ searchQuery: '', sortBy: 'rating', filterBy: ['completed'] });
    // Regex toggled on with nothing typed is a plain view.
    expect(needsClientSearch({ ...base, enableRegexSearch: true })).toBe(false);
    expect(buildServerView({ ...base, searchQuery: 'one' }).searchQuery).toBe('one');
  });

  it('keys a view by its content, not by object identity or key order', () => {
    const a = buildServerView({ ...base, advancedFilters: { genres: ['A'], ratingMin: 5 } });
    const b = buildServerView({ ...base, advancedFilters: { ratingMin: 5, genres: ['A'], tags: [] } });
    expect(gridViewKey(a)).toBe(gridViewKey(b));
    expect(gridViewKey(a)).not.toBe(gridViewKey(buildServerView({ ...base, sortBy: 'rating' })));
  });

  it('knows when the next rows are the library order', () => {
    expect(isUnfilteredAlphabetical(buildServerView(base))).toBe(true);
    expect(isUnfilteredAlphabetical(buildServerView({ ...base, mediaType: 'manga' }))).toBe(false);
    expect(isUnfilteredAlphabetical(buildServerView({ ...base, advancedFilters: { genres: ['A'] } }))).toBe(false);
  });

  it('knows when chapter updates can reorder or refilter the view', () => {
    expect(viewDependsOnChapters(buildServerView(base))).toBe(false);
    expect(viewDependsOnChapters(buildServerView({ ...base, sortBy: 'last-read' }))).toBe(true);
    expect(viewDependsOnChapters(buildServerView({ ...base, advancedFilters: { monitored: false } }))).toBe(true);
    expect(viewDependsOnChapters(buildServerView({ ...base, advancedFilters: { genres: ['A'] } }))).toBe(false);
  });

  it('finds the first title under a letter', () => {
    const rows = [{ title: '3x3 Eyes' }, { title: 'akira' }, { title: 'Berserk' }];
    expect(findLetterIndex(rows, 'A')).toBe(1);
    expect(findLetterIndex(rows, '#')).toBe(0);
    expect(findLetterIndex(rows, 'Z')).toBe(-1);
  });
});
