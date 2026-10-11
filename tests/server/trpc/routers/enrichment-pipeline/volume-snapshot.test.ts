/**
 * @jest-environment node
 */
import { describe, it, expect, jest } from '@jest/globals';

import { shouldRunPhantomPrunes } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-phantom-prune';
import { boundProvidersOf, planVolumeFieldRefill, planVolumeRestore, providersToKeep } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/volume-snapshot';

jest.mock('@/server/db', () => ({ prisma: {} }));

describe('planVolumeRestore — which volumes to put back after the per-run rebuild', () => {
  // Why this exists: enrichment deletes every Volume row and rebuilds from that
  // run's provider results. A timeout is the same null as "no match", so a run
  // during a provider outage (or a rebuild that threw) left a title with fewer
  // volumes or none, and still reported success.
  const snapshot = [
    { number: 1, source: 'comicvine+wikipedia' },
    { number: 2, source: 'wikipedia' },
    { number: 3, source: 'mangadex' },
    { number: 4, source: null },
    { number: 5, source: 'manual' },
  ];

  it('restores nothing on a healthy run — the rebuilt set is the truth', () => {
    expect(planVolumeRestore(snapshot, new Set([1, 2]), [])).toEqual([5]);
  });

  it('restores everything when the rebuild produced no volumes at all', () => {
    expect(planVolumeRestore(snapshot, new Set(), [])).toEqual([1, 2, 3, 4, 5]);
  });

  it('restores missing volumes sourced from a provider that did not answer', () => {
    expect(planVolumeRestore(snapshot, new Set([3]), ['wikipedia'])).toEqual([1, 2, 5]);
  });

  it('does not restore a missing volume whose providers all answered', () => {
    expect(planVolumeRestore(snapshot, new Set([1, 2]), ['kitsu'])).toEqual([5]);
  });

  it('never restores a volume the rebuild already produced', () => {
    expect(planVolumeRestore(snapshot, new Set([1, 2, 3, 4, 5]), ['wikipedia', 'mangadex'])).toEqual([]);
  });

  it('always restores a missing manual volume', () => {
    expect(planVolumeRestore([{ number: 9, source: 'manual' }], new Set([1]), [])).toEqual([9]);
  });

  it('has nothing to restore when there was nothing before', () => {
    expect(planVolumeRestore([], new Set(), ['anilist'])).toEqual([]);
  });
});

describe('planVolumeFieldRefill — keep descriptive fields a degraded rebuild could not supply', () => {
  // Why this exists: a re-enrichment while ComicVine was down rebuilt Attack on
  // Titan's volumes with every title blank — the rows existed, so the volume
  // restore did not apply, but the data ComicVine had supplied was gone.
  const blank = {
    title: null, subtitle: null, alternativeTitle: null, description: null, summary: null, isbn: null,
    isbn13: null, publisher: null, pageCount: null, releaseDate: null, coverImage: null,
    chapterStart: null, chapterEnd: null,
  };
  const previous = { ...blank, title: 'To You, 2,000 Years From Now', isbn13: '9781612620244', coverImage: '/c/1.jpg', source: 'comicvine+wikipedia' };

  it('refills empty fields when the previous source did not answer', () => {
    expect(planVolumeFieldRefill(previous, { ...blank, coverImage: '/c/new.jpg' }, ['comicvine']))
      .toEqual({ title: 'To You, 2,000 Years From Now', isbn13: '9781612620244' });
  });

  it('refills nothing on a healthy run, so a corrected binding is not undone', () => {
    expect(planVolumeFieldRefill(previous, blank, [])).toEqual({});
  });

  it('refills nothing when a different provider was the one that did not answer', () => {
    expect(planVolumeFieldRefill(previous, blank, ['kitsu'])).toEqual({});
  });

  it('refills a volume labelled with another source when a volume-data provider was not refreshed', () => {
    // Chainsaw Man (Official Colored): ComicVine titles and covers sat on
    // volumes whose source said "mangadex".
    const labelledMangaDex = { ...previous, source: 'mangadex' };
    expect(planVolumeFieldRefill(labelledMangaDex, blank, ['comicvine']))
      .toEqual({ title: 'To You, 2,000 Years From Now', isbn13: '9781612620244', coverImage: '/c/1.jpg' });
    expect(planVolumeFieldRefill(labelledMangaDex, blank, ['mal'])).toEqual({});
  });

  it('never overwrites a value the rebuild produced', () => {
    expect(planVolumeFieldRefill(previous, { ...blank, title: 'New title', isbn13: '9780000000000', coverImage: '/c/x.jpg' }, ['comicvine']))
      .toEqual({});
  });
});

