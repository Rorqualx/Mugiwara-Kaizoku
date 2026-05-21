/**
 * Update Library Path Mutation
 *
 * Updates a manga's library path and re-links chapter files
 * by scanning the new directory and matching files to existing chapters.
 *
 * @module server/trpc/routers/manga/crud-operations/update-library-path
 */

/* eslint-disable no-await-in-loop */
// Note: Sequential chapter updates required for data integrity

import * as fs from 'fs/promises';
import * as path from 'path';

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  getUnifiedFilenameMatcher,
  parseFilename,
} from '@/server/services/matching';
import type { SupportedProvider, VolumeForMatching } from '@/server/services/matching/types';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { findMangaFiles } from '@/utils/file-utils';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { logInfo, EventType, EventSource } from '@/utils/system-event-logger';

import { invalidateMangaCache } from './get-manga-cache';

import type { PrismaClient } from '@prisma/client';

/** Input schema for updateLibraryPath */
export const updateLibraryPathSchema = z.object({
  mangaId: z.number(),
  libraryPath: z.string().min(1, 'Path cannot be empty'),
});

/** Result type for updateLibraryPath */
export interface UpdateLibraryPathResult {
  success: boolean;
  message: string;
  libraryPath: string;
  filesFound: number;
  chaptersUpdated: number;
}

/** Extended volume type for file matching */
interface VolumeWithChapters extends VolumeForMatching {
  chaptersData: Array<{
    number: number;
    chapterNumber: number;
    title: string;
    alternativeTitles: string[];
  }>;
}

/** Chapter shape needed for matching */
interface ChapterForMatching {
  id: number;
  volume: number | null;
  chapterNumber: number | null;
  index: number;
  title: string;
  alternativeTitles: string[];
}

/**
 * Validate that the given path is an accessible directory
 */
