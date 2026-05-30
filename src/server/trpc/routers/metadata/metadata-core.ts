/**
 * Metadata Core Operations Router
 *
 * This module handles core metadata operations:
 * - Field preference management (global, no Settings FK)
 * - Provider strength ratings
 * - Metadata conflict detection and resolution
 * - Metadata cache management (ParserCache)
 * - Metadata refresh with provider enrichment
 * - Metadata URL updates
 *
 * Key Features:
 * - Database operations with ExtendedPrismaClient for optional models
 * - AsyncResult pattern for error handling
 * - Integration with refreshService helpers
 * - Integration with metadata-helpers for conflict resolution
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createSuccessResult, createErrorResult, isError } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import {
  updateMetadataWithResolution,
  updateMangaProviderPreference,
} from '../metadata-helpers';

import {
  handleError,
  UpdateFieldPreferencesSchema,
  ResolveConflictSchema,
  GetConflictsSchema,
} from './metadata-utils';

import type {
  MetadataFieldPreference,
  MetadataConflict,
  ProviderStrengths,
  ExtendedPrismaClient,
} from './metadata-utils';

/**
 * Metadata Core Operations Router
 *
 * Provides endpoints for:
 * - Field preferences (query/mutation)
 * - Provider strengths (query)
 * - Conflict management (query/mutation)
 * - Cache management (mutation)
 * - Metadata refresh (mutation)
 * - URL updates (mutation, protected)
 */
