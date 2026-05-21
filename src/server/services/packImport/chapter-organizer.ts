/**
 * Chapter file organizer — moves a single COMPLETED Chapter's file into
 * `<libraryBasePath>/<mangaTitle>/Chapters/<formatted-name>` and updates
 * the Chapter row's `filePath` + `fileName` to match.
 *
 * Shared by the pack-import linker (chapter-linker.ts) and the library
 * scanner (library-scanner.ts) so both code paths produce the same
 * on-disk layout and honor the same naming template configured via the
 * `fileOrganization` Config row.
 *
 * Idempotent: if the file is already at the destination path, this
 * returns `{ moved: false }` without touching the filesystem or the DB
 * row.
 */
import fs from 'fs/promises';
import path from 'path';

import { assertChapterFilePathOwned } from '@/server/services/library/chapter-path-guard';
import { logger } from '@/utils/logger';

import {
  buildChapterDestDir, buildMangaPaths, formatChapterFileName
} from './library-path-resolver';
import { moveFile } from './packImportService';

import type { PackImportConfig } from './library-path-resolver';
import type { PrismaClient } from '@prisma/client';

export interface ChapterToOrganize {
  id: number;
  filePath: string;
  fileName: string;
  chapterNumber: number | null;
  volume: number | null;
}

export interface OrganizeResult {
  moved: boolean;
  from: string;
  to: string;
}

export async function organizeChapterFile(params: {
  prismaClient: PrismaClient;
  mangaId: number;
  mangaTitle: string;
  chapter: ChapterToOrganize;
  config: PackImportConfig;
}): Promise<OrganizeResult> {
  const { prismaClient, chapter, config } = params;

  if (chapter.chapterNumber === null) {
    // Without a chapter number we have nothing to template against.
    // Leave the file in place — surfaces as a no-op in callers.
    return { moved: false, from: chapter.filePath, to: chapter.filePath };
  }

  // Guard: when several Chapter rows share one physical file (typical
  // for pack-imported volume archives — Vol 15.cbz contains chapters
  // 124..132 and all 9 chapter rows have the same filePath), we cannot
  // safely template per-chapter destination names (we'd rename the file
  // for chapter 124, then fail on chapter 125 because the source moved).
  // Skip the move; the caller treats this as a no-op. The pack-import
  // linker (which sets up these shared paths) places the file under
  // Volumes/ already, so nothing is "broken" by leaving it.
  const sharers = await prismaClient.chapter.count({
    where: { filePath: chapter.filePath, id: { not: chapter.id } }
  });
  if (sharers > 0) {
    return { moved: false, from: chapter.filePath, to: chapter.filePath };
  }

  const { chaptersDir } = buildMangaPaths(config.libraryBasePath, params.mangaTitle);
  const destDir = buildChapterDestDir(chaptersDir, chapter.volume);
  const ext = path.extname(chapter.filePath);
  const newName = formatChapterFileName(
    config.chapterNamingTemplate, params.mangaTitle,
    chapter.chapterNumber, chapter.volume, ext
  );
  const destPath = path.join(destDir, newName);

  if (chapter.filePath === destPath) {
    return { moved: false, from: chapter.filePath, to: destPath };
  }

  await assertChapterFilePathOwned(prismaClient, params.mangaId, destPath, 'organizeChapterFile');
  await fs.mkdir(destDir, { recursive: true });
  await moveFile(chapter.filePath, destPath);

  await prismaClient.chapter.update({
    where: { id: chapter.id },
    data: { filePath: destPath, fileName: newName }
  });

  logger.info(`[ChapterOrganizer] Moved chapter ${chapter.id}: ${chapter.fileName} → ${newName}`);
  return { moved: true, from: chapter.filePath, to: destPath };
}
