import { describe, it, expect } from '@jest/globals';

import { parseManualAniListId, resolveAniListPin } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/anilist-pin';

describe('resolveAniListPin — Manga.selectedSourceId is an AniList pin only when it is an AniList id', () => {
  // Why this exists: bindProvider used to write ANY provider's id into
  // selectedSourceId. Production held a MangaDex UUID (Attack on Titan) and a
  // Fandom slug (Before the Fall) there. A non-numeric value fell through to
  // the title search but still masked the auto-bound id and switched the
  // freshness check off; a numeric MAL/Kitsu/ComicVine id was fetched from
  // AniList as an undislodgeable manual pin.
  const none = new Set<string>();

  it('uses a numeric selectedSourceId as the manual pin', () => {
    expect(resolveAniListPin({ selectedSourceId: '51614', boundAlId: '92948', rejectedAlIds: none }))
      .toEqual({ pinnedAlId: '51614', manualPin: true });
  });

  it('never filters a manual pin by rejections', () => {
    expect(resolveAniListPin({ selectedSourceId: '51614', boundAlId: null, rejectedAlIds: new Set(['51614']) }))
      .toEqual({ pinnedAlId: '51614', manualPin: true });
  });

  it.each([
    ['a MangaDex UUID', '304ceac3-8cdb-4fe7-acf7-2b6ff7a60613'],
    ['a Fandom slug', 'attackontitan'],
    ['a ComicVine volume id', '4050-12345'],
    ['the add-manga wizard JSON map', '{"anilist":53390}'],
    ['exponent notation', '1e3'],
    ['hex notation', '0x1f'],
    ['zero', '0'],
    ['an empty string', ''],
  ])('ignores %s and falls back to the auto-bound id', (_label, junk) => {
    expect(resolveAniListPin({ selectedSourceId: junk, boundAlId: '53390', rejectedAlIds: none }))
      .toEqual({ pinnedAlId: '53390', manualPin: false });
  });

  it('reuses the auto-bound id when there is no pin', () => {
    expect(resolveAniListPin({ selectedSourceId: null, boundAlId: '123314', rejectedAlIds: none }))
      .toEqual({ pinnedAlId: '123314', manualPin: false });
  });

  it('drops a rejected auto-bound id so the matcher runs', () => {
    expect(resolveAniListPin({ selectedSourceId: undefined, boundAlId: '85199', rejectedAlIds: new Set(['85199']) }))
      .toEqual({ pinnedAlId: null, manualPin: false });
  });

  it('returns no pin when nothing is bound', () => {
    expect(resolveAniListPin({ selectedSourceId: 'attackontitan', boundAlId: null, rejectedAlIds: none }))
      .toEqual({ pinnedAlId: null, manualPin: false });
  });

  it('trims whitespace around a numeric id', () => {
    expect(parseManualAniListId(' 53390 ')).toBe('53390');
  });
});
