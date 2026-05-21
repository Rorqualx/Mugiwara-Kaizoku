/**
 * Volume Router - CRUD Operations
 *
 * Procedures:
 * - create: Create a new volume
 * - update: Update volume metadata
 * - delete: Delete a volume
 * - upsertBatch: Batch upsert volumes from provider
 *
 * @module server/trpc/routers/volume/crud
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import {
  volumeCreateSchema,
  volumeUpdateSchema,
  volumeBatchSchema,
  filterUndefined,
} from './utils';

import type { Volume, Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface BatchUpsertResult {
  created: number;
  updated: number;
  errors: string[];
}

// ============================================================================
// Router
// ============================================================================

export const volumeCrudRouter = router({
  /**
   * Create a new volume
   *
   * Creates a new volume record for a manga.
   */
  create: protectedProcedure
    .input(volumeCreateSchema)
    .mutation(async ({ ctx, input }): Promise<Volume> => {
      // Verify manga exists
      const manga = await ctx.prisma.manga.findUnique({
        where: { id: input.mangaId },
        select: { id: true },
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Manga with ID ${input.mangaId} not found`,
        });
      }

      // Check for duplicate volume number
      const existing = await ctx.prisma.volume.findUnique({
        where: {
          mangaId_number: {
            mangaId: input.mangaId,
            number: input.number,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Volume ${input.number} already exists for this manga`,
        });
      }

      const createData = filterUndefined({
        mangaId: input.mangaId,
        number: input.number,
        title: input.title,
        subtitle: input.subtitle,
        alternativeTitle: input.alternativeTitle,
        description: input.description,
        summary: input.summary,
        isbn: input.isbn,
        isbn13: input.isbn13,
        publisher: input.publisher,
        pageCount: input.pageCount,
        format: input.format ?? 'TANKOBON',
        releaseDate: input.releaseDate,
        coverImage: input.coverImage,
        chapterStart: input.chapterStart,
        chapterEnd: input.chapterEnd,
        totalChapters: input.totalChapters,
        source: input.source,
        sourceId: input.sourceId,
        sourceUrl: input.sourceUrl,
        enrichmentTier: input.enrichmentTier,
      });

      const volume = await ctx.prisma.volume.create({
        data: createData as Prisma.VolumeUncheckedCreateInput,
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitMangaUpdate({
        mangaId: input.mangaId,
        action: 'updated',
        data: { volumeCreated: volume.id, volumeNumber: volume.number }
      });

      return volume;
    }),

  /**
   * Update volume metadata
   *
   * Updates an existing volume's metadata.
   */
  update: protectedProcedure
    .input(volumeUpdateSchema)
    .mutation(async ({ ctx, input }): Promise<Volume> => {
      const { id, ...data } = input;

      // Verify volume exists
      const volume = await ctx.prisma.volume.findUnique({
        where: { id },
        select: { id: true, mangaId: true },
      });

      if (!volume) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Volume with ID ${id} not found`,
        });
      }

      // If changing volume number, check for conflicts
      if (data.number !== undefined) {
        const existing = await ctx.prisma.volume.findFirst({
          where: {
            mangaId: volume.mangaId,
            number: data.number,
            id: { not: id },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Volume ${data.number} already exists for this manga`,
          });
        }
      }

      const updateData = filterUndefined({
        number: data.number,
        title: data.title,
        subtitle: data.subtitle,
        alternativeTitle: data.alternativeTitle,
        description: data.description,
        summary: data.summary,
        isbn: data.isbn,
        isbn13: data.isbn13,
        publisher: data.publisher,
        pageCount: data.pageCount,
        format: data.format,
        releaseDate: data.releaseDate,
        coverImage: data.coverImage,
        chapterStart: data.chapterStart,
        chapterEnd: data.chapterEnd,
        totalChapters: data.totalChapters,
        source: data.source,
        sourceId: data.sourceId,
        sourceUrl: data.sourceUrl,
        enrichmentTier: data.enrichmentTier,
      });

      const updatedVolume = await ctx.prisma.volume.update({
        where: { id },
        data: updateData as Prisma.VolumeUncheckedUpdateInput,
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitMangaUpdate({
        mangaId: volume.mangaId,
        action: 'updated',
        data: { volumeUpdated: id }
      });

      return updatedVolume;
    }),

  /**
   * Delete a volume
   *
   * Deletes a volume and all related data (creators, characters, etc.).
   * Chapters linked to this volume will have their volumeId set to null.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }): Promise<Volume> => {
      const volume = await ctx.prisma.volume.findUnique({
        where: { id: input.id },
      });

      if (!volume) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Volume with ID ${input.id} not found`,
        });
      }

      const deletedVolume = await ctx.prisma.volume.delete({
        where: { id: input.id },
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitMangaUpdate({
        mangaId: volume.mangaId,
        action: 'updated',
        data: { volumeDeleted: input.id }
      });

      return deletedVolume;
    }),

  /**
   * Batch upsert volumes from provider
   *
   * Creates or updates multiple volumes from provider metadata.
   * Returns counts of created and updated volumes.
   */
  upsertBatch: protectedProcedure
    .input(volumeBatchSchema)
    // eslint-disable-next-line max-lines-per-function -- Batch upsert with per-volume processing, error tracking, and WebSocket emission
    .mutation(async ({ ctx, input }): Promise<BatchUpsertResult> => {
      const result: BatchUpsertResult = {
        created: 0,
        updated: 0,
        errors: [],
      };

      // Verify manga exists
      const manga = await ctx.prisma.manga.findUnique({
        where: { id: input.mangaId },
        select: { id: true },
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Manga with ID ${input.mangaId} not found`,
        });
      }

      for (const volumeData of input.volumes) {
        try {
          // eslint-disable-next-line no-await-in-loop -- Batch upsert with per-volume error tracking; parallelization would lose individual error context
          const existing = await ctx.prisma.volume.findUnique({
            where: {
              mangaId_number: {
                mangaId: input.mangaId,
                number: volumeData.number,
              },
            },
          });

          if (existing) {
            const batchUpdateData = filterUndefined({
              title: volumeData.title,
              subtitle: volumeData.subtitle,
              alternativeTitle: volumeData.alternativeTitle,
              description: volumeData.description,
              summary: volumeData.summary,
              isbn: volumeData.isbn,
              isbn13: volumeData.isbn13,
              publisher: volumeData.publisher,
              pageCount: volumeData.pageCount,
              format: volumeData.format ?? existing.format,
              releaseDate: volumeData.releaseDate,
              coverImage: volumeData.coverImage,
              chapterStart: volumeData.chapterStart,
              chapterEnd: volumeData.chapterEnd,
              totalChapters: volumeData.totalChapters,
              source: input.source,
              sourceId: volumeData.sourceId,
              sourceUrl: volumeData.sourceUrl,
              enrichmentTier: volumeData.enrichmentTier,
              lastEnriched: new Date(),
            });
            // eslint-disable-next-line no-await-in-loop -- Batch upsert with per-volume error tracking; parallelization would lose individual error context
            await ctx.prisma.volume.update({
              where: { id: existing.id },
              data: batchUpdateData as Prisma.VolumeUncheckedUpdateInput,
            });
            result.updated++;
          } else {
            const batchCreateData = filterUndefined({
              mangaId: input.mangaId,
              number: volumeData.number,
              title: volumeData.title,
              subtitle: volumeData.subtitle,
              alternativeTitle: volumeData.alternativeTitle,
              description: volumeData.description,
              summary: volumeData.summary,
              isbn: volumeData.isbn,
              isbn13: volumeData.isbn13,
              publisher: volumeData.publisher,
              pageCount: volumeData.pageCount,
              format: volumeData.format ?? 'TANKOBON',
              releaseDate: volumeData.releaseDate,
              coverImage: volumeData.coverImage,
              chapterStart: volumeData.chapterStart,
              chapterEnd: volumeData.chapterEnd,
              totalChapters: volumeData.totalChapters,
              source: input.source,
              sourceId: volumeData.sourceId,
              sourceUrl: volumeData.sourceUrl,
              enrichmentTier: volumeData.enrichmentTier,
              fetchedAt: new Date(),
            });
            // eslint-disable-next-line no-await-in-loop -- Batch upsert with per-volume error tracking; parallelization would lose individual error context
            await ctx.prisma.volume.create({
              data: batchCreateData as Prisma.VolumeUncheckedCreateInput,
            });
            result.created++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Volume ${volumeData.number}: ${errorMessage}`);
        }
      }

      // Emit WebSocket event for real-time sync (batch complete)
      if (result.created > 0 || result.updated > 0) {
        void realtimeEmitter.emitMangaUpdate({
          mangaId: input.mangaId,
          action: 'updated',
          data: {
            volumesBatchUpserted: true,
            created: result.created,
            updated: result.updated
          }
        });
      }

      return result;
    }),
});
