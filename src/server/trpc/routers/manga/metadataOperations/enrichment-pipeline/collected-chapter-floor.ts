/**
 * How far down a finished series' chapter count may be lowered, judged by the
 * collected volumes the providers list.
 *
 * The corroborated final chapter (corroborated-final-chapter.ts) is the last
 * chapter of the main numbering. A chapter that is printed in a tankobon is a
 * real chapter whether or not the feeds number it, so the count is never
 * lowered below:
 *
 *   1. the highest chapter any provider writes inside a numbered volume, and
 *   2. the end of the series at all, when the providers place the final
 *      chapter in a volume before the last one. Dr. STONE ends its numbering
 *      at 232 in volume 26, and volume 27 collects 233-236 (an epilogue and
 *      "4D Science"), which no provider numbers: Wikipedia lists them as
 *      "One-shot" and "1D"-"3D", MangaDex has no volume past 23. The count of
 *      236 is the only number for them, so it is kept.
 *
 * Bleach is the opposite shape: 686 is the last chapter of volume 74, the last
 * volume, and the 20 extras AniList counts are in no volume, so the bound holds.
 */

import { parseComicVineDescriptions } from './comicvine-description-parser';
import { highestWrittenChapter } from './corroborated-final-chapter';

import type { UnifiedProviderResults } from './types';

/** The highest numbered chapter one provider places in one numbered volume (0: the volume lists none). */
export interface VolumePlacement {
  source: string;
  volume: number;
  chapter: number;
}

/** "232", 232, 200.5 → the whole chapter; "Prologue", "1D" → 0. */
function wholeChapter(value: string | number): number {
  const parsed = typeof value === 'number' ? value : /^\d+(?:\.\d+)?$/.test(value.trim()) ? parseFloat(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/** Wikipedia's volume list, unless the cross-series gate disabled the article. */
function wikipediaPlacements(results: UnifiedProviderResults): VolumePlacement[] {
  const wiki = results.wikipediaResult;
  if (!wiki || wiki.chapterList.length === 0) return [];
  return (wiki.data.volumeList ?? [])
    .filter(v => v.number > 0)
    .map(v => ({
      source: 'wikipedia',
      volume: v.number,
      chapter: Math.max(0, ...v.chapters.map(c => wholeChapter(c.number))),
    }));
}

/** ComicVine: chapter numbers as written in each volume's description. */
function comicvinePlacements(results: UnifiedProviderResults): VolumePlacement[] {
  const parsed = parseComicVineDescriptions(results.enrichmentResult.enrichedData);
  return parsed.volumeDescriptions
    .filter(v => v.volumeNumber > 0)
    .map(v => ({ source: 'comicvine', volume: v.volumeNumber, chapter: highestWrittenChapter([v.descriptionText]) }));
}

/** MangaDex aggregate; its parser already drops the "none" volume. */
function mangadexPlacements(results: UnifiedProviderResults): VolumePlacement[] {
  return (results.mangadexAggregate?.volumes ?? [])
    .filter(v => v.volumeNumber > 0)
    .map(v => ({ source: 'mangadex', volume: v.volumeNumber, chapter: Math.floor(v.chapterEnd) }));
}

export function collectVolumePlacements(results: UnifiedProviderResults): VolumePlacement[] {
  return [...wikipediaPlacements(results), ...comicvinePlacements(results), ...mangadexPlacements(results)];
}

/**
 * The lowest chapter count the providers' volume lists allow.
 *
 * `lastVolume` is the series' stated volume count (AniList / MAL); without
 * one, the highest volume Wikipedia or ComicVine lists. MangaDex volume
 * numbers are scanlator tags and do not decide which volume is last.
 *
 * Returns +Infinity when every placement that reaches the final chapter is in
 * a volume before the last one: later volumes hold chapters past it that no
 * provider numbers, so no number below the scalar is safe. A final chapter no
 * provider places is not evidence either way and leaves rule 1 alone.
 */
export function collectedChapterFloor(
  placements: VolumePlacement[],
  finalChapter: number,
  statedVolumes: number | null,
): number {
  const listedVolumes = placements.filter(p => p.source !== 'mangadex').map(p => p.volume);
  const lastVolume = statedVolumes !== null && statedVolumes > 0 ? statedVolumes : Math.max(0, ...listedVolumes);
  const reachingFinal = placements.filter(p => p.chapter >= finalChapter);
  if (lastVolume > 0 && reachingFinal.length > 0 && reachingFinal.every(p => p.volume < lastVolume)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, ...placements.map(p => p.chapter));
}

/** "wikipedia=232@v26 (last v27)": each provider's highest placed chapter and its last listed volume, for logs. */
export function describePlacements(placements: VolumePlacement[]): string {
  const sources = [...new Set(placements.map(p => p.source))];
  return sources.map(source => {
    const own = placements.filter(p => p.source === source);
    const top = own.reduce((best, p) => (p.chapter > best.chapter ? p : best));
    const last = Math.max(...own.map(p => p.volume));
    return `${source}=${top.chapter}@v${top.volume} (last v${last})`;
  }).join(', ');
}
