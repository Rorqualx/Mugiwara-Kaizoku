/**
 * Cross-Series Chapter Gate
 *
 * Decides whether a Fandom/Wikipedia chapter list looks like it came from a
 * DIFFERENT series than the one being enriched — the classic shared-wiki
 * failure where a spin-off binds to the franchise wiki and scrapes the parent
 * series' (much longer) chapter list.
 *
 * Pure logic (no DB / network) so it can be unit-tested directly. Both the
 * provider-fetch phase (`decideCrossSeriesGate`) and the reconciliation step
 * (`filterFandomChaptersByCrossSeriesGate`) decide through this module.
 *
 * @module cross-series-gate
 */

import { logger } from '@/utils/logger';

export interface CrossSeriesGateConfig {
  ratio: number;
  minAniList: number;
  minMangaDex: number;
  /** Tighter same-universe spin-off backstop (1.5×–2× band): gate when the
   *  Fandom list overflows AniList by both `tightRatio×` AND `absOverflow`
   *  absolute chapters, with AniList ≥ `tightMinAniList`. */
  tightRatio: number;
  absOverflow: number;
  tightMinAniList: number;
  /** Last-resort cap for a sub-series title ("Part 7") when no count is known. */
  subSeriesCap?: number;
}

/**
 * What the series' own providers say about how long it is. Used only when
 * AniList has no chapter count (an ongoing series): then the MangaDex tier
 * compares against the English feed, which for a licensed title holds a few
 * dozen chapters of a 278-chapter series.
 */
export interface SeriesExtentEvidence {
  /** Highest chapter number any provider reports for this series; 0 when none does. */
  chapterReach: number;
  /** Volume counts the providers report (Kitsu, MAL, AniList); unknowns left out. */
  knownVolumeCounts: number[];
}

/** The size of a wiki's list: chapters, and the highest volume number it files them under. */
export interface WikiListShape {
  chapterCount: number;
  volumeCount: number;
}

export interface CrossSeriesGateDecision {
  gate: boolean;
  reason: string;
}

/** A wiki may run ahead of the providers that report a highest chapter by this factor. */
export const CHAPTER_REACH_TOLERANCE = 1.25;
/** A wiki's volume count may differ from a provider's by this many volumes. */
export const VOLUME_COUNT_TOLERANCE = 1;
/** Below this many volumes a count match is too likely to be a coincidence. */
const MIN_VOLUMES_FOR_AGREEMENT = 3;
/** Below this, a highest chapter number says too little about series length. */
const MIN_CHAPTER_REACH = 10;
/** A feed chapter counts toward the reach only when another feed chapter lies this close below it. */
const FEED_NEIGHBOUR_SPAN = 50;

export interface SeriesExtentSources {
  mangadexFeed?: ReadonlyArray<{ number: number }> | null | undefined;
  mangadexLastChapter?: string | null | undefined;
  mangaupdatesLatestChapter?: number | null | undefined;
  kitsu?: { chapterCount?: number | undefined; volumeCount?: number | undefined } | null | undefined;
  mal?: { chapters: number | null; volumes: number | null } | null | undefined;
  anilistVolumes?: number | null | undefined;
}

