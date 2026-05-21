/**
 * MangaDex Download Operations Router
 *
 * tRPC router for MangaDex chapter search and download operations.
 * Integrates with the Native download system.
 *
 * @module native-download/mangadex-operations
 */

import path from 'path';

import { JobPriority, NativeDownloadStatus, Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { mangadexClient, mangadexConfigService, extractScanlationGroups } from '@/server/services/mangadex';
import { getNativeDownloadManager } from '@/server/services/native-download/NativeDownloadManager';
import { publicProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

const log = logger.child('mangadexOperationsRouter');

/** Chapter file name format. Numeric chapters get zero-padded; decimals are kept. */
function formatChapterFileName(chapterNumber: number): string {
  const formatted = Number.isInteger(chapterNumber)
    ? chapterNumber.toString().padStart(4, '0')
    : chapterNumber.toString();
  return `Chapter ${formatted}.cbz`;
}

interface MangaWithLibrary {
  title: string;
  libraryPath: string | null;
  Library: { path: string } | null;
}

function resolveLibraryDir(manga: MangaWithLibrary): string | null {
  if (manga.libraryPath) return manga.libraryPath;
  if (manga.Library) return path.join(manga.Library.path, manga.title);
  return null;
}

/**
 * Resolve the absolute output path for a chapter download.
 * Prefers the manga's persisted libraryPath; falls back to <library.path>/<title>.
 */
function resolveDestinationPath(manga: MangaWithLibrary, chapterNumber: number): string {
  const baseDir = resolveLibraryDir(manga);
  if (!baseDir) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Manga has no library path. Run a library scan or add the manga to a library first.',
    });
  }
  return path.join(baseDir, formatChapterFileName(chapterNumber));
}

interface EnqueueOptions {
  mangaId: number;
  mangaTitle: string;
  mangadexChapterId: string;
  chapterNumber: number;
  quality: 'full' | 'dataSaver';
  destinationPath: string;
  existingChapterId: number | null;
  jobMetadataKind: 'chapter' | 'batch_chapter';
}

function buildJobPayload(opts: EnqueueOptions, downloadId: string): Prisma.InputJsonValue {
  return {
    downloadId,
    mangaId: opts.mangaId,
    mangadexChapterId: opts.mangadexChapterId,
    chapterNumber: opts.chapterNumber,
    quality: opts.quality,
    destinationPath: opts.destinationPath,
    metadata: {
      series: opts.mangaTitle,
      number: String(opts.chapterNumber),
    },
  };
}

/**
 * Create the NativeDownload row plus its companion `mangadex_download` Job
 * inside the supplied transaction. Returns the created download id so the
 * caller can hand it to `NativeDownloadManager.queueDownload`.
 */
async function enqueueMangadexDownload(
  tx: Prisma.TransactionClient,
  opts: EnqueueOptions,
): Promise<{ downloadId: string; jobId: bigint }> {
  const downloadRecord = await tx.nativeDownload.create({
    data: {
      sourceId: 'MANGADEX',
      mangaId: opts.mangaId,
      chapterId: opts.existingChapterId,
      sourceChapterId: opts.mangadexChapterId,
      chapterNumber: opts.chapterNumber,
      status: NativeDownloadStatus.QUEUED,
      sourceType: 'MANGADEX',
      destinationPath: opts.destinationPath,
    },
  });

  const jobRecord = await tx.jobs.create({
    data: {
      job_type: 'mangadex_download',
      // Worker is configured to poll queue_name='default' (src/server/index.ts:122);
      // handler routing is by job_type, so this simply gets the job picked up.
      queue_name: 'default',
      priority: JobPriority.normal,
      status: 'pending',
      manga_id: opts.mangaId,
      payload: buildJobPayload(opts, downloadRecord.id),
      metadata: {
        downloadType: opts.jobMetadataKind,
        sourceName: 'MANGADEX',
      } as Prisma.InputJsonValue,
    },
  });

  return { downloadId: downloadRecord.id, jobId: jobRecord.id };
}

/**
 * Throws PRECONDITION_FAILED when MangaDex is disabled as a download source.
 * Metadata-side reads stay unblocked so the user can keep browsing series
 * info while pausing downloads.
 */
async function assertDownloadEnabled(): Promise<void> {
  const enabled = await mangadexConfigService.isDownloadEnabled();
  if (!enabled) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'MangaDex downloads are disabled. Enable them in Settings → Indexers.',
    });
  }
}

/**
 * MangaDex Operations Router
 */
