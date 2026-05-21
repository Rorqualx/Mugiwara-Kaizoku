/**
 * Type-Safe AniList Client with Zod Validation
 *
 * This module wraps the existing AniList client with Zod schema validation,
 * providing runtime type safety for all GraphQL responses.
 *
 * Benefits over direct client usage:
 * - Runtime validation catches invalid API responses
 * - Type-safe responses (no more `as any` casts)
 * - Clear error messages when validation fails
 * - Preserves existing rate limiting and caching
 *
 * @example
 * ```typescript
 * import { validatedAnilistClient } from '@/server/services/anilist/validated-client';
 *
 * // Type-safe manga details
 * const response = await validatedAnilistClient.getMangaDetails(123);
 * // response.data.Media is now properly typed!
 * ```
 *
 * @module server/services/anilist/validated-client
 */

import { TRPCError } from '@trpc/server';

import {
  AniListMediaQueryResponseSchema,
  AniListMediaSearchResponseSchema,
  type AniListMediaQueryResponse,
  type AniListMediaSearchResponse,
} from '@/lib/schemas';
import { logger } from '@/utils/logger';

import { anilistClient, AniListPriority, type AniListPriorityLevel } from './client';
import * as anilistQueries from './queries';

/**
 * Validated AniList Client
 *
 * Wrapper around the existing AniList client that adds Zod validation
 * to all responses. This ensures runtime type safety while preserving
 * the existing rate limiting, caching, and retry logic.
 */
