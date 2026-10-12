/**
 * Upper plausibility bound for a finished series' final chapter.
 *
 * AniList and Kitsu report a chapter COUNT. For most series that equals the
 * highest chapter number, but a count also includes side stories and extras:
 * Bleach is 706 (686 numbered + 20 extras), and using 706 as the last chapter
 * number created stubs 687-706 and a phantom volume on every refresh.
 *
 * Other providers state the highest NUMBERED chapter directly. When at least
 * two of them agree, that number is cross-checked and a larger scalar is a
 * count, not a chapter number. A single witness, or witnesses that disagree,
 * bound nothing.
 */

import { parseComicVineDescriptions } from './comicvine-description-parser';
import { wikipediaOwnChapterCount } from './phase-volume-cross-validation/witness-counts';

import type { UnifiedProviderResults } from './types';

export interface FinalChapterWitness {
  source: string;
  chapter: number;
}

export interface CorroboratedFinalChapter {
  /** Highest numbered chapter the agreeing witnesses report. */
  chapter: number;
  /** Providers that agree on it; those that reported exactly `chapter` come first. */
  sources: string[];
}

/** Witnesses may differ by this much and still agree (a "Chapter 0", a missed last row). */
const WITNESS_AGREEMENT_WINDOW = 1;

/**
 * A scalar this close above the corroborated number is left alone: an omake or
 * an epilogue legitimately adds one or two (the chapter consensus uses the
 * same window), and a small excess is not worth overriding the anchor for.
 */
export const FINAL_CHAPTER_SLACK = 2;

/** A corroborated number below this fraction of the scalar is a shorter
 *  edition or an incomplete listing, not the same series counted differently. */
const CORROBORATION_FLOOR = 0.9;

function mangadexFinalChapter(results: UnifiedProviderResults): number {
  const enriched = results.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
  const manga = enriched?.['manga'] as Record<string, unknown> | undefined;
  const meta = manga?.['mangadexMeta'] as Record<string, unknown> | undefined;
  // `lastChapter` is only a final chapter once MangaDex marks the series completed.
  if (typeof meta?.['status'] !== 'string' || meta['status'].toLowerCase() !== 'completed') return 0;
  const raw = meta['lastChapter'];
  const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/** "Chapter 686. Death & Strawberry", "Chapters 24 - 46": the number as written. */
const WRITTEN_CHAPTER = /\bChapters?\s+(\d{1,4})(?!\d)(?:\s*[-\u2013]\s*(\d{1,4})(?!\d))?/gi;

/**
 * Highest chapter number literally written in ComicVine's volume descriptions.
 *
 * The parsed chapter list is not used: where a description's lines do not
 * parse as numbered, the parser numbers them by position (Bleach volume 74
 * reads 1-12 for "Chapter 675." to "Chapter 686."), so its maximum is neither
 * a count nor a chapter number.
 */
export function highestWrittenChapter(descriptions: string[]): number {
  let highest = 0;
  for (const text of descriptions) {
    for (const match of text.matchAll(WRITTEN_CHAPTER)) {
      const value = Math.max(parseInt(match[1] ?? '0', 10), parseInt(match[2] ?? '0', 10));
      if (value > highest) highest = value;
    }
  }
  return highest;
}

function comicvineHighestChapter(results: UnifiedProviderResults): number {
  const parsed = parseComicVineDescriptions(results.enrichmentResult.enrichedData);
  return highestWrittenChapter(parsed.volumeDescriptions.map(v => v.descriptionText));
}

/**
 * Wikipedia's highest listed chapter: the total its extractor computes from
 * the chapter list itself (highest number, plus a chapter 0 and epilogues).
 * The extracted-row count is lower whenever rows fail to parse (Bleach: 667
 * rows, highest 686). Nothing from an article the cross-series gate disabled.
 */
function wikipediaHighestChapter(results: UnifiedProviderResults): number {
  const wiki = results.wikipediaResult;
  if (!wiki || wiki.chapterList.length === 0) return 0;
  const stated = wiki.data.chapters;
  return typeof stated === 'number' && stated > 0 ? Math.floor(stated) : wikipediaOwnChapterCount(results);
}

/**
 * Each provider's statement of the highest numbered chapter. AniList, MAL and
 * Kitsu are left out on purpose: theirs is the count being checked.
 */
export function collectFinalChapterWitnesses(results: UnifiedProviderResults): FinalChapterWitness[] {
  const witnesses: FinalChapterWitness[] = [];
  const push = (source: string, chapter: number): void => {
    if (chapter > 0) witnesses.push({ source, chapter });
  };
  push('mangadex', mangadexFinalChapter(results));
  push('comicvine', comicvineHighestChapter(results));
  push('wikipedia', wikipediaHighestChapter(results));
  const mu = results.mangaupdatesResult;
  if (mu?.completed) push('mangaupdates', Math.floor(mu.latestChapter));
  return witnesses;
}

/**
 * The highest chapter number that at least two providers agree on, or null.
 * Taking the highest agreeing group means an incomplete pair (two sources that
 * both stop early) never outvotes a complete one.
 */
export function corroborateFinalChapter(witnesses: FinalChapterWitness[]): CorroboratedFinalChapter | null {
  const byChapterDesc = [...witnesses].sort((a, b) => b.chapter - a.chapter);
  for (const seed of byChapterDesc) {
    const group = witnesses.filter(w => Math.abs(w.chapter - seed.chapter) <= WITNESS_AGREEMENT_WINDOW);
    // Exact reporters first: the first source is written as the stored value's
    // provenance, and a provider one below did not report the stored number.
    const exactFirst = [...group].sort((a, b) => Number(b.chapter === seed.chapter) - Number(a.chapter === seed.chapter));
    const sources = [...new Set(exactFirst.map(w => w.source))];
    if (sources.length >= 2) return { chapter: seed.chapter, sources };
  }
  return null;
}

/**
 * Bound a trusted final-chapter scalar by the corroborated number. Only ever
 * lowers the scalar, and only when the excess is more than slack yet small
 * enough to be extras counted on top of the same series.
 *
 * A witness that states the scalar itself as the highest numbered chapter
 * means the scalar is a chapter number, not a count: two lower witnesses that
 * agree with each other (two listings that both stop early) do not outvote it.
 *
 * `collectedFloor` (collected-chapter-floor.ts) is the lowest count the
 * providers' volume lists allow: a chapter printed in a volume is real, so the
 * bound is never below it (Dr. STONE keeps 233-236, collected in volume 27).
 */
export function boundByCorroboratedFinal(
  ceiling: number,
  corroborated: CorroboratedFinalChapter | null,
  witnesses: FinalChapterWitness[] = [],
  collectedFloor = 0,
): number {
  if (corroborated === null) return ceiling;
  if (witnesses.some(w => Math.abs(w.chapter - ceiling) <= WITNESS_AGREEMENT_WINDOW)) return ceiling;
  if (corroborated.chapter < ceiling * CORROBORATION_FLOOR) return ceiling;
  const bound = Math.max(corroborated.chapter, collectedFloor);
  if (ceiling - bound <= FINAL_CHAPTER_SLACK) return ceiling;
  return bound;
}