function positive(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * The highest chapter number in a MangaDex feed that another feed chapter
 * backs up (one within 50 below it). A licensed title's English feed holds
 * chapters 1-3 and 200-232, so its row count (32) says nothing about how long
 * the series is, but its highest chapter does; a lone stray number (a year)
 * is not counted.
 */
export function mangadexFeedReach(feed: ReadonlyArray<{ number: number }>): number {
  const numbers = [...new Set(feed.map(c => positive(c.number)).filter(n => n > 0))].sort((a, b) => b - a);
  for (let i = 0; i < numbers.length - 1; i++) {
    const n = numbers[i] ?? 0;
    const next = numbers[i + 1] ?? 0;
    if (n - next <= FEED_NEIGHBOUR_SPAN) return n;
  }
  return 0;
}

/** Collect what the providers say about the series' extent. */
export function seriesExtentEvidence(sources: SeriesExtentSources): SeriesExtentEvidence {
  const chapterReach = Math.max(
    mangadexFeedReach(sources.mangadexFeed ?? []),
    positive(sources.mangadexLastChapter === null || sources.mangadexLastChapter === undefined ? 0 : parseFloat(sources.mangadexLastChapter)),
    positive(sources.mangaupdatesLatestChapter),
    positive(sources.kitsu?.chapterCount),
    positive(sources.mal?.chapters),
  );
  const knownVolumeCounts = [sources.kitsu?.volumeCount, sources.mal?.volumes, sources.anilistVolumes]
    .map(positive)
    .filter(n => n > 0);
  return { chapterReach, knownVolumeCounts };
}

/** The highest volume number a wiki files anything under (volume list or chapter list). */
export function wikiVolumeCount(
  volumes: ReadonlyArray<{ number: number }>,
  chapters: ReadonlyArray<{ volume?: number | undefined }>,
): number {
  let max = 0;
  for (const v of volumes) max = Math.max(max, positive(v.number));
  for (const c of chapters) max = Math.max(max, positive(c.volume));
  return max;
}

/**
 * Why the wiki's list is this series' own, or null when its size does not
 * match what the series' providers report. Same series when either:
 *   - its volume count is within ±1 of a provider's volume count (≥3 volumes), or
 *   - its chapter count is no more than 1.25× the highest chapter number any
 *     provider reports.
 */
export function wikiMatchesSeriesExtent(wiki: WikiListShape, evidence: SeriesExtentEvidence): string | null {
  if (wiki.volumeCount >= MIN_VOLUMES_FOR_AGREEMENT) {
    const agreeing = evidence.knownVolumeCounts.find(
      known => known >= MIN_VOLUMES_FOR_AGREEMENT && Math.abs(known - wiki.volumeCount) <= VOLUME_COUNT_TOLERANCE,
    );
    if (agreeing !== undefined) return `wiki volumes ${wiki.volumeCount} agree with provider volume count ${agreeing}`;
  }
  if (evidence.chapterReach >= MIN_CHAPTER_REACH && wiki.chapterCount <= evidence.chapterReach * CHAPTER_REACH_TOLERANCE) {
    return `wiki chapters ${wiki.chapterCount} within reach of highest provider chapter ${evidence.chapterReach}`;
  }
  return null;
}

/**
 * Gate decision for one wiki list.
 *
 * Tier 1 — AniList (most accurate; spin-offs indexed separately):
 *   - `>ratio×` AniList → gate (the long-standing 2× rule).
 *   - same-universe backstop: `>tightRatio×` AND `+absOverflow` absolute over
 *     AniList (with AniList ≥ tightMinAniList) → gate. Catches the 1.5×–2× band
 *     the ratio rule misses (139 vs 73 → 139 < 146 but +66 over).
 * No AniList count (an ongoing series): a list whose size matches the series'
 * own providers (`wikiMatchesSeriesExtent`) is kept. Otherwise:
 * Tier 2 — MangaDex rows: `>ratio×` MangaDex → gate.
 * Tier 3 — sub-series title over `subSeriesCap` → gate.
 */
export function decideCrossSeriesGate(
  wiki: WikiListShape,
  counts: { mangadex: number; anilist: number; subSeriesTitle?: boolean },
  cfg: CrossSeriesGateConfig,
  evidence?: SeriesExtentEvidence,
): CrossSeriesGateDecision {
  const n = wiki.chapterCount;
  if (counts.anilist >= cfg.minAniList) {
    if (n > counts.anilist * cfg.ratio) {
      return { gate: true, reason: `>${cfg.ratio}x AniList (${n} vs ${counts.anilist})` };
    }
    if (counts.anilist >= cfg.tightMinAniList && n > counts.anilist * cfg.tightRatio && n - counts.anilist >= cfg.absOverflow) {
      return { gate: true, reason: `>${cfg.tightRatio}x & +${n - counts.anilist} over AniList (${n} vs ${counts.anilist})` };
    }
    return { gate: false, reason: '' };
  }
  const sameSeries = evidence ? wikiMatchesSeriesExtent(wiki, evidence) : null;
  if (sameSeries !== null) return { gate: false, reason: sameSeries };
  if (counts.mangadex >= cfg.minMangaDex && n > counts.mangadex * cfg.ratio) {
    return { gate: true, reason: `>${cfg.ratio}x MangaDex (${n} vs ${counts.mangadex})` };
  }
  if (counts.subSeriesTitle === true && cfg.subSeriesCap !== undefined && n > cfg.subSeriesCap) {
    return { gate: true, reason: `sub-series title with ${n} chapters (cap ${cfg.subSeriesCap})` };
  }
  return { gate: false, reason: '' };
}

/**
 * Discard Fandom's chapter list when it looks cross-series (e.g. the AoT wiki
 * bound to "Attack on Titan: Before the Fall" floods the spin-off with the main
 * series' 139 chapters). Returns the original array when on-series, `[]` when
 * gated. `wiki` and `evidence` supply the same-series check for a series with
 * no AniList chapter count; without them only the counts decide.
 */
export function filterFandomChaptersByCrossSeriesGate<T>(
  mangaId: number,
  rawFandomChapters: T[],
  counts: { mangadex: number; anilist: number },
  cfg: CrossSeriesGateConfig,
  extent?: { volumeCount: number; evidence: SeriesExtentEvidence },
): T[] {
  const decision = decideCrossSeriesGate(
    { chapterCount: rawFandomChapters.length, volumeCount: extent?.volumeCount ?? 0 },
    counts, cfg, extent?.evidence,
  );
  if (decision.gate) {
    logger.warn(`[enrichmentPipeline] Skipping Fandom chapters for manga ${mangaId}: ${decision.reason} (likely cross-series wiki)`);
    return [];
  }
  return rawFandomChapters;
}
