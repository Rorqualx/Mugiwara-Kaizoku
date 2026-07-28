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
jest.mock('@/server/db', () => ({ prisma: {} }));
jest.mock('@/server/services/mangadex/configService', () => ({
  mangadexConfigService: { getDownloadConfig: jest.fn() },
}));
jest.mock('@/server/services/suwayomi/configService', () => ({
  suwayomiConfigService: {},
}));
jest.mock('@/server/services/suwayomi/graphql/client', () => ({
  getSuwayomiGraphQLClient: jest.fn(),
}));

import { isEligibleSourceLanguage } from '@/server/services/suwayomi/manga-matcher';

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

  it('does not treat a language prefix collision as a match', () => {
    // `en` must not swallow `enm` (Middle English) or similar codes.
    expect(isEligibleSourceLanguage('enm', 'en')).toBe(false);
  });

  it('keeps the prod-bound English sources eligible', () => {
    // Weeb Central + MangaPill are what the live library actually binds to.
    expect(isEligibleSourceLanguage('en', 'en')).toBe(true);
  });
});
