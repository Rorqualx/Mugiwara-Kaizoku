/**
 * What a library file's own name says about the chapter it holds (pure).
 *
 * A file named for one chapter — `SPY x FAMILY V17 C119.cbz`, `Chapter 0087.cbz`,
 * `c039.cbz` — holds that chapter and nothing else. It is never a whole-volume
 * archive, so no other chapter row may be pointed at it and no numberless
 * volume-file row may treat it as its volume's archive. Volume archives
 * (`One Piece V03.cbz`, `Kaiju No.8 Vol 05`) carry no chapter marker.
 *
 * Only an explicit marker (`c`, `ch`, `chapter`) counts: a bare number in a
 * title ("Mob Psycho 100 V01") is not a chapter, and a file wrongly read as a
 * chapter file would stop its volume's chapters linking to it. A range
 * (`C001-008`) is a multi-chapter archive, not a single chapter.
 */

import * as path from 'node:path';

const CHAPTER_MARKER = /(?:^|[^a-z0-9])(?:c|ch\.?|chapter)[\s._-]*0*(\d+(?:\.\d+)?)/i;
const RANGE_AFTER_NUMBER = /^\s*(?:-|–|~|to\s)\s*(?:c|ch\.?|chapter)?[\s._]*\d/i;

/** Chapter number a file's name assigns to its single chapter, or null when it names no single chapter. */
export function chapterNumberFromFileName(filePath: string): number | null {
  const base = path.basename(filePath);
  const match = CHAPTER_MARKER.exec(base);
  const digits = match?.[1];
  if (match === null || digits === undefined) return null;
  const rest = base.slice(match.index + match[0].length);
  if (RANGE_AFTER_NUMBER.test(rest)) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

/** True when the file's name says it holds exactly one chapter. */
export function isSingleChapterFile(filePath: string | null | undefined): boolean {
  return typeof filePath === 'string' && filePath !== '' && chapterNumberFromFileName(filePath) !== null;
}

/** Minimal row shape for {@link findChapterFileSquatters}. */
export interface ChapterFileHolder {
  id: number;
  chapterNumber: number | null;
  filePath: string | null;
}

/**
 * Numbered rows holding another chapter's file. A single-chapter file shared by
 * several rows belongs to the row whose number the file names (SPY x FAMILY
 * `V17 C119.cbz` → chapter 119); every other numbered row on it is a squatter.
 * A file with no owning row is left alone: its number may be offset from the
 * rows' (Berserk's prologue rows 0.01-0.24 hold `C001`-`C024`).
 */
export function findChapterFileSquatters(rows: readonly ChapterFileHolder[]): number[] {
  const byFile = new Map<string, ChapterFileHolder[]>();
  for (const r of rows) {
    if (r.filePath === null || r.filePath === '') continue;
    byFile.set(r.filePath, [...(byFile.get(r.filePath) ?? []), r]);
  }
  const squatters: number[] = [];
  for (const [filePath, holders] of byFile) {
    if (holders.length < 2) continue;
    const fileChapter = chapterNumberFromFileName(filePath);
    if (fileChapter === null || !holders.some(h => h.chapterNumber === fileChapter)) continue;
    for (const h of holders) {
      if (h.chapterNumber !== null && h.chapterNumber !== fileChapter) squatters.push(h.id);
    }
  }
  return squatters;
}
