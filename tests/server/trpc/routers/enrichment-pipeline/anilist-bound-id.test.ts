import { describe, it, expect } from '@jest/globals';

import { extractBoundAniListId } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch';

describe('extractBoundAniListId — reuse the bound AniList id on re-enrichment', () => {
  // Why this exists: AniList's search can't reproduce some titles at all (e.g.
  // "Völundio ~Divergent Sword Saga~" returns nothing for every title/synonym
  // variant, but id 123314 resolves fine). When the manga already has an AniList
  // binding, re-enrichment must fetch by that id instead of re-searching, or the
  // failed anchor cascades into garbage ComicVine/Wikipedia matches.
  it('reads providerMetadata.anilist.providerId', () => {
    expect(extractBoundAniListId({ anilist: { providerId: '123314' } })).toBe('123314');
  });

  it('returns null for the manual-unbound sentinel (providerId: null)', () => {
    // The sentinel marks "intentionally unbound" — must NOT re-pin to a stale id.
    expect(extractBoundAniListId({ anilist: { manual: true, providerId: null } })).toBeNull();
  });

  it('returns null when no anilist binding is present', () => {
    expect(extractBoundAniListId({ kitsu: { providerId: '60803' } })).toBeNull();
    expect(extractBoundAniListId({})).toBeNull();
  });

  it('returns null for non-object / nullish input', () => {
    expect(extractBoundAniListId(null)).toBeNull();
    expect(extractBoundAniListId(undefined)).toBeNull();
    expect(extractBoundAniListId('123314')).toBeNull();
    expect(extractBoundAniListId({ anilist: null })).toBeNull();
    expect(extractBoundAniListId({ anilist: { providerId: 123314 } })).toBeNull(); // non-string
  });
});
