/**
 * @jest-environment node
 */
import { describe, it, expect, jest } from '@jest/globals';

import type { ComicVineIssue } from '@/server/services/comicvine/service';
import { lastVolumeOfCompleteManifest, type ManualVolumeManifest } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/manual-volume-manifest-sentinel';
import { mapComicVineIssuesToVolumes } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/comicvine-volume-mapper';
import { buildProviderDirectives, readComicVineBoundId } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/provider-pins';

jest.mock('@/server/db', () => ({ prisma: {} }));

const none: ReadonlySet<string> = new Set();

describe('readComicVineBoundId — the volume an earlier run bound', () => {
  // Why this exists: "One Piece (Official Colored)" is bound to ComicVine
  // volume 31022, which the title search no longer returns. The refresh then
  // had no ComicVine data and rebuilt volumes 14–101 with drifting ranges.
  it('returns an automatic binding, in either id format', () => {
    expect(readComicVineBoundId({ comicvine: { providerId: '31022' } }, none)).toBe(31022);
    expect(readComicVineBoundId({ comicvine: { providerId: '4050-31022' } }, none)).toBe(31022);
    expect(readComicVineBoundId({ comicvine: { providerId: 31022 } }, none)).toBe(31022);
  });

  it('returns nothing for a manual, rejected, unbound or missing binding', () => {
    expect(readComicVineBoundId({ comicvine: { providerId: '31022', manual: true } }, none)).toBeUndefined();
    expect(readComicVineBoundId({ comicvine: { providerId: '136269' } }, new Set(['136269']))).toBeUndefined();
    expect(readComicVineBoundId({ comicvine: { manual: true, providerId: null, intent: 'unbound' } }, none)).toBeUndefined();
    expect(readComicVineBoundId({ mangadex: { providerId: 'x' } }, none)).toBeUndefined();
    expect(readComicVineBoundId(null, none)).toBeUndefined();
  });

  it('is carried on the ComicVine directive only', () => {
    const directives = buildProviderDirectives({ comicvine: { providerId: '31022' }, kitsu: { providerId: '7176' } }, () => none);
    expect(directives.comicvine.boundId).toBe(31022);
    expect(directives.comicvine.pin).toEqual({ kind: 'none' });
    expect(directives.kitsu.boundId).toBeUndefined();
  });
});

describe('lastVolumeOfCompleteManifest — a manual manifest that reaches the end is the whole list', () => {
  // Why this exists: Akira has six manual volumes covering chapters 1–120 of
  // 120; a refresh appended ComicVine volumes 7–14 from another edition.
  const manifest: ManualVolumeManifest = {
    manual: true, setAt: '2026-05-17T00:00:00.000Z',
    volumes: { '1': { range: [1, 18] }, '2': { range: [19, 33] }, '6': { range: [97, 120] } },
  };

  it('returns the last volume when the manifest covers the last chapter', () => {
    expect(lastVolumeOfCompleteManifest(manifest, 120)).toBe(6);
    expect(lastVolumeOfCompleteManifest(manifest, 118)).toBe(6);
  });

  it('returns null for a partial manifest or an unknown series length', () => {
    expect(lastVolumeOfCompleteManifest(manifest, 150)).toBeNull();
    expect(lastVolumeOfCompleteManifest(manifest, null)).toBeNull();
    expect(lastVolumeOfCompleteManifest(manifest, 0)).toBeNull();
  });
});

describe('mapComicVineIssuesToVolumes — no chapter data means no range', () => {
  // Why this exists: with no counts to go on the mapper wrote nine chapters
  // per volume (Neon Genesis Evangelion volume 2 = 10–18) as ComicVine ranges.
  it('leaves volumes without ranges instead of inventing nine per volume', () => {
    const issues = [1, 2, 3].map(n => ({ id: n, issue_number: String(n), name: `Volume ${n}`, description: '<p>A summary with no chapter list.</p>' })) as unknown as ComicVineIssue[];
    const volumes = mapComicVineIssuesToVolumes(issues);
    expect(volumes).toHaveLength(3);
    expect(volumes.map(v => [v['startChapter'], v['endChapter']])).toEqual([[undefined, undefined], [undefined, undefined], [undefined, undefined]]);
    expect(volumes[1]?.['title']).toBe('Volume 2');
  });
});