describe('planVolumeFieldRefill — an empty chapter range', () => {
  const blank = {
    title: null, subtitle: null, alternativeTitle: null, description: null, summary: null, isbn: null,
    isbn13: null, publisher: null, pageCount: null, releaseDate: null, coverImage: null,
    chapterStart: null, chapterEnd: null,
  };
  const previous = { ...blank, chapterStart: 1122, chapterEnd: 1133, source: 'comicvine' };

  it('puts the previous range back when the rebuild produced none', () => {
    expect(planVolumeFieldRefill(previous, blank, ['comicvine'])).toEqual({ chapterStart: 1122, chapterEnd: 1133 });
  });

  it('leaves a range the rebuild produced alone', () => {
    expect(planVolumeFieldRefill(previous, { ...blank, chapterStart: 1120, chapterEnd: 1130 }, ['comicvine'])).toEqual({});
  });
});

describe('providersToKeep — a bound provider that found nothing has not replaced its data', () => {
  // Why this exists: refreshing "One Piece (Official Colored)" and "Chainsaw
  // Man (Official Colored)" in production wiped their volume titles, covers
  // and ranges. Both were bound to a ComicVine volume, but this run's
  // ComicVine search returned no match — an answer, so the safety net stood
  // down and the rebuild had nothing to put in their place.
  it('keeps providers that did not answer', () => {
    expect(providersToKeep({ comicvine: 'timeout', wikipedia: 'error', mangadex: 'ok' }, [])).toEqual(['comicvine', 'wikipedia']);
  });

  it('keeps a bound provider that returned no match', () => {
    expect(providersToKeep({ comicvine: 'no_match', mangadex: 'ok' }, ['comicvine', 'mangadex'])).toEqual(['comicvine']);
  });

  it('does not keep an unbound provider that returned no match', () => {
    expect(providersToKeep({ comicvine: 'no_match', kitsu: 'no_match' }, ['mangadex'])).toEqual([]);
  });

  it('keeps nothing extra on a healthy run or when outcomes are unknown', () => {
    expect(providersToKeep({ comicvine: 'ok', anilist: 'ok' }, ['comicvine', 'anilist'])).toEqual([]);
    expect(providersToKeep(undefined, ['comicvine'])).toEqual([]);
  });

  it('reads bound providers from providerMetadata, ignoring unbound sections and key case', () => {
    expect(boundProvidersOf({
      comicvine: { providerId: '31022' },
      MANGADEX: { providerId: 'a2c1d849' },
      mangadex: { providerId: 'a2c1d849' },
      kitsu: { manual: true, providerId: null, intent: 'unbound' },
      importProfile: { name: 'default' },
    }).sort()).toEqual(['comicvine', 'mangadex']);
  });
});

describe('shouldRunPhantomPrunes — prune unless the anchor did not answer', () => {
  it('runs on a healthy run and when outcomes are unknown', () => {
    expect(shouldRunPhantomPrunes({ anilist: 'ok', comicvine: 'ok' })).toBe(true);
    expect(shouldRunPhantomPrunes(undefined)).toBe(true);
  });

  it('still runs when a non-anchor provider is down', () => {
    expect(shouldRunPhantomPrunes({ anilist: 'ok', comicvine: 'timeout', mal: 'error' })).toBe(true);
  });

  it('skips when AniList timed out or errored', () => {
    expect(shouldRunPhantomPrunes({ anilist: 'timeout' })).toBe(false);
    expect(shouldRunPhantomPrunes({ anilist: 'error' })).toBe(false);
  });
});
