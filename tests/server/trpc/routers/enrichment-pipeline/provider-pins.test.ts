/** @jest-environment node */
import { describe, it, expect } from '@jest/globals';

import {
  buildProviderDirectives,
  dropRejected,
  mayBindAfterRejection,
  readComicVinePin,
  readKitsuPin,
  readMangaDexPin,
  readMangaUpdatesPin,
  skipsSecondWave,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/provider-pins';

const MD_UUID = 'a1c7c817-4e59-43b7-9365-09675a149a6f';
const manual = (providerId: unknown): Record<string, unknown> => ({ providerId, manual: true, boundAt: '2026-10-10T00:00:00.000Z' });
const auto = (providerId: unknown): Record<string, unknown> => ({ providerId, boundAt: '2026-10-10T00:00:00.000Z' });
const SENTINEL = { manual: true, providerId: null, intent: 'unbound', boundAt: '2026-10-10T00:00:00.000Z' };

describe('readMangaDexPin', () => {
  it('pins a manual UUID and lowercases it (the API rejects uppercase)', () => {
    expect(readMangaDexPin({ mangadex: manual(MD_UUID.toUpperCase()) }))
      .toEqual({ kind: 'pinned', id: MD_UUID, raw: MD_UUID.toUpperCase() });
  });

  it('ignores an id the pipeline bound itself', () => {
    // An auto binding must not lock out a better candidate on the next run.
    expect(readMangaDexPin({ mangadex: auto(MD_UUID) })).toEqual({ kind: 'none' });
  });

  it('reports the unbound sentinel', () => {
    expect(readMangaDexPin({ mangadex: SENTINEL })).toEqual({ kind: 'unbound' });
  });

  it('marks a manual non-UUID as unusable instead of fetching it', () => {
    expect(readMangaDexPin({ mangadex: manual('one-piece') })).toMatchObject({ kind: 'unusable', raw: 'one-piece' });
  });

  it('returns none for missing or malformed providerMetadata', () => {
    expect(readMangaDexPin(null)).toEqual({ kind: 'none' });
    expect(readMangaDexPin('{"mangadex":{}}')).toEqual({ kind: 'none' });
    expect(readMangaDexPin({ mangadex: 'x' })).toEqual({ kind: 'none' });
    expect(readMangaDexPin({})).toEqual({ kind: 'none' });
  });
});

describe('readMangaUpdatesPin', () => {
  it('pins a manual numeric series id', () => {
    expect(readMangaUpdatesPin({ mangaupdates: manual('64884662872') }))
      .toEqual({ kind: 'pinned', id: { seriesId: 64884662872, slug: null }, raw: '64884662872' });
  });

  it('decodes a base36 slug to the numeric id the API wants', () => {
    // Stored pairs from the library: tt2niag ↔ 64884662872, phd2ifp ↔ 55469435605.
    expect(readMangaUpdatesPin({ mangaupdates: manual('tt2niag') }))
      .toEqual({ kind: 'pinned', id: { seriesId: 64884662872, slug: 'tt2niag' }, raw: 'tt2niag' });
    expect(readMangaUpdatesPin({ mangaupdates: manual('PHD2IFP') }))
      .toMatchObject({ kind: 'pinned', id: { seriesId: 55469435605, slug: 'phd2ifp' } });
  });

  it('accepts a numeric id stored as a number', () => {
    expect(readMangaUpdatesPin({ mangaupdates: manual(64884662872) }))
      .toMatchObject({ kind: 'pinned', id: { seriesId: 64884662872, slug: null } });
  });

  it('ignores an auto binding and reports the sentinel', () => {
    expect(readMangaUpdatesPin({ mangaupdates: auto('64884662872') })).toEqual({ kind: 'none' });
    expect(readMangaUpdatesPin({ mangaupdates: SENTINEL })).toEqual({ kind: 'unbound' });
  });

  it('marks a pasted URL or an over-long slug as unusable', () => {
    expect(readMangaUpdatesPin({ mangaupdates: manual('https://www.mangaupdates.com/series/tt2niag') }))
      .toMatchObject({ kind: 'unusable' });
    expect(readMangaUpdatesPin({ mangaupdates: manual('zzzzzzzzzzzz') })).toMatchObject({ kind: 'unusable' });
  });
});

describe('readKitsuPin', () => {
  it('pins a manual numeric id', () => {
    expect(readKitsuPin({ kitsu: manual('59289') })).toEqual({ kind: 'pinned', id: '59289', raw: '59289' });
  });

  it('marks a slug as unusable — the client can only fetch /manga/{numeric id}', () => {
    expect(readKitsuPin({ kitsu: manual('sweat-and-soap') })).toMatchObject({ kind: 'unusable', raw: 'sweat-and-soap' });
  });

  it('ignores an auto binding and reports the sentinel', () => {
    expect(readKitsuPin({ kitsu: auto('59289') })).toEqual({ kind: 'none' });
    expect(readKitsuPin({ kitsu: SENTINEL })).toEqual({ kind: 'unbound' });
  });
});

describe('readComicVinePin', () => {
  it('reads both stored forms of a volume id', () => {
    expect(readComicVinePin({ comicvine: manual('4050-50244') })).toMatchObject({ kind: 'pinned', id: 50244 });
    expect(readComicVinePin({ comicvine: manual('50244') })).toMatchObject({ kind: 'pinned', id: 50244 });
    expect(readComicVinePin({ comicvine: manual(50244) })).toMatchObject({ kind: 'pinned', id: 50244 });
  });

  it('ignores an auto binding, reports the sentinel, rejects junk', () => {
    expect(readComicVinePin({ comicvine: auto('50244') })).toEqual({ kind: 'none' });
    expect(readComicVinePin({ comicvine: SENTINEL })).toEqual({ kind: 'unbound' });
    expect(readComicVinePin({ comicvine: manual('one-piece') })).toMatchObject({ kind: 'unusable' });
  });

  it('keeps the sentinel when finalize has added volumeData to the section', () => {
    // storeVolumeCoverData spreads the section and adds volumeData on every run.
    expect(readComicVinePin({ comicvine: { ...SENTINEL, volumeData: [{ number: 1 }] } })).toEqual({ kind: 'unbound' });
  });
});

describe('dropRejected', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('removes rejected candidates and keeps order', () => {
    expect(dropRejected(items, (i) => i.id, new Set(['b']))).toEqual([{ id: 'a' }, { id: 'c' }]);
  });

  it('returns nothing when every candidate is rejected', () => {
    expect(dropRejected(items, (i) => i.id, new Set(['a', 'b', 'c']))).toEqual([]);
  });

  it('is a no-op without rejections', () => {
    expect(dropRejected(items, (i) => i.id, undefined)).toEqual(items);
    expect(dropRejected(items, (i) => i.id, new Set())).toEqual(items);
  });
});

