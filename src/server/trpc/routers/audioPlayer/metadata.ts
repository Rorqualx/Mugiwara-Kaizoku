/**
 * Audio Player Router - Metadata Module
 *
 * Procedures:
 * - getAudioMetadata: Extract audio metadata from chapter file
 * - getChapters: Get chapters embedded in audio file (M4B)
 * - getAudioChapters: Get all audio chapters for a manga
 *
 * @module server/trpc/routers/audioPlayer/metadata
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { extractAudioMetadata, detectAudioFormat } from '@/server/services/conversion/utils/audio-extractor';
import type { AudioMetadata, AudioChapter } from '@/server/services/conversion/utils/audio-extractor';
import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import { getUserId, SUPPORTED_AUDIO_FORMATS, AUDIO_MIME_TYPES } from './utils';

import type { Prisma } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Chapter with manga metadata
 */
type ChapterWithManga = Prisma.ChapterGetPayload<{
  include: {
    Manga: {
      include: {
        Metadata: true;
      };
    };
  };
}>;

/**
 * Audio chapter info response
 */
interface AudioChapterInfo {
  chapterId: number;
  chapterNumber: number;
  title: string;
  filePath: string | null;
  format: string | null;
  duration: number | null;
  hasChapters: boolean;
  chapterCount: number;
  coverUrl: string | null;
}

/**
 * Audio file info response
 */
interface AudioFileInfo {
  exists: boolean;
  filePath: string;
  format: string | null;
  duration: number;
  hasChapters: boolean;
  chapterCount: number;
  metadata: AudioMetadata | null;
}

// ============================================================================
// Router
// ============================================================================

export const audioPlayerMetadataRouter = router({
  /**
   * Get audio metadata from chapter file
   *
   * Extracts metadata from an audio file including duration, chapters,
   * cover art, and other audio information.
   */
  getAudioMetadata: protectedProcedure
    .input(
      z.object({
        chapterId: z.number(),
      }),
    )
    .query(async ({ ctx, input }): Promise<AudioFileInfo> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.chapterId },
      });

      if (!chapter?.filePath) {
        return {
          exists: false,
          filePath: '',
          format: null,
          duration: 0,
          hasChapters: false,
          chapterCount: 0,
          metadata: null,
        };
      }

      const format = detectAudioFormat(chapter.filePath);
      if (!format) {
        return {
          exists: true,
          filePath: chapter.filePath,
          format: null,
          duration: 0,
          hasChapters: false,
          chapterCount: 0,
          metadata: null,
        };
      }

      const result = await extractAudioMetadata(chapter.filePath);

      if (result.status !== 'success') {
        return {
          exists: true,
          filePath: chapter.filePath,
          format,
          duration: 0,
          hasChapters: false,
          chapterCount: 0,
          metadata: null,
        };
      }

      return {
        exists: true,
        filePath: chapter.filePath,
        format,
        duration: result.data.metadata.duration,
        hasChapters: result.data.metadata.chapters.length > 0,
        chapterCount: result.data.metadata.chapters.length,
        metadata: result.data.metadata,
      };
    }),

  /**
   * Get embedded chapters from audio file
   *
   * Returns the chapter list embedded in an M4B or similar audio file.
   */
  getChapters: protectedProcedure
    .input(
      z.object({
        chapterId: z.number(),
      }),
    )
    .query(async ({ ctx, input }): Promise<AudioChapter[]> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.chapterId },
      });

      if (!chapter?.filePath) {
        return [];
      }

      const result = await extractAudioMetadata(chapter.filePath);

      if (result.status !== 'success') {
        return [];
      }

      return result.data.metadata.chapters;
    }),

  /**
   * Get all audio chapters for a manga
   *
   * Returns a list of all chapters that are audio files for a given manga,
   * with basic audio information for each.
   */
  getAudioChapters: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
      }),
    )
    .query(async ({ ctx, input }): Promise<AudioChapterInfo[]> => {
      const userId = getUserId(ctx);
      if (!userId) return [];

      const chapters = await ctx.prisma.chapter.findMany({
        where: {
          mangaId: input.mangaId,
          filePath: { not: null },
        },
        include: {
          Manga: {
            include: {
              Metadata: true,
            },
          },
        },
        orderBy: {
          chapterNumber: 'asc',
        },
      });

      // Filter to only audio files
      const audioChapters = chapters.filter((chapter) => {
        if (!chapter.filePath) return false;
        const format = detectAudioFormat(chapter.filePath);
        return format !== null;
      });

      // Get basic info for each audio chapter
      const chapterInfos: AudioChapterInfo[] = await Promise.all(
        audioChapters.map(async (chapter: ChapterWithManga) => {
          let duration: number | null = null;
          let hasChapters = false;
          let chapterCount = 0;

          if (chapter.filePath) {
            const result = await extractAudioMetadata(chapter.filePath);
            if (result.status === 'success') {
              duration = result.data.metadata.duration;
              hasChapters = result.data.metadata.chapters.length > 0;
              chapterCount = result.data.metadata.chapters.length;
            }
          }

          return {
            chapterId: chapter.id,
            chapterNumber: chapter.chapterNumber ?? 0,
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- chapterNumber may be null in DB
            title: chapter.title ?? `Chapter ${chapter.chapterNumber ?? 0}`,
            filePath: chapter.filePath,
            format: chapter.filePath ? detectAudioFormat(chapter.filePath) : null,
            duration,
            hasChapters,
            chapterCount,
            coverUrl: chapter.Manga.Metadata?.coverLarge ?? null,
          };
        })
      );

      return chapterInfos;
    }),

  /**
   * Get supported audio formats
   *
   * Returns the list of supported audio file formats.
   */
  getSupportedFormats: publicProcedure.query((): {
    formats: readonly string[];
    mimeTypes: Record<string, string>;
  } => {
    return {
      formats: SUPPORTED_AUDIO_FORMATS,
      mimeTypes: AUDIO_MIME_TYPES,
    };
  }),

  /**
   * Check if a chapter is an audio file
   *
   * Returns whether the specified chapter is an audio file.
   */
  isAudioChapter: protectedProcedure
    .input(
      z.object({
        chapterId: z.number(),
      }),
    )
    .query(async ({ ctx, input }): Promise<boolean> => {
      const chapter = await ctx.prisma.chapter.findUnique({
        where: { id: input.chapterId },
        select: { filePath: true },
      });

      if (!chapter?.filePath) return false;

      return detectAudioFormat(chapter.filePath) !== null;
    }),
});
