/**
 * Manga File Deletion
 *
 * Deletes a manga's chapter files from disk ahead of a DB delete, used by the
 * single and bulk "remove manga" paths when the user opts into file deletion.
 *
 * Safety model:
 * - Every path must resolve inside the manga's own library root (containment
 *   guard) or it is skipped and reported.
 * - Files also referenced by another manga's chapters are skipped — duplicate
 *   libraryPath values have existed historically (see path-cleanup.ts), so a
 *   manga's folder cannot be assumed exclusive. No blanket directory removal.
 * - Directory cleanup happens by pruning now-empty parents upward to the
 *   library root; fs.rmdir refuses non-empty dirs, which makes this safe by
 *   construction.
 *
 * @module server/services/library/manga-file-deletion
 */

import fs from 'fs/promises';
import path from 'path';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

export interface MangaFileDeletionResult {
  mangaId: number;
  filesDeleted: number;
  filesMissing: number;
  filesSkipped: number;
  dirsPruned: number;
  errors: string[];
}

function emptyResult(mangaId: number): MangaFileDeletionResult {
  return { mangaId, filesDeleted: 0, filesMissing: 0, filesSkipped: 0, dirsPruned: 0, errors: [] };
}

function isContained(candidate: string, root: string): boolean {
  const resolved = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  return resolved.startsWith(resolvedRoot + path.sep);
}

type RemoveOutcome =
  | { kind: 'deleted'; parentDir: string }
  | { kind: 'missing'; parentDir: string }
  | { kind: 'error'; message: string };

/** Remove a single chapter path (archive file or loose-image directory) */
async function removeChapterPath(filePath: string): Promise<RemoveOutcome> {
  try {
    const stat = await fs.lstat(filePath);
    if (stat.isDirectory()) {
      await fs.rm(filePath, { recursive: true });
    } else {
      await fs.unlink(filePath);
    }
    return { kind: 'deleted', parentDir: path.dirname(filePath) };
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      // Still worth pruning the parents of a missing file
      return { kind: 'missing', parentDir: path.dirname(filePath) };
    }
    return { kind: 'error', message: `${filePath}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Prune empty directories from startDir upward, stopping at the library root. Returns count pruned. */
async function pruneEmptyDirsUpward(startDir: string, libraryRoot: string): Promise<number> {
  let pruned = 0;
  let current = path.resolve(startDir);
  while (isContained(current, libraryRoot)) {
    try {
      // eslint-disable-next-line no-await-in-loop -- directories must be removed child-first
      await fs.rmdir(current); // refuses non-empty dirs — safe by construction
      pruned++;
    } catch {
      return pruned; // not empty, already gone, or not removable — stop walking
    }
    current = path.dirname(current);
  }
  return pruned;
}

/**
 * Delete all on-disk chapter files for a manga.
 *
 * Must be called BEFORE the manga's DB rows are deleted (it reads Chapter
 * rows to find the files).
 */
export async function deleteMangaFiles(mangaId: number): Promise<MangaFileDeletionResult> {
  const result = emptyResult(mangaId);

  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { id: true, title: true, libraryPath: true, Library: { select: { path: true } } }
  });
  if (!manga) {
    result.errors.push(`Manga ${mangaId} not found`);
    return result;
  }
  const libraryRoot = manga.Library.path;

  const chapters = await prisma.chapter.findMany({
    where: { mangaId, filePath: { not: null } },
    select: { filePath: true }
  });
  const candidatePaths = [...new Set(chapters.map((c) => c.filePath).filter((p): p is string => p !== null))];

  // Skip files another manga's chapters also reference (shared-folder history)
  const sharedRows = candidatePaths.length > 0
    ? await prisma.chapter.findMany({
        where: { mangaId: { not: mangaId }, filePath: { in: candidatePaths } },
        select: { filePath: true }
      })
    : [];
  const sharedPaths = new Set(sharedRows.map((r) => r.filePath));

  const parentDirs = new Set<string>();
  for (const filePath of candidatePaths) {
    if (sharedPaths.has(filePath)) {
      result.filesSkipped++;
      logger.warn(`[deleteMangaFiles] Skipping shared file referenced by another manga: ${filePath}`);
      continue;
    }
    if (!isContained(filePath, libraryRoot)) {
      result.filesSkipped++;
      logger.warn(`[deleteMangaFiles] Skipping path outside library root: ${filePath}`);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop -- sequential fs deletes keep NFS/SMB load bounded
    const outcome = await removeChapterPath(filePath);
    if (outcome.kind === 'deleted') {
      result.filesDeleted++;
      parentDirs.add(outcome.parentDir);
    } else if (outcome.kind === 'missing') {
      result.filesMissing++;
      parentDirs.add(outcome.parentDir);
    } else {
      result.errors.push(outcome.message);
    }
  }

  // Prune emptied directories (chapter dirs, then the manga folder itself)
  if (manga.libraryPath && isContained(manga.libraryPath, libraryRoot)) {
    parentDirs.add(manga.libraryPath);
  }
  for (const dir of parentDirs) {
    // eslint-disable-next-line no-await-in-loop -- directories must be pruned one chain at a time
    result.dirsPruned += await pruneEmptyDirsUpward(dir, libraryRoot);
  }

  logger.info(`[deleteMangaFiles] "${manga.title}" (${mangaId}): ${result.filesDeleted} deleted, ${result.filesMissing} missing, ${result.filesSkipped} skipped, ${result.dirsPruned} dirs pruned${result.errors.length > 0 ? `, ${result.errors.length} errors` : ''}`);
  return result;
}
