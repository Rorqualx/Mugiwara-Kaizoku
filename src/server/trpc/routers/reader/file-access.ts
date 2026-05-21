/**
 * Reader Router - File Access Module
 *
 * Handles chapter file access operations with three-tier caching.
 *
 * Procedures:
 * - getChapterFile: Retrieve chapter file information with hot/regular/DB caching
 *
 * Extracted from: reader.ts (lines 95-182)
 */

import fs from 'fs/promises';
import path from 'path';

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { hotCacheProvider } from '@/server/cache/HotDataCacheProvider';
import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { switchActiveChapterFile } from '@/server/services/library/scanner/chapter-creator/chapter-file-service';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import { getUserId, fileAccessService, type ChapterFileInfo } from './utils';

export const readerFileAccessRouter = router({
  getChapterFile: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      chapterId: z.number()
    }))
    // eslint-disable-next-line complexity -- 3-tier caching + ChapterFile resolution requires branching
    .query(async ({ ctx, input }): Promise<ChapterFileInfo> => {
      const cacheKey = `chapter:${input.chapterId}`;

      // 1. Check hot cache first (2-5ms) - fastest path for active reading
      const hotCached = await hotCacheProvider.getHot<ChapterFileInfo>('chapter', cacheKey);
      if (hotCached) {
        logger.debug(`Hot cache hit for chapter ${input.chapterId}`);
        return hotCached;
      }

      // 2. Check regular cache (15-30ms) - second fastest path
      const cached = await cacheProvider.get<ChapterFileInfo>(cacheKey, 'chapters');
      if (cached) {
        logger.debug(`Regular cache hit for chapter ${input.chapterId}`);
        // Auto-promote to hot cache since this is an active read
        hotCacheProvider.setHot('chapter', cacheKey, cached, {
          forceHot: true,
          ttl: 3600,
          tags: ['reader', 'chapter']
        }).catch((err: unknown) =>
          logger.debug('Failed to promote chapter to hot cache:', err)
        );
        return cached;
      }

      // 3. Database query (30-50ms) - slowest path, only on first access
      logger.debug(`Cache miss for chapter ${input.chapterId}, fetching from database`);

      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.chapterId },
        include: {
          Manga: true,
          chapterFiles: {
            select: { id: true, filePath: true, sourceType: true, pageStart: true, pageEnd: true, pageCount: true, isActive: true },
          },
        },
      });
      if (!chapter) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chapter not found'
        });
      }
      if (chapter.mangaId !== input.mangaId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Chapter does not belong to this manga'
        });
      }

      // Validate user has access
      const hasAccess = fileAccessService.validateAccess(getUserId(ctx), input.mangaId);
      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied'
        });
      }

      const activeFile = chapter.chapterFiles.find((f) => f.isActive);
      const pageStart = activeFile?.pageStart ?? null;
      const pageEnd = activeFile?.pageEnd ?? null;
      const hasPageRange = pageStart !== null && pageEnd !== null;
      const effectivePageCount = hasPageRange
        ? (pageEnd - pageStart + 1)
        : (chapter.pageCount ?? chapter.pages ?? 0);

      const result: ChapterFileInfo = {
        filePath: activeFile?.filePath ?? chapter.filePath,
        format: chapter.fileFormat ?? 'cbz',
        pageCount: effectivePageCount,
        title: chapter.title,
        chapterNumber: chapter.index,
        downloadStatus: chapter.downloadStatus,
        sourceType: activeFile?.sourceType ?? undefined,
        pageStart: activeFile?.pageStart ?? undefined,
        pageEnd: activeFile?.pageEnd ?? undefined,
        fileSourceCount: chapter.chapterFiles.length,
      };

      // 4. Store in both cache layers for future requests
      await Promise.all([
        // Regular cache with 1 hour TTL
        cacheProvider.set(cacheKey, result, {
          ttl: 3600,
          namespace: 'chapters',
          tags: ['chapter', `manga:${input.mangaId}`]
        }),
        // Hot cache with force promotion (active reading session)
        hotCacheProvider.setHot('chapter', cacheKey, result, {
          forceHot: true,
          ttl: 3600,
          tags: ['reader', 'chapter', 'active-read']
        })
      ]).catch((err: unknown) =>
        logger.warn('Failed to cache chapter file info:', err)
      );

      return result;
    }),

  /** List all file sources for a chapter */
  getChapterFileSources: protectedProcedure
    .input(z.object({ chapterId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Validate ownership: chapter → manga → user access
      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.chapterId },
        select: { mangaId: true },
      });
      if (!chapter) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chapter not found' });
      }
      const hasAccess = fileAccessService.validateAccess(getUserId(ctx), chapter.mangaId);
      if (!hasAccess) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      const sources = await ctx.prisma.chapterFile.findMany({
        where: { chapterId: input.chapterId },
        select: {
          id: true,
          filePath: true,
          fileName: true,
          fileSize: true,
          isActive: true,
          sourceType: true,
          pageStart: true,
          pageEnd: true,
          pageCount: true,
          importedAt: true,
        },
        orderBy: [{ isActive: 'desc' }, { importedAt: 'desc' }],
      });

      return sources;
    }),

  /** Switch active file source for a chapter */
  switchChapterFileSource: protectedProcedure
    .input(z.object({
      chapterId: z.number(),
      chapterFileId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate ownership: chapter → manga → user access
      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.chapterId },
        select: { mangaId: true },
      });
      if (!chapter) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chapter not found' });
      }
      const hasAccess = fileAccessService.validateAccess(getUserId(ctx), chapter.mangaId);
      if (!hasAccess) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      await switchActiveChapterFile(input.chapterId, input.chapterFileId);

      // Invalidate caches for this chapter
      const validationKey = `chapter:validation:${input.chapterId}`;
      const infoKey = `chapter:info:${input.chapterId}`;
      const fileKey = `chapter:${input.chapterId}`;

      await Promise.all([
        cacheProvider.del(validationKey, 'chapters'),
        cacheProvider.del(infoKey, 'chapters'),
        cacheProvider.del(fileKey, 'chapters'),
      ]).catch((err: unknown) =>
        logger.warn('Failed to invalidate chapter caches after source switch:', err)
      );

      // Clear extracted page cache directory
      const baseDir = process.env['MANGA_FILES_DIR'] ?? process.cwd() + '/data/cache';
      const cacheDir = path.join(baseDir, 'extracted', `manga-${chapter.mangaId}`, `chapter-${input.chapterId}`);
      await fs.rm(cacheDir, { recursive: true, force: true }).catch(() => {
        // Ignore if directory doesn't exist
      });

      logger.info('Switched chapter file source', {
        chapterId: input.chapterId,
        chapterFileId: input.chapterFileId,
      });

      return { success: true };
    }),
});