export const metadataCoreRouter = router({
  /**
   * Get field preferences (now global, no Settings FK)
   */
  fieldPreferences: publicProcedure.query(async (): Promise<MetadataFieldPreference[]> => {
    try {
      // Field preferences are now global (no FK to Settings)
      const extendedPrisma = prisma as unknown as ExtendedPrismaClient;
      const preferences = extendedPrisma.metadataFieldPreference
        ? await extendedPrisma.metadataFieldPreference.findMany({
            orderBy: [{ priority: 'desc' }, { fieldName: 'asc' }],
          })
        : [];
      return preferences;
    } catch (error: unknown) {
      logger.error(
        `Error fetching field preferences: ${error instanceof Error ? error.message : String(error)}`
      );
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch field preferences',
      });
    }
  }),

  /**
   * Update field preferences (now global, no Settings FK)
   */
  updateFieldPreferences: protectedProcedure
    .input(UpdateFieldPreferencesSchema)
    .mutation(async ({ input }): Promise<MetadataFieldPreference[]> => {
      try {
        const extendedPrisma = prisma as unknown as ExtendedPrismaClient;
        if (extendedPrisma.metadataFieldPreference) {
          // Delete all existing preferences (they're global now)
          await extendedPrisma.metadataFieldPreference.deleteMany({});

          // Create new preferences
          const newPreferences = await Promise.all(
            input.preferences.map(async (pref) => {
              if (!extendedPrisma.metadataFieldPreference) {
                throw new Error('MetadataFieldPreference model not available');
              }
              return extendedPrisma.metadataFieldPreference.create({
                data: {
                  fieldName: pref.fieldName,
                  providerId: pref.providerId,
                  priority: pref.priority,
                },
              });
            })
          );
          logger.info(`Updated ${newPreferences.length} field preferences`);
          return newPreferences;
        } else {
          // If the model doesn't exist, return empty array
          logger.warn('MetadataFieldPreference model not available, skipping update');
          return [];
        }
      } catch (error: unknown) {
        logger.error(
          `Error updating field preferences: ${error instanceof Error ? error.message : String(error)}`
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update field preferences',
        });
      }
    }),

  /**
   * Get provider strength data for fields
   * @returns {ProviderStrengths} Provider field strength ratings
   */
  providerStrengths: publicProcedure.query((): ProviderStrengths => {
    // This is currently hardcoded in the UI component, but could be moved to the server
    // and made configurable in the future
    const strengths: ProviderStrengths = {
      anilist: {
        title: 5,
        summary: 4,
        genres: 5,
        authors: 4,
        characters: 5,
        cover: 4,
        status: 5,
        startDate: 5,
        endDate: 5,
        volumes: 4,
        chapters: 4,
        synonyms: 5,
        tags: 5,
      },
      comicvine: {
        title: 4,
        summary: 4,
        genres: 4,
        authors: 5,
        characters: 4,
        cover: 4,
        status: 4,
        startDate: 5,
        endDate: 4,
        volumes: 5,
        chapters: 4,
        synonyms: 3,
        tags: 3,
      },
      fandom: {
        title: 3,
        summary: 5,
        genres: 3,
        authors: 3,
        characters: 5,
        cover: 2,
        status: 3,
        startDate: 3,
        endDate: 3,
        volumes: 4,
        chapters: 5,
        synonyms: 4,
        tags: 3,
      },
      wikipedia: {
        title: 4,
        summary: 5,
        genres: 3,
        authors: 5,
        characters: 3,
        cover: 1,
        status: 2,
        startDate: 4,
        endDate: 4,
        volumes: 4,
        chapters: 5,
        synonyms: 3,
        tags: 2,
      },
    };
    return strengths;
  }),

  /**
   * Get metadata conflicts for a manga
   */
  getConflicts: publicProcedure
    .input(GetConflictsSchema)
    .query(async ({ input }): Promise<MetadataConflict[]> => {
      try {
        const { mangaId, onlyUnresolved } = input;
        // Get conflicts from database
        // Check if the model exists first using our typed extended client
        const extendedPrisma = prisma as ExtendedPrismaClient;
        if (extendedPrisma.metadataConflict) {
          const conflicts = await extendedPrisma.metadataConflict.findMany({
            where: {
              mangaId,
              ...(onlyUnresolved ? { resolved: false } : {}),
            },
            orderBy: {
              createdAt: 'desc',
            },
          });
          return conflicts;
        } else {
          // If the model doesn't exist, return empty array
          logger.warn('MetadataConflict model not available, returning empty result');
          return [];
        }
      } catch (error: unknown) {
        logger.error(
          `Error fetching metadata conflicts: ${error instanceof Error ? error.message : String(error)}`
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch metadata conflicts',
        });
      }
    }),

  /**
   * Resolve a metadata conflict
   */
  resolveConflict: publicProcedure
    .input(ResolveConflictSchema)
    .mutation(async ({ input }): Promise<AsyncResult<boolean, Error>> => {
      try {
        const { conflictId, resolutionValue, resolutionProvider } = input;
        const extendedPrisma = prisma as ExtendedPrismaClient;

        if (!extendedPrisma.metadataConflict) {
          logger.warn('MetadataConflict model not available, cannot resolve conflict');
          return createErrorResult(new Error('MetadataConflict model not available'));
        }

        const conflict = await extendedPrisma.metadataConflict.findUnique({
          where: { id: conflictId },
          include: { Manga: true },
        });

        if (!conflict) {
          return createErrorResult(new Error('Conflict not found'));
        }

        await extendedPrisma.metadataConflict.update({
          where: { id: conflictId },
          data: {
            resolved: true,
            resolution: JSON.stringify(resolutionValue),
            resolutionProvider,
            updatedAt: new Date(),
          },
        });

        // Update metadata if available
        if (conflict.manga?.metadataId) {
          const metadataResult = await updateMetadataWithResolution(
            conflict.manga.metadataId,
            conflict.fieldName,
            resolutionValue
          );
          if (isError(metadataResult)) {
            logger.warn(`Failed to update metadata: ${metadataResult.error.message}`);
          }
        }

        // Update provider preference
        const preferenceResult = await updateMangaProviderPreference(
          conflict.mangaId,
          conflict.fieldName,
          resolutionProvider,
          resolutionValue
        );

        if (isError(preferenceResult)) {
          logger.warn(`Failed to update provider preference: ${preferenceResult.error.message}`);
        }

        return createSuccessResult(true);
      } catch (error: unknown) {
        logger.error(
          `Error resolving metadata conflict: ${error instanceof Error ? error.message : String(error)}`
        );
        return createErrorResult(handleError(error));
      }
    }),

  /**
   * Clear metadata cache
   *
   * Clears cached metadata from CacheUnified table. Can optionally clear
   * cache for a specific manga or clear all metadata cache entries.
   */
  clearMetadataCache: publicProcedure
    .input(
      z
        .object({
          mangaId: z.number().optional(), // If provided, clear only for that manga
        })
        .optional()
    )
    .mutation(async ({ input }): Promise<AsyncResult<{ count: number }, Error>> => {
      try {
        // Build where clause based on input
        const where = input?.mangaId
          ? { namespace: 'metadata', key: { startsWith: `${input.mangaId}:` } }
          : { namespace: 'metadata' };

        // Delete cache entries
        const result = await prisma.parserCache.deleteMany({ where });

        logger.info(
          `Cleared ${result.count} metadata cache entries${input?.mangaId ? ` for manga ${input.mangaId}` : ''}`
        );

        return createSuccessResult({ count: result.count });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error clearing metadata cache: ${errorMessage}`);
        return createErrorResult(new Error(`Failed to clear metadata cache: ${errorMessage}`));
      }
    }),

  /**
   * Update metadata URLs for a manga
   */
  updateUrls: protectedProcedure
    .input(
      z.object({
        mangaId: z.number(),
        urls: z.array(z.string()),
      })
    )
    .mutation(async ({ input }): Promise<AsyncResult<boolean, Error>> => {
      try {
        const { mangaId, urls } = input;
        // Find the manga with its metadata
        const manga = await prisma.manga.findUnique({
          where: { id: mangaId },
          include: { Metadata: true },
        });
        if (!manga) {
          return createErrorResult(new Error('Manga not found'));
        }
        if (!manga.Metadata) {
          return createErrorResult(new Error('Manga has no metadata'));
        }
        // Update the metadata URLs
        await prisma.metadata.update({
          where: { id: manga.Metadata['id'] },
          data: {
            urls: urls,
          },
        });
        logger.info(`Updated metadata URLs for manga ID ${mangaId}: ${urls.length} URLs`);
        return createSuccessResult(true);
      } catch (error: unknown) {
        logger.error(
          `Error updating metadata URLs: ${error instanceof Error ? error.message : String(error)}`
        );
        return createErrorResult(handleError(error));
      }
    }),

  /**
   * Check if search results are already added to library
   *
   * Batch checks multiple search results against the database to determine
   * which ones already exist in the library. Returns distinction between
   * "in current library" vs "in other library".
   *
   * @param results - Array of search results with id and provider
   * @param currentLibraryId - Optional library ID to check against for distinction
   * @returns Array of results with alreadyAdded status and library info
   */
  checkAlreadyAdded: publicProcedure
    .input(
      z.object({
        results: z.array(
          z.object({
            id: z.string(),
            provider: z.string(),
          })
        ),
        currentLibraryId: z.number().optional(),
      })
    )
    .query(
      // eslint-disable-next-line max-lines-per-function -- Batch check logic is clearer inline
      async ({
        input,
      }): Promise<
        Array<{
          id: string;
          provider: string;
          alreadyAdded: boolean;
          inCurrentLibrary: boolean;
          inOtherLibrary: boolean;
          existingMangaId?: number | undefined;
          existingTitle?: string | undefined;
          libraryName?: string | undefined;
        }>
      > => {
        try {
          const { results, currentLibraryId } = input;

          if (results.length === 0) {
            return [];
          }

          // Extract unique providers and IDs for the query
          const providers = [...new Set(results.map((r) => r.provider))];
          const ids = [...new Set(results.map((r) => r.id))];

          // Single batch query for ALL libraries
          const existingManga = await prisma.manga.findMany({
            where: {
              OR: [
                // Check Manga.sourceId
                {
                  source: { in: providers },
                  sourceId: { in: ids },
                },
                // Check Metadata.sourceId
                {
                  Metadata: {
                    source: { in: providers },
                    sourceId: { in: ids },
                  },
                },
              ],
            },
            select: {
              id: true,
              title: true,
              source: true,
              sourceId: true,
              libraryId: true,
              Library: { select: { name: true } },
              Metadata: { select: { source: true, sourceId: true } },
            },
          });

          // Build lookup map with library info
          type MangaEntry = (typeof existingManga)[0];
          const existingMap = new Map<
            string,
            {
              manga: MangaEntry;
              inCurrentLibrary: boolean;
            }
          >();

          for (const manga of existingManga) {
            const inCurrentLibrary = currentLibraryId
              ? manga.libraryId === currentLibraryId
              : false;

            const entry = { manga, inCurrentLibrary };

            // Map by Manga.source + sourceId
            if (manga.sourceId) {
              existingMap.set(`${manga.source}-${manga.sourceId}`, entry);
            }

            // Also map by Metadata.source + sourceId (may differ from Manga.source)
            const metadataSource = manga.Metadata?.source;
            const metadataSourceId = manga.Metadata?.sourceId;
            if (metadataSourceId && metadataSource) {
              existingMap.set(`${metadataSource}-${metadataSourceId}`, entry);
            }
          }

          // Return enriched results
          return results.map((r) => {
            const entry = existingMap.get(`${r.provider}-${r.id}`);
            // Library can be null if manga has no library association
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const libraryName = entry?.manga.Library?.name;
            return {
              id: r.id,
              provider: r.provider,
              alreadyAdded: !!entry,
              inCurrentLibrary: entry?.inCurrentLibrary ?? false,
              inOtherLibrary: entry ? !entry.inCurrentLibrary : false,
              existingMangaId: entry?.manga.id,
              existingTitle: entry?.manga.title,
              libraryName,
            };
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error checking already added status: ${errorMessage}`);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to check already added status',
          });
        }
      }
    ),

  /**
   * Phase 4 #1: Latest N MetadataSelectionAttempt rows for the manga.
   *
   * Feeds the provenance badge hook. Read-only. Returns the rows newest-first
   * with the per-pass selections summary + shadow deltas where the selector
   * disagreed with the Object.assign chain.
   */
  getSelectionHistory: publicProcedure
    .input(z.object({ mangaId: z.number().int().positive(), limit: z.number().int().min(1).max(50).optional() }))
    .query(async ({ input }) => {
      const limit = input.limit ?? 10;
      return prisma.metadataSelectionAttempt.findMany({
        where: { mangaId: input.mangaId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    }),
});
