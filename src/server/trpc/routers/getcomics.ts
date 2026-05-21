/**
 * GetComics tRPC Router
 *
 * Provides procedures for GetComics integration management including:
 * - Settings CRUD operations
 * - Search functionality
 * - Download link extraction
 * - Download queue management
 *
 * @module server/trpc/routers/getcomics
 */

import { JobType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { queueManager } from '@/server/queue/queueManager';
import { getGetComicsService } from '@/server/services/getcomics/getcomicsService';
import { generateDestPath } from '@/server/services/getcomics/hosts';
import { getConfigBoolean } from '@/server/utils/configReader';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { protectedProcedure, publicProcedure } from '../procedures';
import { router } from '../trpc';

import type { GetComicsSettings, Prisma } from '@prisma/client';

/**
 * Schema for updating GetComics settings
 */
const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  rateLimit: z.number().min(1).max(10).optional(),
  timeout: z.number().min(5000).max(120000).optional(),
  useFlareSolverr: z.boolean().optional(),
  preferredHosts: z.array(z.string()).optional(),
});

/**
 * Schema for GetComics search
 */
const searchSchema = z.object({
  query: z.string().min(1).max(200),
  page: z.number().min(1).default(1),
  /**
   * Origin of the search. When `comicbook`, the comicbook-tracking feature
   * flag must be enabled. `manga` keeps the existing GetComicsSettings.enabled
   * gate (handled inside the service).
   */
  context: z.enum(['manga', 'comicbook']).default('manga'),
});

/**
 * Schema for getting download links
 */
const getLinksSchema = z.object({
  detailUrl: z.string().url(),
});

/**
 * Schema for queueing a download
 */
const queueDownloadSchema = z.object({
  mangaId: z.number(),
  detailUrl: z.string().url(),
  downloadUrl: z.string().url(),
  host: z.string(),
  title: z.string(),
  volumeNumber: z.number().optional(),
  chapterNumber: z.number().optional(),
});

/**
 * Default settings when none exist
 */
const DEFAULT_SETTINGS: Omit<GetComicsSettings, 'createdAt' | 'updatedAt'> = {
  id: 'default',
  enabled: true,
  rateLimit: 1,
  timeout: 30000,
  useFlareSolverr: true,
  preferredHosts: ['mediafire', 'mega', 'direct', 'dropapk', 'userscloud', 'zippyshare'],
};

/**
 * GetComics Router
 */
