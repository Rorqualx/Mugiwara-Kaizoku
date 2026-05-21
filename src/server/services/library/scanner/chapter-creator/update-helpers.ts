/**
 * Chapter Update Helpers
 *
 * Helper functions for executing batch chapter updates and cleanup.
 * Extracted from chapter-creator.ts to keep file size under 500 lines.
 *
 * @module server/services/library/scanner/chapter-creator/update-helpers
 */

import { ChapterStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { normalizeFileFormat } from '@/server/services/conversion/format-normalization';
import { assertChapterFilePathOwned } from '@/server/services/library/chapter-path-guard';
import { countArchivePages } from '@/utils/file-utils';
import { logger } from '@/utils/logger';

import {
  upsertChapterFilesBatch,
  resolveAndStoreVolumeBoundaries,
  type ChapterFileInput,
} from './chapter-file-service';

import type { ChapterUpdate } from './types';

/** Pattern matching generic chapter titles like "Chapter 1", "Vol.2 Chapter 10" */
const GENERIC_TITLE_RE = /^(Vol\.\d+\s+)?Chapter\s+\d+(\.\d+)?$/i;

/**
 * Check if a title is generic (e.g., "Chapter 1") vs. specific (e.g., "Chapter 1 - The Beginning")
 */
function isGenericTitle(title: string): boolean {
  return GENERIC_TITLE_RE.test(title.trim());
}

/**
 * Build the title update field for a chapter update.
 * Only overwrites if: incoming title exists AND existing title is generic.
 */
function buildTitleUpdate(
  existingTitle: string | null,
  incomingTitle: string | undefined
): Record<string, string> {
  if (incomingTitle === undefined) return {};
  if (existingTitle !== null && !isGenericTitle(existingTitle)) return {};
  if (isGenericTitle(incomingTitle)) return {};
  return { title: incomingTitle };
}

/**
 * Execute batch updates for linked chapters and create ChapterFile entries.
 * Additive: never overwrites or deletes existing ChapterFile entries.
 * Merges richer metadata (titles, covers, etc.) into existing chapters
 * when the incoming data is more specific than what's already stored.
 */
export async function executeChapterUpdates(updates: ChapterUpdate[], mangaId?: number): Promise<void> {
  if (updates.length === 0) return;

  // Cross-manga binding guard: every filePath in this batch must belong
  // to the supplied manga's libraryPath. Throws on violation so a wrong
  // binding can't land in DB.
  if (mangaId !== undefined) {
    for (const u of updates) {
      // eslint-disable-next-line no-await-in-loop -- per-row guard, small N
      await assertChapterFilePathOwned(prisma, mangaId, u.filePath, 'executeChapterUpdates');
    }
  }

  await prisma.$transaction(async (tx) => {
    // Track which filePaths appear in multiple updates (volume files)
    const filePathCounts = new Map<string, number>();
    for (const u of updates) {
      const count = filePathCounts.get(u.filePath) ?? 0;
      filePathCounts.set(u.filePath, count + 1);
    }

    // Fetch existing titles so we can decide whether to overwrite
    const chapterIds = updates.filter((u) => u.title !== undefined).map((u) => u.id);
    const existingTitles = new Map<number, string>();
    if (chapterIds.length > 0) {
      const existing = await tx.chapter.findMany({
        where: { id: { in: chapterIds } },
        select: { id: true, title: true },
      });
      for (const ch of existing) {
        existingTitles.set(ch.id, ch.title);
      }
    }

    // Update chapter records
    await Promise.all(
      updates.map((u) =>
        tx.chapter.update({
          where: { id: u.id },
          data: {
            fileName: u.fileName,
            filePath: u.filePath,
            fileFormat: normalizeFileFormat(u.fileName),
            size: u.size,
            downloadStatus: ChapterStatus.COMPLETED,
            updatedAt: new Date(),
            // Merge title only if incoming is more specific than existing
            ...buildTitleUpdate(existingTitles.get(u.id) ?? null, u.title),
            // Update metadata fields if provided (don't overwrite with null)
            ...(u.coverImage !== undefined && { coverImage: u.coverImage }),
            ...(u.description !== undefined && { description: u.description }),
            ...(u.pageCount !== undefined && { pageCount: u.pageCount }),
            ...(u.releaseDate !== undefined && { releaseDate: u.releaseDate })
          }
        })
      )
    );

    // Create ChapterFile entries (additive - upsert won't delete existing)
    const chapterFileInputs: ChapterFileInput[] = updates.map((u) => ({
      chapterId: u.id,
      filePath: u.filePath,
      fileName: u.fileName,
      fileSize: u.size,
      sourceType: ((filePathCounts.get(u.filePath) ?? 0) > 1 ? 'volume' : 'chapter') as 'chapter' | 'volume',
    }));

    await upsertChapterFilesBatch(chapterFileInputs, tx);

    // Volume-source files: persist per-chapter page boundaries so the reader
    // can jump inside the volume CBZ. One pass per unique volume filePath.
    const volumePaths = [...filePathCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([fp]) => fp);
    if (volumePaths.length > 0) {
      const volumeUpdateIds = updates
        .filter((u) => (filePathCounts.get(u.filePath) ?? 0) > 1)
        .map((u) => u.id);
      const chNumberById = new Map<number, number | null>();
      if (volumeUpdateIds.length > 0) {
        const rows = await tx.chapter.findMany({
          where: { id: { in: volumeUpdateIds } },
          select: { id: true, chapterNumber: true, index: true },
        });
        for (const r of rows) chNumberById.set(r.id, r.chapterNumber ?? r.index);
      }
      for (const volPath of volumePaths) {
        const updatesForVolume = updates.filter((u) => u.filePath === volPath);
        const volChapters = updatesForVolume
          .map((u) => {
            const chNum = chNumberById.get(u.id);
            if (typeof chNum !== 'number') return null;
            return {
              id: u.id,
              chapterNumber: chNum,
              ...(u.pageCount !== undefined ? { pageCount: u.pageCount } : {}),
              ...(u.title !== undefined ? { title: u.title } : {}),
            };
          })
          .filter((c): c is { id: number; chapterNumber: number; pageCount?: number; title?: string } => c !== null);
        if (volChapters.length === 0) continue;
        // eslint-disable-next-line no-await-in-loop -- sequential per-volume; typical count < 10
        const actualPages = await countArchivePages(volPath);
        // eslint-disable-next-line no-await-in-loop -- depends on previous; cheap relative to archive read
        await resolveAndStoreVolumeBoundaries(volPath, actualPages, volChapters, tx);
      }
    }
  });
}

/**
 * Delete orphaned "Volume X" chapters from previous imports
 */
export async function deleteOrphanedVolumeChapters(mangaId: number): Promise<number> {
  const result = await prisma.chapter.deleteMany({
    where: { mangaId, title: { startsWith: 'Volume ' } }
  });
  if (result.count > 0) {
    logger.info('Deleted old volume chapters from previous import', { mangaId, count: result.count });
  }
  return result.count;
}