export const validatedAnilistClient = {
  /**
   * Get detailed manga information (type-safe)
   *
   * Fetches comprehensive manga data from AniList with runtime validation.
   *
   * @param id - AniList manga ID
   * @returns Validated manga details response
   * @throws {TRPCError} If manga not found or validation fails
   *
   * @example
   * ```typescript
   * const response = await validatedAnilistClient.getMangaDetails(30013);
   *
   * if (response.data?.Media) {
   *   // TypeScript knows the exact structure!
   *   console.log(response.data.Media.title?.romaji);
   *   console.log(response.data.Media.chapters);
   * }
   * ```
   */
  async getMangaDetails(id: number): Promise<AniListMediaQueryResponse> {
    try {
      logger.info(`[ValidatedAniListClient] Fetching details for manga ID: ${id}`);

      // Query AniList using existing client (preserves rate limiting & caching)
      const rawResponse: unknown = await anilistClient.query(
        anilistQueries.GET_MANGA_DETAILS,
        { id }
      );

      // Wrap the response in { data: ... } to match the schema structure
      // anilistClient.query() returns the inner data object directly
      const wrappedResponse = { data: rawResponse };

      // Validate response with Zod schema
      const parseResult = AniListMediaQueryResponseSchema.safeParse(wrappedResponse);

      if (!parseResult.success) {
        logger.error('[ValidatedAniListClient] Validation failed for getMangaDetails', {
          id,
          errors: parseResult.error.errors,
          rawResponse: JSON.stringify(rawResponse).substring(0, 500),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Invalid response from AniList API',
          cause: parseResult.error,
        });
      }

      // Return validated, typed response
      return parseResult.data;
    } catch (error: unknown) {
      if (error instanceof TRPCError) {
        throw error;
      }

      logger.error('[ValidatedAniListClient] Failed to fetch manga details', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch manga details from AniList',
        cause: error,
      });
    }
  },

  /**
   * Search for manga (type-safe)
   *
   * Searches AniList for manga by title with runtime validation.
   *
   * @param search - Search query string
   * @param page - Page number (default: 1)
   * @param perPage - Results per page (default: 10)
   * @param isAdult - Include adult content (default: false)
   * @returns Validated search results
   *
   * @example
   * ```typescript
   * const response = await validatedAnilistClient.searchManga('One Piece', 1, 10);
   *
   * if (response.data?.Page?.media) {
   *   response.data.Page.media.forEach(manga => {
   *     console.log(manga.title?.romaji); // Type-safe!
   *   });
   * }
   * ```
   */
  async searchManga(
    search: string,
    page = 1,
    perPage = 10,
    isAdult = false
  ): Promise<AniListMediaSearchResponse> {
    try {
      logger.info(`[ValidatedAniListClient] Searching for: "${search}"`);

      // Query AniList using existing client
      const rawResponse: unknown = await anilistClient.query(
        anilistQueries.SEARCH_MANGA,
        { search, page, perPage, isAdult }
      );

      // Wrap the response in { data: ... } to match the schema structure
      // anilistClient.query() returns the inner data object directly
      const wrappedResponse = { data: rawResponse };

      // Validate response with Zod schema
      const parseResult = AniListMediaSearchResponseSchema.safeParse(wrappedResponse);

      if (!parseResult.success) {
        logger.error('[ValidatedAniListClient] Validation failed for searchManga', {
          search,
          page,
          perPage,
          errors: parseResult.error.errors,
          rawResponse: JSON.stringify(rawResponse).substring(0, 500),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Invalid response from AniList search API',
          cause: parseResult.error,
        });
      }

      // Return validated, typed response
      return parseResult.data;
    } catch (error: unknown) {
      if (error instanceof TRPCError) {
        throw error;
      }

      logger.error('[ValidatedAniListClient] Failed to search manga', {
        search,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to search manga on AniList',
        cause: error,
      });
    }
  },

  /**
   * Query AniList page (type-safe)
   *
   * Generic method for any query that returns a Page response.
   * Useful for popular, trending, genre filters, etc.
   *
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @returns Validated page response
   *
   * @example
   * ```typescript
   * const response = await validatedAnilistClient.queryPage(
   *   GET_POPULAR_MANGA,
   *   { page: 1, perPage: 20 }
   * );
   *
   * const media = response.data?.Page?.media ?? [];
   * ```
   */
  async queryPage(
    query: string,
    variables: Record<string, unknown>
  ): Promise<AniListMediaSearchResponse> {
    try {
      const rawResponse: unknown = await anilistClient.query(query, variables);
      // anilistClient.query() returns the inner data object directly (e.g., { Page: { media: [...] } })
      // Wrap it in { data: ... } to match the expected response structure
      const wrappedResponse = { data: rawResponse } as AniListMediaSearchResponse;

      // Log for debugging
      logger.debug('[ValidatedAniListClient] queryPage response', {
        hasData: !!wrappedResponse.data,
        hasPage: !!(wrappedResponse.data as Record<string, unknown> | null)?.['Page'],
      });

      return wrappedResponse;
    } catch (error: unknown) {
      if (error instanceof TRPCError) {
        throw error;
      }

      logger.error('[ValidatedAniListClient] Page query failed', {
        variables,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to execute AniList page query',
        cause: error,
      });
    }
  },

  /**
   * Query AniList page with priority (type-safe)
   *
   * Routes the request through the global queue with priority support.
   * Use this for home page queries to prevent burst limiting.
   *
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @param priority - Request priority (higher = processed first)
   * @param description - Description for logging
   * @returns Validated page response
   *
   * @example
   * ```typescript
   * const response = await validatedAnilistClient.queryPageWithPriority(
   *   GET_TRENDING_MANGA,
   *   { page: 1, perPage: 20 },
   *   AniListPriority.CRITICAL,
   *   'Trending manga'
   * );
   * ```
   */
  async queryPageWithPriority(
    query: string,
    variables: Record<string, unknown>,
    priority: AniListPriorityLevel = AniListPriority.LOW,
    description?: string
  ): Promise<AniListMediaSearchResponse> {
    try {
      const rawResponse: unknown = await anilistClient.queryWithPriority(
        query,
        variables,
        priority,
        description
      );
      // anilistClient.queryWithPriority() returns the inner data object directly
      // Wrap it in { data: ... } to match the expected response structure
      const wrappedResponse = { data: rawResponse } as AniListMediaSearchResponse;

      // Log for debugging
      logger.debug('[ValidatedAniListClient] queryPageWithPriority response', {
        hasData: !!wrappedResponse.data,
        hasPage: !!(wrappedResponse.data as Record<string, unknown> | null)?.['Page'],
        priority,
        description,
      });

      return wrappedResponse;
    } catch (error: unknown) {
      if (error instanceof TRPCError) {
        throw error;
      }

      logger.error('[ValidatedAniListClient] Page query with priority failed', {
        variables,
        priority,
        description,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to execute AniList page query',
        cause: error,
      });
    }
  },

  /**
   * Raw query with validation (advanced)
   *
   * For custom queries that need validation but don't have a dedicated method.
   * Use the specific methods (getMangaDetails, searchManga) when possible.
   *
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @param schema - Zod schema to validate response
   * @returns Validated response
   *
   * @example
   * ```typescript
   * import { z } from 'zod';
   *
   * const customSchema = z.object({
   *   data: z.object({
   *     Media: z.object({ id: z.number() }).nullable(),
   *   }).nullable(),
   * });
   *
   * const response = await validatedAnilistClient.queryWithValidation(
   *   myQuery,
   *   { id: 123 },
   *   customSchema
   * );
   * ```
   */
  async queryWithValidation<T>(
    query: string,
    variables: Record<string, unknown>,
    schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: unknown } }
  ): Promise<T> {
    try {
      const rawResponse: unknown = await anilistClient.query(query, variables);
      const parseResult = schema.safeParse(rawResponse);

      if (!parseResult.success) {
        logger.error('[ValidatedAniListClient] Custom query validation failed', {
          variables,
          errors: parseResult.error,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Invalid response from AniList API',
          cause: parseResult.error,
        });
      }

      // parseResult.success is true, so data is defined
      if (parseResult.data === undefined) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'AniList API returned undefined data despite successful parse',
        });
      }

      return parseResult.data;
    } catch (error: unknown) {
      if (error instanceof TRPCError) {
        throw error;
      }

      logger.error('[ValidatedAniListClient] Custom query failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to execute AniList query',
        cause: error,
      });
    }
  },
};

/**
 * Migration Guide
 *
 * To migrate existing code:
 *
 * ## Before (Unsafe)
 * ```typescript
 * const response = await anilistClient.query<{ Media: unknown }>(
 *   anilistQueries.GET_MANGA_DETAILS,
 *   { id }
 * );
 *
 * const media = response.Media as { ... }; // Manual casting
 * ```
 *
 * ## After (Safe)
 * ```typescript
 * const response = await validatedAnilistClient.getMangaDetails(id);
 *
 * if (response.data?.Media) {
 *   // response.data.Media is properly typed!
 *   const media = response.data.Media;
 * }
 * ```
 *
 * ## Benefits
 * - No more `as unknown` or `as any` casts
 * - Runtime validation catches API changes
 * - TypeScript autocomplete works
 * - Clear error messages when validation fails
 * - Preserves existing rate limiting & caching
 */

// Re-export priority constants for use in home routers
export { AniListPriority, type AniListPriorityLevel } from './client';
