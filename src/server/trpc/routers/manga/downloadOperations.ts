// @file-size-justified: pre-existing 607-line file; splitting download router is a separate refactor task
/** Download Operations Router - handles all download-related manga operations */

import { Chapter as ChapterEntity, ChapterStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { enqueueDownloadTask } from '@/server/queue/download';
import type { IDownloadWorkerData } from '@/server/queue/download';
import { DownloadManager } from '@/server/services/download/downloadManager';
import { loadAcceptedTitles } from '@/server/services/prowlarr/accepted-titles';
import { ProwlarrMangaSearch } from '@/server/services/prowlarr/mangaSearch';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import type {
  DownloadJobPayload,
  DownloadJobResult,
  JobError
} from '@/types/api/manga-router-types';
import { isJob } from '@/types/api/manga-router-types';
import { DownloadMethod, DownloadMode } from '@/types/search.types';
import {
  isSuccess,
  isError
} from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { logInfo, logError, EventType, EventSource } from '@/utils/system-event-logger';

import {
  buildResetResult,
  invalidateMangaCacheFor,
  runDispatchForReset,
  type ResetFailedDownloadsResult,
} from './resetFailedDownloadsHelpers';


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) return (obj as Record<string, unknown>)[key];
  return undefined;
}

const downloadSchema = z.object({ mangaId: z.number(), chapterIndex: z.number().optional() });

