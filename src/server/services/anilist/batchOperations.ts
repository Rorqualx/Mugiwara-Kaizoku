/**
 * AniList Batch Operations Module
 *
 * Provides optimized batch operations for AniList API interactions.
 * Implements efficient data fetching by combining multiple requests
 * into single API calls to reduce rate limiting impact.
 *
 * Features:
 * - Batch manga details fetching
 * - Batch manga search
 * - Automatic chunking for large requests
 * - Error handling and logging
 * - Rate limit consideration
 *
 * @module server/services/anilist/batchOperations
 * @requires ./client - AniList API client
 * @requires ./service - AniList service types
 * @requires @/utils/logging - Logging utilities
 */
import { logger } from '@/utils/logger';

import { anilistClient } from './client';

import type { AniListMangaDetails } from './service';
/**
 * GraphQL Query: Batch Manga Details
 *
 * Fetches detailed information for multiple manga in a single request.
 * Limited to 50 IDs per request by AniList API constraints.
 *
 * Returns:
 * - Basic information (titles, description)
 * - Media assets (cover images, banner)
 * - Publication details (status, volumes, chapters)
 * - Metadata (genres, tags, scores)
 * - Dates (start, end)
 */
const BATCH_MANGA_DETAILS_QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: MANGA) {
        id
        title {
          romaji
          english
          native
        }
        description
        coverImage {
          extraLarge
          large
          medium
          color
        }
        bannerImage
        status
        volumes
        chapters
        genres
        synonyms
        averageScore
        popularity
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        tags {
          id
          name
          category
        }
      }
    }
  }
`;
/**
 * Batch Manga Details Fetcher
 *
 * Retrieves detailed information for multiple manga in batches.
 * Automatically chunks requests to comply with API limits.
 *
 * Implementation Details:
 * - Chunks requests into groups of 50 (AniList limit)
 * - Processes chunks sequentially to avoid rate limits
 * - Maps results by manga ID for easy lookup
 * - Includes comprehensive error handling
 *
 * @param {number[]} ids - Array of AniList manga IDs to fetch
 * @returns {Promise<Record<number, AniListMangaDetails>>} Object mapping manga IDs to their details
 * @throws {Error} If API request fails or response is invalid
 *
 * @example
 * ```typescript
 * // Fetch details for multiple manga
 * const details = await batchGetMangaDetails([30013, 21, 105778]);
 * logger.info(details[30013].title.english); // Access specific manga details
 * ```
 */
export async function batchGetMangaDetails(ids: number[]): Promise<Record<number, AniListMangaDetails>> {
    if (!ids.length) {
        return {};
    }
    try {
        logger.info(`Batch fetching details for ${ids.length} manga`);
        // Split into chunks of 50 (AniList API limit)
        const chunks: number[][] = [];
        for (let i = 0; i < ids.length; i += 50) {
            chunks.push(ids.slice(i, i + 50));
        }
        const results: Record<number, AniListMangaDetails> = {};
        // Process each chunk sequentially to respect AniList API rate limits
        for (const [index, chunk] of chunks.entries()) {
            logger.debug(`Processing batch ${index + 1}/${chunks.length} (${chunk.length} manga)`);
            // eslint-disable-next-line no-await-in-loop -- Sequential processing required for AniList API rate limiting
            const response = await anilistClient.query<{
                Page: {
                    media: AniListMangaDetails[];
                };
            }>(BATCH_MANGA_DETAILS_QUERY, { ids: chunk });
            // Map results by ID
            for (const media of response.Page.media) {
                results[media["id"]] = media;
            }
        }
        logger.info(`Successfully fetched details for ${Object.keys(results).length}/${ids.length} manga`);
        return results;
    }
    catch (error: unknown) {
        logger.error(`Error batch fetching manga details: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
/**
 * GraphQL Query: Batch Manga Search
 *
 * Searches for multiple manga titles in a single request.
 * Supports pagination for large result sets.
 *
 * Returns:
 * - Basic information (titles)
 * - Cover images
 * - Status and genres
 *
 * Note: Less precise than individual title searches
 * due to AniList API limitations.
 */
const BATCH_MANGA_SEARCH_QUERY = `
  query ($titles: [String], $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: MANGA, search_in: $titles) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
          medium
        }
        status
        genres
      }
    }
  }
`;
/**
 * Batch Manga Search Function
 *
 * Performs a batch search for multiple manga titles.
 * Note: Results may be less precise than individual searches
 * due to AniList API search behavior.
 *
 * Implementation Details:
 * - Supports pagination
 * - Returns combined results
 * - Includes error handling
 * - Logs search statistics
 *
 * @param {string[]} titles - Array of manga titles to search for
 * @param {number} [page=1] - Page number for pagination
 * @param {number} [perPage=50] - Results per page (max 50)
 * @returns {Promise<AniListMangaDetails[]>} Array of matching manga
 * @throws {Error} If search request fails
 *
 * @example
 * ```typescript
 * // Search for multiple manga titles
 * const results = await batchSearchManga(['One Piece', 'Naruto'], 1, 25);
 * logger.info(results.map(manga => manga["title"].english));
 * ```
 */
export async function batchSearchManga(titles: string[], page = 1, perPage = 50): Promise<AniListMangaDetails[]> {
    if (!titles.length) {
        return [];
    }
    try {
        logger.info(`Batch searching for ${titles.length} manga titles`);
        const response = await anilistClient.query<{
            Page: {
                media: AniListMangaDetails[];
            };
        }>(BATCH_MANGA_SEARCH_QUERY, {
            titles,
            page,
            perPage
        });
        const results = response.Page.media;
        logger.info(`Found ${results.length} results for batch search`);
        return results;
    }
    catch (error: unknown) {
        logger.error(`Error batch searching manga: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
/**
 * Example Usage Demonstration
 *
 * Demonstrates proper usage of batch operations.
 * Includes error handling and logging examples.
 *
 * @example
 * ```typescript
 * // Run example usage
 * await exampleBatchUsage();
 * ```
 */
export async function exampleBatchUsage(): Promise<void> {
    try {
        // Example: Fetch details for multiple manga
        const mangaIds = [30013, 21, 105778, 113138, 30002]; // One Piece, Hunter x Hunter, etc.
        const mangaDetails = await batchGetMangaDetails(mangaIds);
        logger.info(`Fetched details for ${Object.keys(mangaDetails).length} manga`);
        for (const [id, manga] of Object.entries(mangaDetails)) {
            logger.info(`- ${id}: ${manga["title"].english ?? manga["title"].romaji}`);
        }
        // Example: Search for multiple manga titles
        const mangaTitles = ['One Piece', 'Naruto', 'Dragon Ball'];
        const searchResults = await batchSearchManga(mangaTitles);
        logger.info(`Found ${searchResults.length} results for batch search`);
        for (const manga of searchResults) {
            logger.info(`- ${manga["id"]}: ${manga["title"].english ?? manga["title"].romaji}`);
        }
    }
    catch (error: unknown) {
        logger.error(`Error in example batch usage: ${error instanceof Error ? error.message : String(error)}`);
    }
}
