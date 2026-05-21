/**
 * Chapter Linker
 *
 * Links individual chapter CBZ files (no volume number) to their
 * existing database chapters by matching on chapter number (index).
 * Files are placed in {mangaDir}/Chapters/ and renamed per the naming template.
 */

import fs from 'fs/promises';
import path from 'path';

import { maybeEnqueueConversion } from '@/server/services/conversion/auto-convert-trigger';
import { normalizeFileFormat } from '@/server/services/conversion/format-normalization';
import { countPagesInArchive } from '@/server/services/download/fileImporter/page-counter';
import { assertChapterFilePathOwned } from '@/server/services/library/chapter-path-guard';
import { logger } from '@/utils/logger';

import { maybeConvertFile } from './archive-converter';
import {
  loadPackImportConfig, formatChapterFileName, buildChapterDestDir, buildMangaPaths
} from './library-path-resolver';
import { moveFile } from './packImportService';

import type { ConversionConfig } from './archive-converter';
import type { PrismaClient } from '@prisma/client';

interface ChapterFile {
  fileName: string;
  filePath: string;
  size: number;
  volumeNumber: number | null;
  chapterNumber: number | null;
  isValidChapter: boolean;
}

interface LinkResult {
  linkedIds: number[];
  errors: string[];
}

interface LinkFileContext {
  prismaClient: PrismaClient;
  mangaId: number;
  chaptersDir: string;
  mangaTitle: string;
  template: string;
  packDownloadId: number;
  conversionConfig: ConversionConfig;
}

/**
 * Move a single chapter file into the Chapters/ directory and update the DB record.
 */
async function linkSingleFile(
  ctx: LinkFileContext, file: ChapterFile
): Promise<{ id: number } | { error: string }> {
  const chapterNum = file.chapterNumber as number;

  const existingChapter = await ctx.prismaClient.chapter.findUnique({
    where: { mangaId_index: { mangaId: ctx.mangaId, index: chapterNum } }
  });

  if (!existingChapter) {
    const msg = `Chapter ${chapterNum} not found in DB for manga #${ctx.mangaId} — skipping ${file.fileName}`;
    logger.warn(`[PackImport] ${msg}`);
    return { error: msg };
  }

  // Convert RAR→CBZ if enabled
  const converted = await maybeConvertFile(file.filePath, file.fileName, ctx.conversionConfig);

  const ext = path.extname(converted.fileName);
  const newName = formatChapterFileName(ctx.template, ctx.mangaTitle, chapterNum, existingChapter.volume, ext);
  const destDir = buildChapterDestDir(ctx.chaptersDir, existingChapter.volume);
  const destPath = path.join(destDir, newName);

  await assertChapterFilePathOwned(ctx.prismaClient, ctx.mangaId, destPath, 'linkSingleFile');
  await fs.mkdir(destDir, { recursive: true });
  await moveFile(converted.filePath, destPath);

  const fileFormat = normalizeFileFormat(ext) ?? 'cbz';
  await ctx.prismaClient.chapter.update({
    where: { id: existingChapter.id },
    data: {
      filePath: destPath, fileName: newName, size: file.size,
      downloadStatus: 'COMPLETED', packDownloadId: BigInt(ctx.packDownloadId), fileFormat
    }
  });

  logger.info(`[PackImport] Linked ${file.fileName} → ${newName} (ch ${chapterNum}, id: ${existingChapter.id})`);

  // iter-IC4: pack-import landed a non-cbz file — enqueue conversion.
  // Idempotent + novel-skip aware inside the helper; failure is
  // logged but doesn't fail the link.
  if (fileFormat !== 'cbz') {
    void maybeEnqueueConversion({
      chapterId: existingChapter.id, mangaId: ctx.mangaId,
      sourceFile: destPath, sourceFormat: fileFormat,
    });
  }
  return { id: existingChapter.id };
}

/**
 * Link individual chapter files to existing DB chapters by chapter number.
 * Files are moved to {mangaDir}/Chapters/ and renamed per the chapter naming template.
 */
