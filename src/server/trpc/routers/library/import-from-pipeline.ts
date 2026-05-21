/**
 * Import From Pipeline Procedure
 *
 * Handles importing manga from the import pipeline.
 * Creates manga entry with metadata and chapters from files.
 * Copies files to library folder for persistence.
 *
 * @module server/trpc/routers/library/import-from-pipeline
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import {
  loadFileOrganizationConfig as loadFileOrgConfig,
  generateMangaFolderPath,
} from '@/server/services/download/fileImporter/utils';
import { type FileOrganizationConfig } from '@/server/services/fileOrganization/configService';
import { createMangaSafe } from '@/server/services/library/manga-create-guard';
import { autoBindAniList } from '@/server/services/library/scanner/anilist-auto-bind';
import { createChaptersFromFileList, linkFilesToExistingChapters, type ChapterMappingForImport } from '@/server/services/library/scanner/chapter-creator';
import { validateImportResult } from '@/server/services/library/scanner/import-validator';
import { extractAndSetLocalCover } from '@/server/services/library/scanner/local-cover-extractor';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { findMangaFiles } from '@/utils/file-utils';
import { logger } from '@/utils/logger';

import { processFilesForImport, queueConversionIfNeeded } from './import-file-processor';

import type { Prisma } from '@prisma/client';

/** Input schema for pipeline import */
export const importFromPipelineSchema = z.object({
  libraryId: z.number(),
  path: z.string(),
  title: z.string(),
  provider: z.string().default('local'),
  providerId: z.string().default('local'),
  metadata: z.record(z.unknown()).optional(),
  createChapters: z.boolean().default(true),
  fileMode: z.enum(['keep_in_place', 'move', 'copy']).optional(),
});

export type ImportFromPipelineInput = z.infer<typeof importFromPipelineSchema>;

/** Result of pipeline import */
export interface ImportFromPipelineResult {
  mangaId: number;
  title: string;
  chaptersCreated: number;
  filesFailedCount?: number;
  validationWarnings?: string[];
}

async function findExistingMangaByTitle(title: string): Promise<{ id: number; title: string; libraryPath: string | null } | null> {
  return prisma.manga.findFirst({
    where: { title },
    select: { id: true, title: true, libraryPath: true }
  });
}

