/**
 * @jest-environment node
 *
 * MangaDex adapter language policy.
 *
 * Regression cover for the "English settings, Spanish downloads" bug: the
 * adapter used to score non-preferred translations as still-eligible (50) and
 * cache an arbitrary variant, then persist the UUID *without* its language —
 * which left the dispatcher's fail-open `language_mismatch` gate blind.
 *
 * The scenario these tests encode is the real one from Witch Hat Atelier:
 * MangaDex carries es-la/fr for the chapter and no English at all, because the
 * publisher took the English uploads down.
 */
const getDownloadConfigMock = jest.fn();
const getMangaMock = jest.fn();
const getMangaChaptersMock = jest.fn();
const mangaFindUniqueMock = jest.fn();
const chapterUpdateMock = jest.fn();
const transactionMock = jest.fn();

jest.mock('@/server/services/mangadex/configService', () => ({
  mangadexConfigService: { getDownloadConfig: getDownloadConfigMock },
}));

jest.mock('@/server/services/mangadex/ts-client-factory', () => ({
  getTsMangadexClient: async () => ({
    getManga: getMangaMock,
    getMangaChapters: getMangaChaptersMock,
  }),
}));

jest.mock('@/server/db', () => ({
  prisma: {
    manga: { findUnique: (...a: unknown[]) => mangaFindUniqueMock(...a) },
    chapter: { update: (...a: unknown[]) => chapterUpdateMock(...a) },
    $transaction: (...a: unknown[]) => transactionMock(...a),
  },
}));

import {
  filterVariantsByPolicy,
  partitionStoredBindings,
  pickPreferredVariant,
  scoreForLanguage,
  searchMangaDex,
  storedBindingIsEligible,
  type ChapterVariant,
  type LanguagePolicy,
  type MissingChapterStub,
} from '@/server/services/library/indexerSearch/adapters/mangadex-adapter';

const STRICT: LanguagePolicy = { preferred: 'en', allowFallback: false };
const LOOSE: LanguagePolicy = { preferred: 'en', allowFallback: true };

function stub(overrides: Partial<MissingChapterStub> = {}): MissingChapterStub {
  return {
    id: 1,
    chapterNumber: 97,
    mangadexId: null,
    suwayomiChapterId: null,
    ...overrides,
  };
}

beforeEach(() => {
  getDownloadConfigMock.mockReset();
  getMangaMock.mockReset();
  getMangaChaptersMock.mockReset();
  mangaFindUniqueMock.mockReset();
  chapterUpdateMock.mockReset();
  transactionMock.mockReset();

  getDownloadConfigMock.mockResolvedValue({
    enabled: true,
    preferredLanguage: 'en',
    allowLanguageFallback: false,
    dataSaverMode: false,
    rateLimit: { maxRequests: 5, perMilliseconds: 1000 },
  });
  chapterUpdateMock.mockImplementation((args: unknown) => args);
  transactionMock.mockResolvedValue([]);
});

describe('filterVariantsByPolicy', () => {
  const variants: ChapterVariant[] = [
    { uuid: 'es', language: 'es-la' },
    { uuid: 'fr', language: 'fr' },
  ];

  it('drops every variant when none match and fallback is off', () => {
    expect(filterVariantsByPolicy(variants, STRICT)).toEqual([]);
  });

  it('keeps all variants when none match and fallback is on', () => {
    expect(filterVariantsByPolicy(variants, LOOSE)).toHaveLength(2);
  });

  it('returns only the preferred variant even when fallback is on', () => {
    const withEnglish = [...variants, { uuid: 'en', language: 'en' }];
    expect(filterVariantsByPolicy(withEnglish, LOOSE)).toEqual([{ uuid: 'en', language: 'en' }]);
  });

  it('family-matches regional codes (en-us satisfies a preference of en)', () => {
    const regional: ChapterVariant[] = [{ uuid: 'r', language: 'en-us' }];
    expect(filterVariantsByPolicy(regional, STRICT)).toEqual(regional);
  });

  it('family-matches the other direction (es-la satisfies a preference of es)', () => {
    const policy: LanguagePolicy = { preferred: 'es', allowFallback: false };
    expect(filterVariantsByPolicy(variants, policy)).toEqual([{ uuid: 'es', language: 'es-la' }]);
  });
});

describe('scoreForLanguage', () => {
  it('ranks the preferred language above any fallback', () => {
    expect(scoreForLanguage('en', 'en')).toBeGreaterThan(scoreForLanguage('es-la', 'en'));
  });

  it('scores a regional variant of the preferred family as preferred', () => {
    expect(scoreForLanguage('en-us', 'en')).toBe(scoreForLanguage('en', 'en'));
  });
});

describe('pickPreferredVariant', () => {
  it('prefers a family match over first-seen', () => {
    const variants: ChapterVariant[] = [
      { uuid: 'es', language: 'es-la' },
      { uuid: 'en', language: 'en-us' },
    ];
    expect(pickPreferredVariant(variants, 'en')?.uuid).toBe('en');
  });
});

