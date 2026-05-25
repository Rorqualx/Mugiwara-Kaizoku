// @file-size-justified: Core tRPC router — splitting procedures across files breaks router type inference
/**
 * CRUD Operations Router
 *
 * Handles all Create, Read, Update, Delete operations for manga:
 * - add: Add a new manga to library with metadata and chapters
 * - update: Update manga title and monitoring configuration
 * - query: List all manga with pagination
 * - get: Get single manga by ID with caching
 * - detail: Alias for get (backward compatibility)
 * - getAllChapters: Get all chapters for a manga
 * - remove: Delete manga and related data
 *
 * NOTE: searchLibrary is in searchOperations.ts (includes transformation for import pipeline)
 */

import * as path from 'path';

import { TRPCError } from '@trpc/server';
import { z } from 'zod';


import { eventEmitter } from '@/server/services/eventEmitter';
import { createMangaSafe } from '@/server/services/library/manga-create-guard';
import { autoBindAniList } from '@/server/services/library/scanner/anilist-auto-bind';
import type { MetadataInput } from '@/server/services/manga/metadataBuilder';
import {
  getUnifiedFilenameMatcher,
  parseFilename,
} from '@/server/services/matching';
import type { SupportedProvider, VolumeForMatching } from '@/server/services/matching/types';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { findMangaFiles } from '@/utils/file-utils';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { logInfo, logError, EventType, EventSource } from '@/utils/system-event-logger';


import {
  shouldFetchChapterDetails,
  fetchChapterDetailsAsync
} from './crud-operations/add-manga-chapter-details';
import {
  buildChapterCreationData,
  orchestrateChapters
} from './crud-operations/add-manga-chapters';
import {
  logMangaAdded,
  logMangaAddError
} from './crud-operations/add-manga-events';
import {
  validateLibrary,
  checkMangaDuplicate,
  createMangaMetadata,
  buildMangaCreateData,
  createAutoDownloadRule,
  logMangaMetadataCounts,
  logRawProviderData,
  logProviderMetadata,
  parseSelectedProviders
} from './crud-operations/add-manga-validation';
import { persistVolumesFromImport } from './crud-operations/add-manga-volumes';
import {
  checkMangaCache,
  storeMangaInCache,
  checkChapterRefetch,
  invalidateMangaCache
} from './crud-operations/get-manga-cache';
import { updateLibraryPathProcedure } from './crud-operations/update-library-path';
import {
  DEFAULT_CHAPTER_LIMIT,
  createMangaRelations,
  createMangaRelationsSlim,
  includeSchema,
  idSchema,
  addMangaSchema,
  includeMangaRelations,
  type MangaWithRelations
} from './shared';

import type { ChapterMetadataInput } from './crud-operations/add-manga-chapter-details';
import type { AddMangaInput } from './crud-operations/add-manga-validation';
import type { Prisma } from '@prisma/client';

// ===================================
// CRUD PROCEDURES
// ===================================

