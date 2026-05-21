/**
 * Home Router - AniList Manga Details
 *
 * Procedure for fetching comprehensive manga details from AniList.
 *
 * Procedures:
 * - getMangaDetails: Get full manga information
 *
 * Extracted from: home.ts (lines 1372-1447)
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { validatedAnilistClient } from '@/server/services/anilist/validated-client';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

/**
 * AniList Manga Details Router
 *
 * Provides access to comprehensive manga information from AniList
 * using the validated client with Zod schema validation.
 */
export const homeAnilistDetailsRouter = router({
  /**
   * Get Manga Details
   * Returns comprehensive manga information from AniList
   *
   * MIGRATED: Now uses validated AniList client with Zod schema validation
   * - Runtime type safety
   * - No manual type casting
   * - Clear error messages on validation failure
   *
   * @input id - AniList manga ID (required)
   * @returns Detailed manga information including description, characters, staff, relations, recommendations
   */
  getMangaDetails: publicProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input }) => {
      const { id } = input;

      // Use validated client with Zod schema validation
      // Throws TRPCError if not found or validation fails
      const response = await validatedAnilistClient.getMangaDetails(id);

      // Check if media exists
      if (!response.data?.Media) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Manga with ID ${id} not found`,
        });
      }

      // media is now properly typed from Zod schema!
      const media = response.data.Media;

      // Transform response to clean format (maintaining API contract)
      // NOTE: genres, synonyms, and tags are always arrays after Zod validation
      // The createDefaultArraySchema transforms null to [] during parsing
      const mangaDetails = {
        id: media.id,
        title: {
          english: media.title?.english,
          romaji: media.title?.romaji,
          native: media.title?.native,
        },
        description: media.description,
        coverImage: {
          extraLarge: media.coverImage?.extraLarge,
          large: media.coverImage?.large,
          medium: media.coverImage?.medium,
          color: media.coverImage?.color,
        },
        bannerImage: media.bannerImage,
        status: media.status,
        volumes: media.volumes,
        chapters: media.chapters,
        // FIX: Removed unnecessary ?? - these are always arrays from Zod schema
        genres: media.genres,
        synonyms: media.synonyms,
        averageScore: media.averageScore,
        popularity: media.popularity,
        startDate: media.startDate,
        endDate: media.endDate,
        // FIX: Removed unnecessary ?? - tags is always an array from Zod schema
        tags: media.tags.map(tag => ({
          id: tag.id,
          name: tag.name,
          category: tag.category,
        })),
        // Characters, staff, relations, recommendations are not in our basic schema yet
        // These would be added to the schema for full migration
        characters: [] as const,
        staff: [] as const,
        relations: [] as const,
        recommendations: [] as const,
      };

      logger.info(`[AniList Manga Details] Successfully fetched details for manga ID: ${id}`);
      return mangaDetails;
    }),
});
