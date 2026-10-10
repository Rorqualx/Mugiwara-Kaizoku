/**
 * @jest-environment node
 *
 * Hardening plan 3.5: selector winners reach their columns.
 *
 * End to end over the real pieces: legacy result builder + claim builders →
 * runShadowSelection → applySelectorCutover → the persister's update data.
 * The overlay used to write winners under the selector's field name
 * (`cover`, `idMal`, `summary`, `synonyms`…) while the persister reads the
 * legacy names, so these picks never reached the Metadata row.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import type { AniListMangaDetails } from '@/server/services/anilist/service';

jest.mock('@/server/db', () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock('@/server/services/realtime/RealtimeEventEmitter', () => ({ realtimeEmitter: { emitMangaUpdate: jest.fn() } }));

import { prisma } from '@/server/db';
import { MetadataPersistenceService } from '@/server/services/metadata/metadata-persister';
import { collectCandidates, type ProviderClaim } from '@/server/services/metadata/selectors/collect-candidates';
import { applySelectorCutover } from '@/server/services/metadata/selectors/cutover-overlay';
import { runShadowSelection } from '@/server/services/metadata/selectors/shadow-mode';
import { buildEnrichmentResult } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/enrichment-result-builder';
import type { KitsuDirectResult } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/kitsu-fetch';
import { buildClaimsForShadow, type ClaimInputs } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/provider-claims';

const LONG_AL = 'Monkey D. Luffy sets out to sea to find the legendary treasure One Piece and become King of the Pirates. (AniList)';
const LONG_MD = '**Gol D. Roger** was known as the Pirate King, the strongest and most infamous being to have sailed the Grand Line. (MangaDex, a longer markdown text than the others)';
const SHORT_AL = 'Pirates look for treasure.';
const SHORT_MD = 'A boy made of rubber sails the seas with his crew.';

function anilist(description: string): NonNullable<ClaimInputs['anilist']> & { id: number } {
  return {
    id: 30013,
    details: {
      id: 30013,
      title: { english: 'One Piece', romaji: 'ONE PIECE', native: 'ワンピース' },
      description,
      coverImage: { extraLarge: 'https://al/xl.jpg', large: 'https://al/l.jpg', medium: 'https://al/m.jpg' },
      idMal: 13,
      synonyms: ['OP'],
      genres: ['Action'],
      status: 'RELEASING',
    } as unknown as AniListMangaDetails,
  };
}

function kitsu(): KitsuDirectResult {
  return {
    kitsuId: '38', slug: 'one-piece', canonicalTitle: 'One Piece',
    alternativeTitles: ['one piece', 'Wan Pīsu'], synopsis: undefined, status: 'current', subtype: 'manga',
    ageRating: undefined, ageRatingGuide: undefined, chapterCount: undefined, volumeCount: undefined,
    startDate: undefined, endDate: undefined, serialization: undefined, averageRating: undefined,
    userCount: 0, favoritesCount: 0, posterImageUrl: 'https://kitsu/poster.jpg', coverImageUrl: undefined,
  };
}

interface Stored {
  claims: ProviderClaim[];
  /** The data object handed to `tx.metadata.create`. */
  row: Record<string, unknown>;
  /** provider per provenance key, as written to `Manga.providerMetadata`. */
  provenance: Record<string, string>;
}

