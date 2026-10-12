/** Shared builders for the claims-recorder tests. */

import type { FandomSnapshot, FetchPhaseSnapshot, WikipediaSnapshot } from '../claim-run/recorder';

const NO_PIN = { pin: { kind: 'none' } };

export const ALL_OK: Readonly<Record<string, string>> = {
  anilist: 'ok', mangadex: 'ok', comicvine: 'ok', fandom: 'ok',
  wikipedia: 'ok', mangaupdates: 'ok', kitsu: 'ok', mal: 'ok',
};

export function fandomSnapshot(chapters: number, volumes: Array<[number, number, number]>, parseSuccess = true): FandomSnapshot {
  return {
    url: 'https://bleach.fandom.com/wiki/Chapters',
    chapterList: Array.from({ length: chapters }, (_, i) => ({ number: i + 1 })),
    volumeList: volumes.map(([number, chapterStart, chapterEnd]) => ({ number, chapterStart, chapterEnd })),
    parseSuccess,
  };
}

export function wikipediaSnapshot(overrides: Partial<WikipediaSnapshot['data']> = {}, chapters = 0): WikipediaSnapshot {
  return {
    data: { title: 'Bleach (manga)', wikipediaUrl: 'https://en.wikipedia.org/wiki/Bleach_(manga)', ...overrides },
    chapterList: Array.from({ length: chapters }, (_, i) => ({ number: i + 1 })),
  };
}

/** A fetch phase in which every provider answered with something usable. */
export function snapshot(overrides: Partial<FetchPhaseSnapshot> = {}): FetchPhaseSnapshot {
  return {
    providerStatus: ALL_OK,
    directives: { mangadex: NO_PIN, mangaupdates: NO_PIN, kitsu: NO_PIN, comicvine: NO_PIN, malUnbound: false },
    anilist: { id: 30012, details: { idMal: 12 } },
    mangadex: {
      mangaId: '239d6260', lastChapter: '686', lastVolume: '74', malId: 12,
      chapterList: [{ number: 1 }, { number: 686 }], aggregate: { volumes: [{}, {}] },
    },
    comicvine: { volumeId: 18282, issues: [{}, {}, {}] },
    mangaupdates: { seriesId: 777 },
    kitsu: { kitsuId: '26' },
    mal: { malId: 12 },
    fandom: fandomSnapshot(686, [[1, 1, 7]]),
    wikipedia: wikipediaSnapshot({ chapters: 686, volumes: 74 }),
    ...overrides,
  };
}
