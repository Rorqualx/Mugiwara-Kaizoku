/**
 * Choose this series' volume manifest from a page's Graphic novel list tables.
 *
 * A manifest is used only when it is unambiguous: volumes numbered 1..N with
 * chapters, each volume's chapters in order without gaps, each volume
 * starting right after the previous one ends, the first starting at chapter 0
 * or 1. Anything else (a page we misread, an omnibus edition, a list with
 * unnumbered chapters) returns null and the caller keeps what it had.
 *
 * Pure: no network, no logging.
 *
 * @module services/wikipedia/graphic-novel-list/manifest
 */

import type { GraphicNovelTable, GraphicNovelVolume } from './wikitext-parser';

export interface GraphicNovelManifest {
  /** Volumes of the chosen table in number order; trailing volumes may have no chapters yet. */
  volumes: GraphicNovelVolume[];
  /** Headings the chosen table sits under. */
  headings: string[];
  /**
   * True when the page also holds other series' tables (a franchise list such
   * as "List of Battle Angel Alita chapters"): the page's other chapters are
   * not this series'.
   */
  sharedPage: boolean;
}

/** Fewer volumes with chapters than this is too little to trust over the other sources. */
const MIN_VOLUMES_WITH_CHAPTERS = 3;

/** Heading or title text reduced for comparison. */
export function normalizeSeriesName(text: string): string {
  return text
    .toLowerCase()
    .replace(/\((?:manga|comics?|series)\)/g, '')
    .replace(/[‘’'"`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * The volume's whole-numbered chapters in order. Decimal chapters (bonus
 * "31.5", listed wherever the editors put them) do not decide boundaries.
 */
function wholeChapters(volume: GraphicNovelVolume): number[] {
  return volume.chapters.map(c => c.number).filter(n => Number.isInteger(n)).sort((a, b) => a - b);
}

/** Each chapter after the first is the next whole number. */
function consecutive(numbers: number[]): boolean {
  return numbers.every((n, i) => i === 0 || n === (numbers[i - 1] ?? 0) + 1);
}

/** Leading volumes that list chapters, when they form a clean 1..N manifest; null otherwise. */
export function cleanVolumesWithChapters(volumes: GraphicNovelVolume[]): GraphicNovelVolume[] | null {
  const withChapters: GraphicNovelVolume[] = [];
  for (const [i, volume] of volumes.entries()) {
    if (volume.number !== i + 1) return null;
    if (volume.chapters.length === 0) break;
    withChapters.push(volume);
  }
  // A volume after the first chapterless one that lists chapters again is a misread.
  if (volumes.slice(withChapters.length).some(v => v.chapters.length > 0)) return null;
  if (withChapters.length < MIN_VOLUMES_WITH_CHAPTERS) return null;
  let previousEnd = -1;
  for (const volume of withChapters) {
    const numbers = wholeChapters(volume);
    const first = numbers[0];
    if (first === undefined || !consecutive(numbers)) return null;
    if (previousEnd < 0 ? first > 1 : first !== previousEnd + 1) return null;
    previousEnd = numbers[numbers.length - 1] ?? first;
  }
  return withChapters;
}

/**
 * Join tables that continue the one before (a long series split into
 * "Volumes 1–20" / "Volumes 21–40" sections) into one table.
 */
export function joinContinuedTables(tables: GraphicNovelTable[]): GraphicNovelTable[] {
  const joined: GraphicNovelTable[] = [];
  for (const table of tables) {
    const previous = joined[joined.length - 1];
    const lastNumber = previous?.volumes[previous.volumes.length - 1]?.number ?? 0;
    const firstNumber = table.volumes[0]?.number ?? 0;
    if (previous && lastNumber > 0 && firstNumber === lastNumber + 1) {
      joined[joined.length - 1] = { headings: previous.headings, volumes: [...previous.volumes, ...table.volumes] };
    } else {
      joined.push(table);
    }
  }
  return joined;
}

/**
 * The manifest for `seriesNames` from a page's tables. On a page with several
 * series' tables, only a table under a heading naming the series is taken; a
 * page with a single series' tables uses its first clean table (the original
 * edition comes first; later tables are translations or reprints).
 */
export function selectGraphicNovelManifest(
  tables: GraphicNovelTable[],
  seriesNames: string[],
): GraphicNovelManifest | null {
  const joined = joinContinuedTables(tables);
  const isClean = (t: GraphicNovelTable): boolean => cleanVolumesWithChapters(t.volumes) !== null;
  const wanted = new Set(seriesNames.map(normalizeSeriesName).filter(n => n.length > 0));
  const named = joined.filter(t => t.headings.some(h => wanted.has(normalizeSeriesName(h))));
  // A heading names the series: only its tables count, clean or not (Tokyo
  // Ghoul:re must never fall back to the parent's table above it).
  const chosen = named.length > 0 ? named.find(isClean) : joined.find(isClean);
  if (!chosen) return null;
  // Tables with chapters in other sections that the series' name does not
  // head belong to other series (Last Order, Mars Chronicle on Alita's list).
  const sectionOf = (t: GraphicNovelTable): string => t.headings.slice(0, 2).join('/');
  const sharedPage = named.length > 0 && joined.some(t =>
    !named.includes(t) && sectionOf(t) !== sectionOf(chosen) && t.volumes.some(v => v.chapters.length > 0));
  return { volumes: withoutStrayExtras(chosen.volumes), headings: chosen.headings, sharedPage };
}

/**
 * Volumes with their chapters sorted, minus decimal extras whose whole number
 * another volume holds: Tokyo Ghoul:re lists "32.1" in volume 3 and "31.5" in
 * volume 4, which as ranges would make the two volumes overlap.
 */
function withoutStrayExtras(volumes: GraphicNovelVolume[]): GraphicNovelVolume[] {
  const owner = new Map<number, number>();
  for (const v of volumes) for (const n of wholeChapters(v)) owner.set(n, v.number);
  return volumes.map(v => ({
    ...v,
    chapters: v.chapters
      .filter(c => Number.isInteger(c.number) || (owner.get(Math.floor(c.number)) ?? v.number) === v.number)
      .sort((a, b) => a.number - b.number),
  }));
}
