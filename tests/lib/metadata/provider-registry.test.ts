/**
 * Provider-registry transcription guard.
 *
 * The registry consolidated per-provider facts that previously lived as
 * literals in authority.ts / phase-provider-fetch.ts / freshness-check.ts /
 * MetadataProvenance/utils.ts. This is a PURE consolidation — the values must
 * match their former homes exactly. These assertions pin every value so an
 * accidental edit to the table is caught immediately.
 */

import {
  ALL_PROVIDERS,
  ANCHOR_PROVIDERS,
  bindMinFor,
  enabledDefaultFor,
  isAnchor,
  matchConfidenceFor,
  providerColor,
  providerLabel,
  resolveWeight,
  type SourceName,
} from '@/lib/metadata/provider-registry';

describe('provider-registry identity', () => {
  it('has exactly the 8 wired providers', () => {
    expect([...ALL_PROVIDERS].sort()).toEqual(
      ['anilist', 'comicvine', 'fandom', 'kitsu', 'mal', 'mangadex', 'mangaupdates', 'wikipedia'],
    );
  });

  it('marks anilist + mal as the only anchors', () => {
    expect([...ANCHOR_PROVIDERS].sort()).toEqual(['anilist', 'mal']);
    expect(isAnchor('anilist')).toBe(true);
    expect(isAnchor('mal')).toBe(true);
    expect(isAnchor('mangadex')).toBe(false);
    expect(isAnchor('kitsu')).toBe(false);
    expect(isAnchor('unknown-provider')).toBe(false);
  });
});

describe('matchConfidenceFor (was: phase-provider-fetch push-helper literals)', () => {
  const expected: Record<string, number> = {
    anilist: 0.95,
    mangadex: 0.95,
    mangaupdates: 0.92,
    mal: 0.92,
    kitsu: 0.85,
    comicvine: 0.85,
  };
  for (const [provider, value] of Object.entries(expected)) {
    it(`${provider} = ${value}`, () => {
      expect(matchConfidenceFor(provider as SourceName)).toBe(value);
    });
  }
});

describe('resolveWeight (was: PROVIDER_BASE_WEIGHT + FIELD_AUTHORITY_OVERRIDES)', () => {
  it('reproduces base weights for a field with no override', () => {
    // popularity has no per-field override → base weight applies.
    expect(resolveWeight('popularity', 'anilist')).toBe(0.95);
    expect(resolveWeight('popularity', 'mangadex')).toBe(0.96);
    expect(resolveWeight('popularity', 'mal')).toBe(0.92);
    expect(resolveWeight('popularity', 'mangaupdates')).toBe(0.95);
    expect(resolveWeight('popularity', 'kitsu')).toBe(0.56);
    expect(resolveWeight('popularity', 'fandom')).toBe(0.87);
    expect(resolveWeight('popularity', 'wikipedia')).toBe(0.90);
    expect(resolveWeight('popularity', 'comicvine')).toBe(0.70);
  });

  it('reproduces the status overrides (incl. the A1 MangaDex floor)', () => {
    expect(resolveWeight('status', 'mal')).toBe(0.95);
    expect(resolveWeight('status', 'anilist')).toBe(0.82);
    expect(resolveWeight('status', 'mangaupdates')).toBe(0.60);
    expect(resolveWeight('status', 'mangadex')).toBe(0.40);
  });

  it('reproduces chapters / volumes / rating overrides', () => {
    expect(resolveWeight('chapters', 'anilist')).toBe(0.95);
    expect(resolveWeight('chapters', 'mangadex')).toBe(0.93);
    expect(resolveWeight('chapters', 'kitsu')).toBe(0.50);
    expect(resolveWeight('volumes', 'mangadex')).toBe(0.88);
    expect(resolveWeight('volumes', 'mangaupdates')).toBe(0.90);
    expect(resolveWeight('rating', 'kitsu')).toBe(0.60);
  });

  it('reproduces the single-provider content-classification overrides', () => {
    expect(resolveWeight('contentRating', 'mangadex')).toBe(0.96);
    expect(resolveWeight('publicationDemographic', 'mal')).toBe(0.80);
    expect(resolveWeight('themes', 'anilist')).toBe(0.90);
    expect(resolveWeight('countryOfOrigin', 'anilist')).toBe(0.95);
  });

  it('falls through to base weight for a provider not listed in an override', () => {
    // status override lists mal/anilist/mangaupdates/mangadex — kitsu falls through.
    expect(resolveWeight('status', 'kitsu')).toBe(0.56);
  });
});

describe('bindMinFor (was: MIN_BIND_SCORE)', () => {
  const expected: Record<string, number> = {
    anilist: 0.70,
    mangadex: 0.70,
    mal: 0.65,
    mangaupdates: 0.60,
    kitsu: 0.55,
    fandom: 0.55,
    wikipedia: 0.55,
    comicvine: 0.55,
  };
  for (const [provider, value] of Object.entries(expected)) {
    it(`${provider} = ${value}`, () => {
      expect(bindMinFor(provider as SourceName)).toBe(value);
    });
  }
});

describe('enabledDefaultFor (was: PROVIDER_DEFAULTS)', () => {
  const expected: Record<string, boolean> = {
    anilist: true,
    mangadex: true,
    comicvine: false,
    mangaupdates: true,
    fandom: true,
    wikipedia: true,
    mal: false,
    kitsu: false,
  };
  for (const [provider, value] of Object.entries(expected)) {
    it(`${provider} = ${value}`, () => {
      expect(enabledDefaultFor(provider as SourceName)).toBe(value);
    });
  }
});

describe('providerLabel / providerColor (was: PROVIDER_LABELS / PROVIDER_COLORS)', () => {
  it('preserves the three previously-known display values', () => {
    expect(providerLabel('anilist')).toBe('AniList');
    expect(providerLabel('fandom')).toBe('Fandom');
    expect(providerLabel('comicvine')).toBe('ComicVine');
    expect(providerColor('anilist')).toBe('blue');
    expect(providerColor('fandom')).toBe('green');
    expect(providerColor('comicvine')).toBe('red');
  });

  it('now covers the five providers that previously drifted to raw strings', () => {
    expect(providerLabel('mangadex')).toBe('MangaDex');
    expect(providerLabel('mal')).toBe('MyAnimeList');
    expect(providerLabel('kitsu')).toBe('Kitsu');
    expect(providerLabel('mangaupdates')).toBe('MangaUpdates');
    expect(providerLabel('wikipedia')).toBe('Wikipedia');
    // distinct colors for the newly-covered providers (wikipedia is intentionally
    // gray — its brand is black/white — which the fallback happens to share).
    expect(providerColor('mangadex')).toBe('orange');
    expect(providerColor('mal')).toBe('indigo');
    expect(providerColor('kitsu')).toBe('pink');
    expect(providerColor('mangaupdates')).toBe('teal');
    expect(providerColor('wikipedia')).toBe('gray');
  });

  it('falls back for unknown / undefined input', () => {
    expect(providerLabel('nope')).toBe('nope');
    expect(providerColor('nope')).toBe('gray');
    expect(providerColor(undefined)).toBe('gray');
  });
});