describe('buildProviderDirectives / skipsSecondWave', () => {
  const rejections = new Map<string, ReadonlySet<string>>([['kitsu', new Set(['1'])]]);
  const lookup = (provider: string): ReadonlySet<string> => rejections.get(provider) ?? new Set<string>();

  it('pairs each provider with its own pin and rejections', () => {
    const d = buildProviderDirectives(
      { mangadex: manual(MD_UUID), mangaupdates: SENTINEL, kitsu: auto('59289'), mal: SENTINEL }, lookup,
    );
    expect(d.mangadex.pin.kind).toBe('pinned');
    expect(d.mangaupdates.pin.kind).toBe('unbound');
    expect(d.kitsu.pin.kind).toBe('none');
    expect([...d.kitsu.rejectedIds]).toEqual(['1']);
    expect(d.mangadex.rejectedIds.size).toBe(0);
    expect(d.comicvine.pin.kind).toBe('none');
    expect(d.malUnbound).toBe(true);
  });

  it('skips the verify step for an unbound provider and for a pinned result', () => {
    const d = buildProviderDirectives({ mangadex: manual(MD_UUID), kitsu: SENTINEL }, lookup);
    expect(skipsSecondWave(d.kitsu, null)).toBe(true);
    expect(skipsSecondWave(d.mangadex, { manualPin: true })).toBe(true);
  });

  it('still verifies when the pinned fetch failed and the matcher produced the result', () => {
    const d = buildProviderDirectives({ mangadex: manual(MD_UUID) }, lookup);
    expect(skipsSecondWave(d.mangadex, {})).toBe(false);
    expect(skipsSecondWave(d.mangadex, null)).toBe(false);
    expect(skipsSecondWave(d.mangaupdates, { manualPin: false })).toBe(false);
  });
});

describe('mayBindAfterRejection — a rejected match is not replaced by a weak one', () => {
  // Why this exists: with its MangaUpdates series rejected, a title was
  // rebound to the runner-up at 0.55, a different series. Nothing bound is
  // better than the wrong thing bound.
  it('lets any pick through when no rejected candidate was in the results', () => {
    expect(mayBindAfterRejection('mangaupdates', 0.31, 0)).toBe(true);
  });

  it('refuses a runner-up below the provider bind threshold', () => {
    expect(mayBindAfterRejection('mangaupdates', 0.55, 1)).toBe(false);
    expect(mayBindAfterRejection('mangadex', 0.69, 2)).toBe(false);
    expect(mayBindAfterRejection('kitsu', 0.54, 1)).toBe(false);
  });

  it('accepts a runner-up at or above the threshold', () => {
    expect(mayBindAfterRejection('mangaupdates', 0.6, 1)).toBe(true);
    expect(mayBindAfterRejection('mangadex', 0.95, 1)).toBe(true);
    expect(mayBindAfterRejection('kitsu', 0.55, 3)).toBe(true);
  });
});
