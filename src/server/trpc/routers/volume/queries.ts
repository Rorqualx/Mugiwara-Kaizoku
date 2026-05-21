/**
 * Volume Router - Query Operations
 *
 * Procedures:
 * - list: List volumes for a manga
 * - get: Get single volume by ID
 * - getWithChapters: Get volume with linked chapters
 * - getByIsbn: Find volume by ISBN
 * - search: Search volumes
 *
 * @module server/trpc/routers/volume/queries
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { publicProcedure, protectedProcedure as _protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import {
  volumeListSchema,
  volumeSearchSchema,
  buildVolumeInclude,
  getUserId,
} from './utils';

import type { Volume as _Volume, Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

type VolumeWithRelations = Prisma.VolumeGetPayload<{
  include: {
    creators: true;
    characters: true;
    themes: true;
    genres: true;
    storyArcs: true;
  };
}>;

type VolumeWithChapters = Prisma.VolumeGetPayload<{
  include: {
    chapters: true;
    creators: true;
    characters: true;
    themes: true;
    genres: true;
    storyArcs: true;
  };
}>;

// ============================================================================
// Router
// ============================================================================

export const volumeQueriesRouter = router({
  /**
   * List volumes for a manga
   *
   * Returns all volumes for a specified manga with optional chapter
   * and progress inclusion.
   */
  list: publicProcedure
    .input(volumeListSchema)
    .query(async ({ ctx, input }): Promise<VolumeWithRelations[]> => {
      const userId = getUserId(ctx);
      const include = buildVolumeInclude({
        includeChapters: input.includeChapters,
        includeProgress: input.includeProgress,
        userId,
      });

      const orderByField = input.orderBy;
      const orderDirection = input.orderDirection;

      return ctx.prisma.volume.findMany({
        where: { mangaId: input.mangaId },
        include,
        orderBy: { [orderByField]: orderDirection },
      }) as Promise<VolumeWithRelations[]>;
    }),

  /**
   * Get single volume by ID
   *
   * Returns a volume with all related data including creators,
   * characters, themes, genres, and story arcs.
   */
  get: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }): Promise<VolumeWithRelations> => {
      const volume = await ctx.prisma.volume.findUnique({
        where: { id: input.id },
        include: {
          creators: true,
          characters: true,
          themes: true,
          genres: true,
          storyArcs: true,
        },
      });

      if (!volume) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Volume with ID ${input.id} not found`,
        });
      }

      return volume;
    }),

  /**
   * Get volume with linked chapters
   *
   * Returns a volume with all chapters that are linked to it,
   * ordered by chapter number.
   */
  getWithChapters: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }): Promise<VolumeWithChapters> => {
      const volume = await ctx.prisma.volume.findUnique({
        where: { id: input.id },
        include: {
          chapters: {
            orderBy: { chapterNumber: 'asc' },
          },
          creators: true,
          characters: true,
          themes: true,
          genres: true,
          storyArcs: true,
        },
      });

      if (!volume) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Volume with ID ${input.id} not found`,
        });
      }

      return volume;
    }),

  /**
   * Find volume by ISBN
   *
   * Searches for a volume by ISBN (10 or 13 digit format).
   */
  getByIsbn: publicProcedure
    .input(z.object({ isbn: z.string().min(10).max(20) }))
    .query(async ({ ctx, input }): Promise<VolumeWithRelations | null> => {
      const normalizedIsbn = input.isbn.replace(/[-\s]/g, '');

      const volume = await ctx.prisma.volume.findFirst({
        where: {
          OR: [
            { isbn: normalizedIsbn },
            { isbn13: normalizedIsbn },
            { isbn: input.isbn },
            { isbn13: input.isbn },
          ],
        },
        include: {
          creators: true,
          characters: true,
          themes: true,
          genres: true,
          storyArcs: true,
        },
      });

      return volume;
    }),

  /**
   * Search volumes
   *
   * Searches volumes by various criteria including title, ISBN,
   * publisher, and source.
   */
  search: publicProcedure
    .input(volumeSearchSchema)
    .query(async ({ ctx, input }): Promise<{ volumes: VolumeWithRelations[]; total: number }> => {
      const where: Prisma.VolumeWhereInput = {};

      if (input.query) {
        where.OR = [
          { title: { contains: input.query, mode: 'insensitive' } },
          { subtitle: { contains: input.query, mode: 'insensitive' } },
          { alternativeTitle: { contains: input.query, mode: 'insensitive' } },
        ];
      }

      if (input.isbn) {
        const normalizedIsbn = input.isbn.replace(/[-\s]/g, '');
        where.OR = [
          ...(where.OR ?? []),
          { isbn: normalizedIsbn },
          { isbn13: normalizedIsbn },
        ];
      }

      if (input.publisher) {
        where.publisher = { contains: input.publisher, mode: 'insensitive' };
      }

      if (input.source) {
        where.source = input.source;
      }

      if (input.format) {
        where.format = input.format;
      }

      const [volumes, total] = await Promise.all([
        ctx.prisma.volume.findMany({
          where,
          include: {
            creators: true,
            characters: true,
            themes: true,
            genres: true,
            storyArcs: true,
          },
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.volume.count({ where }),
      ]);

      return { volumes, total };
    }),

  /**
   * Get volume count for a manga
   *
   * Returns the total number of volumes for a manga.
   */
  getCount: publicProcedure
    .input(z.object({ mangaId: z.number().int().positive() }))
    .query(async ({ ctx, input }): Promise<number> => {
      return ctx.prisma.volume.count({
        where: { mangaId: input.mangaId },
      });
    }),
});