/** Run one enrichment's worth of selection and persistence, capturing what would be stored. */
async function enrichAndPersist(alDescription: string, mdDescription: string | undefined): Promise<Stored> {
  const al = anilist(alDescription);
  const mangadex = { mangaId: 'md-1', status: 'ongoing', lastVolume: undefined, lastChapter: undefined, description: mdDescription };
  const inputs: ClaimInputs = { anilist: al, mangadex, mangaupdates: null, mal: null, kitsu: kitsu(), comicvine: null };

  const legacy = buildEnrichmentResult({
    mangaId: 1, title: 'One Piece', anilist: al, mangadex, comicvine: null, mangaupdates: null, mal: null, kitsu: inputs.kitsu,
  });
  const metadata = (legacy.appliedMatch?.metadata ?? {}) as Record<string, unknown>;
  const provenance = (legacy.appliedMatch?.perFieldProvenance ?? {}) as Record<string, string>;

  const claims = buildClaimsForShadow(inputs);
  applySelectorCutover(runShadowSelection(collectCandidates(claims)), metadata, provenance);

  const captured: { row: Record<string, unknown>; providerMetadata: Record<string, unknown> } = { row: {}, providerMetadata: {} };
  const manga = { id: 1, metadataId: null, Metadata: null, providerMetadata: {} };
  const tx = {
    manga: {
      findUnique: jest.fn(() => Promise.resolve(manga)),
      update: jest.fn((args: { data: { providerMetadata?: Record<string, unknown> } }) => {
        if (args.data.providerMetadata) captured.providerMetadata = args.data.providerMetadata;
        return Promise.resolve(manga);
      }),
    },
    metadata: {
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        captured.row = args.data;
        return Promise.resolve({ id: 100 });
      }),
      update: jest.fn(),
    },
  };
  (prisma.$transaction as unknown as jest.Mock).mockImplementation(
    (callback: unknown) => (callback as (client: typeof tx) => Promise<unknown>)(tx),
  );

  const result = await new MetadataPersistenceService().persistMetadata({
    mangaId: 1, metadata: metadata as never, metadataProvenance: provenance,
  });
  expect(result.status).toBe('success');

  const stored = (captured.providerMetadata['metadataProvenance'] ?? {}) as Record<string, { provider: string }>;
  return {
    claims,
    row: captured.row,
    provenance: Object.fromEntries(Object.entries(stored).map(([k, v]) => [k, v.provider])),
  };
}

const claimed = (stored: Stored, provider: string, field: string): unknown =>
  stored.claims.find(c => c.provider === provider)?.fields[field];

describe('selector winners reach their Metadata columns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores cover, cover sizes and idMal, with provenance under the column name', async () => {
    const stored = await enrichAndPersist(LONG_AL, LONG_MD);

    expect(stored.row['cover']).toBe('https://al/xl.jpg');
    expect(stored.row['coverExtraLarge']).toBe('https://al/xl.jpg');
    expect(stored.row['coverLarge']).toBe('https://al/l.jpg');
    expect(stored.row['coverMedium']).toBe('https://al/m.jpg');
    expect(stored.row['idMal']).toBe(13);

    // The provider named for each column is the one that claimed the stored value.
    for (const column of ['cover', 'coverExtraLarge', 'coverLarge', 'coverMedium', 'idMal']) {
      const provider = stored.provenance[column];
      expect(provider).toBe('anilist');
      expect(claimed(stored, provider ?? '', column)).toBe(stored.row[column]);
    }
  });

  it('writes one provenance entry per column: no legacy duplicates', async () => {
    const { provenance } = await enrichAndPersist(LONG_AL, LONG_MD);
    for (const legacyKey of ['coverImage', 'covers', 'externalIds', 'description', 'alternativeTitles']) {
      expect(provenance).not.toHaveProperty(legacyKey);
    }
    expect(Object.keys(provenance)).toEqual(expect.arrayContaining(['cover', 'idMal', 'summary', 'synonyms']));
  });

  it('D3: keeps a full-length AniList description even when the selector prefers another text', async () => {
    const stored = await enrichAndPersist(LONG_AL, LONG_MD);
    expect(stored.row['summary']).toBe(LONG_AL);
    expect(stored.provenance['summary']).toBe('anilist');
  });

  it('D3: with only short descriptions, names the provider whose text is stored', async () => {
    const stored = await enrichAndPersist(SHORT_AL, SHORT_MD);
    const provider = stored.provenance['summary'] ?? '';
    expect(['anilist', 'mangadex']).toContain(provider);
    expect(stored.row['summary']).toBe(claimed(stored, provider, 'summary'));
  });

  it('D3: keeps the legacy chain\'s own fallback text and names its provider', async () => {
    // AniList short, MangaDex long: the legacy chain already swaps in MangaDex.
    const stored = await enrichAndPersist(SHORT_AL, LONG_MD);
    expect(stored.row['summary']).toBe(LONG_MD);
    expect(stored.provenance['summary']).toBe('mangadex');
  });

  it('D3: synonyms are the legacy titles first, then the selector\'s, without case duplicates', async () => {
    const stored = await enrichAndPersist(LONG_AL, LONG_MD);
    // 'ONE PIECE' (romaji) and Kitsu's 'one piece' differ from the English title only in case.
    expect(stored.row['synonyms']).toEqual(['One Piece', 'ワンピース', 'OP', 'Wan Pīsu']);
    expect(stored.provenance['synonyms']).toBe('anilist');
  });
});
