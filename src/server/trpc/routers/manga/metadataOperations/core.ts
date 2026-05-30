/**
 * Core Metadata Operations
 *
 * Basic CRUD operations for manga metadata:
 * - updateMetadata: Update metadata fields
 * - updateProviderPreferences: Update provider preferences
 *
 * Extracted from: metadataOperations.ts (lines 105-241)
 */

import { MangaPublicationStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { realtimeEmitter, type MetadataRefreshPhase } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';


import { invalidateMangaCache } from '../crud-operations/get-manga-cache';
import { includeMangaRelations, updateProviderPreferencesSchema, type MangaWithRelations } from '../shared';

import { runEnrichmentPipeline } from './enrichment-pipeline';

import type { Prisma } from '@prisma/client';

/**
 * Type for metadata update fields
 * Using union with undefined for exactOptionalPropertyTypes compatibility
 */
interface MetadataUpdateFields {
  coverLarge?: string | undefined;
  coverMedium?: string | undefined;
  coverSmall?: string | undefined;
  cover?: string | undefined;
  coverUrl?: string | undefined;
  bannerImage?: string | undefined;
  summary?: string | undefined;
  status?: MangaPublicationStatus | undefined;
}

/**
 * Input schema for updateMetadata
 */
const updateMetadataSchema = z.object({
  id: z.number(),
  metadata: z.object({
    coverLarge: z.string().optional(),
    coverMedium: z.string().optional(),
    coverSmall: z.string().optional(),
    cover: z.string().optional(),
    coverUrl: z.string().optional(),
    bannerImage: z.string().optional(),
    status: z.string().optional(),
    description: z.string().optional(),
    summary: z.string().optional()
  })
});

/**
 * Status mapping from string to enum
 */
const statusMap: Record<string, MangaPublicationStatus> = {
  'ongoing': MangaPublicationStatus.ONGOING,
  'completed': MangaPublicationStatus.COMPLETED,
  'hiatus': MangaPublicationStatus.HIATUS,
  'cancelled': MangaPublicationStatus.CANCELLED,
  'unknown': MangaPublicationStatus.UNKNOWN
};

export const metadataCoreProcedures = router({
  /**
   * Update manga metadata fields
   */
  updateMetadata: publicProcedure
    .input(updateMetadataSchema)
    .mutation(async ({ input, ctx }): Promise<MangaWithRelations> => {
      const { id, metadata } = input;

      logger.info(`Updating metadata for manga ID ${id}`);

      // First, fetch the existing manga with metadata
      const existingManga = await ctx.prisma.manga.findUnique({
        where: { id },
        include: { Metadata: true }
      });

      if (!existingManga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Manga not found'
        });
      }

      // Filter out description and map to summary if provided
      const { description, status, ...restMetadata } = metadata;
      const metadataUpdate: MetadataUpdateFields = {
        ...restMetadata
      };

      if (description) {
        metadataUpdate.summary = description;
      }

      // Convert status string to MangaPublicationStatus enum if provided
      if (status) {
        metadataUpdate.status = statusMap[status.toLowerCase()] ?? MangaPublicationStatus.UNKNOWN;
      }

      // Update the metadata - upsert to create if it doesn't exist
      // Convert undefined values to null for Prisma compatibility
      const prismaMetadataUpdate: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(metadataUpdate)) {
        if (value !== undefined) {
          prismaMetadataUpdate[key] = value;
        }
      }

      const updatedManga = await ctx.prisma.manga.update({
        where: { id },
        data: {
          Metadata: {
            upsert: {
              create: prismaMetadataUpdate as Prisma.MetadataCreateWithoutMangaInput,
              update: prismaMetadataUpdate as Prisma.MetadataUpdateWithoutMangaInput
            }
          }
        },
        include: includeMangaRelations
      });

      // Invalidate the server-side manga cache (hot + unified) so the next
      // get() call returns fresh data instead of the pre-update snapshot.
      // Without this, even React Query refetches see stale cover/banner.
      await invalidateMangaCache(id);

      logger.info(`Successfully updated metadata for manga: ${existingManga.title}`);

      return updatedManga as MangaWithRelations;
    }),

  /**
   * Update provider preferences for a manga
   */
  updateProviderPreferences: protectedProcedure
    .input(updateProviderPreferencesSchema)
    .mutation(async ({ input }): Promise<Prisma.MangaGetPayload<{ include: { Metadata: true } }>> => {
      const { id, preferences } = input;

      logger.info(`Updating provider preferences for manga ID ${id}`);

      try {
        // Get manga from database
        const manga = await prisma.manga.findUnique({
          where: { id },
          include: { Metadata: true }
        });

        if (!manga) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Manga with ID ${id} not found.`
          });
        }

        // Get current provider metadata or initialize empty object
        const providerMetadata = (manga.providerMetadata ?? {}) as Record<string, unknown>;

        // Update preferences
        const updatedProviderMetadata = {
          ...providerMetadata,
          preferences: preferences
        };

        // Update manga
        const updatedManga = await prisma.manga.update({
          where: { id },
          data: {
            providerMetadata: updatedProviderMetadata as unknown as Prisma.InputJsonValue
          },
          include: { Metadata: true }
        });

        logger.info(`Successfully updated provider preferences for manga: ${manga.title} (ID: ${id})`);

        return updatedManga;
      } catch (error: unknown) {
        logger.error(`Error updating provider preferences: ${error instanceof Error ? error.message : String(error)}`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update provider preferences: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }),

  /**
   * One-click enrichment via the modern enrichment pipeline.
   * Emits WebSocket progress events so the frontend can show real-time status.
   */
  oneClickEnrich: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      title: z.string()
    }))
    .mutation(async ({ input }) => {
      const { mangaId, title } = input;
      logger.info(`[oneClickEnrich] MUTATION CALLED for manga ID ${mangaId}: "${title}"`);

      const TOTAL_PHASES = 10;
      const enrichPhaseMap: Record<string, { phase: MetadataRefreshPhase; index: number }> = {
        fetching: { phase: 'fetching_providers', index: 1 },
        enriching: { phase: 'enriching_metadata', index: 2 },
        persisting: { phase: 'persisting_data', index: 3 },
        reconciling: { phase: 'reconciling_chapters', index: 4 },
        validating: { phase: 'validating_volumes', index: 5 },
        fandom: { phase: 'fandom_scraping', index: 6 },
        fandom_enrichment: { phase: 'fandom_enrichment', index: 7 },
        fandom_chapters: { phase: 'fandom_chapters', index: 7 },
        wikipedia: { phase: 'wikipedia_enrichment', index: 7 },
        wikipedia_enrichment: { phase: 'wikipedia_enrichment', index: 7 },
        applying: { phase: 'applying_data', index: 8 },
        finalizing: { phase: 'rebuilding_chapters', index: 9 },
      };

      return runEnrichmentPipeline(mangaId, title, async (pipelinePhase, message) => {
        const mapped = enrichPhaseMap[pipelinePhase];
        if (mapped) {
          await realtimeEmitter.emitMetadataRefreshProgress({
            mangaId,
            phase: mapped.phase,
            phaseIndex: mapped.index,
            totalPhases: TOTAL_PHASES,
            message,
          });
        }
      });
    }),
});
