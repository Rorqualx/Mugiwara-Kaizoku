/**
 * Reader Router - Chapters Module
 *
 * Procedures:
 * - getReadableChapters: Get available chapters for reading
 * - getChapterNavigation: Navigation with hot/regular/DB caching
 * - verifyChapterFiles: Verify files exist on disk
 *
 * Extracted from: reader.ts (lines 566-732)
 */

import fs from 'fs/promises';
import path from 'path';

import { ChapterStatus } from '@prisma/client';
import { z } from 'zod';

import { hotCacheProvider } from '@/server/cache/HotDataCacheProvider';
import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';


// Type definitions for chapter navigation
interface ChapterNavInfo {
  id: number;
  index: number;
  title: string | null;
  pageCount: number | null;
}

interface NavigationResult {
  chapters: ChapterNavInfo[];
  currentChapter: ChapterNavInfo | null;
  prevChapter: ChapterNavInfo | null;
  nextChapter: ChapterNavInfo | null;
  currentIndex: number;
  totalChapters: number;
}

interface ChapterVerification {
  chapterId: number;
  exists: boolean;
  filePath: string | null;
  downloadStatus: ChapterStatus;
}

type VerificationMap = Record<number, ChapterVerification>;

/**
 * Build navigation result from chapters array and current chapter ID
 */
function buildNavigationResult(
  chapters: ChapterNavInfo[],
  chapterId: number
): NavigationResult {
  const currentIndex = chapters.findIndex((ch) => ch.id === chapterId);
  if (currentIndex === -1) {
    return { chapters, currentChapter: null, prevChapter: null, nextChapter: null, currentIndex: -1, totalChapters: chapters.length };
  }
  return {
    chapters,
    currentChapter: chapters[currentIndex] ?? null,
    prevChapter: currentIndex > 0 ? chapters[currentIndex - 1] ?? null : null,
    nextChapter: currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] ?? null : null,
    currentIndex,
    totalChapters: chapters.length,
  };
}

/**
 * Reader Chapters Router
 *
 * Handles chapter-related operations for the manga reader:
 * - Fetching readable chapters
 * - Chapter navigation with multi-tier caching
 * - File verification
 */
export const readerChaptersRouter = router({
  /**
   * Get readable chapters
   *
   * Returns all completed chapters for a manga that have file paths
   */
  getReadableChapters: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.chapter.findMany({
        where: {
          mangaId: input.mangaId,
          downloadStatus: ChapterStatus.COMPLETED,
          filePath: { not: null },
        },
        orderBy: { index: 'asc' },
      });
    }),

  /**
   * Get chapter navigation info (prev/next chapters) with caching
   *
   * Uses three-tier caching strategy:
   * 1. Hot cache (2-5ms)
   * 2. Regular cache (15-30ms)
   * 3. Database query (30-50ms)
   */
  getChapterNavigation: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        chapterId: z.number(),
      })
    )
    .query(async ({ ctx, input }): Promise<NavigationResult> => {
      const cacheKey = `nav:${input.mangaId}:${input.chapterId}`;

      // 1. Check hot cache first (2-5ms)
      const hotCached = await hotCacheProvider.getHot<NavigationResult>(
        'chapter',
        cacheKey
      );
      if (hotCached) {
        logger.debug(
          `Hot cache hit for navigation ${input.mangaId}:${input.chapterId}`
        );
        return hotCached;
      }

      // 2. Check regular cache (15-30ms)
      const cached = await cacheProvider.get<NavigationResult>(
        cacheKey,
        'navigation'
      );
      if (cached) {
        logger.debug(
          `Regular cache hit for navigation ${input.mangaId}:${input.chapterId}`
        );
        // Auto-promote to hot cache for active reading session
        hotCacheProvider
          .setHot('chapter', cacheKey, cached, {
            forceHot: true,
            ttl: 1800,
            tags: ['reader', 'navigation'],
          })
          .catch((err: unknown) =>
            logger.debug('Failed to promote navigation to hot cache:', err)
          );
        return cached;
      }

      // 3. Database query (30-50ms)
      logger.debug(
        `Cache miss for navigation ${input.mangaId}:${input.chapterId}, fetching from database`
      );

      // Get all readable chapters
      const chapters = await ctx.prisma.chapter.findMany({
        where: {
          mangaId: input.mangaId,
          downloadStatus: ChapterStatus.COMPLETED,
          filePath: { not: null },
        },
        orderBy: { index: 'asc' },
        select: {
          id: true,
          index: true,
          title: true,
          pageCount: true,
        },
      });

      // Build navigation result
      const result = buildNavigationResult(chapters, input.chapterId);

      // 4. Store in both cache layers
      await Promise.all([
        // Regular cache with 30 min TTL
        cacheProvider.set(cacheKey, result, {
          ttl: 1800,
          namespace: 'navigation',
          tags: ['navigation', `manga:${input.mangaId}`],
        }),
        // Hot cache with force promotion
        hotCacheProvider.setHot('chapter', cacheKey, result, {
          forceHot: true,
          ttl: 1800,
          tags: ['reader', 'navigation', 'active-read'],
        }),
      ]).catch((err: unknown) =>
        logger.warn('Failed to cache navigation info:', err)
      );

      return result;
    }),

  /**
   * Verify chapter files exist on disk
   *
   * Checks if the chapter files referenced in the database actually exist
   * on the filesystem
   */
  verifyChapterFiles: protectedProcedure
    .input(
      z.object({
        chapterIds: z.array(z.number()),
      })
    )
    .query(async ({ ctx, input }): Promise<VerificationMap> => {
      const baseDir = process.env['MANGA_FILES_DIR'] ?? '/data/manga';

      // Get all requested chapters
      const chapters = await ctx.prisma.chapter.findMany({
        where: {
          id: { in: input.chapterIds },
        },
        select: {
          id: true,
          filePath: true,
          downloadStatus: true,
        },
      });

      // Verify each chapter file exists
      const verificationResults = await Promise.all(
        chapters.map(async (chapter): Promise<ChapterVerification> => {
          if (!chapter.filePath) {
            return {
              chapterId: chapter.id,
              exists: false,
              filePath: null,
              downloadStatus: chapter.downloadStatus,
            };
          }

          const fullPath = path.isAbsolute(chapter.filePath)
            ? chapter.filePath
            : path.join(baseDir, chapter.filePath);

          try {
            await fs.access(fullPath, fs.constants.R_OK);
            return {
              chapterId: chapter.id,
              exists: true,
              filePath: chapter.filePath,
              downloadStatus: chapter.downloadStatus,
            };
          } catch {
            return {
              chapterId: chapter.id,
              exists: false,
              filePath: chapter.filePath,
              downloadStatus: chapter.downloadStatus,
            };
          }
        })
      );

      // Create a map for easy lookup
      const verificationMap: VerificationMap = Object.fromEntries(
        verificationResults.map((result) => [result.chapterId, result])
      );

      return verificationMap;
    }),
});