async function validateImportTarget(libraryId: number, path: string, title: string): Promise<{ existingManga: { id: number; title: string; libraryPath: string | null } | null }> {
  const library = await prisma.library.findUnique({ where: { id: libraryId } });
  if (!library) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Library with ID ${libraryId} not found` });
  }

  const existingByPath = await prisma.manga.findFirst({
    where: { libraryId, libraryPath: path },
    select: { id: true, title: true, libraryPath: true },
  });
  if (existingByPath) {
    // Same-path + same-title = top-up: the user is importing more files into a
    // manga we already track at this libraryPath. Route to the existing-manga
    // import path (linkFilesToExistingChapters). Different title at the same
    // path remains a genuine conflict.
    if (existingByPath.title === title) {
      return { existingManga: existingByPath };
    }
    throw new TRPCError({ code: 'CONFLICT', message: `Manga "${existingByPath.title}" already exists at path: ${path}` });
  }

  const existingByTitle = await findExistingMangaByTitle(title);
  return { existingManga: existingByTitle };
}

const loadFileOrganizationConfig = loadFileOrgConfig;

/** Generate a unique manga folder path, appending a numeric suffix on collision */
async function generateUniqueMangaFolderPath(
  libraryId: number,
  libraryPath: string,
  mangaTitle: string,
  config: FileOrganizationConfig
): Promise<string> {
  const basePath = generateMangaFolderPath(libraryPath, mangaTitle, config);

  // Check if this path is already used by another manga in this library
  let finalPath = basePath;
  let suffix = 1;
  const maxIterations = 100;

  while (suffix <= maxIterations) {
    // eslint-disable-next-line no-await-in-loop -- Sequential collision detection required
    const existingManga = await prisma.manga.findFirst({
      where: { libraryId, libraryPath: finalPath },
      select: { id: true }
    });

    if (!existingManga) {
      // Path is available
      return finalPath;
    }

    // Path is taken, try with suffix
    finalPath = `${basePath} (${suffix})`;
    suffix++;
  }

  // Exceeded max iterations - this shouldn't happen in practice
  throw new TRPCError({
    code: 'CONFLICT',
    message: `Cannot generate unique path for "${mangaTitle}" - too many conflicts`
  });
}

/** Extract chapter mappings from metadata (user-assigned volume/chapter info) */
function extractChapterMappings(metadata?: Record<string, unknown>): ChapterMappingForImport[] | undefined {
  if (!metadata) return undefined;
  const mappings = metadata['chapterMappings'];
  if (!Array.isArray(mappings)) return undefined;

  // Validate and filter valid mappings
  return mappings.filter((m): m is ChapterMappingForImport => {
    if (typeof m !== 'object' || m === null) return false;
    const obj = m as Record<string, unknown>;
    return (
      typeof obj['filePath'] === 'string' &&
      (obj['chapterNumber'] === undefined || typeof obj['chapterNumber'] === 'number') &&
      (obj['volumeNumber'] === undefined || typeof obj['volumeNumber'] === 'number') &&
      (obj['title'] === undefined || typeof obj['title'] === 'string')
    );
  });
}

/** Create chapters from files - processes files according to import mode */
// eslint-disable-next-line max-params -- 6 distinct inputs from the import pipeline; all are independently meaningful and used positionally at the single call site
async function createChaptersFromPath(
  mangaId: number,
  sourcePath: string,
  mangaFolderPath: string,
  config: FileOrganizationConfig,
  chapterMappings?: ChapterMappingForImport[],
  mangaTitle?: string,
): Promise<{ chaptersCreated: number; filesFailedCount: number; validationWarnings: string[] }> {
  try {
    const sourceFiles = await findMangaFiles(sourcePath);
    if (sourceFiles.length === 0) return { chaptersCreated: 0, filesFailedCount: 0, validationWarnings: [] };

    const fileResult = await processFilesForImport(sourceFiles, mangaFolderPath, config, mangaTitle);

    if (fileResult.successFiles.length > 0) {
      // Pass user-provided mappings if available (takes priority over filename parsing)
      await createChaptersFromFileList(mangaId, fileResult.successFiles, true, chapterMappings);

      // Run post-import validation
      const validation = await validateImportResult(mangaId, fileResult.successFiles.length);

      return {
        chaptersCreated: fileResult.successFiles.length,
        filesFailedCount: fileResult.failedCount,
        validationWarnings: validation.warnings
      };
    }

    return { chaptersCreated: 0, filesFailedCount: fileResult.failedCount, validationWarnings: [] };
  } catch (error) {
    logger.error('Failed to create chapters', { error, mangaId });
  }
  return { chaptersCreated: 0, filesFailedCount: 0, validationWarnings: [] };
}

/** Create metadata record for the manga */
async function createMetadataRecord(
  mangaId: number,
  cover: string | undefined,
  description: string | undefined
): Promise<void> {
  if (cover === undefined && description === undefined) return;
  await prisma.metadata.create({
    data: {
      Manga: { connect: { id: mangaId } },
      cover: cover ?? '/cover-not-found.jpg',
      summary: description ?? null
    }
  });
}

/** Emit events for the created manga */
function emitMangaCreatedEvent(mangaId: number, title: string, libraryId: number, folderPath: string, chaptersCreated: number): void {
  void realtimeEmitter.emitMangaUpdate({
    mangaId, action: 'created',
    data: { title, libraryId, source: 'import-pipeline', path: folderPath, chaptersCreated },
  });
}

/** Fire-and-forget: trigger full enrichment pipeline for newly imported manga */
async function triggerPostImportEnrichment(mangaId: number, title: string): Promise<void> {
  try {
    const { runEnrichmentPipeline } = await import('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/pipeline-orchestrator');
    await runEnrichmentPipeline(mangaId, title);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('Post-import enrichment failed', { mangaId, error: msg });
  }
}

/** Process files and link to existing manga chapters */
async function processAndLinkToExistingManga(
  existingManga: { id: number; title: string; libraryPath: string | null },
  sourcePath: string,
  libraryPath: string,
  config: FileOrganizationConfig,
  chapterMappings?: ChapterMappingForImport[]
): Promise<{ chaptersLinked: number; chaptersCreated: number; filesFailedCount: number; mangaFolderPath: string }> {
  // For in-place mode, use source path; otherwise use existing or generate new path
  const mangaFolderPath = config.fileMode === 'keep_in_place'
    ? sourcePath
    : (existingManga.libraryPath ?? generateMangaFolderPath(libraryPath, existingManga.title, config));

  const sourceFiles = await findMangaFiles(sourcePath);
  if (sourceFiles.length === 0) {
    return { chaptersLinked: 0, chaptersCreated: 0, filesFailedCount: 0, mangaFolderPath };
  }

  const fileResult = await processFilesForImport(sourceFiles, mangaFolderPath, config, existingManga.title);
  if (fileResult.successFiles.length === 0) {
    return { chaptersLinked: 0, chaptersCreated: 0, filesFailedCount: fileResult.failedCount, mangaFolderPath };
  }

  // Link processed files to existing chapters using user-provided mappings
  const result = await linkFilesToExistingChapters(existingManga.id, fileResult.successFiles, chapterMappings);
  return { chaptersLinked: result.linked, chaptersCreated: result.created, filesFailedCount: fileResult.failedCount, mangaFolderPath };
}

/** Handle import when manga with same title already exists */
async function handleExistingMangaImport(
  existingManga: { id: number; title: string; libraryPath: string | null },
  input: ImportFromPipelineInput,
  libraryPath: string,
  config: FileOrganizationConfig,
  metadata: Record<string, unknown>
): Promise<ImportFromPipelineResult> {
  logger.info('Found existing manga with same title, linking files', { existingMangaId: existingManga.id });

  const chapterMappings = extractChapterMappings(metadata);
  logger.info('Chapter mappings extracted', {
    hasMappings: !!chapterMappings && chapterMappings.length > 0,
    mappingCount: chapterMappings?.length ?? 0,
    sampleMapping: chapterMappings?.[0] ? {
      filePath: chapterMappings[0].filePath,
      hasChapterNum: chapterMappings[0].chapterNumber !== undefined,
      hasVolumeNum: chapterMappings[0].volumeNumber !== undefined,
    } : null
  });

  const linkResult = input.createChapters
    ? await processAndLinkToExistingManga(existingManga, input.path, libraryPath, config, chapterMappings)
    : { chaptersLinked: 0, chaptersCreated: 0, filesFailedCount: 0, mangaFolderPath: existingManga.libraryPath ?? '' };

  const totalChapters = linkResult.chaptersLinked + linkResult.chaptersCreated;
  emitMangaCreatedEvent(existingManga.id, existingManga.title, input.libraryId, linkResult.mangaFolderPath, totalChapters);

  logger.info('Files linked to existing manga', {
    mangaId: existingManga.id,
    chaptersLinked: linkResult.chaptersLinked,
    chaptersCreated: linkResult.chaptersCreated,
    filesFailedCount: linkResult.filesFailedCount
  });

  // Fire-and-forget: trigger full enrichment pipeline for the re-imported manga
  void triggerPostImportEnrichment(existingManga.id, existingManga.title);
  // Fire-and-forget: queue auto-conversion for any non-cbz files just added.
  // The new-manga path already calls this at the bottom; mirror here so a
  // top-up import of a PDF/EPUB doesn't sit un-converted until the next scan.
  void queueConversionIfNeeded(existingManga.id);

  return {
    mangaId: existingManga.id,
    title: existingManga.title,
    chaptersCreated: totalChapters,
    ...(linkResult.filesFailedCount > 0 && { filesFailedCount: linkResult.filesFailedCount })
  };
}

/**
 * Run an import-from-pipeline operation against the DB.
 *
 * Extracted from the tRPC procedure so scripts (iter loops, batch tools)
 * can call the exact same flow without going through HTTP. Behavior is
 * unchanged from the previous inline mutation body.
 */
export async function runImportFromPipeline(input: ImportFromPipelineInput): Promise<ImportFromPipelineResult> {
  logger.info('Importing manga from pipeline', { title: input.title, provider: input.provider, path: input.path });

  const library = await prisma.library.findUnique({ where: { id: input.libraryId } });
  if (!library) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `Library with ID ${input.libraryId} not found` });
  }

  const fileOrgConfig = await loadFileOrganizationConfig();
  if (input.fileMode) {
    fileOrgConfig.fileMode = input.fileMode;
  }

  const { existingManga } = await validateImportTarget(input.libraryId, input.path, input.title);
  const metadata = input.metadata ?? {};
  const cover = typeof metadata['coverImage'] === 'string' ? metadata['coverImage'] : undefined;
  const description = typeof metadata['description'] === 'string' ? metadata['description'] : undefined;

  if (existingManga) {
    return handleExistingMangaImport(existingManga, input, library.path, fileOrgConfig, metadata);
  }

  // Determine manga folder path based on import mode
  const mangaFolderPath = fileOrgConfig.fileMode === 'keep_in_place'
    ? input.path
    : await generateUniqueMangaFolderPath(input.libraryId, library.path, input.title, fileOrgConfig);

  // Structure providerMetadata — skip binding entry for local-only imports
  const isLocalOnly = input.provider === 'local';
  const structuredProviderMetadata: Record<string, unknown> = {
    ...(isLocalOnly ? {} : {
      [input.provider]: {
        providerId: input.providerId,
        boundAt: new Date().toISOString(),
      },
    }),
    importedAt: new Date().toISOString(),
    cover,
    ...metadata,
  };

  const manga = await createMangaSafe(prisma, {
    data: {
      title: input.title,
      source: 'local',
      libraryId: input.libraryId,
      libraryPath: mangaFolderPath,
      libraryStatus: 'ACTIVE',
      searchProvider: isLocalOnly ? 'anilist' : input.provider,
      updatedAt: new Date(),
      providerMetadata: structuredProviderMetadata as Prisma.InputJsonValue,
    }
  });

  const chapterMappings = extractChapterMappings(metadata);
  const chapterResult = input.createChapters
    ? await createChaptersFromPath(manga.id, input.path, mangaFolderPath, fileOrgConfig, chapterMappings, input.title)
    : { chaptersCreated: 0, filesFailedCount: 0, validationWarnings: [] as string[] };

  await createMetadataRecord(manga.id, cover, description);

  // For local-only imports without a cover, extract one from the first chapter archive
  if (isLocalOnly && !cover) {
    void extractAndSetLocalCover(manga.id, input.path);
  }

  emitMangaCreatedEvent(manga.id, manga.title, input.libraryId, mangaFolderPath, chapterResult.chaptersCreated);

  // Fire-and-forget: bind to AniList, trigger enrichment, queue conversions
  void autoBindAniList(manga.id, input.title);
  if (!isLocalOnly) {
    void triggerPostImportEnrichment(manga.id, input.title);
  }
  void queueConversionIfNeeded(manga.id);

  logger.info('Manga imported successfully', { mangaId: manga.id, chaptersCreated: chapterResult.chaptersCreated });
  return {
    mangaId: manga.id,
    title: manga.title,
    chaptersCreated: chapterResult.chaptersCreated,
    ...(chapterResult.filesFailedCount > 0 && { filesFailedCount: chapterResult.filesFailedCount }),
    ...(chapterResult.validationWarnings.length > 0 && { validationWarnings: chapterResult.validationWarnings })
  };
}

/** Import a manga from the import pipeline */
export const importFromPipelineProcedure = protectedProcedure
  .input(importFromPipelineSchema)
  .mutation(async ({ input }): Promise<ImportFromPipelineResult> => runImportFromPipeline(input));
