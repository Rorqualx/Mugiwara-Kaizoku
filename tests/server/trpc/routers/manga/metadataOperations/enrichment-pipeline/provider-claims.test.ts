/**
 * @jest-environment node
 *
 * Selector claim builders (hardening plan 3.2 B/C). The module is pure, so it
 * is exercised here without mocking the database.
 */

import { describe, it, expect } from '@jest/globals';
import { MangaPublicationStatus } from '@prisma/client';

import { selectField } from '@/server/services/metadata/selectors';
import { collectCandidates } from '@/server/services/metadata/selectors/collect-candidates';
import { getFieldType } from '@/server/services/metadata/selectors/types';
import type { KitsuDirectResult } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/kitsu-fetch';
import type { MALDirectResult } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/mal-fetch';
import { buildMALMetadataSupplements } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/mal-supplements';
import {
  buildMangaUpdatesMetadataSupplements,
  type MangaUpdatesDirectResult,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/mangaupdates-fetch';
import {
  buildClaimsForShadow,
  mapMangaUpdatesStatus,
  type ClaimInputs,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/provider-claims';

const NONE: ClaimInputs = { anilist: null, mangadex: null, mangaupdates: null, mal: null, kitsu: null, comicvine: null };

function mu(over: Partial<MangaUpdatesDirectResult>): MangaUpdatesDirectResult {
  return {
    seriesId: 1, urlSlug: null, title: 'T', publisher: undefined, categories: [], genres: [],
    status: '', licensed: false, completed: false, type: 'Manga', year: '2020',
    bayesianRating: 0, ratingVotes: 0, latestChapter: 0, authors: [], publishers: [],
    publications: [], relatedSeries: [], recommendations: [], alternativeTitles: [], animeMapping: null,
    ...over,
  };
}

function mal(over: Partial<MALDirectResult>): MALDirectResult {
  return {
    malId: 1, title: 'T', chapters: null, volumes: null, status: 'UNKNOWN', score: null,
    scoredBy: null, rank: null, genres: [], isAdult: false, ...over,
  };
}

function kitsu(over: Partial<KitsuDirectResult>): KitsuDirectResult {
  return {
    kitsuId: '1', slug: 't', canonicalTitle: 'T', alternativeTitles: [], synopsis: undefined,
    status: '', subtype: '', ageRating: undefined, ageRatingGuide: undefined,
    chapterCount: undefined, volumeCount: undefined, startDate: undefined, endDate: undefined,
    serialization: undefined, averageRating: undefined, userCount: 0, favoritesCount: 0,
    posterImageUrl: undefined, coverImageUrl: undefined, ...over,
  };
}

function statusClaim(inputs: Partial<ClaimInputs>, provider: string): unknown {
  const claim = buildClaimsForShadow({ ...NONE, ...inputs }).find(c => c.provider === provider);
  return claim?.fields['status'];
}

describe('mapMangaUpdatesStatus', () => {
  it.each([
    ['86 Chapters (Ongoing)', false, 'ONGOING'],
    ['34 Volumes (Complete)', false, 'COMPLETED'],
    ['14 Volumes (Hiatus)', false, 'HIATUS'],
    ['29 Volumes (Discontinued)', false, 'CANCELLED'],
    ['3 Volumes (Cancelled)', false, 'CANCELLED'],
    ['Oneshot (Complete)', false, 'COMPLETED'],
    // The flag wins over whatever the text says.
    ['12 Volumes (Ongoing)', true, 'COMPLETED'],
    ['', true, 'COMPLETED'],
    // Same state stated for two editions is still one state.
    ['27 Volumes (Complete)\n\n14 Volumes (Complete) - Bunko', false, 'COMPLETED'],
    // Two different states, no state word, or a word that merely contains one.
    ['27 Volumes (Ongoing)\n\n3 Volumes (Complete) - Deluxe edition', false, null],
    ['112 Chapters', false, null],
    ['', false, null],
    ['Incomplete scan of 3 Volumes', false, null],
  ] as Array<[string, boolean, string | null]>)('%p (completed=%p) -> %p', (status, completed, expected) => {
    expect(mapMangaUpdatesStatus(status, completed)).toBe(expected);
  });
});

describe('status claims', () => {
  it('emits MAL status, except the UNKNOWN placeholder', () => {
    expect(statusClaim({ mal: mal({ status: 'HIATUS' }) }, 'mal')).toBe('HIATUS');
    expect(statusClaim({ mal: mal({ status: 'UNKNOWN' }) }, 'mal')).toBeUndefined();
  });

  it('emits Kitsu status raw', () => {
    expect(statusClaim({ kitsu: kitsu({ status: 'current' }) }, 'kitsu')).toBe('current');
    expect(statusClaim({ kitsu: kitsu({ status: '' }) }, 'kitsu')).toBeUndefined();
  });

  it('emits MangaUpdates status only when it maps cleanly', () => {
    expect(statusClaim({ mangaupdates: mu({ status: '29 Volumes (Discontinued)' }) }, 'mangaupdates')).toBe('CANCELLED');
    expect(statusClaim({ mangaupdates: mu({ status: '1 Volume (Ongoing)\n\n1 Volume (Complete)' }) }, 'mangaupdates')).toBeUndefined();
  });

  it('never hands the selector a status it would persist outside the enum', () => {
    const members = new Set<string>(Object.values(MangaPublicationStatus));
    const rawStatuses = ['current', 'finished', 'tba', 'unreleased', 'upcoming', 'something new', '29 Volumes (Discontinued)'];
    for (const raw of rawStatuses) {
      const byField = collectCandidates(buildClaimsForShadow({
        ...NONE, kitsu: kitsu({ status: raw }), mangaupdates: mu({ status: raw }), mal: mal({ status: raw }),
      }));
      const candidates = byField.get('status') ?? [];
      const result = selectField({
        mangaId: 0, field: 'status', fieldType: getFieldType('status'), candidates, existingValue: null, existingProvider: null,
      });
      const value = result.winner?.value ?? null;
      expect(value === null || (typeof value === 'string' && members.has(value))).toBe(true);
    }
  });

  it('lets MAL, Kitsu and MangaUpdates outvote a stale AniList status', () => {
    const byField = collectCandidates(buildClaimsForShadow({
      ...NONE,
      anilist: { details: { title: { romaji: 'T' }, status: 'RELEASING' } } as unknown as ClaimInputs['anilist'],
      mal: mal({ status: 'FINISHED' }),
      kitsu: kitsu({ status: 'finished' }),
      mangaupdates: mu({ status: '14 Volumes (Complete)' }),
    }));
    const candidates = byField.get('status') ?? [];
    const result = selectField({
      mangaId: 0, field: 'status', fieldType: getFieldType('status'), candidates, existingValue: null, existingProvider: null,
    });
    expect(candidates.map(c => c.provider).sort()).toEqual(['anilist', 'kitsu', 'mal', 'mangaupdates']);
    expect(result.winner?.value).toBe('COMPLETED');
    expect(result.alternatives.map(a => a.provider)).toContain('anilist');
  });
});

describe('shared supplement builders stay status-free', () => {
  // The legacy Object.assign chain calls these too; a status key here would be
  // copied over metadata.status as raw provider text.
  it('MangaUpdates supplements carry no status', () => {
    const fields = buildMangaUpdatesMetadataSupplements({}, mu({ status: '29 Volumes (Discontinued)', completed: true, latestChapter: 5 }), undefined);
    expect(fields).not.toHaveProperty('status');
  });

  it('MAL supplements carry no status', () => {
    expect(buildMALMetadataSupplements({}, mal({ status: 'FINISHED', chapters: 10 }))).not.toHaveProperty('status');
  });
});

describe('claims other than status are unchanged by the move', () => {
  it('builds the same field set per provider as before', () => {
    const claims = buildClaimsForShadow({
      ...NONE,
      mangadex: { status: 'ongoing', description: 'd', contentRating: 'safe', publicationDemographic: 'seinen' },
      kitsu: kitsu({ ageRating: 'PG', synopsis: 's', subtype: 'manga', chapterCount: 10, volumeCount: 2, posterImageUrl: 'u', alternativeTitles: ['a'] }),
      mal: mal({ chapters: 10, volumes: 2, score: 8.5 }),
      mangaupdates: mu({ latestChapter: 12, genres: ['Drama'] }),
      comicvine: { publisherName: 'Viz' },
    });
    const fieldsOf = (p: string): string[] => Object.keys(claims.find(c => c.provider === p)?.fields ?? {}).sort();
    expect(claims.map(c => c.provider)).toEqual(['mangadex', 'mangaupdates', 'mal', 'kitsu', 'comicvine']);
    expect(fieldsOf('mangadex')).toEqual(['contentRating', 'publicationDemographic', 'status', 'summary']);
    expect(fieldsOf('kitsu')).toEqual(['chapters', 'contentRating', 'cover', 'format', 'summary', 'synonyms', 'volumes']);
    expect(fieldsOf('mal')).toEqual(['averageScore', 'chapters', 'rating', 'volumes']);
    expect(fieldsOf('mangaupdates')).toEqual(['chapters', 'genres', 'publishers']);
    expect(fieldsOf('comicvine')).toEqual(['publishers']);
  });
});