export async function linkIndividualChapterFiles(
  prismaClient: PrismaClient, mangaId: number,
  files: ChapterFile[], packDownloadId: number,
  conversionConfig: ConversionConfig
): Promise<LinkResult> {
  const linkedIds: number[] = [];
  const errors: string[] = [];

  const matchableFiles = files.filter((f) => f.chapterNumber !== null);
  if (matchableFiles.length === 0) {
    logger.warn(`[PackImport] No matchable individual chapter files (all have null chapterNumber)`);
    return { linkedIds, errors };
  }

  const manga = await prismaClient.manga.findUnique({
    where: { id: mangaId }, select: { title: true }
  });
  if (!manga) {
    errors.push(`Manga not found: ${mangaId}`);
    return { linkedIds, errors };
  }

  const config = await loadPackImportConfig(prismaClient);
  const { chaptersDir } = buildMangaPaths(config.libraryBasePath, manga.title);
  await fs.mkdir(chaptersDir, { recursive: true });

  logger.info(`[PackImport] Linking ${matchableFiles.length} chapter files → ${chaptersDir}`);

  const ctx: LinkFileContext = {
    prismaClient, mangaId, chaptersDir,
    mangaTitle: manga.title, template: config.chapterNamingTemplate, packDownloadId, conversionConfig
  };

  for (const file of matchableFiles) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await linkSingleFile(ctx, file);
      if ('id' in result) { linkedIds.push(result.id); }
      else { errors.push(result.error); }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[PackImport] Failed to link ${file.fileName}:`, error);
      errors.push(`Failed to link chapter ${file.chapterNumber}: ${msg}`);
    }
  }

  logger.info(`[PackImport] Linked ${linkedIds.length}/${matchableFiles.length} individual chapter files`);
  return { linkedIds, errors };
}

export interface LinkVolumeChaptersParams {
  prismaClient: PrismaClient;
  mangaId: number;
  volumeNumber: number;
  archivePath: string;
  archiveFileName: string;
  archiveSize: number;
  packDownloadId: number;
  fileFormat: string;
}

/**
 * Link normal-index Chapter rows (index < 100000) whose `volume` matches the
 * imported volume to the volume archive. Fixes the bug where pack imports
 * created a volume entry at index 100000+N but never flipped the contained
 * chapters from PENDING to COMPLETED. pageCount is the archive's total
 * page count; chapters in the same volume share the file.
 */
export async function linkVolumeChapters(
  params: LinkVolumeChaptersParams
): Promise<{ linkedCount: number; skippedCount: number }> {
  const {
    prismaClient, mangaId, volumeNumber, archivePath, archiveFileName,
    archiveSize, packDownloadId, fileFormat,
  } = params;

  const candidates = await prismaClient.chapter.findMany({
    where: {
      mangaId, volume: volumeNumber, index: { lt: 100000 },
    },
    select: { id: true, downloadStatus: true, filePath: true },
  });

  if (candidates.length === 0) {
    logger.info(`[PackImport] linkVolumeChapters: no chapters with volume=${volumeNumber} for mangaId=${mangaId}`);
    return { linkedCount: 0, skippedCount: 0 };
  }

  // A candidate needs (re)linking if it isn't COMPLETED, has no filePath
  // recorded, OR has a filePath that no longer exists on disk (a previous
  // pack moved/deleted out from under us — without this check, the row
  // stays "COMPLETED" but the viewer 404s).
  const linkChecks = await Promise.all(candidates.map(async (c) => {
    if (c.downloadStatus !== 'COMPLETED' || c.filePath === null) return { c, link: true };
    try {
      await fs.access(c.filePath);
      return { c, link: false };
    } catch {
      return { c, link: true };
    }
  }));
  const toLink = linkChecks.filter((r) => r.link).map((r) => r.c);
  if (toLink.length === 0) {
    logger.info(`[PackImport] linkVolumeChapters: all ${candidates.length} chapters of volume=${volumeNumber} already completed`);
    return { linkedCount: 0, skippedCount: candidates.length };
  }

  const pageCount = await countPagesInArchive(archivePath);
  if (pageCount === 0) {
    logger.warn(`[PackImport] linkVolumeChapters: archive has 0 pages, linking with pageCount=0 — chapters will not be readable: ${archivePath}`);
  }

  await assertChapterFilePathOwned(prismaClient, mangaId, archivePath, 'linkVolumeChapters');
  const result = await prismaClient.chapter.updateMany({
    where: { id: { in: toLink.map((c) => c.id) } },
    data: {
      filePath: archivePath, fileName: archiveFileName,
      fileFormat, size: archiveSize, pageCount,
      downloadStatus: 'COMPLETED', packDownloadId: BigInt(packDownloadId),
      updatedAt: new Date(),
    },
  });

  logger.info(`[PackImport] linkVolumeChapters: linked ${result.count} chapters of mangaId=${mangaId} volume=${volumeNumber} → ${archiveFileName} (pages=${pageCount})`);

  // iter-IC4: volume-pack arrived in non-cbz format. Enqueue ONE
  // conversion job for the first linked chapter; iter-IC5's repoint
  // updates that chapter, then a subsequent library-scan re-points
  // siblings via the post-scan pass (they share the same source
  // archive). Per-chapter enqueue here would create N redundant jobs
  // since all N chapters share the same source path.
  const normalizedFormat = normalizeFileFormat(fileFormat);
  if (normalizedFormat !== null && normalizedFormat !== 'cbz' && toLink.length > 0) {
    const first = toLink[0];
    if (first) {
      void maybeEnqueueConversion({
        chapterId: first.id, mangaId,
        sourceFile: archivePath, sourceFormat: normalizedFormat,
      });
    }
  }
  return { linkedCount: result.count, skippedCount: candidates.length - toLink.length };
}
