/**
 * Chapter File Service
 *
 * Manages ChapterFile junction table records and syncs
 * the active file back to Chapter.filePath for backward compatibility.
 *
 * @module server/services/library/scanner/chapter-creator/chapter-file-service
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import {
  validateVolumePageCount,
  handlePageCountMismatch,
  type ChapterBoundary,
  type ChapterForValidation,
} from './page-count-validator';

import type { PrismaClient } from '@prisma/client';

/** Source type for a chapter file */
export type ChapterFileSourceType = 'chapter' | 'volume';

/** Priority order: chapter files are preferred over volume files */
const SOURCE_PRIORITY: Record<ChapterFileSourceType, number> = {
  chapter: 2,
  volume: 1,
};

/** Input for creating/upserting a ChapterFile record */
export interface ChapterFileInput {
  chapterId: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  sourceType: ChapterFileSourceType;
  pageStart?: number;
  pageEnd?: number;
  pageCount?: number;
}

/**
 * Upsert a ChapterFile record and set it active based on source priority.
 *
 * When a chapter file is added:
 * 1. Insert or update the ChapterFile row
 * 2. Determine if this new source should become active (chapter > volume > existing)
 * 3. If active changes, sync Chapter.filePath
 */
export async function upsertChapterFile(
  input: ChapterFileInput,
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
): Promise<void> {
  const db = tx ?? prisma;

  // Upsert the ChapterFile record
  await db.chapterFile.upsert({
    where: {
      chapterId_filePath: {
        chapterId: input.chapterId,
        filePath: input.filePath,
      },
    },
    create: {
      chapterId: input.chapterId,
      filePath: input.filePath,
      fileName: input.fileName,
      fileSize: input.fileSize,
      sourceType: input.sourceType,
      isActive: false, // Will be determined below
      pageStart: input.pageStart ?? null,
      pageEnd: input.pageEnd ?? null,
      pageCount: input.pageCount ?? null,
    },
    update: {
      fileName: input.fileName,
      fileSize: input.fileSize,
      sourceType: input.sourceType,
      pageStart: input.pageStart ?? null,
      pageEnd: input.pageEnd ?? null,
      pageCount: input.pageCount ?? null,
    },
  });

  // Determine which file should be active for this chapter
  await resolveActiveFile(input.chapterId, db);
}

/**
 * Run an async fn over items with a bounded concurrency. Avoids pulling p-limit
 * for a single use; keeps the connection pool from being swamped by N parallel
 * single-row writes (observed 2026-05-19: pool saturation pushed ChapterFile
 * upsert latency from ~50ms to >2s and queued WebSocket-broadcast queries to
 * 16+ seconds).
 */
async function runLimited<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const cursor = { value: 0 };
  const worker = async (): Promise<void> => {
    for (let idx = cursor.value++; idx < items.length; idx = cursor.value++) {
      const item = items[idx];
      if (item === undefined) continue;
      // eslint-disable-next-line no-await-in-loop -- worker drains a shared cursor; sequential by design for bounded concurrency
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

/**
 * Upsert multiple ChapterFile records in a batch.
 *
 * Strategy: pre-query existing rows, then `createMany(skipDuplicates)` for new
 * rows (one round-trip) plus a small bounded-concurrency update pass for any
 * pre-existing rows that need column refreshes. This replaces the prior
 * `Promise.all(inputs.map(upsert))` which fired N parallel single-row upserts
 * and saturated the Postgres pool during library imports.
 */
export async function upsertChapterFilesBatch(
  inputs: ChapterFileInput[],
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
): Promise<void> {
  if (inputs.length === 0) return;

  const db = tx ?? prisma;

  // 1. Pre-query which (chapterId, filePath) keys already exist.
  const existing = await db.chapterFile.findMany({
    where: {
      OR: inputs.map((i) => ({ chapterId: i.chapterId, filePath: i.filePath })),
    },
    select: { chapterId: true, filePath: true },
  });
  const existingKey = new Set(existing.map((r) => `${r.chapterId}|${r.filePath}`));

  const toCreate = inputs.filter((i) => !existingKey.has(`${i.chapterId}|${i.filePath}`));
  const toUpdate = inputs.filter((i) => existingKey.has(`${i.chapterId}|${i.filePath}`));

  // 2. Bulk-insert all new rows in a single round-trip.
  if (toCreate.length > 0) {
    await db.chapterFile.createMany({
      data: toCreate.map((i) => ({
        chapterId: i.chapterId,
        filePath: i.filePath,
        fileName: i.fileName,
        fileSize: i.fileSize,
        sourceType: i.sourceType,
        isActive: false,
        pageStart: i.pageStart ?? null,
        pageEnd: i.pageEnd ?? null,
        pageCount: i.pageCount ?? null,
      })),
      // Safety net in case a concurrent caller beat us to a row between
      // findMany and createMany — the unique constraint would otherwise abort
      // the entire batch.
      skipDuplicates: true,
    });
  }

  // 3. Targeted updates for the (typically small) overlap set, bounded concurrency.
  await runLimited(toUpdate, 5, (i) =>
    db.chapterFile.update({
      where: { chapterId_filePath: { chapterId: i.chapterId, filePath: i.filePath } },
      data: {
        fileName: i.fileName,
        fileSize: i.fileSize,
        sourceType: i.sourceType,
        pageStart: i.pageStart ?? null,
        pageEnd: i.pageEnd ?? null,
        pageCount: i.pageCount ?? null,
      },
    }).then(() => undefined)
  );

  // 4. Resolve active file for each unique chapterId, also bounded.
  const uniqueChapterIds = [...new Set(inputs.map((i) => i.chapterId))];
  await runLimited(uniqueChapterIds, 5, (chapterId) => resolveActiveFile(chapterId, db));
}

/**
 * Resolve which ChapterFile should be active for a chapter.
 * Priority: chapter files > volume files.
 * Within same priority, the most recently imported file wins.
 * Syncs Chapter.filePath to the active file.
 */
async function resolveActiveFile(
  chapterId: number,
  db: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
): Promise<void> {
  const files = await db.chapterFile.findMany({
    where: { chapterId },
    orderBy: { importedAt: 'desc' },
  });

  if (files.length === 0) return;

  // Find highest priority file
  let bestFile = files[0];
  if (!bestFile) return;

  for (const file of files) {
    const sourceType = file.sourceType as ChapterFileSourceType;
    const bestSourceType = bestFile.sourceType as ChapterFileSourceType;
    if (sourceType in SOURCE_PRIORITY && bestSourceType in SOURCE_PRIORITY
      && SOURCE_PRIORITY[sourceType] > SOURCE_PRIORITY[bestSourceType]) {
      bestFile = file;
    }
  }

  // Deactivate all, then activate the best — two sequential updates avoid race conditions
  await db.chapterFile.updateMany({
    where: { chapterId },
    data: { isActive: false },
  });

  await db.chapterFile.update({
    where: { id: bestFile.id },
    data: { isActive: true },
  });

  // Sync Chapter.filePath to active file
  await db.chapter.update({
    where: { id: chapterId },
    data: { filePath: bestFile.filePath },
  });
}

/**
 * Switch the active file source for a chapter.
 * Sets the specified ChapterFile as active and syncs Chapter.filePath.
 */
export async function switchActiveChapterFile(
  chapterId: number,
  chapterFileId: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Verify the target file exists and belongs to the chapter
    const targetFile = await tx.chapterFile.findFirst({
      where: { id: chapterFileId, chapterId },
    });

    if (!targetFile) {
      throw new Error(`ChapterFile ${chapterFileId} not found for chapter ${chapterId}`);
    }

    // Deactivate all files for this chapter
    await tx.chapterFile.updateMany({
      where: { chapterId },
      data: { isActive: false },
    });

    // Activate the target file
    await tx.chapterFile.update({
      where: { id: chapterFileId },
      data: { isActive: true },
    });

    // Sync Chapter.filePath
    await tx.chapter.update({
      where: { id: chapterId },
      data: { filePath: targetFile.filePath },
    });

    logger.info('Switched active chapter file source', {
      chapterId,
      chapterFileId,
      newFilePath: targetFile.filePath,
      sourceType: targetFile.sourceType,
    });
  });
}