export const mangadexOperationsRouter = router({
  /**
   * Search for chapters on MangaDex
   */
  searchChapters: publicProcedure
    .input(z.object({
      mangadexId: z.string(),
      language: z.string().optional(),
      groupId: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input }) => {
      try {
        const config = await mangadexConfigService.getDownloadConfig();

        const response = await mangadexClient.getMangaChapters(input.mangadexId, {
          limit: input.limit,
          offset: input.offset,
          translatedLanguage: [input.language ?? config.preferredLanguage],
          ...(input.groupId ? { groups: [input.groupId] } : {}),
          includes: ['scanlation_group'],
        });

        const chapters = Array.isArray(response.data) ? response.data : [response.data];

        // Transform to simplified format
        const results = chapters.map(chapter => {
          const groups = extractScanlationGroups(chapter);
          return {
            id: chapter.id,
            title: chapter.attributes.title,
            chapter: chapter.attributes.chapter,
            volume: chapter.attributes.volume,
            pages: chapter.attributes.pages,
            language: chapter.attributes.translatedLanguage,
            publishAt: chapter.attributes.publishAt,
            scanlationGroups: groups.map(g => ({
              id: g.id,
              name: g.name,
              isOfficial: g.isOfficial
            }))
          };
        });

        return {
          chapters: results,
          total: response.total ?? results.length,
          offset: input.offset,
          limit: input.limit
        };
      } catch (error) {
        log.error('Failed to search MangaDex chapters', {
          mangadexId: input.mangadexId,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }),

  /**
   * Get download info for a chapter (preview)
   */
  getDownloadInfo: publicProcedure
    .input(z.object({
      chapterId: z.string()
    }))
    .query(async ({ input }) => {
      try {
        const images = await mangadexClient.getChapterImages(input.chapterId);
        const config = await mangadexConfigService.getDownloadConfig();

        // Calculate estimated sizes
        // Full quality: ~500KB per page average
        // Data saver: ~150KB per page average
        const pageCount = images.chapter.data.length;
        const estimatedFullSize = pageCount * 500 * 1024; // bytes
        const estimatedDataSaverSize = pageCount * 150 * 1024;

        return {
          chapterId: input.chapterId,
          pageCount,
          hasDataSaver: images.chapter.dataSaver.length > 0,
          estimatedSize: {
            full: estimatedFullSize,
            dataSaver: estimatedDataSaverSize
          },
          defaultQuality: config.dataSaverMode ? 'dataSaver' : 'full'
        };
      } catch (error) {
        log.error('Failed to get download info', {
          chapterId: input.chapterId,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }),

  /**
   * Start a single chapter download
   */
  startDownload: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      mangadexChapterId: z.string(),
      chapterNumber: z.number().optional(),
      quality: z.enum(['full', 'dataSaver']).default('full'),
      destinationPath: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      try {
        await assertDownloadEnabled();
        log.info('Starting MangaDex download', input);

        const manga = await prisma.manga.findUnique({
          where: { id: input.mangaId },
          include: { Library: true },
        });
        if (!manga) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
        }

        const chapterNumber = input.chapterNumber ?? 0;
        const destinationPath = input.destinationPath ?? resolveDestinationPath(manga, chapterNumber);

        const existingChapter = await prisma.chapter.findUnique({
          where: { mangadexId: input.mangadexChapterId },
          select: { id: true },
        });

        const enqueued = await prisma.$transaction((tx) =>
          enqueueMangadexDownload(tx, {
            mangaId: input.mangaId,
            mangaTitle: manga.title,
            mangadexChapterId: input.mangadexChapterId,
            chapterNumber,
            quality: input.quality,
            destinationPath,
            existingChapterId: existingChapter?.id ?? null,
            jobMetadataKind: 'chapter',
          }),
        );

        const manager = await getNativeDownloadManager();
        await manager.queueDownload(enqueued.downloadId);

        log.info('MangaDex download enqueued', {
          downloadId: enqueued.downloadId,
          jobId: String(enqueued.jobId),
          mangadexChapterId: input.mangadexChapterId,
          destinationPath,
        });

        return {
          downloadId: enqueued.downloadId,
          status: 'QUEUED',
          message: 'Download queued successfully',
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        log.error('Failed to start MangaDex download', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to queue MangaDex download',
          cause: error,
        });
      }
    }),

  /**
   * Start batch download of multiple chapters
   */
  startBatchDownload: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      chapters: z.array(z.object({
        mangadexChapterId: z.string(),
        chapterNumber: z.number().optional()
      })),
      quality: z.enum(['full', 'dataSaver']).default('full')
    }))
    .mutation(async ({ input }) => {
      try {
        await assertDownloadEnabled();
        log.info('Starting MangaDex batch download', {
          mangaId: input.mangaId,
          chapterCount: input.chapters.length,
        });

        const manga = await prisma.manga.findUnique({
          where: { id: input.mangaId },
          include: { Library: true },
        });
        if (!manga) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
        }

        const existingChapters = await prisma.chapter.findMany({
          where: { mangadexId: { in: input.chapters.map(c => c.mangadexChapterId) } },
          select: { id: true, mangadexId: true },
        });
        const chapterIdByMangadexId = new Map(
          existingChapters.flatMap(c => (c.mangadexId ? [[c.mangadexId, c.id] as const] : [])),
        );

        const enqueueOpts = input.chapters.map((ch) => {
          const chapterNumber = ch.chapterNumber ?? 0;
          return {
            mangaId: input.mangaId,
            mangaTitle: manga.title,
            mangadexChapterId: ch.mangadexChapterId,
            chapterNumber,
            quality: input.quality,
            destinationPath: resolveDestinationPath(manga, chapterNumber),
            existingChapterId: chapterIdByMangadexId.get(ch.mangadexChapterId) ?? null,
            jobMetadataKind: 'batch_chapter' as const,
          };
        });

        const downloadIds = await prisma.$transaction(async (tx) => {
          const ids: string[] = [];
          for (const opts of enqueueOpts) {
            // eslint-disable-next-line no-await-in-loop -- sequential creates inside a single transaction
            const result = await enqueueMangadexDownload(tx, opts);
            ids.push(result.downloadId);
          }
          return ids;
        });

        const manager = await getNativeDownloadManager();
        await Promise.all(downloadIds.map(id => manager.queueDownload(id)));

        log.info('MangaDex batch download enqueued', { count: downloadIds.length });

        return {
          queuedCount: downloadIds.length,
          status: 'QUEUED',
          message: `${downloadIds.length} chapters queued for download`,
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        log.error('Failed to start batch download', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to queue MangaDex batch download',
          cause: error,
        });
      }
    }),

  /**
   * Get the MangaDex download-side config (indexer settings).
   * `enabled` here is `mangadex.download.enabled` — distinct from the
   * metadata-provider toggle.
   */
  getDownloadConfig: publicProcedure.query(async () => {
    return mangadexConfigService.getDownloadConfig();
  }),

  /**
   * Update the MangaDex download-side config.
   * `preferredLanguage` is shared with the metadata role — writing it here
   * also affects metadata search.
   */
  updateDownloadConfig: protectedProcedure
    .input(z.object({
      enabled: z.boolean().optional(),
      preferredLanguage: z.string().optional(),
      dataSaverMode: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      log.info('Updating MangaDex download config', input);
      const updates: Parameters<typeof mangadexConfigService.updateDownloadConfig>[0] = {};
      if (input.enabled !== undefined) updates.enabled = input.enabled;
      if (input.preferredLanguage !== undefined) updates.preferredLanguage = input.preferredLanguage;
      if (input.dataSaverMode !== undefined) updates.dataSaverMode = input.dataSaverMode;
      await mangadexConfigService.updateDownloadConfig(updates);
      // publicProcedure caches getDownloadConfig results for 30s; clear so
      // the UI's refetch sees the new value immediately.
      const { cache } = await import('@/server/cache/cache-adapter');
      await cache.clear('trpc:nativeDownload.getDownloadConfig:*');
      return { success: true };
    }),

  /**
   * Get the MangaDex metadata-side config (metadata-provider settings).
   * `enabled` here is `mangadex.enabled`.
   */
  getMetadataConfig: publicProcedure.query(async () => {
    return mangadexConfigService.getMetadataConfig();
  }),

  /**
   * Update the MangaDex metadata-side config.
   * `preferredLanguage` is shared with the download role — writing it here
   * also affects chapter downloads.
   */
  updateMetadataConfig: protectedProcedure
    .input(z.object({
      enabled: z.boolean().optional(),
      preferredLanguage: z.string().optional(),
      includeAdult: z.boolean().optional(),
      defaultContentRating: z.array(z.enum(['safe', 'suggestive', 'erotica', 'pornographic'])).optional(),
    }))
    .mutation(async ({ input }) => {
      log.info('Updating MangaDex metadata config', input);
      const updates: Parameters<typeof mangadexConfigService.updateMetadataConfig>[0] = {};
      if (input.enabled !== undefined) updates.enabled = input.enabled;
      if (input.preferredLanguage !== undefined) updates.preferredLanguage = input.preferredLanguage;
      if (input.includeAdult !== undefined) updates.includeAdult = input.includeAdult;
      if (input.defaultContentRating !== undefined) updates.defaultContentRating = input.defaultContentRating;
      await mangadexConfigService.updateMetadataConfig(updates);
      // publicProcedure caches getMetadataConfig results for 30s; clear so
      // the UI's refetch sees the new value immediately.
      const { cache } = await import('@/server/cache/cache-adapter');
      await cache.clear('trpc:nativeDownload.getMetadataConfig:*');
      return { success: true };
    }),

  /**
   * Health check for MangaDex API
   */
  healthCheck: publicProcedure.query(async () => {
    const isHealthy = await mangadexClient.healthCheck();
    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date()
    };
  })
});