async function validateDirectoryPath(dirPath: string): Promise<void> {
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The specified path is not a directory' });
    }
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot access path: ${dirPath}. Verify the directory exists and is readable.`
    });
  }
}

/**
 * Scan directory for manga files (returns empty array if none found)
 */
async function scanForFiles(dirPath: string): Promise<string[]> {
  try {
    return await findMangaFiles(dirPath, { recursive: true, includeImageDirs: false });
  } catch (error) {
    logger.warn(`[UpdateLibraryPath] Failed to scan directory: ${dirPath}`, error);
    return [];
  }
}

/**
 * Build volume map from existing chapters for file matching
 */
function buildVolumeMap(chapters: ChapterForMatching[]): Map<number, VolumeWithChapters> {
  const volumeMap = new Map<number, VolumeWithChapters>();
  for (const chapter of chapters) {
    const volumeNum = chapter.volume ?? -1;
    if (!volumeMap.has(volumeNum)) {
      volumeMap.set(volumeNum, {
        volumeNumber: volumeNum, number: volumeNum,
        title: `Volume ${volumeNum}`, chaptersData: []
      });
    }
    volumeMap.get(volumeNum)?.chaptersData.push({
      number: chapter.chapterNumber ?? chapter.index,
      chapterNumber: chapter.chapterNumber ?? chapter.index,
      title: chapter.title,
      alternativeTitles: chapter.alternativeTitles
    });
  }
  return volumeMap;
}

/**
 * Match files to chapters using the unified filename matcher
 */
function matchFilesToChapters(
  files: string[],
  volumeMap: Map<number, VolumeWithChapters>,
  provider: SupportedProvider
): Map<number, string> {
  const parsedFiles = files.map(f => parseFilename(path.basename(f)));
  const volumes = Array.from(volumeMap.values());
  const matcher = getUnifiedFilenameMatcher();
  const matchResults = matcher.matchFilesToVolumes(parsedFiles, volumes, provider);

  const chapterToFile = new Map<number, string>();
  for (const result of matchResults) {
    if (!result.bestMatch) continue;
    const volume = volumeMap.get(result.bestMatch.volumeNumber);
    const fileIndex = parsedFiles.findIndex(pf => pf.filename === result.file.filename);
    const fullPath = fileIndex >= 0 ? files[fileIndex] : undefined;
    if (!fullPath || !volume?.chaptersData) continue;

    for (const ch of volume.chaptersData) {
      chapterToFile.set(ch.number, fullPath);
    }
  }
  return chapterToFile;
}

/**
 * Update chapter file paths based on matched files
 */
async function updateChapterFilePaths(
  prisma: PrismaClient,
  chapters: ChapterForMatching[],
  chapterToFile: Map<number, string>
): Promise<number> {
  let updatedCount = 0;
  for (const chapter of chapters) {
    const chapterNum = chapter.chapterNumber ?? chapter.index;
    const matchedFile = chapterToFile.get(chapterNum);
    if (!matchedFile) continue;

    await prisma.chapter.update({
      where: { id: chapter.id },
      data: { filePath: matchedFile, fileName: path.basename(matchedFile) }
    });
    updatedCount++;
  }
  return updatedCount;
}

/** Resolve provider type from manga source string */
function resolveProvider(source: string): SupportedProvider {
  const map: Record<string, SupportedProvider> = {
    comicvine: 'comicvine', fandom: 'fandom', wikipedia: 'wikipedia', wiki: 'wikipedia'
  };
  return map[source.toLowerCase()] ?? 'fandom';
}

/**
 * Core handler: validates path, updates manga, re-links chapters
 */
async function handleUpdateLibraryPath(
  prisma: PrismaClient,
  mangaId: number,
  newPath: string
): Promise<UpdateLibraryPathResult> {
  logger.info(`[UpdateLibraryPath] Updating path for manga ${mangaId} to: ${newPath}`);

  await validateDirectoryPath(newPath);

  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    include: { Library: true, Chapter: { orderBy: { chapterNumber: 'asc' } }, Volume: true }
  });
  if (!manga) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Manga with ID ${mangaId} not found` });
  }

  // Always update the path first
  await prisma.manga.update({ where: { id: mangaId }, data: { libraryPath: newPath } });

  // Scan and re-link chapters if files are found (best-effort)
  const files = await scanForFiles(newPath);
  let updatedCount = 0;

  if (files.length > 0) {
    logger.info(`[UpdateLibraryPath] Found ${files.length} files. Re-linking chapters...`);
    const provider = resolveProvider(manga.source);
    const volumeMap = buildVolumeMap(manga.Chapter);
    const chapterToFile = matchFilesToChapters(files, volumeMap, provider);
    updatedCount = await updateChapterFilePaths(prisma, manga.Chapter, chapterToFile);
    logger.info(`[UpdateLibraryPath] Re-linked ${updatedCount} chapters for "${manga.title}"`);
  } else {
    logger.info(`[UpdateLibraryPath] No manga files found in ${newPath}. Path saved without re-linking.`);
  }

  await logInfo(`Updated library path for manga: ${manga.title}`, EventType.MANGA_UPDATED, EventSource.MANGA, {
    relatedEntityId: toStringId(mangaId),
    relatedEntityType: 'manga',
    details: { title: manga.title, oldPath: manga.libraryPath, newPath, filesFound: files.length, chaptersUpdated: updatedCount }
  });

  await invalidateMangaCache(mangaId);
  void realtimeEmitter.emitMangaUpdate({
    mangaId, action: 'updated',
    data: { title: manga.title, libraryPath: newPath, chaptersUpdated: updatedCount },
  });

  const message = files.length > 0
    ? `Path updated. Found ${files.length} files, linked ${updatedCount} chapters.`
    : 'Path updated. No manga files found yet — add files to re-link later.';

  return {
    success: true, message,
    libraryPath: newPath, filesFound: files.length, chaptersUpdated: updatedCount
  };
}

/**
 * Update Library Path tRPC procedure
 */
export const updateLibraryPathProcedure = protectedProcedure
  .input(updateLibraryPathSchema)
  .mutation(({ input, ctx }) => handleUpdateLibraryPath(ctx.prisma, input.mangaId, input.libraryPath));
