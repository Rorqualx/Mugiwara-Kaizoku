/**
 * @jest-environment node
 *
 * Suwayomi source-language eligibility.
 *
 * Suwayomi installs one source per language — MangaFire ships as en / es /
 * es-419 / fr / ja / pt / pt-BR, MANGA Plus as en / es / fr / id / pt-BR / ru.
 * Auto-discovery used to fan out across all of them and rank purely on title
 * score, so a Spanish MangaFire could outscore the English one and get
 * persisted as the binding. This became load-bearing once the MangaDex adapter
 * turned strict: chapters MangaDex no longer supplies fall through to Suwayomi.
 */
const getDownloadConfigMock = jest.fn();
const getSourcesMock = jest.fn();

jest.mock('@/server/db', () => ({ prisma: {} }));
jest.mock('@/server/services/mangadex/configService', () => ({
  mangadexConfigService: { getDownloadConfig: getDownloadConfigMock },
}));
jest.mock('@/server/services/suwayomi/configService', () => ({
  suwayomiConfigService: {},
}));
jest.mock('@/server/services/suwayomi/graphql/client', () => ({
  getSuwayomiGraphQLClient: () => ({ getSources: getSourcesMock }),
}));

import {
  boundSourceStillEligible,
  isEligibleSourceLanguage,
} from '@/server/services/suwayomi/manga-matcher';

beforeEach(() => {
  getDownloadConfigMock.mockReset();
  getSourcesMock.mockReset();
  getDownloadConfigMock.mockResolvedValue({
    enabled: true,
    preferredLanguage: 'en',
    allowLanguageFallback: false,
    dataSaverMode: false,
    rateLimit: { maxRequests: 5, perMilliseconds: 1000 },
  });
});

describe('isEligibleSourceLanguage', () => {
  it('accepts an exact match', () => {
    expect(isEligibleSourceLanguage('en', 'en')).toBe(true);
  });

  it('rejects the real-world offenders for an English library', () => {
    for (const lang of ['es', 'es-419', 'fr', 'ja', 'pt', 'pt-BR', 'ru', 'id', 'th']) {
      expect(isEligibleSourceLanguage(lang, 'en')).toBe(false);
    }
  });

  it('family-matches a regional source against a bare preference', () => {
    // A user preferring `es` should still reach MangaFire es-419.
    expect(isEligibleSourceLanguage('es-419', 'es')).toBe(true);
  });

  it('family-matches a bare source against a regional preference', () => {
    expect(isEligibleSourceLanguage('es', 'es-419')).toBe(true);
  });

  it('never excludes the built-in Local source', () => {
    // Local source serves user-supplied files and reports a sentinel language.
    expect(isEligibleSourceLanguage('localsourcelang', 'en')).toBe(true);
    expect(isEligibleSourceLanguage('localsourcelang', 'ja')).toBe(true);
  });

  it('keeps `all`-language aggregators eligible', () => {
    // Mihon convention: `all` = the source serves many languages (Cubari and
    // most proxy extensions). Excluding it would silently drop real coverage.
    expect(isEligibleSourceLanguage('all', 'en')).toBe(true);
    expect(isEligibleSourceLanguage('all', 'ja')).toBe(true);
  });

  it('still excludes `other`, which means a non-standard language', () => {
    expect(isEligibleSourceLanguage('other', 'en')).toBe(false);
  });

  it('does not treat a language prefix collision as a match', () => {
    // `en` must not swallow `enm` (Middle English) or similar codes.
    expect(isEligibleSourceLanguage('enm', 'en')).toBe(false);
  });

  it('keeps the prod-bound English sources eligible', () => {
    // Weeb Central + MangaPill + Goda are what the live library binds to.
    expect(isEligibleSourceLanguage('en', 'en')).toBe(true);
  });
});

describe('boundSourceStillEligible', () => {
  it('keeps a binding whose source is still in the preferred language', async () => {
    getSourcesMock.mockResolvedValue([{ id: 111, name: 'Weeb Central', lang: 'en' }]);
    expect(await boundSourceStillEligible('111')).toBe(true);
  });

  it('rejects a binding that now points at a wrong-language source', async () => {
    getSourcesMock.mockResolvedValue([{ id: 222, name: 'MangaFire', lang: 'es' }]);
    expect(await boundSourceStillEligible('222')).toBe(false);
  });

  it('keeps the binding when the source is no longer installed', async () => {
    // Can't prove it's wrong; dropping it would lose a working binding.
    getSourcesMock.mockResolvedValue([{ id: 111, name: 'Weeb Central', lang: 'en' }]);
    expect(await boundSourceStillEligible('999')).toBe(true);
  });

  it('keeps the binding when Suwayomi is unreachable', async () => {
    // A transient GraphQL failure must never mass-clear bindings.
    getSourcesMock.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await boundSourceStillEligible('111')).toBe(true);
  });

  it('matches real Suwayomi source ids, which exceed MAX_SAFE_INTEGER', async () => {
    // SourceType types `id` as number, but the GraphQL API returns it QUOTED:
    //   {"id":"2131019126180322627", ...}
    // That value is ~236x MAX_SAFE_INTEGER, so it only survives as a string —
    // were it a real JS number, JSON.parse would already have corrupted it and
    // no source lookup could ever match. This pins the runtime shape.
    const realId = '2131019126180322627';
    expect(Number(realId) > Number.MAX_SAFE_INTEGER).toBe(true);
    expect(String(Number(realId))).not.toBe(realId); // precision would be lost
    getSourcesMock.mockResolvedValue([{ id: realId, lang: 'es', name: 'MangaFire' }]);
    expect(await boundSourceStillEligible(realId)).toBe(false);
  });

  it('keeps every source the live library is actually bound to', async () => {
    getSourcesMock.mockResolvedValue([
      { id: '2131019126180322627', lang: 'en', name: 'Weeb Central' },
      { id: '8448310129093543312', lang: 'en', name: 'MangaPill' },
      { id: '4273874799952447458', lang: 'en', name: 'Goda' },
    ]);
    for (const id of ['2131019126180322627', '8448310129093543312', '4273874799952447458']) {
      expect(await boundSourceStillEligible(id)).toBe(true);
    }
  });
});
