/**
 * Per-user chapter read state.
 *
 * The manga catalog is shared: several users can have the same title through
 * `LibraryMembership`, and they all see the same `Chapter` rows. Whether a
 * chapter is read is therefore a fact about a (user, chapter) pair, stored in
 * `ChapterReadState` — one row means "this user has read this chapter".
 *
 * The legacy `Chapter.isRead` column is NOT a source of truth any more. Query
 * code keeps returning an `isRead` field so clients are unchanged, but its
 * value must come from here ({@link applyReadMarks} and friends).
 *
 * Every function takes the user id explicitly; none of them falls back to
 * "all users", so a caller cannot read or change another user's state by
 * omission.
 *
 * @module server/services/reader/chapter-read-state
 */
import { createErrorResult, createSuccessResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

/** The Prisma surface this module needs (a client or a transaction client). */
export type ReadStateDb = Pick<PrismaClient, 'chapter' | 'chapterReadState'>;

/** chapterId → when the user read it. */
export type ReadMarks = Map<number, Date>;

/** A chapter row with the caller's read state attached. */
export type WithReadState<T> = Omit<T, 'isRead'> & { isRead: boolean; readAt: Date | null };

/** Which chapters to load marks for: whole titles, specific chapters, or both. */
export interface ReadMarkScope {
  mangaIds?: readonly number[];
  chapterIds?: readonly number[];
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Loads one user's read marks.
 *
 * @returns chapterId → readAt for every chapter in scope that the user has read
 */
export async function getReadMarks(db: ReadStateDb, userId: string, scope: ReadMarkScope): Promise<ReadMarks> {
  const marks: ReadMarks = new Map();
  const mangaIds = scope.mangaIds ?? [];
  const chapterIds = scope.chapterIds ?? [];
  if (mangaIds.length === 0 && chapterIds.length === 0) return marks;

  const rows = await db.chapterReadState.findMany({
    where: {
      userId,
      ...(mangaIds.length > 0 ? { mangaId: { in: [...mangaIds] } } : {}),
      ...(chapterIds.length > 0 ? { chapterId: { in: [...chapterIds] } } : {}),
    },
    select: { chapterId: true, readAt: true },
  });
  for (const row of rows) marks.set(row.chapterId, row.readAt);
  return marks;
}

/**
 * Attaches the user's read state to chapter rows.
 *
 * Any `isRead` already on a row (the legacy shared column) is overwritten, so
 * the stale value can never reach a client.
 */
export function applyReadMarks<T extends { id: number }>(chapters: readonly T[], marks: ReadMarks): Array<WithReadState<T>> {
  return chapters.map((chapter) => {
    const readAt = marks.get(chapter.id) ?? null;
    return { ...chapter, isRead: readAt !== null, readAt };
  });
}

/** A title whose chapters may have been loaded under `Chapter`. */
interface MangaWithChapters {
  id: number;
  Chapter?: ReadonlyArray<{ id: number }> | null;
}

/**
 * Returns a copy of the title with the user's read state on its chapters.
 *
 * The input is not modified, so a row that came from (or is about to go into)
 * a cache shared between users stays user-neutral.
 */
export async function withMangaReadState<M extends MangaWithChapters>(db: ReadStateDb, userId: string, manga: M): Promise<M> {
  const [result] = await withMangaListReadState(db, userId, [manga]);
  return result ?? manga;
}

/** {@link withMangaReadState} for a page of titles, in one query. */
export async function withMangaListReadState<M extends MangaWithChapters>(db: ReadStateDb, userId: string, mangas: readonly M[]): Promise<M[]> {
  const withChapters = mangas.filter((m) => Array.isArray(m.Chapter) && m.Chapter.length > 0);
  if (withChapters.length === 0) return [...mangas];

  const marks = await getReadMarks(db, userId, { mangaIds: withChapters.map((m) => m.id) });
  return mangas.map((manga) => {
    if (!Array.isArray(manga.Chapter)) return manga;
    return { ...manga, Chapter: applyReadMarks(manga.Chapter, marks) };
  });
}

/**
 * Marks every chapter of the given titles as read for one user.
 *
 * The caller is responsible for having checked that the user may access the
 * titles (library membership).
 *
 * @returns how many chapters changed from unread to read
 */
export async function markMangaRead(db: ReadStateDb, userId: string, mangaIds: readonly number[]): Promise<AsyncResult<number, Error>> {
  if (mangaIds.length === 0) return createSuccessResult(0);
  try {
    const chapters = await db.chapter.findMany({
      where: { mangaId: { in: [...mangaIds] } },
      select: { id: true, mangaId: true },
    });
    if (chapters.length === 0) return createSuccessResult(0);

    // skipDuplicates keeps the original readAt of chapters already read and
    // makes a concurrent second call a no-op instead of a unique violation.
    const inserted = await db.chapterReadState.createMany({
      data: chapters.map((chapter) => ({ userId, chapterId: chapter.id, mangaId: chapter.mangaId })),
      skipDuplicates: true,
    });
    return createSuccessResult(inserted.count);
  } catch (error: unknown) {
    logger.error('Failed to mark chapters read', { userId, mangaIds, error });
    return createErrorResult(toError(error));
  }
}

/**
 * Marks every chapter of the given titles as unread for one user.
 *
 * Only this user's marks are removed. Page progress (`ReadingProgress`) is
 * left alone, so "continue reading" still knows where they stopped.
 *
 * @returns how many chapters changed from read to unread
 */
export async function markMangaUnread(db: ReadStateDb, userId: string, mangaIds: readonly number[]): Promise<AsyncResult<number, Error>> {
  if (mangaIds.length === 0) return createSuccessResult(0);
  try {
    const removed = await db.chapterReadState.deleteMany({
      where: { userId, mangaId: { in: [...mangaIds] } },
    });
    return createSuccessResult(removed.count);
  } catch (error: unknown) {
    logger.error('Failed to mark chapters unread', { userId, mangaIds, error });
    return createErrorResult(toError(error));
  }
}

/**
 * Marks one chapter as read for one user (used when the reader reaches the
 * last page). Idempotent: an existing mark keeps its original `readAt`.
 */
export async function markChapterRead(db: ReadStateDb, userId: string, mangaId: number, chapterId: number): Promise<AsyncResult<void, Error>> {
  try {
    await db.chapterReadState.upsert({
      where: { userId_chapterId: { userId, chapterId } },
      create: { userId, chapterId, mangaId },
      update: {},
    });
    return createSuccessResult(undefined);
  } catch (error: unknown) {
    logger.error('Failed to mark chapter read', { userId, mangaId, chapterId, error });
    return createErrorResult(toError(error));
  }
}
