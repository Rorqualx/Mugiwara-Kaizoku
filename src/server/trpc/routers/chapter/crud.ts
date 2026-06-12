/**
 * Chapter Router - CRUD Operations
 *
 * Procedures:
 * - markAllAsRead: Mark all chapters of a manga as read
 * - markAllAsUnread: Mark all chapters of a manga as unread
 * - getByMangaId: Get chapters by manga ID
 * - fixChapterIndices: Fix chapter indices by applying an offset
 *
 * @module server/trpc/routers/chapter/crud
 */

import fs from 'fs/promises';

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

// ============================================================================
// Router
// ============================================================================

export const chapterCrudRouter = router({
  /**
   * Mark all chapters of a manga as read
   */
  markAllAsRead: protectedProcedure
    .input(z.object({ mangaId: z.number() }))
    .mutation(async ({ input }): Promise<{ updatedCount: number; message: string }> => {
      const { mangaId } = input;

      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        select: { id: true, title: true }
      });

      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
      }

      const result = await prisma.chapter.updateMany({
        where: { mangaId, isRead: false },
        data: { isRead: true }
      });

      logger.info(`Marked ${result.count} chapters as read for manga: ${manga.title}`);

      void realtimeEmitter.emitChapterUpdate({
        chapterId: 0,
        mangaId,
        action: 'read',
        data: { count: result.count }
      });

      return {
        updatedCount: result.count,
        message: `Marked ${result.count} chapters as read`
      };
    }),

  /**
   * Mark all chapters of a manga as unread
   */
  markAllAsUnread: protectedProcedure
    .input(z.object({ mangaId: z.number() }))
    .mutation(async ({ input }): Promise<{ updatedCount: number; message: string }> => {
      const { mangaId } = input;

      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        select: { id: true, title: true }
      });

      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
      }

      const result = await prisma.chapter.updateMany({
        where: { mangaId, isRead: true },
        data: { isRead: false }
      });

      logger.info(`Marked ${result.count} chapters as unread for manga: ${manga.title}`);

      void realtimeEmitter.emitChapterUpdate({
        chapterId: 0,
        mangaId,
        action: 'unread',
        data: { count: result.count }
      });

      return {
        updatedCount: result.count,
        message: `Marked ${result.count} chapters as unread`
      };
    }),

  /**
   * Get chapters by manga ID
   */
  getByMangaId: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      downloadStatus: z.enum(['PENDING', 'DOWNLOADING', 'COMPLETED', 'ERROR']).optional()
    }))
    .query(async ({ input }) => {
      const { mangaId, downloadStatus } = input;

      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        select: { id: true, title: true }
      });

      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
      }

      const chapters = await prisma.chapter.findMany({
        where: {
          mangaId,
          ...(downloadStatus ? { downloadStatus } : {})
        },
        select: {
          id: true,
          title: true,
          chapterNumber: true,
          index: true,
          downloadStatus: true,
          filePath: true,
          fileName: true,
          fileFormat: true,
          size: true
        },
        orderBy: { index: 'asc' }
      });

      logger.info(`Fetched ${chapters.length} chapters for manga: ${manga.title}${downloadStatus ? ` (status: ${downloadStatus})` : ''}`);

      return chapters;
    }),

  /**
   * Fix chapter indices by applying an offset
   */
  fixChapterIndices: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      offset: z.number().default(-1)
    }))
    .mutation(async ({ input }): Promise<{
      updatedCount: number;
      message: string;
      details?: { oldRange: string; newRange: string };
    }> => {
      const { mangaId, offset } = input;

      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        select: { id: true, title: true }
      });

      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
      }

      const chapters = await prisma.chapter.findMany({
        where: { mangaId },
        select: { id: true, index: true },
        orderBy: { index: 'asc' }
      });

      if (chapters.length === 0) {
        return { updatedCount: 0, message: 'No chapters to update' };
      }

      const updatePromises = chapters.map(chapter => {
        const newIndex = chapter.index + offset;
        if (newIndex < 0) {
          logger.warn(`Skipping chapter ${chapter.id} - new index would be negative (${newIndex})`);
          return Promise.resolve();
        }
        return prisma.chapter.update({
          where: { id: chapter.id },
          data: { index: newIndex }
        });
      });

      await Promise.all(updatePromises);

      logger.info(`Fixed indices for ${chapters.length} chapters in manga: ${manga.title} (offset: ${offset})`);

      void realtimeEmitter.emitSystemEvent({
        eventType: 'chapters:indices:fixed',
        source: 'chapterRouter',
        message: `Fixed ${chapters.length} chapter indices for ${manga.title}`,
        data: {
          mangaId,
          updatedCount: chapters.length,
          offset,
          oldRange: `${chapters[0]?.index} - ${chapters[chapters.length - 1]?.index}`,
          newRange: `${(chapters[0]?.index ?? 0) + offset} - ${((chapters[chapters.length - 1]?.index ?? 0) + offset)}`
        }
      });

      return {
        updatedCount: chapters.length,
        message: `Updated ${chapters.length} chapter indices (offset: ${offset})`,
        details: {
          oldRange: `${chapters[0]?.index} - ${chapters[chapters.length - 1]?.index}`,
          newRange: `${(chapters[0]?.index ?? 0) + offset} - ${((chapters[chapters.length - 1]?.index ?? 0) + offset)}`
        }
      };
    }),

  /**
   * Delete a single chapter
   */
  deleteOne: protectedProcedure
    .input(z.object({
      chapterId: z.number().int().positive(),
      mangaId: z.number().int().positive()
    }))
    .mutation(async ({ input }): Promise<{ deletedId: number; message: string }> => {
      const { chapterId, mangaId } = input;

      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        select: { id: true, mangaId: true, title: true, fileName: true }
      });

      if (chapter?.mangaId !== mangaId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chapter not found' });
      }

      await prisma.chapter.delete({ where: { id: chapterId } });

      logger.info(`Deleted chapter: ${chapter.title} (${chapter.fileName})`);

      void realtimeEmitter.emitChapterUpdate({
        chapterId,
        mangaId,
        action: 'deleted',
        data: { title: chapter.title }
      });

      return {
        deletedId: chapterId,
        message: `Deleted "${chapter.title}"`
      };
    }),

  /**
   * Delete only the file for a chapter, preserving metadata
   * Sets downloadStatus to AVAILABLE and clears filePath
   */
  deleteFile: protectedProcedure
    .input(z.object({
      chapterId: z.number().int().positive(),
      mangaId: z.number().int().positive()
    }))
    .mutation(async ({ input }): Promise<{ chapterId: number; message: string }> => {
      const { chapterId, mangaId } = input;

      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        select: { id: true, mangaId: true, title: true, filePath: true }
      });

      if (chapter?.mangaId !== mangaId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chapter not found' });
      }

      // Delete file from disk if it exists
      if (chapter.filePath) {
        try {
          await fs.unlink(chapter.filePath);
          logger.info(`Deleted chapter file: ${chapter.filePath}`);
        } catch (error) {
          // File may already be deleted or inaccessible
          logger.warn(`Failed to delete file: ${chapter.filePath}`, { error });
        }
      }

      // Update chapter to clear file info and set status to AVAILABLE
      await prisma.chapter.update({
        where: { id: chapterId },
        data: {
          filePath: null,
          downloadStatus: 'AVAILABLE',
          size: 0
        }
      });

      logger.info(`Removed file for chapter: ${chapter.title}`);

      void realtimeEmitter.emitChapterUpdate({
        chapterId,
        mangaId,
        action: 'updated',
        data: { title: chapter.title, downloadStatus: 'AVAILABLE' }
      });

      return {
        chapterId,
        message: `Removed file for "${chapter.title}"`
      };
    }),

  /**
   * Delete files for multiple chapters, preserving metadata
   * Sets downloadStatus to AVAILABLE and clears filePath for all specified chapters
   */
  deleteFilesMany: protectedProcedure
    .input(z.object({
      chapterIds: z.array(z.number().int().positive()),
      mangaId: z.number().int().positive()
    }))
    .mutation(async ({ input }): Promise<{ deletedCount: number; message: string }> => {
      const { chapterIds, mangaId } = input;

      if (chapterIds.length === 0) {
        return { deletedCount: 0, message: 'No files to delete' };
      }

      // Get all chapters with their file paths
      const chapters = await prisma.chapter.findMany({
        where: { id: { in: chapterIds }, mangaId },
        select: { id: true, filePath: true, title: true }
      });

      if (chapters.length !== chapterIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Some chapters do not belong to this manga'
        });
      }

      // Delete files from disk
      let filesDeleted = 0;
      for (const chapter of chapters) {
        if (chapter.filePath) {
          try {
            // eslint-disable-next-line no-await-in-loop -- Sequential file deletion for safety
            await fs.unlink(chapter.filePath);
            filesDeleted++;
            logger.info(`Deleted file: ${chapter.filePath}`);
          } catch (error) {
            logger.warn(`Failed to delete file: ${chapter.filePath}`, { error });
          }
        }
      }

      // Update all chapters to clear file info
      await prisma.chapter.updateMany({
        where: { id: { in: chapterIds }, mangaId },
        data: {
          filePath: null,
          downloadStatus: 'AVAILABLE',
          size: 0
        }
      });

      logger.info(`Removed files for ${chapters.length} chapters in manga ${mangaId}`);

      void realtimeEmitter.emitMangaUpdate({
        mangaId,
        action: 'updated',
        data: { filesRemoved: filesDeleted }
      });

      return {
        deletedCount: filesDeleted,
        message: `Removed ${filesDeleted} file${filesDeleted !== 1 ? 's' : ''}`
      };
    }),

  /**
   * Delete multiple chapters (bulk delete)
   */
  deleteMany: protectedProcedure
    .input(z.object({
      chapterIds: z.array(z.number().int().positive()),
      mangaId: z.number().int().positive()
    }))
    .mutation(async ({ input }): Promise<{ deletedCount: number; message: string }> => {
      const { chapterIds, mangaId } = input;

      if (chapterIds.length === 0) {
        return { deletedCount: 0, message: 'No chapters to delete' };
      }

      // Verify all chapters belong to this manga
      const chapters = await prisma.chapter.findMany({
        where: { id: { in: chapterIds }, mangaId },
        select: { id: true }
      });

      if (chapters.length !== chapterIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Some chapters do not belong to this manga'
        });
      }

      const result = await prisma.chapter.deleteMany({
        where: { id: { in: chapterIds }, mangaId }
      });

      logger.info(`Deleted ${result.count} chapters for manga ${mangaId}`);

      void realtimeEmitter.emitMangaUpdate({
        mangaId,
        action: 'updated',
        data: { deletedChapters: result.count }
      });

      return {
        deletedCount: result.count,
        message: `Deleted ${result.count} chapter${result.count !== 1 ? 's' : ''}`
      };
    })
});
