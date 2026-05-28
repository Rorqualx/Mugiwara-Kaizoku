/**
 * Cross-Series Chapter Gate
 *
 * Decides whether a Fandom/Wikipedia chapter list looks like it came from a
 * DIFFERENT series than the one being enriched — the classic shared-wiki
 * failure where a spin-off binds to the franchise wiki and scrapes the parent
 * series' (much longer) chapter list.
 *
 * Pure logic (no DB / network) so it can be unit-tested directly. The mirror
 * `shouldGate` closure in `phase-provider-fetch.ts` MUST stay consistent with
 * the thresholds here.
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
}

/**
 * Discard Fandom's chapter list when it looks cross-series (e.g. the AoT wiki
 * bound to "Attack on Titan: Before the Fall" floods the spin-off with the main
 * series' 139 chapters). Returns the original array when on-series, `[]` when gated.
 *
 * Tier 1 — AniList (most accurate; spin-offs indexed separately):
 *   - `>ratio×` AniList → gate (the long-standing 2× rule).
 *   - same-universe backstop: `>tightRatio×` AND `+absOverflow` absolute over
 *     AniList (with AniList ≥ tightMinAniList) → gate. Catches the 1.5×–2× band
 *     the ratio rule misses (139 vs 73 → 139 < 146 but +66 over).
 * Tier 2 — MangaDex (fallback when AniList missing): `>ratio×` MangaDex → gate.
 */
export function filterFandomChaptersByCrossSeriesGate<T>(
  mangaId: number,
  rawFandomChapters: T[],
  counts: { mangadex: number; anilist: number },
  cfg: CrossSeriesGateConfig,
): T[] {
  if (counts.anilist >= cfg.minAniList) {
    if (rawFandomChapters.length > counts.anilist * cfg.ratio) {
      logger.warn(`[enrichmentPipeline] Skipping Fandom chapters: ${rawFandomChapters.length} returned but AniList has ${counts.anilist} for manga ${mangaId} (likely cross-series wiki)`);
      return [];
    }
    // Absolute-overflow backstop for same-universe spin-offs (1.5×–2× band):
    // e.g. AoT: Before the Fall AL=73, Fandom=139 (main series) — under 2× but
    // +66 chapters over AL. Keep mirrored with phase-provider-fetch's shouldGate.
    if (counts.anilist >= cfg.tightMinAniList
        && rawFandomChapters.length > counts.anilist * cfg.tightRatio
        && rawFandomChapters.length - counts.anilist >= cfg.absOverflow) {
      logger.warn(`[enrichmentPipeline] Skipping Fandom chapters: ${rawFandomChapters.length} returned but AniList has ${counts.anilist} for manga ${mangaId} (likely cross-series wiki, absolute-overflow backstop)`);
      return [];
    }
    return rawFandomChapters;
  }
  if (counts.mangadex >= cfg.minMangaDex && rawFandomChapters.length > counts.mangadex * cfg.ratio) {
    logger.warn(`[enrichmentPipeline] Skipping Fandom chapters: ${rawFandomChapters.length} returned but MangaDex has ${counts.mangadex} for manga ${mangaId} (likely cross-series wiki, AniList unavailable)`);
    return [];
  }
  return rawFandomChapters;
}
