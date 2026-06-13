/**
 * Pack-import de-duplication helpers.
 *
 * A Prowlarr/torrent pack often finishes AFTER a native source (Suwayomi,
 * MangaDex) has already downloaded some of the same chapters — the release
 * dispatcher's native fallback fills a pack's claimed chapters while the
 * torrent is still seeding. When the pack finally imports, it must NOT clobber
 * those already-satisfied chapters with its own (frequently different-language
 * or lower-quality) files, and it must NOT leave a second redundant file on
 * disk. It SHOULD still import anything genuinely missing — gaps the native
 * source didn't cover, plus bonus/omake the pack uniquely provides.
 *
 * Provenance is inferred, not stored: the Chapter model has no `source` column.
 * `packDownloadId` marks a pack import; `suwayomiChapterId`/`mangadexId` mark
 * native bindings. The robust, source-agnostic rule used here is simply: a
 * chapter that is COMPLETED with a file present on disk is already satisfied —
 * whoever delivered it, don't overwrite it.
 *
 * @module server/services/packImport/import-dedup
 */

import fs from 'fs/promises';

import type { ChapterStatus } from '@prisma/client';

/** Minimal chapter shape the dedup decision needs. */
export interface DedupCandidate {
  downloadStatus: ChapterStatus;
  filePath: string | null;
}

/**
 * Pure decision: should a pack import SKIP this chapter because another source
 * already satisfied it? True iff the chapter is COMPLETED, has a recorded file
 * path, and that file is present on disk (`fileOnDisk`). Kept pure (no I/O) so
 * the policy is unit-testable; {@link isChapterAlreadySatisfied} does the
 * disk check and delegates here.
 */
export function shouldSkipRedundantImport(
  chapter: DedupCandidate,
  fileOnDisk: boolean,
): boolean {
  return chapter.downloadStatus === 'COMPLETED' && chapter.filePath !== null && fileOnDisk;
}

/**
 * True if `chapter` is already satisfied — COMPLETED with its file present on
 * disk. A missing file (COMPLETED row whose file vanished) returns false so the
 * pack is allowed to (re)fill it. Mirrors the guard `linkVolumeChapters`
 * already applies on the volume-import path.
 */
export async function isChapterAlreadySatisfied(chapter: DedupCandidate): Promise<boolean> {
  if (chapter.downloadStatus !== 'COMPLETED' || chapter.filePath === null) return false;
  const present = await fileExists(chapter.filePath);
  return shouldSkipRedundantImport(chapter, present);
}

/** Best-effort `fs.access` presence check — never throws. */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure set-difference for the cleanup audit: of the files found on disk, which
 * are referenced by NO chapter (orphaned/redundant leftovers from a past
 * overwrite)? Both sides must be compared as the same absolute-path strings.
 */
export function findOrphanedFiles(
  filesOnDisk: readonly string[],
  referencedPaths: ReadonlySet<string>,
): string[] {
  return filesOnDisk.filter((f) => !referencedPaths.has(f));
}
