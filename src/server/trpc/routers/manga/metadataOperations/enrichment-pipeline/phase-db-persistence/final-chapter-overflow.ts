/**
 * Provider chapters numbered past a finished series' agreed final chapter.
 *
 * A source that lists a series under its whole-franchise numbering (MangaDex
 * lists JoJo Part 4, chapters 1-174, again as 266-439) hands the merge a
 * second run of chapters. They carry a page count, so the phantom prune keeps
 * them as real, and they were stored as monitored chapters waiting to be
 * downloaded. They are refused before the merge instead.
 *
 * Only generic-titled whole numbers are dropped: a chapter with its own title
 * past the scalar is a real late chapter (Berserk 384, 385) and stays.
 *
 * No DB access; `withoutOverflowPastFinal` only logs.
 */

import { logger } from '@/utils/logger';

import { isGenericChapterTitle } from '../types';

import type { ChapterConsensus } from '../phase-volume-cross-validation/chapter-consensus-resolver';
import type { ProviderChapter } from '../types';

/** An epilogue or omake may sit this far past the count. */
const FINAL_CHAPTER_SLACK = 2;
/** The list must hold at least this share of 1..final for the rest to be a second numbering. */
const MIN_MAIN_RUN_COVERAGE = 0.5;

const FINISHED_STATUSES = new Set<string>(['COMPLETED', 'FINISHED', 'CANCELLED']);

/**
 * The final chapter of a finished series, when the chapter consensus agrees
 * with the stored scalar. Null for a running series, a disputed count, or no
 * consensus — then nothing is refused.
 */
export function agreedFinalChapter(
  status: unknown,
  scalarChapters: number,
  consensus: ChapterConsensus | undefined,
): number | null {
  if (typeof status !== 'string' || !FINISHED_STATUSES.has(status.toUpperCase())) return null;
  if (scalarChapters <= 0 || !consensus) return null;
  if (consensus.confidence !== 'high' && consensus.confidence !== 'medium') return null;
  if (Math.abs(consensus.count - scalarChapters) > FINAL_CHAPTER_SLACK) return null;
  return Math.max(consensus.count, scalarChapters);
}

/**
 * The last chapter number a finished series can have, from the merge's
 * expected count; null while the series is running or the count is unknown.
 * Unlike `agreedFinalChapter` it needs no consensus: it only stops a
 * whole-volume archive row from being numbered past the end.
 */
export function finishedSeriesFinalChapter(status: unknown, expectedCount: number): number | null {
  if (typeof status !== 'string' || !FINISHED_STATUSES.has(status.toUpperCase())) return null;
  return expectedCount > 0 ? expectedCount : null;
}

/**
 * Split `chapters` into those to merge and the generic-titled overflow past
 * `finalChapter`. Returns everything as kept when there is no final chapter
 * or the list does not cover the main run. Up to two chapters past the final
 * chapter are kept as an epilogue, unless the overflow run continues past them.
 */
export function splitOverflowPastFinal(
  chapters: ProviderChapter[],
  finalChapter: number | null,
  slack = FINAL_CHAPTER_SLACK,
): { kept: ProviderChapter[]; refused: ProviderChapter[] } {
  if (finalChapter === null) return { kept: chapters, refused: [] };
  const limit = finalChapter + slack;
  const mainRun = chapters.filter(c => c.chapterNumber <= limit).length;
  if (mainRun < finalChapter * MIN_MAIN_RUN_COVERAGE) return { kept: chapters, refused: [] };
  const isGenericWhole = (c: ProviderChapter): boolean =>
    Number.isInteger(c.chapterNumber) && isGenericChapterTitle(c.title);
  // The slack is for an epilogue that stands alone. When the generic run goes
  // straight on past it (JoJo Part 3: 152 chapters, listed again as 114-265),
  // the chapters inside the slack are the same second numbering, not an epilogue.
  const runContinuesPastSlack = chapters.some(c => c.chapterNumber === limit + 1 && isGenericWhole(c));
  const from = runContinuesPastSlack ? finalChapter : limit;
  const kept: ProviderChapter[] = [];
  const refused: ProviderChapter[] = [];
  for (const chapter of chapters) {
    const overflow = chapter.chapterNumber > from && isGenericWhole(chapter);
    (overflow ? refused : kept).push(chapter);
  }
  return { kept, refused };
}

/**
 * The chapters to merge for one title, with any refused overflow logged.
 *
 * `crossCheckedFinal` is set when this run lowered a finished series' count to
 * the final chapter the providers state (Demon Slayer 207 → 205). That number
 * already leaves the extras out, so there is no epilogue slack past it: a
 * generic "Chapter 206" (MangaDex's Latin-American Spanish upload numbers the
 * extras 206) is refused. Decimal extras and titled chapters still pass.
 */
export function withoutOverflowPastFinal(
  mangaId: number,
  chapters: ProviderChapter[],
  series: {
    status: unknown;
    scalarChapters: number;
    consensus: ChapterConsensus | undefined;
    crossCheckedFinal?: number | null;
  },
): ProviderChapter[] {
  const { status, scalarChapters, consensus, crossCheckedFinal } = series;
  const finished = typeof status === 'string' && FINISHED_STATUSES.has(status.toUpperCase());
  const { kept, refused } = finished && typeof crossCheckedFinal === 'number' && crossCheckedFinal > 0
    ? splitOverflowPastFinal(chapters, crossCheckedFinal, 0)
    : splitOverflowPastFinal(chapters, agreedFinalChapter(status, scalarChapters, consensus));
  if (refused.length > 0) {
    const numbers = refused.map(c => c.chapterNumber);
    logger.info(`[enrichmentPipeline] Refused ${refused.length} generic chapter(s) past the final chapter of finished manga ${mangaId} (${Math.min(...numbers)}-${Math.max(...numbers)})`);
  }
  return kept;
}