/**
 * Store page boundaries on ChapterFile records for a volume file.
 * Accepts an optional `tx` so callers inside a transaction can chain it.
 */
export async function storePageBoundaries(
  filePath: string,
  boundaries: ChapterBoundary[],
  chapterIdByNumber: Map<number, number>,
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
): Promise<void> {
  const db = tx ?? prisma;
  const updates: Array<{ chapterId: number; pageStart: number; pageEnd: number; pageCount: number }> = [];

  for (const boundary of boundaries) {
    const chapterId = chapterIdByNumber.get(boundary.chapterNumber);
    if (chapterId === undefined) continue;

    // Skip invalid boundaries where start exceeds end
    if (boundary.startPage > boundary.endPage) continue;

    updates.push({
      chapterId,
      pageStart: boundary.startPage,
      pageEnd: boundary.endPage,
      pageCount: boundary.pageCount,
    });
  }

  if (updates.length === 0) return;

  await runLimited(updates, 5, (u) =>
    db.chapterFile.updateMany({
      where: { chapterId: u.chapterId, filePath },
      data: {
        pageStart: u.pageStart,
        pageEnd: u.pageEnd,
        pageCount: u.pageCount,
      },
    }).then(() => undefined)
  );

  logger.info('Stored page boundaries for volume file', {
    filePath,
    boundariesStored: updates.length,
  });
}

/**
 * Validate a volume file's actual page count against its chapter metadata and,
 * if the validation passes, persist per-chapter page boundaries so the reader
 * can jump directly to a chapter inside the volume CBZ. Logs a single warn
 * line on validation failure (handlePageCountMismatch verdict).
 *
 * Reader-side consumer: `routers/reader/file-access.ts:60-99` already reads
 * `ChapterFile.pageStart/pageEnd` — this helper is what populates them.
 */
export async function resolveAndStoreVolumeBoundaries(
  filePath: string,
  actualPages: number,
  chapters: Array<{ id: number; chapterNumber: number; pageCount?: number; title?: string }>,
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
): Promise<void> {
  if (actualPages <= 0 || chapters.length === 0) return;

  const forValidation: ChapterForValidation[] = chapters.map((c) => ({
    number: c.chapterNumber,
    ...(c.pageCount !== undefined ? { pageCount: c.pageCount } : {}),
    ...(c.title !== undefined ? { title: c.title } : {}),
  }));

  const result = validateVolumePageCount(actualPages, forValidation);

  if (!result.isValid || !result.chapterBoundaries) {
    const verdict = handlePageCountMismatch(result);
    logger.warn('[volume-boundaries] skipped — page count validation failed', {
      filePath,
      action: verdict.action,
      message: verdict.message,
    });
    return;
  }

  const chapterIdByNumber = new Map<number, number>();
  for (const c of chapters) chapterIdByNumber.set(c.chapterNumber, c.id);

  await storePageBoundaries(filePath, result.chapterBoundaries, chapterIdByNumber, tx);
}
