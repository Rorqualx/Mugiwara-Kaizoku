/**
 * Multi-series wiki gate for the provider-fetch phase.
 *
 * When a wiki's chapter list is far longer than the expected count for this
 * manga, the wiki is almost certainly a series-wide catalog (jojo.fandom.com
 * lists 900+ chapters across all 9 JoJo parts) or a main-series wiki bound to
 * a spin-off (naruto.fandom.com's 700 chapters on "Naruto Shinden", whose
 * AniList entry has 10). The chapter and volume lists are wiped at the source
 * so every downstream consumer sees an empty set; summary/cover stay.
 *
 * The decision itself lives in `cross-series-gate.ts`. An ongoing series has
 * no AniList chapter count, and a licensed one has a short English MangaDex
 * feed (Sakamoto Days: 32 rows of a 278-chapter series), so before the
 * MangaDex tier the list is checked against what the series' own providers
 * say: its volume count (Kitsu, MAL, AniList) or the highest chapter number
 * any of them reports.
 *
 * @module phase-provider-fetch/wiki-gate
 */

import { logger } from '@/utils/logger';

import { decideCrossSeriesGate, seriesExtentEvidence, wikiVolumeCount, type CrossSeriesGateConfig } from '../cross-series-gate';

import { withoutChaptersPastVolumeCeiling } from './fandom-volume-ceiling';

import type { KitsuDirectResult } from './kitsu-fetch';
import type { MALDirectResult } from './mal-fetch';
import type { MangaDexDirectResult } from './mangadex-fetch';
import type { MangaUpdatesDirectResult } from './mangaupdates-fetch';
import type { EnrichmentPipelineOptions, UnifiedProviderResults } from '../types';

const log = logger.child('PhaseProviderFetch');

/**
 * Thresholds. OVERFLOW_MIN_AL is low (2) so spin-offs with tiny AniList counts
 * (Vagabond Saigo no Manga-ten AL=2, JJK 0 AL=4) still trip the gate when their
 * main-series wiki floods 200+ chapters; the 2× ratio prevents false positives.
 * The 1.5× / +40 backstop catches a parent list under 2× (AoT: Before the
 * Fall AL=73, Fandom=139). Keep mirrored with pipeline-orchestrator.ts.
 */
export const WIKI_GATE_CONFIG: CrossSeriesGateConfig = {
  ratio: 2.0,
  minAniList: 2,
  minMangaDex: 10,
  tightRatio: 1.5,
  absOverflow: 40,
  tightMinAniList: 30,
  subSeriesCap: 200,
};

const SUB_SERIES_PATTERN = /\b(part|vol|volume|season|book|arc)\s*\d+/i;

type FandomResult = UnifiedProviderResults['fandomResult'];
type WikipediaResult = UnifiedProviderResults['wikipediaResult'];

export interface WikiGateInputs {
  mangaId: number;
  title: string;
  anilist: { chapters?: number | null; volumes?: number | null; status?: unknown } | null;
  mangadex: MangaDexDirectResult | null;
  mangaupdates: MangaUpdatesDirectResult | null;
  kitsu: KitsuDirectResult | null;
  mal: MALDirectResult | null;
  fandom: FandomResult;
  wikipedia: WikipediaResult;
  claimRun?: EnrichmentPipelineOptions['claimRun'];
}

/** Apply the cross-series gate to the Fandom and Wikipedia results. */
export function applyWikiGate(inputs: WikiGateInputs): { fandom: FandomResult; wikipedia: WikipediaResult } {
  const { mangaId, anilist, mangadex } = inputs;
  const counts = {
    mangadex: mangadex?.chapterList.length ?? 0,
    anilist: anilist?.chapters ?? 0,
    subSeriesTitle: SUB_SERIES_PATTERN.test(inputs.title),
  };
  const evidence = seriesExtentEvidence({
    mangadexFeed: mangadex?.chapterList,
    mangadexLastChapter: mangadex?.lastChapter,
    mangaupdatesLatestChapter: inputs.mangaupdates?.latestChapter,
    kitsu: inputs.kitsu,
    mal: inputs.mal,
    anilistVolumes: anilist?.volumes,
  });

  let fandom = inputs.fandom;
  if (fandom) {
    const shape = { chapterCount: fandom.chapterList.length, volumeCount: wikiVolumeCount(fandom.volumeList, fandom.chapterList) };
    const { gate, reason } = decideCrossSeriesGate(shape, counts, WIKI_GATE_CONFIG, evidence);
    if (gate) {
      log.warn('Fandom chapter list disabled — likely cross-series wiki', {
        mangaId, fandomChapters: shape.chapterCount, reason, fandomUrl: fandom.url,
      });
      inputs.claimRun?.noteGated('fandom', reason, { fandom });
      fandom = { ...fandom, chapterList: [], volumeList: [] };
    } else {
      if (reason !== '') log.info('Fandom chapter list kept as this series', { mangaId, reason });
      // A whole-franchise wiki under the count gate still files its chapters under volumes this series does not have.
      fandom = withoutChaptersPastVolumeCeiling(mangaId, fandom, anilist?.status, anilist?.volumes);
    }
  }

  let wikipedia = inputs.wikipedia;
  if (wikipedia) {
    const volumeList = wikipedia.data.volumeList ?? [];
    const shape = { chapterCount: wikipedia.chapterList.length, volumeCount: wikiVolumeCount(volumeList, []) };
    const { gate, reason } = decideCrossSeriesGate(shape, counts, WIKI_GATE_CONFIG, evidence);
    if (gate) {
      log.warn('Wikipedia chapter list disabled — likely cross-series article', {
        mangaId, wikipediaChapters: shape.chapterCount, reason, wikipediaTitle: wikipedia.data.title,
      });
      inputs.claimRun?.noteGated('wikipedia', reason, { wikipedia });
      wikipedia = { ...wikipedia, chapterList: [], ownChapterCount: 0, data: { ...wikipedia.data, volumeList: [] } };
    } else if (reason !== '') {
      log.info('Wikipedia chapter list kept as this series', { mangaId, reason });
    }
  }
  return { fandom, wikipedia };
}
