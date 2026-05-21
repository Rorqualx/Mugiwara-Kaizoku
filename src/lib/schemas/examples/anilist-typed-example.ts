/**
 * AniList Type-Safe API Integration Example
 *
 * This file demonstrates how to use the new type-safe API client
 * with Zod schemas for AniList GraphQL queries.
 *
 * **Purpose**: Proof-of-concept for Phase 2 of High-Impact ESLint Strategy
 * **Fixes**: @typescript-eslint/no-unsafe-argument violations in external API calls
 *
 * @example
 * ```typescript
 * // Use this pattern for all external API calls
 * const manga = await fetchAniListMediaById(123);
 * // manga is now typed and validated!
 * ```
 */

import { fetchGraphQL } from '@/lib/api-client';
import {
  AniListMediaQueryResponseSchema,
  AniListMediaSearchResponseSchema,
  type AniListMedia,
  type AniListMediaQueryResponse,
  type AniListMediaSearchResponse,
} from '@/lib/schemas';
import { logger } from '@/utils/logger';

/** AniList GraphQL API endpoint */
const ANILIST_API_URL = 'https://graphql.anilist.co';

/**
 * ❌ BEFORE (removed): Unsafe API call pattern
 *
 * The unsafe pattern was:
 * - Return type `Promise<unknown>` (no type safety)
 * - No runtime validation (crashes if fields missing)
 * - Direct use of fetch() without validation
 * - ESLint violations: @typescript-eslint/no-unsafe-argument
 *
 * This function has been removed as it was just an anti-pattern example.
 * See the type-safe implementation below instead.
 */

/**
 * ✅ CORRECT APPROACH: Type-safe API call (with validation)
 *
 * Benefits:
 * - Return type is properly typed (AniListMedia)
 * - Runtime validation with Zod
 * - Clear error messages if validation fails
 * - No ESLint violations
 */
export async function fetchAniListMediaById(id: number): Promise<AniListMedia | null> {
  try {
    const response: AniListMediaQueryResponse = await fetchGraphQL({
      url: ANILIST_API_URL,
      query: `
        query ($id: Int) {
          Media(id: $id, type: MANGA) {
            id
            idMal
            title { romaji english native }
            description
            coverImage { large medium }
            bannerImage
            chapters
            volumes
            status
            format
            genres
            tags {
              id
              name
              rank
            }
            startDate { year month day }
            endDate { year month day }
            averageScore
            popularity
            synonyms
            externalLinks {
              url
              site
            }
          }
        }
      `,
      variables: { id },
      schema: AniListMediaQueryResponseSchema,
    });

    // Check for GraphQL errors
    if (response.errors && response.errors.length > 0) {
      logger.warn('[AniList] GraphQL errors in response', {
        id,
        errors: response.errors,
      });
      return null;
    }

    return response.data?.Media ?? null;
  } catch (error: unknown) {
    logger.error('[AniList] Failed to fetch media', {
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * ✅ Search for manga by title (type-safe)
 */
export async function searchAniListManga(
  title: string,
  page = 1,
  perPage = 10
): Promise<AniListMedia[]> {
  try {
    const response: AniListMediaSearchResponse = await fetchGraphQL({
      url: ANILIST_API_URL,
      query: `
        query ($search: String, $page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            pageInfo {
              total
              currentPage
              lastPage
              hasNextPage
            }
            media(search: $search, type: MANGA) {
              id
              idMal
              title { romaji english native }
              description
              coverImage { large }
              chapters
              volumes
              status
              averageScore
              popularity
            }
          }
        }
      `,
      variables: { search: title, page, perPage },
      schema: AniListMediaSearchResponseSchema,
    });

    if (response.errors && response.errors.length > 0) {
      logger.warn('[AniList] GraphQL errors in search', {
        title,
        errors: response.errors,
      });
      return [];
    }

    return response.data?.Page?.media ?? [];
  } catch (error: unknown) {
    logger.error('[AniList] Failed to search manga', {
      title,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * ✅ Usage example
 */
export async function exampleUsage(): Promise<void> {
  // Fetch single manga (type-safe)
  const manga = await fetchAniListMediaById(30013); // One Piece

  if (manga) {
    // TypeScript knows all these fields exist and their types!
    logger.info(`Title: ${manga.title?.romaji}`);
    logger.info(`Chapters: ${manga.chapters ?? 'Unknown'}`);
    logger.info(`Score: ${manga.averageScore ?? 'N/A'}`);
    logger.info(`Genres: ${manga.genres.join(', ')}`);
  }

  // Search for manga (type-safe)
  const results = await searchAniListManga('One Piece', 1, 5);

  results.forEach((result) => {
    // TypeScript autocomplete works here!
    logger.info(`- ${result.title?.romaji} (Score: ${result.averageScore})`);
  });
}

/**
 * 🔄 Migration Pattern
 *
 * To migrate existing code:
 *
 * 1. Find unsafe API calls:
 *    ```typescript
 *    const data = await client.query<{ Media: unknown }>(query);
 *    ```
 *
 * 2. Replace with typed version:
 *    ```typescript
 *    const response = await fetchGraphQL({
 *      url: ANILIST_API_URL,
 *      query,
 *      variables,
 *      schema: AniListMediaQueryResponseSchema,
 *    });
 *    ```
 *
 * 3. Update function signature:
 *    ```typescript
 *    // Before
 *    async function fetchManga(id: number): Promise<any>
 *
 *    // After
 *    async function fetchManga(id: number): Promise<AniListMedia | null>
 *    ```
 *
 * 4. Handle validation errors gracefully
 */

// Export for use in other services
export const AniListTypedClient = {
  fetchMediaById: fetchAniListMediaById,
  searchManga: searchAniListManga,
};