export const crudRouter = router({
  /**
   * Add a new manga to the library
   *
   * @param input Object containing manga details
   * @returns The newly created manga with all relations
   */
  add: protectedProcedure.input(addMangaSchema).mutation(async ({ input, ctx }) => {
    try {
      logger.info(`Adding new manga: ${input.title} from source: ${input.source}`);

      const library = await validateLibrary(ctx.prisma, input.libraryId);
      await checkMangaDuplicate(ctx.prisma, input.title);

      // Create with compensating delete on failure
      let metadataId: number | undefined;
      let manga: MangaWithRelations | undefined;
      try {
        metadataId = await createMangaMetadata(ctx.prisma, input.metadata as MetadataInput | undefined, input.rawProviderData);
        const createData = buildMangaCreateData(input as AddMangaInput, library.path, metadataId);
        manga = await createMangaSafe(ctx.prisma, { data: createData as Prisma.MangaCreateInput & { libraryPath: string }, include: includeMangaRelations }) as MangaWithRelations;
        logger.info(`Successfully added manga: ${manga.title} (ID: ${manga.id})`);

        await createAutoDownloadRule(ctx.prisma, manga.id);
        logMangaMetadataCounts(manga, input.metadata as MetadataInput | undefined);
        logRawProviderData(manga.rawProviderData, manga.id);
        logProviderMetadata(input.providerMetadata);

        const chapterCreationData = buildChapterCreationData({
          rawProviderData: input.rawProviderData,
          providerMetadata: input.providerMetadata,
          metadata: input.metadata as { chapters?: number | null; volumes?: number | null }
        });
        await orchestrateChapters(ctx, manga.id, chapterCreationData);
        await persistVolumesFromImport(manga.id, input.rawProviderData, input.providerMetadata, input.source);
        await logMangaAdded({ id: manga.id, title: manga.title, source: manga.source, libraryId: manga.libraryId });
      } catch (createError: unknown) {
        const mangaId = manga?.id;
        if (mangaId) {
          logger.error(`Quick-add failed after manga creation, cleaning up manga ${mangaId}`);
          await ctx.prisma.manga.delete({ where: { id: mangaId } })
            .catch((delErr: unknown) => logger.error('Compensating delete failed', { mangaId, error: delErr }));
        } else if (metadataId) {
          await ctx.prisma.metadata.delete({ where: { id: metadataId } })
            .catch((delErr: unknown) => logger.error('Metadata cleanup failed', { metadataId, error: delErr }));
        }
        throw createError;
      }

      // Fire-and-forget (outside compensating scope)
      const selectedProviders = parseSelectedProviders(input.selectedSourceId);
      if (shouldFetchChapterDetails(input.metadata as ChapterMetadataInput | undefined, selectedProviders, manga.source)) {
        void Promise.resolve(fetchChapterDetailsAsync(ctx.prisma, manga.id, (input.metadata ?? {}) as ChapterMetadataInput))
          .catch((err: unknown) => logger.error('fetchChapterDetailsAsync failed', { mangaId: manga.id, error: err }));
      }
      if (manga.source === 'local') {
        void Promise.resolve(autoBindAniList(manga.id, manga.title))
          .catch((err: unknown) => logger.error('autoBindAniList failed', { mangaId: manga.id, error: err }));
      }
      // Auto-download trigger moved to runEnrichmentPipeline post-Phase-6 hook
      // (pipeline-orchestrator.ts) — the prior setTimeout(2000) raced enrichment
      // and read zero Chapter rows. Triggering after Phase 6 guarantees rows exist.
      void realtimeEmitter.emitMangaUpdate({ mangaId: manga.id, action: 'created', data: { title: manga.title, source: manga.source } });

      return manga;
    } catch (error: unknown) {
      logger.error(`Error adding manga: ${error instanceof Error ? error.message : String(error)}`);
      await logMangaAddError(input.title, input.source, input.libraryId, error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to add manga: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }),

  /**
   * Update manga title and optionally AniList ID
   */
  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string(),
    monitoringConfig: z.string().optional(),
    anilistId: z.string().nullish(),
  })).mutation(async ({ input, ctx }) => {
    const manga = await ctx.prisma.manga.findFirst({
      where: {
        id: input.id
      },
      include: includeMangaRelations
    });
    if (!manga) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Manga not found.'
      });
    }

    // Update Metadata sourceId if anilistId is provided
    if (input.anilistId !== undefined && manga.Metadata) {
      await ctx.prisma.metadata.update({
        where: { id: manga.Metadata.id },
        data: { sourceId: input.anilistId ?? null }
      });
    }

    const updatedManga = await ctx.prisma.manga.update({
      where: {
        id: input.id
      },
      data: {
        title: input.title,
        ...(input.monitoringConfig !== undefined && { monitoringConfig: input.monitoringConfig })
      },
      include: includeMangaRelations
    });

    // Emit WebSocket event for manga updated
    void realtimeEmitter.emitMangaUpdate({
      mangaId: input.id,
      action: 'updated',
      data: { title: input.title },
    });

    return updatedManga;
  }),

  /** Update manga library path and re-link chapter files */
  updateLibraryPath: updateLibraryPathProcedure,

  /**
   * Query all manga with optional relation includes and pagination
   */
  query: protectedProcedure.input(z.object({
    include: includeSchema,
    limit: z.number().min(1).max(500).optional().default(200),
    offset: z.number().min(0).optional().default(0)
  }).optional()).query(async ({ input, ctx }) => {
    const limit = input?.limit ?? 200;
    const offset = input?.offset ?? 0;

    const result = await ctx.prisma.manga.findMany({
      include: {
        Library: input?.include?.library ?? false,
        Metadata: input?.include?.metadata ?? false,
        // Slim chapter select: only filter/sort fields (~44 bytes/row vs ~500 for full).
        // `index` is required so the library-table UI can filter out the
        // index >= 100000 pack-import sentinel band when counting "real"
        // chapters (see ResponsiveTableView's isRealChapter helper).
        Chapter: {
          select: {
            id: true,
            index: true,
            isRead: true,
            monitored: true,
            downloadStatus: true,
            updatedAt: true,
            chapterNumber: true,
            volumeId: true,
          },
        },
        Volume: input?.include?.volumes
          ? { select: { id: true } }
          : false,
      },
      take: limit,
      skip: offset,
      orderBy: {
        title: 'asc'
      }
    });

    // Return result directly - heavy fields are handled at DB level
    return result;
  }),

  /**
   * Lightweight listing of all manga titles in a library. Used by the library
   * page to render skeleton cards populated with real titles before the heavy
   * paginated detail query arrives. Returns only id + title + libraryId to
   * keep the payload tiny (~100 bytes per row).
   */
  listTitlesByLibrary: protectedProcedure
    .input(z.object({ libraryId: z.number() }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.manga.findMany({
        where: { libraryId: input.libraryId },
        select: { id: true, title: true, libraryId: true },
        orderBy: { title: 'asc' },
      });
    }),

  // NOTE: searchLibrary is defined in searchOperations.ts with proper transformation
  // (coverImage, libraryChapters, etc.) for the import pipeline. Do not duplicate here.

  /**
   * Get a single manga by ID with caching
   * NOTE: Uses uncachedPublicProcedure because this procedure has its own caching
   * via checkMangaCache (hot cache + unified cache). Using publicProcedure's
   * cachingMiddleware would create duplicate caching and cause stale data issues.
   */
  get: protectedProcedure.input(
    z.object({
      id: z.number(),
      chapterLimit: z.number().optional().default(DEFAULT_CHAPTER_LIMIT)
    })
  ).query(async ({ input, ctx }) => {
    try {
      logger.info(`Fetching manga with ID ${input.id}, chapterLimit=${input.chapterLimit}`);
      const cacheKey = `manga:${input.id}:limit:${input.chapterLimit}`;

      // Check cache layers first
      const cached = await checkMangaCache(input.id, cacheKey);
      if (cached) {
        return cached;
      }

      // Database query on cache miss - use slim chapter select for ~80% smaller payload
      // Only fetches 18 chapter fields instead of 51, reducing payload from ~1.2MB to ~250KB
      // for manga with 1100+ chapters (e.g., One Piece)
      logger.debug(`Cache miss for manga ${input.id}, fetching from database`);

      const mangaRaw = await ctx.prisma.manga.findUnique({
        where: { id: input.id },
        include: createMangaRelationsSlim(input.chapterLimit)
      });

      if (!mangaRaw) {
        logger.warn(`Manga with ID ${input.id} not found`);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Manga with ID ${input.id} not found.`
        });
      }

      // Safe cast: slim select is a subset of full Chapter fields.
      // All downstream consumers (volume tables, chapter lists) only access the slim fields.
      const manga = mangaRaw as unknown as MangaWithRelations;

      // Check if chapter re-fetch is needed
      const refetched = await checkChapterRefetch(ctx.prisma, manga, input.chapterLimit);
      if (refetched) {
        return refetched;
      }

      logger.debug(`Fetched manga: ${manga.title} (ID: ${manga.id}, chapters: ${manga.Chapter.length})`);

      // Store in cache layers
      await storeMangaInCache(input.id, cacheKey, manga);

      return manga;
    } catch (error: unknown) {
      logger.error(`Error fetching manga with ID ${input.id}: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch manga details. The manga may have been deleted or may not exist.'
      });
    }
  }),

  /**
   * Alias for 'get' procedure to maintain backward compatibility
   */
  detail: protectedProcedure.input(
    z.object({
      id: z.number(),
      chapterLimit: z.number().optional().default(DEFAULT_CHAPTER_LIMIT)
    })
  ).query(async ({ input, ctx }) => {
    // Delegate to 'get' procedure
    return ctx.prisma.manga.findUnique({
      where: {
        id: input.id
      },
      include: createMangaRelations(input.chapterLimit)
    });
  }),

  /**
   * Get all chapters for a specific manga
   */
  getAllChapters: protectedProcedure.input(idSchema).query(async ({ input, ctx }) => {
    const manga = await ctx.prisma.manga.findUnique({
      where: {
        id: input.id
      },
      include: {
        Chapter: {
          orderBy: {
            index: 'asc'
          }
        }
      }
    });

    if (!manga) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Manga not found.'
      });
    }

    return manga["Chapter"];
  }),

  /**
   * Remove a manga and all related data
   *
   * Optimized for performance:
   * - Uses Prisma cascade deletes for related records (chapters, volumes, etc.)
   * - Single transaction for atomic deletion
   * - Non-blocking logging and event emission
   */
  remove: protectedProcedure.input(z.object({
    id: z.number(),
    shouldRemoveFiles: z.boolean().optional()
  })).mutation(async ({ input, ctx }) => {
    const { id, shouldRemoveFiles } = input;

    logger.info(`Removing manga with ID ${id}, shouldRemoveFiles=${shouldRemoveFiles ?? false}`);

    // Fetch minimal data needed for logging and metadata cleanup
    const manga = await ctx.prisma.manga.findUnique({
      where: { id },
      select: { id: true, title: true, source: true, metadataId: true }
    });

    if (!manga) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Manga not found.'
      });
    }

    const { title, metadataId } = manga;

    try {
      // Single transaction: Delete manga (cascade handles chapters, volumes, etc.) + orphaned metadata
      // Prisma cascade deletes automatically handle: Chapter, Volume, ReadingProgress, etc.
      await ctx.prisma.$transaction([
        ctx.prisma.manga.delete({ where: { id } }),
        // Clean up orphaned Metadata if it exists (Manga references Metadata, not vice versa)
        ...(metadataId ? [ctx.prisma.metadata.delete({ where: { id: metadataId } })] : [])
      ]);

      logger.info(`Successfully removed manga: ${title} (ID: ${id})`);

      // Non-blocking: cache invalidation + logging + event emission
      void Promise.all([
        invalidateMangaCache(id),
        logInfo(`Removed manga: ${title}`, EventType.MANGA_DELETED, EventSource.MANGA, {
          relatedEntityId: toStringId(id),
          relatedEntityType: 'manga',
          details: { title, source: manga.source, filesRemoved: shouldRemoveFiles ?? false }
        }),
        eventEmitter.emit('manga:deleted', { mangaId: id }),
        // Also emit WebSocket event for real-time updates
        realtimeEmitter.emitMangaUpdate({
          mangaId: id,
          action: 'deleted',
          data: { title, source: manga.source },
        })
      ]);

      return {
        success: true,
        message: `Manga "${title}" removed successfully.`
      };
    } catch (error: unknown) {
      logger.error(`Error removing manga ID ${id}: ${error instanceof Error ? error.message : String(error)}`);

      // Log error event (non-blocking)
      void logError(`Failed to remove manga: ${title}`, EventSource.MANGA, error, {
        relatedEntityId: toStringId(id),
        relatedEntityType: 'manga',
        details: { title }
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to remove manga: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }),

  /**
   * Re-match files to chapters for a manga
   *
   * Scans the manga directory and matches files to existing chapters
   * using the unified filename matcher.
   *
   * @param input Object with mangaId
   * @returns Match statistics and updated chapters
   */
  /* eslint-disable max-lines-per-function, max-statements, complexity -- Complex file matching operation */
  rematchFiles: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      threshold: z.number().min(0).max(1).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { mangaId, threshold } = input;

      logger.info(`[RematchFiles] Starting file re-match for manga ID ${mangaId}`);

      // Fetch manga with library and chapters
      const manga = await ctx.prisma.manga.findUnique({
        where: { id: mangaId },
        include: {
          Library: true,
          Chapter: {
            orderBy: { chapterNumber: 'asc' }
          },
          Volume: true
        }
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Manga with ID ${mangaId} not found`
        });
      }

      // Determine the manga folder path
      const mangaPath = manga.libraryPath ?? path.join(manga.Library.path, manga.title);

      logger.info(`[RematchFiles] Scanning directory: ${mangaPath}`);

      // Scan for manga files
      let files: string[];
      try {
        files = await findMangaFiles(mangaPath, {
          recursive: true,
          includeImageDirs: false
        });
      } catch (error) {
        logger.error(`[RematchFiles] Error scanning directory ${mangaPath}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to scan manga directory: ${error instanceof Error ? error.message : String(error)}`
        });
      }

      if (files.length === 0) {
        logger.warn(`[RematchFiles] No files found in ${mangaPath}`);
        return {
          success: true,
          message: 'No files found in manga directory',
          matchedCount: 0,
          unmatchedCount: 0,
          totalFiles: 0,
          totalChapters: manga.Chapter.length
        };
      }

      logger.info(`[RematchFiles] Found ${files.length} files to match`);

      // Parse filenames
      const parsedFiles = files.map(f => parseFilename(path.basename(f)));

      // Determine provider from manga source
      const providerMap: Record<string, SupportedProvider> = {
        comicvine: 'comicvine',
        fandom: 'fandom',
        wikipedia: 'wikipedia',
        wiki: 'wikipedia'
      };

      const sourceLower = manga.source.toLowerCase();
      const provider: SupportedProvider = providerMap[sourceLower] ?? 'fandom';

      logger.info(`[RematchFiles] Using ${provider} matcher for source "${manga.source}"`);

      // Extended volume type that includes chapters for local processing
      interface VolumeWithChapters extends VolumeForMatching {
        chaptersData: Array<{
          number: number;
          chapterNumber: number;
          title: string;
          alternativeTitles: string[];
        }>;
      }

      // Build volume data from existing chapters/volumes for matching
      const volumeMap = new Map<number, VolumeWithChapters>();

      for (const chapter of manga.Chapter) {
        const volumeNum = chapter.volume ?? -1;
        if (!volumeMap.has(volumeNum)) {
          volumeMap.set(volumeNum, {
            volumeNumber: volumeNum,
            number: volumeNum,
            title: `Volume ${volumeNum}`,
            chaptersData: []
          });
        }

        const vol = volumeMap.get(volumeNum);
        if (vol) {
          vol.chaptersData.push({
            number: chapter.chapterNumber ?? chapter.index,
            chapterNumber: chapter.chapterNumber ?? chapter.index,
            title: chapter.title,
            alternativeTitles: chapter.alternativeTitles
          });
        }
      }

      const volumes = Array.from(volumeMap.values());

      // Get matcher and run matching
      const matcher = getUnifiedFilenameMatcher();
      if (threshold !== undefined) {
        matcher.setThreshold(threshold);
      }

      const matchResults = matcher.matchFilesToVolumes(parsedFiles, volumes, provider);

      // Build chapter-to-file mapping
      const chapterToFile = new Map<number, string>();

      for (const result of matchResults) {
        if (!result.bestMatch) continue;

        const volumeNumber = result.bestMatch.volumeNumber;
        const volume = volumeMap.get(volumeNumber);

        if (volume?.chaptersData) {
          // Get the original file path (not just basename)
          const fileIndex = parsedFiles.findIndex(pf => pf.filename === result.file.filename);
          const fullPath = fileIndex >= 0 ? files[fileIndex] : undefined;

          if (fullPath) {
            for (const chapter of volume.chaptersData) {
              chapterToFile.set(chapter.number, fullPath);
            }
          }
        }
      }

      // Update chapters with matched file paths
      let updatedCount = 0;

      for (const chapter of manga.Chapter) {
        const chapterNum = chapter.chapterNumber ?? chapter.index;
        const matchedFile = chapterToFile.get(chapterNum);

        if (matchedFile && matchedFile !== chapter.filePath) {
          // eslint-disable-next-line no-await-in-loop
          await ctx.prisma.chapter.update({
            where: { id: chapter.id },
            data: {
              filePath: matchedFile,
              fileName: path.basename(matchedFile)
            }
          });
          updatedCount++;
          logger.debug(`[RematchFiles] Updated chapter ${chapterNum} with file: ${path.basename(matchedFile)}`);
        }
      }

      const autoMatchedCount = matchResults.filter(r => r.bestMatch !== undefined).length;
      const unmatchedCount = matchResults.filter(r => r.bestMatch === undefined).length;

      logger.info(
        `[RematchFiles] Complete: ${autoMatchedCount}/${files.length} files matched, ${updatedCount} chapters updated`
      );

      // Log system event
      await logInfo(`Re-matched files for manga: ${manga.title}`, EventType.MANGA_UPDATED, EventSource.MANGA, {
        relatedEntityId: toStringId(mangaId),
        relatedEntityType: 'manga',
        details: {
          title: manga.title,
          provider,
          totalFiles: files.length,
          matchedFiles: autoMatchedCount,
          unmatchedFiles: unmatchedCount,
          chaptersUpdated: updatedCount
        }
      });

      // Invalidate cache
      await invalidateMangaCache(mangaId);

      // Emit WebSocket event for chapters updated
      if (updatedCount > 0) {
        void realtimeEmitter.emitMangaUpdate({
          mangaId,
          action: 'chapters_updated',
          data: {
            title: manga.title,
            chaptersUpdated: updatedCount,
            matchedFiles: autoMatchedCount,
          },
        });
      }

      return {
        success: true,
        message: `Matched ${autoMatchedCount} of ${files.length} files, updated ${updatedCount} chapters`,
        matchedCount: autoMatchedCount,
        unmatchedCount,
        totalFiles: files.length,
        totalChapters: manga.Chapter.length,
        chaptersUpdated: updatedCount
      };
    })
});
