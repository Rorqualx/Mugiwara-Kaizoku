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
import { highestWrittenChapter, preferredLanguageMangaDexChapters } from './corroborated-final-chapter';

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

/**
 * MangaDex: the highest preferred-language chapter tagged with each volume.
 * Not the all-language aggregate: Demon Slayer's aggregate puts a
 * Latin-American Spanish "206" (the extras) in volume 23, which raised the
 * floor above the final chapter 205.
 */
function mangadexPlacements(results: UnifiedProviderResults): VolumePlacement[] {
  const highest = new Map<number, number>();
  for (const c of preferredLanguageMangaDexChapters(results)) {
    if (c.volume === undefined || c.volume <= 0) continue;
    highest.set(c.volume, Math.max(highest.get(c.volume) ?? 0, wholeChapter(c.number)));
  }
  return [...highest].map(([volume, chapter]) => ({ source: 'mangadex', volume, chapter }));
}

export function collectVolumePlacements(results: UnifiedProviderResults): VolumePlacement[] {
  return [...wikipediaPlacements(results), ...comicvinePlacements(results), ...mangadexPlacements(results)];
}

/** The stated volume count, else the highest volume Wikipedia or ComicVine lists (0: none). */
function seriesLastVolume(placements: VolumePlacement[], statedVolumes: number | null): number {
  if (statedVolumes !== null && statedVolumes > 0) return statedVolumes;
  return Math.max(0, ...placements.filter(p => p.source !== 'mangadex').map(p => p.volume));
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
  const lastVolume = seriesLastVolume(placements, statedVolumes);
  const reachingFinal = placements.filter(p => p.chapter >= finalChapter);
  if (lastVolume > 0 && reachingFinal.length > 0 && reachingFinal.every(p => p.volume < lastVolume)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, ...placements.map(p => p.chapter));
}

/**
 * True when Wikipedia's or ComicVine's volume list ends the series' last
 * volume exactly at the final chapter and no provider places anything above
 * it: whatever a chapter count adds past that chapter is in no numbered volume.
 *
 * Demon Slayer: volume 23 of 23 collects 197-205, and the two extras AniList
 * counts (207) are listed by Wikipedia only as unnumbered "Special chapters".
 * Dr. STONE does not qualify: its last volume (27) holds chapters no provider
 * numbers, so no list ends it at the final chapter 232. MangaDex volume tags
 * are scanlators' and do not count.
 */
export function lastVolumeEndsAtFinal(
  placements: VolumePlacement[],
  finalChapter: number,
  statedVolumes: number | null,
): boolean {
  const lastVolume = seriesLastVolume(placements, statedVolumes);
  if (lastVolume <= 0 || finalChapter <= 0) return false;
  if (placements.some(p => p.chapter > finalChapter)) return false;
  return placements.some(p => p.source !== 'mangadex' && p.volume === lastVolume && p.chapter === finalChapter);
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
