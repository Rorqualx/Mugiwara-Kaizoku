import { describe, it, expect } from '@jest/globals';

import { pinFieldsForBind, pinFieldsForUnbind } from '@/server/trpc/routers/manga/providerBindingHelpers';

describe('pinFieldsForBind — only an AniList bind writes the AniList pin', () => {
  // Why this exists: bindProvider wrote selectedSourceId for any provider when
  // the column was empty. The pipeline reads that column as an AniList id, so
  // a manually bound ComicVine volume 50244 was fetched as AniList media 50244.
  it.each(['mangadex', 'mangaupdates', 'kitsu', 'mal', 'comicvine', 'fandom', 'wikipedia'])(
    'writes no pin fields for a %s bind',
    provider => {
      expect(pinFieldsForBind({ source: 'local' }, provider, '50244')).toEqual({});
      expect(pinFieldsForBind({ source: provider }, provider, '50244')).toEqual({});
    },
  );

  it('always writes the pin for an AniList bind, replacing whatever was there', () => {
    expect(pinFieldsForBind({ source: 'local' }, 'anilist', '51614')).toEqual({ selectedSourceId: '51614' });
  });

  it('moves Manga.sourceId with the rebind when AniList is the primary source', () => {
    // Blood Lad: rebound 92948 (light novel) → 51614 (manga) but sourceId stayed
    // 92948, so search showed the wrong entity as "in library".
    expect(pinFieldsForBind({ source: 'anilist' }, 'anilist', '51614'))
      .toEqual({ selectedSourceId: '51614', sourceId: '51614' });
  });
});

describe('pinFieldsForUnbind — unbinding AniList drops the pin', () => {
  it('clears selectedSourceId for AniList', () => {
    expect(pinFieldsForUnbind('anilist')).toEqual({ selectedSourceId: null });
  });

  it('leaves the pin alone for other providers', () => {
    expect(pinFieldsForUnbind('comicvine')).toEqual({});
  });
});