describe('storedBindingIsEligible', () => {
  it('admits legacy rows with an unknown language so they are not stranded', () => {
    expect(storedBindingIsEligible(stub({ mangadexId: 'x', language: null }), STRICT)).toBe(true);
  });

  it('rejects a known wrong-language binding under strict policy', () => {
    expect(storedBindingIsEligible(stub({ mangadexId: 'x', language: 'es-la' }), STRICT)).toBe(false);
  });

  it('admits a known wrong-language binding when fallback is on', () => {
    expect(storedBindingIsEligible(stub({ mangadexId: 'x', language: 'es-la' }), LOOSE)).toBe(true);
  });
});

describe('partitionStoredBindings', () => {
  it('skips wrong-language stored bindings and counts them', () => {
    const result = partitionStoredBindings(
      [
        stub({ id: 1, mangadexId: 'a', language: 'es-la' }),
        stub({ id: 2, mangadexId: 'b', language: 'en' }),
        stub({ id: 3, mangadexId: null }),
      ],
      STRICT,
    );
    expect(result.skippedStoredByLanguage).toBe(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.needsResolution).toHaveLength(1);
  });

  it('counts legacy null-language bindings separately from rejects', () => {
    const result = partitionStoredBindings(
      [stub({ id: 1, mangadexId: 'a', language: null })],
      STRICT,
    );
    expect(result.unknownLanguageBindings).toBe(1);
    expect(result.skippedStoredByLanguage).toBe(0);
    expect(result.candidates).toHaveLength(1);
  });
});

describe('searchMangaDex — Witch Hat Atelier scenario', () => {
  /** MangaDex knows the series but has no English upload for chapter 97. */
  function mockSeriesWithoutEnglish(): void {
    mangaFindUniqueMock.mockResolvedValue({
      providerMetadata: { mangadex: { providerId: 'series-uuid' } },
    });
    getMangaMock.mockResolvedValue({
      data: { attributes: { availableTranslatedLanguages: ['es-la', 'fr'] } },
    });
    getMangaChaptersMock.mockResolvedValue({
      data: [
        { id: 'uuid-es', attributes: { chapter: '97', translatedLanguage: 'es-la' } },
        { id: 'uuid-fr', attributes: { chapter: '97', translatedLanguage: 'fr' } },
      ],
      total: 2,
    });
  }

  it('emits no candidate when the series has no preferred-language upload', async () => {
    mockSeriesWithoutEnglish();
    const out = await searchMangaDex(105, [stub()]);
    expect(out).toEqual([]);
  });

  it('does not even fetch the chapter list when the series lacks the language', async () => {
    mockSeriesWithoutEnglish();
    await searchMangaDex(105, [stub()]);
    expect(getMangaChaptersMock).not.toHaveBeenCalled();
  });

  it('never persists a wrong-language binding', async () => {
    mockSeriesWithoutEnglish();
    await searchMangaDex(105, [stub()]);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('downloads the fallback language only when explicitly enabled', async () => {
    getDownloadConfigMock.mockResolvedValue({
      enabled: true,
      preferredLanguage: 'en',
      allowLanguageFallback: true,
      dataSaverMode: false,
      rateLimit: { maxRequests: 5, perMilliseconds: 1000 },
    });
    mockSeriesWithoutEnglish();
    const out = await searchMangaDex(105, [stub()]);
    expect(out).toHaveLength(2);
  });
});

describe('searchMangaDex — persistence', () => {
  it('persists the resolved language alongside the UUID', async () => {
    mangaFindUniqueMock.mockResolvedValue({
      providerMetadata: { mangadex: { providerId: 'series-uuid' } },
    });
    getMangaMock.mockResolvedValue({
      data: { attributes: { availableTranslatedLanguages: ['en', 'es-la'] } },
    });
    getMangaChaptersMock.mockResolvedValue({
      data: [{ id: 'uuid-en', attributes: { chapter: '97', translatedLanguage: 'en' } }],
      total: 1,
    });

    await searchMangaDex(105, [stub()]);

    expect(chapterUpdateMock).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { mangadexId: 'uuid-en', language: 'en' },
    });
  });

  it('constrains the API request to the preferred language family', async () => {
    mangaFindUniqueMock.mockResolvedValue({
      providerMetadata: { mangadex: { providerId: 'series-uuid' } },
    });
    getMangaMock.mockResolvedValue({
      data: { attributes: { availableTranslatedLanguages: ['en', 'es-la'] } },
    });
    getMangaChaptersMock.mockResolvedValue({ data: [], total: 0 });

    await searchMangaDex(105, [stub()]);

    expect(getMangaChaptersMock).toHaveBeenCalledWith(
      'series-uuid',
      expect.objectContaining({ translatedLanguage: ['en'] }),
    );
  });

  it('honours a per-user preferred-language override', async () => {
    mangaFindUniqueMock.mockResolvedValue({
      providerMetadata: { mangadex: { providerId: 'series-uuid' } },
    });
    getMangaMock.mockResolvedValue({
      data: { attributes: { availableTranslatedLanguages: ['en', 'fr'] } },
    });
    getMangaChaptersMock.mockResolvedValue({
      data: [{ id: 'uuid-fr', attributes: { chapter: '97', translatedLanguage: 'fr' } }],
      total: 1,
    });

    const out = await searchMangaDex(105, [stub()], 'fr');

    expect(getMangaChaptersMock).toHaveBeenCalledWith(
      'series-uuid',
      expect.objectContaining({ translatedLanguage: ['fr'] }),
    );
    expect(out).toHaveLength(1);
  });
});
