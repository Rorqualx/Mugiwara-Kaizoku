/**
 * Phantom-stub predicate for the Volume browser.
 *
 * A "phantom stub" is a Chapter row that survived a wrong provider binding
 * (e.g. ComicVine treating physical volumes as issues) or a reidentify pass
 * that nulled the row's chapterNumber but couldn't delete it. Shape:
 *   chapterNumber = null AND filePath = null AND status ≠ COMPLETED.
 *
 * Volume carrier rows (filePath set, chapterNumber null) and synthetic
 * placeholders (chapterNumber = 0) are NOT phantoms.
 *
 * Backend cleanup is handled by phase-db-persistence.ts:findStaleChapterIds
 * (new phantom sweep added 2026-05-19) and the one-shot
 * scripts/surveys/cleanup-phantom-volume-stubs.ts. This frontend filter
 * keeps the UI honest until those have run.
 */
import { ChapterStatus } from '@prisma/client';

import type { Chapter } from '@prisma/client';

export function isPhantomStub(chapter: Chapter): boolean {
  if (chapter.chapterNumber !== null) return false;
  if (chapter.filePath !== null) return false;
  if (chapter.downloadStatus === ChapterStatus.COMPLETED) return false;
  // Legitimate volume-file rows from ensureVolumeFileRows carry aggregated
  // stats (pageCount or size from the volume's chapter rows) AND link to a
  // Volume row via volumeId. A true phantom from a wrong provider binding
  // has neither — that's the discriminant. Without this carve-out, every
  // partially-downloaded volume's "1-N" row vanishes from the chapter
  // table (Kaiju vol 2: 5/10 chapters present, pageCount=194 — was being
  // filtered as phantom and never rendered).
  const hasAggregatedStats = (chapter.pageCount ?? 0) > 0 || chapter.size > 0;
  if (chapter.volumeId !== null && hasAggregatedStats) return false;
  return true;
}
