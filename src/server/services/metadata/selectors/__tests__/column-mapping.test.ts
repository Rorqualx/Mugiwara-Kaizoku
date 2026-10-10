import { adoptColumnProvenanceKeys, dropSupersededProvenanceKeys, writeWinnerToColumn } from '../column-mapping';

const LONG = 'x'.repeat(80);

describe('writeWinnerToColumn', () => {
  it('writes cover, idMal and cover sizes under the keys the persister reads', () => {
    const metadata: Record<string, unknown> = { covers: { large: 'old-l', small: 's' }, externalIds: { other: 1 } };
    const provenance: Record<string, string> = {};
    writeWinnerToColumn('cover', { value: 'c', provider: 'kitsu' }, metadata, provenance);
    writeWinnerToColumn('idMal', { value: 13, provider: 'anilist' }, metadata, provenance);
    writeWinnerToColumn('coverLarge', { value: 'l', provider: 'anilist' }, metadata, provenance);
    expect(metadata).toEqual({
      coverImage: 'c',
      covers: { large: 'l', small: 's' },
      externalIds: { other: 1, malId: 13 },
    });
    expect(provenance).toEqual({ cover: 'kitsu', idMal: 'anilist', coverLarge: 'anilist' });
  });

  it('passes every other field through under its own name', () => {
    const metadata: Record<string, unknown> = {};
    const provenance: Record<string, string> = {};
    expect(writeWinnerToColumn('status', { value: 'ONGOING', provider: 'mal' }, metadata, provenance)).toBe(true);
    expect(metadata).toEqual({ status: 'ONGOING' });
    expect(provenance).toEqual({ status: 'mal' });
  });

  describe('summary (decision D3)', () => {
    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['shorter than 80 characters', 'x'.repeat(79)],
    ])('replaces a %s legacy description', (_label, legacy) => {
      const metadata: Record<string, unknown> = legacy === undefined ? {} : { description: legacy };
      const provenance: Record<string, string> = legacy === undefined ? {} : { description: 'anilist' };
      expect(writeWinnerToColumn('summary', { value: LONG, provider: 'mangadex' }, metadata, provenance)).toBe(true);
      adoptColumnProvenanceKeys(metadata, provenance);
      expect(metadata['description']).toBe(LONG);
      expect(provenance).toEqual({ summary: 'mangadex' });
    });

    it('keeps a legacy description of 80 characters or more, and its provider', () => {
      const metadata: Record<string, unknown> = { description: LONG };
      const provenance: Record<string, string> = { description: 'comicvine' };
      expect(writeWinnerToColumn('summary', { value: `${LONG} more`, provider: 'mangadex' }, metadata, provenance)).toBe(false);
      adoptColumnProvenanceKeys(metadata, provenance);
      expect(metadata['description']).toBe(LONG);
      expect(provenance).toEqual({ summary: 'comicvine' });
    });
  });

  describe('synonyms (decision D3)', () => {
    it('unions legacy first, case-insensitively, and names the larger contributor', () => {
      const metadata: Record<string, unknown> = { alternativeTitles: ['One Piece', 'ワンピース', 'OP'] };
      const provenance: Record<string, string> = { alternativeTitles: 'anilist' };
      writeWinnerToColumn('synonyms', { value: ['op', 'ONE PIECE', 'Wan Pīsu'], provider: 'kitsu' }, metadata, provenance);
      adoptColumnProvenanceKeys(metadata, provenance);
      expect(metadata['alternativeTitles']).toEqual(['One Piece', 'ワンピース', 'OP', 'Wan Pīsu']);
      expect(provenance).toEqual({ synonyms: 'anilist' });
    });

    it('names the selector\'s provider when it supplies most of the list', () => {
      const metadata: Record<string, unknown> = { alternativeTitles: ['A'] };
      const provenance: Record<string, string> = { alternativeTitles: 'anilist' };
      writeWinnerToColumn('synonyms', { value: ['B', 'C'], provider: 'kitsu' }, metadata, provenance);
      expect(metadata['alternativeTitles']).toEqual(['A', 'B', 'C']);
      expect(provenance['synonyms']).toBe('kitsu');
    });

    it('uses the selector list alone when there is no legacy list', () => {
      const metadata: Record<string, unknown> = {};
      const provenance: Record<string, string> = {};
      writeWinnerToColumn('synonyms', { value: ['B'], provider: 'kitsu' }, metadata, provenance);
      expect(metadata['alternativeTitles']).toEqual(['B']);
      expect(provenance['synonyms']).toBe('kitsu');
    });
  });
});

describe('adoptColumnProvenanceKeys', () => {
  it('re-keys legacy entries the selector did not write and drops the legacy spellings', () => {
    const metadata: Record<string, unknown> = {
      coverImage: 'c', description: 'd', alternativeTitles: ['a'],
      externalIds: { malId: 13 }, covers: { extraLarge: 'xl', large: 'l' },
    };
    const provenance: Record<string, string> = {
      coverImage: 'kitsu', description: 'anilist', alternativeTitles: 'mangaupdates',
      externalIds: 'anilist', covers: 'anilist', genres: 'anilist',
    };
    adoptColumnProvenanceKeys(metadata, provenance);
    expect(provenance).toEqual({
      cover: 'kitsu', summary: 'anilist', synonyms: 'mangaupdates', idMal: 'anilist',
      coverExtraLarge: 'anilist', coverLarge: 'anilist', genres: 'anilist',
    });
  });

  it('does not overwrite an entry the selector stamped', () => {
    const provenance: Record<string, string> = { cover: 'anilist', coverImage: 'kitsu' };
    adoptColumnProvenanceKeys({ coverImage: 'c' }, provenance);
    expect(provenance).toEqual({ cover: 'anilist' });
  });
});

describe('dropSupersededProvenanceKeys', () => {
  const stored = (): Record<string, string> => ({
    description: 'anilist', summary: 'mangadex', coverImage: 'anilist', cover: 'anilist',
    covers: 'anilist', externalIds: 'anilist', alternativeTitles: 'kitsu', genres: 'anilist',
  });

  it('removes the legacy spelling of every column the incoming map names', () => {
    const merged = stored();
    dropSupersededProvenanceKeys(merged, { summary: 'anilist', cover: 'anilist', coverLarge: 'anilist' }, new Set());
    expect(merged).toEqual({ summary: 'mangadex', cover: 'anilist', externalIds: 'anilist', alternativeTitles: 'kitsu', genres: 'anilist' });
  });

  it('leaves entries alone when the caller still writes the legacy spelling, or the entry is pinned', () => {
    const merged = stored();
    dropSupersededProvenanceKeys(merged, { summary: 'anilist', description: 'anilist', cover: 'anilist' }, new Set(['coverImage']));
    expect(merged).toEqual(stored());
  });
});
