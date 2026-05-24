/**
 * @jest-environment node
 *
 * MangaDex Matcher Tests
 *
 * Validates the enrichment-pipeline matcher's edition-mismatch handling so
 * that:
 *   - Iter MDE1: per-title check accepts a candidate whose PRIMARY title
 *     matches the query even when its alt titles contain incompatible
 *     sub-qualifiers (the original Chainsaw Man Official Colored regression).
 *   - Iter MDE2: plain "Color" / "Colour" titles enter the colored family
 *     (regex previously required the literal "ed" suffix).
 */

import type { MangaDexManga } from '@/server/services/mangadex/types';
import type { KaizokuMangaDexClient } from '@/server/services/mangadex/ts-client-factory';

import { pickBestMangaDexMatch } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/mangadex-matcher';

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
}));

const stubClient = {
  getEnglishTitle: (m: MangaDexManga) => m.attributes.title.en ?? m.id,
} as unknown as KaizokuMangaDexClient;

function makeManga(
  id: string,
  primaryEn: string,
  altTitles: string[] = [],
): MangaDexManga {
  return {
    id,
    type: 'manga',
    attributes: {
      title: { en: primaryEn },
      altTitles: altTitles.map((t) => ({ en: t })),
      year: 2018,
      lastChapter: null,
      links: {},
    },
  } as unknown as MangaDexManga;
}

describe('pickBestMangaDexMatch — edition filter', () => {
  it('MDE1: accepts candidate whose primary title matches even when alt titles contain incompatible sub-qualifiers', () => {
    // The reproduction case: MD returns the Official Colored entry, whose
    // primary EN title is "Chainsaw Man (Official Colored)" — an exact match
    // for the query — but whose alt titles include "Chainsaw Man - Digital
    // Colored Comics". The old joined-string check rejected it because the
    // joined text contained "Digital Colored" which the query lacks.
    const officialColored = makeManga(
      'e896c48c',
      'Chainsaw Man (Official Colored)',
      ['Chainsaw Man - Digital Colored Comics', 'Chainsaw Man (Couleur Officielle)'],
    );
    const mainSeries = makeManga('a77742b1', 'Chainsaw Man');

    const result = pickBestMangaDexMatch(
      [officialColored, mainSeries],
      'Chainsaw Man (Official Colored)',
      stubClient,
    );

    expect(result?.id).toBe('e896c48c');
  });

  it('still rejects main series when query has an edition qualifier candidate lacks', () => {
    const mainSeries = makeManga('a77742b1', 'Chainsaw Man');
    const fanColored = makeManga('ad238a4f', 'Chainsaw Man (Fan Colored)');

    // Query has "Official Colored", main has neither, Fan has wrong sub-qualifier
    // → both should mismatch; matcher returns null.
    const result = pickBestMangaDexMatch(
      [mainSeries, fanColored],
      'Chainsaw Man (Official Colored)',
      stubClient,
    );

    expect(result).toBeNull();
  });

  it('MDE2: plain "Color" titles are recognized as colored-family', () => {
    // Pre-fix: /colou?red?/ matched only "color**ed**". Query "One Piece
    // Color" was treated as no-qualifier and incorrectly matched the main
    // series. Fix: /colou?r(?:ed)?/ covers color / colour / colored / coloured.
    const mainSeries = makeManga('main', 'One Piece');
    const coloredSeries = makeManga('colored', 'One Piece Color');

    const result = pickBestMangaDexMatch(
      [mainSeries, coloredSeries],
      'One Piece Color',
      stubClient,
    );

    expect(result?.id).toBe('colored');
  });

  it('returns plain main series for plain query', () => {
    const mainSeries = makeManga('a77742b1', 'Chainsaw Man');
    const officialColored = makeManga(
      'e896c48c',
      'Chainsaw Man (Official Colored)',
      ['Chainsaw Man - Digital Colored Comics'],
    );

    const result = pickBestMangaDexMatch(
      [officialColored, mainSeries],
      'Chainsaw Man',
      stubClient,
    );

    expect(result?.id).toBe('a77742b1');
  });
});
