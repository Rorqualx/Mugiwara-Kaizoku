/**
 * Chapter file-path ownership guard.
 *
 * Prevents cross-manga binding corruption (the Failed Princesses ↔ My Hero
 * Academia pattern: Chapter rows under manga A point at filePaths under
 * manga B's library directory). Every write site that sets
 * `Chapter.filePath` should run the path through `assertChapterFilePathOwned`
 * before persisting.
 *
 * Soft-fail today: when the parent manga has `libraryPath = NULL` the
 * guard logs a warning instead of throwing. Once `Manga.libraryPath` is
 * backfilled and required at TS-level, swap the soft-fail to a hard
 * throw.
 *
 * @module server/services/library/chapter-path-guard
 */

import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

type AnyPrisma = PrismaClient | Omit<PrismaClient, '$on' | '$use' | '$transaction' | '$extends' | '$disconnect' | '$connect'>;

export interface ChapterPathGuardVerdict {
  ok: boolean;
  reason: 'libpath-null' | 'cross-manga' | 'manga-missing' | 'ok';
  expectedPrefix?: string | null;
}

/**
 * Validate that `filePath` belongs under `mangaId`'s libraryPath.
 *
 * Returns:
 *   { ok: true,  reason: 'ok'           } — path matches manga's libraryPath
 *   { ok: true,  reason: 'libpath-null' } — manga has no libraryPath yet (warn-only)
 *   { ok: false, reason: 'manga-missing'} — manga row not found
 *   { ok: false, reason: 'cross-manga'  } — path lives outside this manga's dir
 *
 * Pass `filePath = null` for an unset path (always ok).
 */
export async function validateChapterFilePath(
  prismaClient: AnyPrisma,
  mangaId: number,
  filePath: string | null,
): Promise<ChapterPathGuardVerdict> {
  if (filePath === null) return { ok: true, reason: 'ok' };
  const manga = await prismaClient.manga.findUnique({
    where: { id: mangaId },
    select: { libraryPath: true },
  });
  if (manga === null) return { ok: false, reason: 'manga-missing' };
  if (manga.libraryPath === null) {
    return { ok: true, reason: 'libpath-null', expectedPrefix: null };
  }
  if (filePath.startsWith(manga.libraryPath)) {
    return { ok: true, reason: 'ok', expectedPrefix: manga.libraryPath };
  }
  return { ok: false, reason: 'cross-manga', expectedPrefix: manga.libraryPath };
}

/**
 * Assert variant — throws on cross-manga, logs warn on libpath-null,
 * silent on ok. Use this from write sites that should hard-fail rather
 * than continue with a corrupt write.
 *
 * Context tag (`tag`) is included in the thrown error / warning so the
 * caller-of-this-helper is identifiable in logs (e.g. `tag='linkVolumeChapters'`).
 */
export async function assertChapterFilePathOwned(
  prismaClient: AnyPrisma,
  mangaId: number,
  filePath: string | null,
  tag: string,
): Promise<void> {
  const verdict = await validateChapterFilePath(prismaClient, mangaId, filePath);
  if (verdict.ok) {
    if (verdict.reason === 'libpath-null') {
      logger.warn(
        `[ChapterPathGuard] ${tag}: manga ${mangaId} has libraryPath=null — skipping cross-binding check for ${filePath}`,
      );
    }
    return;
  }
  const expected = verdict.expectedPrefix ?? '(unknown)';
  throw new Error(
    `[ChapterPathGuard] ${tag}: filePath "${filePath}" does not belong to manga ${mangaId} ` +
    `(expected prefix "${expected}", verdict=${verdict.reason})`,
  );
}