export const getcomicsRouter = router({
  /**
   * Get current GetComics settings
   */
  getSettings: publicProcedure.query(async (): Promise<GetComicsSettings> => {
    let settings = await prisma.getComicsSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      // Create default settings if they don't exist
      settings = await prisma.getComicsSettings.create({
        data: DEFAULT_SETTINGS,
      });
      logger.info('[GetComics] Created default settings');
    }

    return settings;
  }),

  /**
   * Update GetComics settings
   */
  updateSettings: protectedProcedure
    .input(updateSettingsSchema)
    .mutation(async ({ input }): Promise<GetComicsSettings> => {
      // Build update data, only including fields that were provided
      const updateData: Prisma.GetComicsSettingsUpdateInput = {};

      if (input.enabled !== undefined) {
        updateData.enabled = input.enabled;
      }
      if (input.rateLimit !== undefined) {
        updateData.rateLimit = input.rateLimit;
      }
      if (input.timeout !== undefined) {
        updateData.timeout = input.timeout;
      }
      if (input.useFlareSolverr !== undefined) {
        updateData.useFlareSolverr = input.useFlareSolverr;
      }
      if (input.preferredHosts !== undefined) {
        updateData.preferredHosts = input.preferredHosts;
      }

      // Build create data with explicit values (not spreading input which has optional props)
      const createData = {
        id: 'default',
        enabled: input.enabled ?? DEFAULT_SETTINGS.enabled,
        rateLimit: input.rateLimit ?? DEFAULT_SETTINGS.rateLimit,
        timeout: input.timeout ?? DEFAULT_SETTINGS.timeout,
        useFlareSolverr: input.useFlareSolverr ?? DEFAULT_SETTINGS.useFlareSolverr,
        preferredHosts: input.preferredHosts ?? DEFAULT_SETTINGS.preferredHosts,
      };

      const settings = await prisma.getComicsSettings.upsert({
        where: { id: 'default' },
        create: createData,
        update: updateData,
      });

      // publicProcedure caches getSettings results for 30s; clear so the
      // UI's refetch (and the dispatcher's loadEnabledSources read) sees
      // the new value immediately.
      const { cache } = await import('@/server/cache/cache-adapter');
      await cache.clear('trpc:getcomics.getSettings:*');

      logger.info('[GetComics] Updated settings', { input });
      return settings;
    }),

  /**
   * Search GetComics for comics
   */
  search: publicProcedure
    .input(searchSchema)
    .query(async ({ input }): Promise<{
      results: Array<{
        id: string;
        title: string;
        detailUrl: string;
        coverUrl: string | null;
        format: string | null;
        year: number | null;
        description: string | null;
      }>;
      totalPages: number;
      currentPage: number;
    }> => {
      const { query, page, context } = input;

      logger.info('[GetComics] Search requested', { query, page, context });

      if (context === 'comicbook') {
        const trackingEnabled = await getConfigBoolean('comicvine.comicbookTrackingEnabled', false);
        if (!trackingEnabled) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Comicbook tracking is disabled. Enable it in Settings → Metadata → ComicVine.',
          });
        }
      }

      const service = getGetComicsService();
      const result = await service.searchComics(query);

      if (!isSuccess(result)) {
        logger.error('[GetComics] Search failed', { error: result.status === 'error' ? result.error.message : 'Unknown' });
        return {
          results: [],
          totalPages: 0,
          currentPage: page,
        };
      }

      return {
        results: result.data.map((r) => ({
          id: r.id,
          title: r.title,
          detailUrl: r.url,
          coverUrl: r.coverUrl ?? null,
          format: r.format ?? null,
          year: r.year ? parseInt(r.year, 10) : null,
          description: r.description ?? null,
        })),
        totalPages: 1, // GetComics doesn't provide pagination info easily
        currentPage: page,
      };
    }),

  /**
   * Get download links from a GetComics detail page
   */
  getDownloadLinks: publicProcedure
    .input(getLinksSchema)
    .query(async ({ input }): Promise<{
      title: string;
      description: string | null;
      coverUrl: string | null;
      links: Array<{
        host: string;
        url: string;
        label: string;
        isMirror: boolean;
      }>;
    }> => {
      const { detailUrl } = input;

      logger.info('[GetComics] Fetching download links', { detailUrl });

      const service = getGetComicsService();
      const result = await service.getDownloadLinks(detailUrl);

      if (!isSuccess(result)) {
        logger.error('[GetComics] Failed to get links', { error: result.status === 'error' ? result.error.message : 'Unknown' });
        return {
          title: '',
          description: null,
          coverUrl: null,
          links: [],
        };
      }

      return {
        title: result.data.title,
        description: result.data.description ?? null,
        coverUrl: result.data.coverUrl ?? null,
        links: result.data.downloadLinks.map((link) => ({
          host: link.host,
          url: link.url,
          label: link.label,
          isMirror: link.isMirror,
        })),
      };
    }),

  /**
   * Queue a download from GetComics
   */
  queueDownload: protectedProcedure
    .input(queueDownloadSchema)
    .mutation(async ({ input }): Promise<{
      success: boolean;
      jobId: string | null;
      message: string;
    }> => {
      const { mangaId, downloadUrl, title, volumeNumber, chapterNumber } = input;

      logger.info('[GetComics] Queueing download', { mangaId, downloadUrl });

      // Get manga and library path
      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        include: { Library: true },
      });

      if (!manga) {
        return {
          success: false,
          jobId: null,
          message: 'Manga not found',
        };
      }

      // For COMICBOOK rows, require the comicbook-tracking feature flag.
      // Manga downloads keep their existing GetComicsSettings.enabled gate.
      if (manga.mediaType === 'COMICBOOK') {
        const trackingEnabled = await getConfigBoolean('comicvine.comicbookTrackingEnabled', false);
        if (!trackingEnabled) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Comicbook tracking is disabled. Enable it in Settings → Metadata → ComicVine.',
          });
        }
      }

      // Generate destination path with issue-numbered format for comicbooks
      const destPath = generateDestPath(
        manga.Library.path,
        manga.title,
        volumeNumber,
        chapterNumber,
        'cbz',
        manga.mediaType === 'COMICBOOK' ? 'COMICBOOK' : 'MANGA',
      );

      // Queue the download job
      const jobId = await queueManager.enqueue(JobType.getcomics_download, {
        mangaId,
        downloadUrl,
        destPath,
        fileName: title,
        volumeId: volumeNumber,
        chapterId: chapterNumber,
      });

      logger.info('[GetComics] Download job queued', { jobId: String(jobId), mangaId, destPath });

      return {
        success: true,
        jobId: String(jobId),
        message: `Download queued: ${title}`,
      };
    }),

  /**
   * Get download history for GetComics
   */
  getDownloads: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      status: z.enum(['COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL']).optional(),
    }))
    .query(async ({ input }): Promise<{
      downloads: Array<{
        id: string;
        title: string;
        status: string;
        progress: number;
        host: string | null;
        createdAt: Date;
        completedAt: Date | null;
        error: string | null;
      }>;
      total: number;
    }> => {
      const { limit, offset, status } = input;

      logger.info('[GetComics] Fetching download history', { limit, offset, status });

      // Query downloads with optional status filter
      const downloads = await prisma.downloadHistory.findMany({
        where: status
          ? { source: 'getcomics', status }
          : { source: 'getcomics' },
        take: limit,
        skip: offset,
        orderBy: { startTime: 'desc' },
        include: { Manga: true },
      });

      const total = await prisma.downloadHistory.count({
        where: status
          ? { source: 'getcomics', status }
          : { source: 'getcomics' },
      });

      return {
        downloads: downloads.map((d) => ({
          id: String(d.id),
          title: d.Manga.title,
          status: d.status,
          progress: d.status === 'COMPLETED' ? 100 : d.status === 'PARTIAL' ? 50 : 0,
          host: null,
          createdAt: d.startTime,
          completedAt: d.endTime,
          error: d.error,
        })),
        total,
      };
    }),
});