async function downloadSingleChapter(
  manga: { id: number; title: string; Chapter: unknown[] },
  chapterIndex: number
): Promise<{ success: boolean; message: string }> {
  const findChapterByIndex = (chapters: unknown[], targetIndex: number): unknown => {
    return chapters.find((c) => isRecord(c) && safeGet(c, 'index') === targetIndex);
  };

  const chapter = findChapterByIndex(manga.Chapter, chapterIndex);
  if (!chapter) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Chapter with index ${chapterIndex} not found.`
    });
  }

  const chapterRecord = isRecord(chapter) ? chapter : {};
  const downloadData: IDownloadWorkerData = {
    mangaId: manga.id,
    chapterIndex: chapterRecord['index'] as number
  };

  await enqueueDownloadTask(downloadData);
  logger.info(`Successfully enqueued download task for manga ID ${manga.id}, chapter ID ${chapterRecord["id"]}`);

  await logInfo(`Started downloading chapter ${chapterRecord['index']} of ${manga.title}`, EventType.DOWNLOAD_STARTED, EventSource.DOWNLOAD, {
    relatedEntityId: toStringId(manga.id),
    relatedEntityType: 'manga',
    details: {
      mangaTitle: manga.title,
      chapterIndex: chapterRecord['index'],
      chapterId: chapterRecord['id']
    }
  });

  return {
    success: true,
    message: `Started downloading chapter ${chapterRecord['index'] ?? 'unknown'} of ${manga.title}`
  };
}

async function downloadAllChapters(
  manga: { id: number; title: string; Chapter: Array<{ index: number }> }
): Promise<{ success: boolean; message: string }> {
  await Promise.all(
    manga.Chapter.map(async (chapter) => {
      const downloadData: IDownloadWorkerData = {
        mangaId: manga.id,
        chapterIndex: chapter.index
      };
      await enqueueDownloadTask(downloadData);
    })
  );

  logger.info(`Successfully enqueued download tasks for all chapters of manga ID ${manga.id}`);

  await logInfo(`Started downloading all chapters of ${manga.title}`, EventType.DOWNLOAD_STARTED, EventSource.DOWNLOAD, {
    relatedEntityId: toStringId(manga.id),
    relatedEntityType: 'manga',
    details: {
      mangaTitle: manga.title,
      chapterCount: manga.Chapter.length
    }
  });

  return {
    success: true,
    message: `Started downloading all chapters of ${manga.title}`
  };
}

export const downloadRouter = router({
  download: protectedProcedure.input(downloadSchema).mutation(async ({ input, ctx }): Promise<{ success: boolean; message: string }> => {
    const { mangaId, chapterIndex } = input;
    logger.info(`Downloading manga ID ${mangaId}${chapterIndex !== undefined ? `, chapter index ${chapterIndex}` : ' (all chapters)'}`);

    const manga = await ctx.prisma.manga.findUnique({
      where: { id: mangaId },
      include: { Chapter: true }
    });

    if (!manga) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found.' });
    }

    if (manga.Chapter.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Manga has no chapters to download.' });
    }

    try {
      let result: { success: boolean; message: string };
      if (chapterIndex !== undefined) {
        result = await downloadSingleChapter(manga, chapterIndex);
      } else {
        result = await downloadAllChapters(manga);
      }

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'download:started',
        source: 'download-router',
        message: result.message,
        data: {
          mangaId,
          mangaTitle: manga.title,
          chapterIndex,
          isAllChapters: chapterIndex === undefined,
        },
      });

      return result;
    } catch (error: unknown) {
      logger.error(`Error downloading manga ID ${mangaId}: ${error instanceof Error ? error.message : String(error)}`);
      await logError(`Failed to download manga: ${manga.title}`, EventSource.DOWNLOAD, error, {
        relatedEntityId: toStringId(mangaId),
        relatedEntityType: 'manga',
        details: { mangaTitle: manga.title, chapterIndex }
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to download: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }),

  bulkDownload: protectedProcedure.input(z.object({
    mangaId: z.number(),
    chapterIds: z.array(z.number()),
    method: z.enum(['PROWLARR', 'DIRECT_URL']),
    clientType: z.string().optional(),
    format: z.enum(['cbz', 'pdf', 'raw']).optional()
  })).mutation(async ({ input }): Promise<{ success: boolean; message: string; downloadId?: string }> => {
    const { mangaId, chapterIds, method, clientType, format } = input;
    logger.info(`Bulk download request: ${chapterIds.length} chapters, method=${method}`);

    const downloadManager = new DownloadManager();
    const request = {
      mangaId,
      chapterIds,
      method: method as DownloadMethod,
      mode: DownloadMode.BULK,
      ...(clientType !== undefined && { clientType }),
      ...(format !== undefined && { format })
    };

    const result = await downloadManager.processDownloadRequest(request);
    if (isError(result)) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: result.error instanceof Error ? result.error.message : String(result.error)
      });
    }

    const response: { success: boolean; message: string; downloadId?: string } = {
      success: true,
      message: `Started bulk download of ${chapterIds.length} chapters`
    };

    if (isSuccess(result) && result.data.taskId) {
      response.downloadId = String(result.data.taskId);
    }

    // Emit WebSocket event for real-time sync
    void realtimeEmitter.emitSystemEvent({
      eventType: 'download:bulk:started',
      source: 'download-router',
      message: response.message,
      data: {
        mangaId,
        chapterCount: chapterIds.length,
        method,
        downloadId: response.downloadId,
      },
    });

    return response;
  }),

  searchProwlarr: publicProcedure.input(z.object({
    query: z.string(),
    mangaId: z.number()
  })).query(async ({ input }): Promise<unknown[]> => {
    const { query, mangaId } = input;
    logger.info(`[Prowlarr Search] Starting search for: "${query}" (manga ${mangaId})`);

    const acceptedTitles = await loadAcceptedTitles(mangaId);
    const prowlarrSearch = new ProwlarrMangaSearch();
    const results = await prowlarrSearch.searchManga(query, {
      mangaId,                // Scopes the post-search blocklist check (was global-blind).
      acceptedTitles,         // Drives the relevance gate (canonical + synonyms).
      categories: [7000],     // Search entire Books category (includes Comics, Mags, EBooks)
      limit: 100,             // Max 100 results
      maxage: 365,            // Only results from last year
      minsize: 10485760       // Min 10MB (filters junk/fake releases)
    });

    if (isError(results)) {
      logger.error(`[Prowlarr Search] Search failed:`, results.error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: results.error instanceof Error ? results.error.message : String(results.error)
      });
    }

    if (isSuccess(results)) {
      logger.info(`[Prowlarr Search] Returning ${results.data.results.length} results`);
      return results.data.results;
    }

    logger.warn(`[Prowlarr Search] No results returned for query: "${query}"`);
    return [];
  }),

  getChapterDownloadHistory: publicProcedure.input(z.object({
    chapterId: z.number()
  })).query(async ({ input }): Promise<Array<{
    timestamp: Date;
    status: string;
    source: string;
    size?: string;
    duration?: string;
    error?: string;
  }>> => {
    const history = await prisma.jobs.findMany({
      where: {
        chapter_id: input.chapterId,
        job_type: 'chapter_download'
      },
      orderBy: { created_at: 'desc' },
      take: 20
    });

    return history.map(job => {
      const payload = isJob(job) ? job.payload as DownloadJobPayload : undefined;
      const result = isJob(job) ? job.result as DownloadJobResult : undefined;
      const error = isJob(job) ? job.last_error as JobError : undefined;

      const historyEntry: {
        timestamp: Date;
        status: string;
        source: string;
        size?: string;
        duration?: string;
        error?: string;
      } = {
        timestamp: job.created_at,
        status: String(job.status),
        source: payload?.clientType ?? payload?.method ?? 'unknown'
      };

      if (result?.fileSize !== undefined) {
        historyEntry.size = `${(result.fileSize / (1024 * 1024)).toFixed(1)} MB`;
      }

      if (job.processing_time_ms !== null) {
        historyEntry.duration = `${(job.processing_time_ms / 1000).toFixed(0)}s`;
      }

      if (error?.message !== undefined) {
        historyEntry.error = error.message;
      }

      return historyEntry;
    });
  }),

  getMangaDownloadHistory: publicProcedure.input(z.object({
    mangaId: z.number()
  })).query(async ({ input }): Promise<Array<{
    timestamp: Date;
    status: string;
    source: string;
    mode: string;
    releaseTitle: string;
    size?: string;
    duration?: string;
    error?: string;
  }>> => {
    const history = await prisma.jobs.findMany({
      where: {
        manga_id: input.mangaId,
        job_type: 'chapter_download',
        chapter_id: null // Only get pack/volume downloads (no specific chapter)
      },
      orderBy: { created_at: 'desc' },
      take: 20
    });

    return history.map(job => {
      const payload = isJob(job) ? job.payload as DownloadJobPayload : undefined;
      const result = isJob(job) ? job.result as DownloadJobResult : undefined;
      const error = isJob(job) ? job.last_error as JobError : undefined;

      const historyEntry: {
        timestamp: Date;
        status: string;
        source: string;
        mode: string;
        releaseTitle: string;
        size?: string;
        duration?: string;
        error?: string;
      } = {
        timestamp: job.created_at,
        status: String(job.status),
        source: payload?.clientType ?? payload?.method ?? 'unknown',
        mode: payload?.mode ?? 'PACK',
        releaseTitle: result?.releaseTitle ?? payload?.prowlarrResult?.title ?? 'Unknown'
      };

      if (result?.fileSize !== undefined) {
        historyEntry.size = `${(result.fileSize / (1024 * 1024)).toFixed(1)} MB`;
      }

      if (job.processing_time_ms !== null) {
        historyEntry.duration = `${(job.processing_time_ms / 1000).toFixed(0)}s`;
      }

      if (error?.message !== undefined) {
        historyEntry.error = error.message;
      }

      return historyEntry;
    });
  }),

  downloadFromProwlarr: protectedProcedure.input(z.object({
    mangaId: z.number(),
    prowlarrId: z.string(),
    clientType: z.string(),
    prowlarrResult: z.unknown().optional(),
    chapterId: z.number().optional() // Add optional chapterId
  })).mutation(async ({ input }): Promise<{ success: boolean; message: string; downloadId?: string }> => {
    const { mangaId, prowlarrId, clientType, prowlarrResult, chapterId } = input;
    logger.info(`Downloading from Prowlarr: ${prowlarrId} via ${clientType}${chapterId ? ` for chapter ${chapterId}` : ''}`);

    const resultData: unknown = prowlarrResult;
    if (!resultData) {
      logger.error('[downloadFromProwlarr] prowlarrResult is missing!');
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Prowlarr search result data' });
    }

    const downloadManager = new DownloadManager();
    const request = {
      mangaId,
      chapterIds: chapterId ? [chapterId] : [0], // Use chapterId if provided, otherwise placeholder for pack downloads
      method: DownloadMethod.PROWLARR,
      mode: DownloadMode.PACK,
      clientType,
      prowlarrResult: isRecord(resultData) ? resultData : {},
      ...(chapterId && { chapterId }) // Only include chapterId when defined
    };

    const result = await downloadManager.processDownloadRequest(request);
    if (isError(result)) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: result.error instanceof Error ? result.error.message : String(result.error)
      });
    }

    const response: { success: boolean; message: string; downloadId?: string } = {
      success: true,
      message: 'Download started'
    };

    if (isSuccess(result) && result.data.taskId) {
      response.downloadId = String(result.data.taskId);
    }

    // Emit WebSocket event for real-time sync
    void realtimeEmitter.emitSystemEvent({
      eventType: 'download:prowlarr:started',
      source: 'download-router',
      message: 'Prowlarr download started',
      data: {
        mangaId,
        prowlarrId,
        clientType,
        chapterId,
        downloadId: response.downloadId,
      },
    });

    return response;
  }),

  quickDownload: protectedProcedure.input(z.object({
    mangaId: z.number(),
    chapterId: z.number()
  })).mutation(async ({ input, ctx }): Promise<{ success: boolean; message: string }> => {
    const { mangaId, chapterId } = input;
    logger.info(`Quick download for chapter ${chapterId} of manga ${mangaId}`);

    const manga = await ctx.prisma.manga.findUnique({
      where: {
        id: mangaId
      },
      include: {
        Chapter: true
      }
    });

    if (!manga) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Manga not found.'
      });
    }

    const chapter = manga["Chapter"].find((ch: ChapterEntity) => ch["id"] === chapterId);
    if (!chapter) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Chapter not found.' });
    }

    const downloadData: IDownloadWorkerData = {
      mangaId,
      chapterIndex: chapter.index,
      chapterId: chapter.id,
    };

    await enqueueDownloadTask(downloadData);

    // Emit WebSocket event for real-time sync
    void realtimeEmitter.emitSystemEvent({
      eventType: 'download:quick:started',
      source: 'download-router',
      message: `Started downloading chapter ${chapter.index}`,
      data: {
        mangaId,
        mangaTitle: manga.title,
        chapterId,
        chapterIndex: chapter.index,
      },
    });

    return {
      success: true,
      message: `Started downloading chapter ${chapter.index}`
    };
  }),

  quickDownloadWithSearch: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      chapterId: z.number().optional(),
      chapterIds: z.array(z.number()).optional(),
      volumeNumber: z.number().optional(),
      mode: z.enum(['SINGLE', 'BULK', 'VOLUME']),
      criteria: z.object({
        preferredFormats: z.array(z.string()).optional(),
        preferOfficial: z.boolean().optional(),
        preferComplete: z.boolean().optional(),
        minSeeders: z.number().optional(),
        seedersWeight: z.number().optional(),
        maxAgeDays: z.number().optional(),
        minSizeMB: z.number().optional(),
        maxSizeMB: z.number().optional(),
        preferredLanguages: z.array(z.string()).optional(),
        skipBlocklisted: z.boolean().optional()
      }).optional()
    }))
    .mutation(async ({ input, ctx }): Promise<unknown> => {
      const { mangaId, chapterId, chapterIds, volumeNumber, mode, criteria } = input;
      logger.info(`[QuickDownload] Request: ${mode} mode for manga ${mangaId}`, { chapterId, chapterCount: chapterIds?.length, volumeNumber, hasCriteria: !!criteria });

      if (mode === 'SINGLE' && !chapterId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'chapterId is required for SINGLE mode' });
      }
      if (mode === 'BULK' && (!chapterIds || chapterIds.length === 0)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'chapterIds array is required for BULK mode' });
      }
      if (mode === 'VOLUME' && volumeNumber === undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'volumeNumber is required for VOLUME mode' });
      }

      try {
        const { QuickDownloadService } = await import('../../../services/quickDownload/autoSelector');
        const quickDownloadService = new QuickDownloadService(ctx.prisma);
        const quickDownloadInput = input as Parameters<typeof quickDownloadService.executeQuickDownload>[0];
        const response = await quickDownloadService.executeQuickDownload(
          quickDownloadInput,
          ctx.session.user.id,
        );

        logger.info(`[QuickDownload] Completed: ${response.summary.started}/${response.summary.total} started`);
        void realtimeEmitter.emitSystemEvent({
          eventType: 'download:quick-search:completed',
          source: 'download-router',
          message: `Quick download completed: ${response.summary.started}/${response.summary.total} started`,
          data: {
            mangaId,
            mode,
            chapterId,
            chapterIds,
            volumeNumber,
            summary: response.summary,
          },
        });

        return response;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[QuickDownload] Failed:`, error);

        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Quick Download failed: ${errorMessage}` });
      }
    }),

  downloadFromUrl: protectedProcedure.input(z.object({
    mangaId: z.number(),
    chapterIds: z.array(z.number()),
    url: z.string().url(),
    clientType: z.string()
  })).mutation(async ({ input }): Promise<{ success: boolean; message: string; downloadId?: string }> => {
    const { mangaId, chapterIds, url, clientType } = input;
    logger.info(`Direct URL download for manga ${mangaId}: ${url}`);

    const manga = await prisma.manga.findUnique({
      where: {
        id: mangaId
      },
      include: {
        Chapter: true
      }
    });

    if (!manga) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
    }

    const chapters = manga["Chapter"].filter((ch: ChapterEntity) => chapterIds.includes(ch["id"]));
    if (chapters.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No valid chapters found' });
    }

    const downloadManager = new DownloadManager();
    const downloadRequest = {
      mangaId,
      chapterIds,
      method: DownloadMethod.DIRECT_URL,
      mode: chapterIds.length > 1 ? DownloadMode.BULK : DownloadMode.MANUAL,
      clientType,
      directUrl: url
    };

    const result = await downloadManager.processDownloadRequest(downloadRequest);
    if (isError(result)) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error instanceof Error ? result.error.message : String(result.error) });
    }

    await logInfo(`Started direct URL download for ${chapterIds.length} chapters of ${manga["title"]}`, EventType.DOWNLOAD_STARTED, EventSource.DOWNLOAD, {
      relatedEntityId: toStringId(mangaId),
      relatedEntityType: 'manga',
      details: {
        mangaTitle: manga["title"],
        chapterCount: chapterIds.length,
        method: 'DIRECT_URL',
        url: url
      }
    });

    const response: { success: boolean; message: string; downloadId?: string } = {
      success: true,
      message: `Started downloading ${chapterIds.length} chapters from URL`
    };

    if (isSuccess(result) && result.data.taskId) response.downloadId = String(result.data.taskId);

    void realtimeEmitter.emitSystemEvent({
      eventType: 'download:url:started',
      source: 'download-router',
      message: response.message,
      data: {
        mangaId,
        mangaTitle: manga.title,
        chapterCount: chapterIds.length,
        url,
        clientType,
        downloadId: response.downloadId,
      },
    });

    return response;
  }),

  downloadFromGetComics: protectedProcedure.input(z.object({
    mangaId: z.number(),
    chapterIds: z.array(z.number()),
    getcomicsUrl: z.string().url()
  })).mutation(async ({ input }) => {
    const { getGetComicsService } = await import('../../../services/getcomics');

    logger.info(`[GetComics Download] Fetching links from: ${input.getcomicsUrl}`);

    const getcomicsService = getGetComicsService();
    const result = await getcomicsService.getDownloadLinks(input.getcomicsUrl);

    if (isError(result)) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: result.error instanceof Error ? result.error.message : 'Failed to get download links'
      });
    }

    if (isSuccess(result)) {
      const detailPage = result.data;

      logger.info(`[GetComics Download] Found ${detailPage.downloadLinks.length} download links`);

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'download:getcomics:links-fetched',
        source: 'download-router',
        message: `Found ${detailPage.downloadLinks.length} download links from GetComics`,
        data: {
          mangaId: input.mangaId,
          chapterIds: input.chapterIds,
          title: detailPage.title,
          totalLinks: detailPage.downloadLinks.length,
        },
      });

      return {
        success: true,
        title: detailPage.title,
        description: detailPage.description,
        coverUrl: detailPage.coverUrl,
        downloadLinks: detailPage.downloadLinks.map(link => ({
          url: link.url,
          host: link.host,
          label: link.label,
          isMirror: link.isMirror
        })),
        totalLinks: detailPage.downloadLinks.length
      };
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get download links from GetComics'
    });
  }),

  /**
   * Clears the per-chapter dispatch-attempt ledger for every ERROR chapter
   * in a manga (optionally narrowed to a single volume), flips them back to
   * PENDING, and re-runs the unified release search. The 7-day exhaustion
   * lookback in `loadFailedSourcesForManga` makes ordinary retries useless
   * once every source has failed once; this is the explicit user-driven
   * reset path.
   *
   * Also invalidates the Suwayomi reachability cache — if the user just
   * turned Suwayomi back on, the cache might still hold a stale "false" for
   * up to 60s, which would silently drop Suwayomi from the post-reset
   * dispatch's source list.
   */
  resetFailedDownloads: protectedProcedure
    .input(z.object({ id: z.number(), volumeNumber: z.number().optional() }))
    .mutation(async ({ input }): Promise<ResetFailedDownloadsResult> => {
      const { clearFailedAttemptsForManga } = await import('@/server/services/library/releaseDispatcher/dispatch-attempt');
      const clearedChapterIds = await clearFailedAttemptsForManga(input.id, input.volumeNumber);
      if (clearedChapterIds.length === 0) {
        return { success: true, clearedCount: 0, queuedCount: 0, uncoveredCount: 0, message: 'No failed chapters to reset' };
      }
      await prisma.chapter.updateMany({
        where: { id: { in: clearedChapterIds } },
        data: { downloadStatus: ChapterStatus.PENDING },
      });
      // Bust the manga.get cache so the per-volume "All chapters failed"
      // banner clears on the next refetch instead of sitting on the
      // pre-reset snapshot.
      await invalidateMangaCacheFor(input.id);
      const { invalidateSuwayomiReachabilityCache } = await import('@/server/services/suwayomi/server-reachable');
      invalidateSuwayomiReachabilityCache();
      // Await the dispatch so the response can report what actually happened.
      // Previously fire-and-forget: toast said "searching enabled sources…"
      // even when the dispatcher produced zero jobs (per-volume scope filter
      // too narrow, sources blocklisted, etc.) and the user had no signal.
      // The wait is bounded by Prowlarr / native search latency, typically
      // 5-15s; the mutation's isPending keeps the UI button in a loading
      // state for the duration.
      const summary = await runDispatchForReset(input.id, input.volumeNumber);
      const scopeLabel = input.volumeNumber !== undefined ? ` in Vol. ${input.volumeNumber}` : '';
      return buildResetResult(clearedChapterIds.length, summary, scopeLabel);
    }),

  /**
   * Manga-wide variant of {@link resetFailedDownloads}: clears every failed
   * chapter on the manga, resets them to PENDING, and fires a single BULK
   * dispatch. Saves the user from clicking per-volume reset 35 times on a
   * Berserk-sized manga.
   */
  resetAllFailedDownloads: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }): Promise<ResetFailedDownloadsResult> => {
      const { clearFailedAttemptsForManga } = await import('@/server/services/library/releaseDispatcher/dispatch-attempt');
      const clearedChapterIds = await clearFailedAttemptsForManga(input.id);
      if (clearedChapterIds.length === 0) {
        return { success: true, clearedCount: 0, queuedCount: 0, uncoveredCount: 0, message: 'No failed chapters to reset' };
      }
      await prisma.chapter.updateMany({
        where: { id: { in: clearedChapterIds } },
        data: { downloadStatus: ChapterStatus.PENDING },
      });
      await invalidateMangaCacheFor(input.id);
      const { invalidateSuwayomiReachabilityCache } = await import('@/server/services/suwayomi/server-reachable');
      invalidateSuwayomiReachabilityCache();
      const summary = await runDispatchForReset(input.id, undefined);
      return buildResetResult(clearedChapterIds.length, summary, '');
    }),

  /**
   * Single-chapter version of {@link resetFailedDownloads} — used by the
   * Actions-column retry button on a single ERROR row.
   */
  resetFailedDownloadForChapter: protectedProcedure
    .input(z.object({ chapterId: z.number() }))
    .mutation(async ({ input }): Promise<{ success: boolean; message: string }> => {
      const { clearFailedAttemptsForChapter } = await import('@/server/services/library/releaseDispatcher/dispatch-attempt');
      const cleared = await clearFailedAttemptsForChapter(input.chapterId);
      if (!cleared) {
        return { success: false, message: 'Chapter is not in ERROR state' };
      }
      const chapter = await prisma.chapter.update({
        where: { id: input.chapterId },
        data: { downloadStatus: ChapterStatus.PENDING },
        select: { id: true, mangaId: true },
      });
      const { invalidateSuwayomiReachabilityCache } = await import('@/server/services/suwayomi/server-reachable');
      invalidateSuwayomiReachabilityCache();
      const { runUnifiedReleaseSearch } = await import('@/server/services/library/releaseDispatcher/dispatch');
      void runUnifiedReleaseSearch(chapter.mangaId, {
        bypassRuleCheck: true,
        scope: { mode: 'SINGLE', chapterIds: [chapter.id] },
      }).catch((err: unknown) => {
        logger.error('Post-reset single-chapter dispatch failed', {
          mangaId: chapter.mangaId,
          chapterId: chapter.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
      return { success: true, message: 'Retrying chapter…' };
    }),
});
