import { toNumberId, toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { mapToMangaStatus } from '@/utils/status-mapper';

import { anilistService } from '../anilist/service';

import type { SearchProvider, SearchResult, SearchOptions, AniListDate } from './types';
import type { AniListMangaResult, AniListMangaDetails } from '../anilist/service';
/**
 * AniList Search Provider
 *
 * Implements direct integration with the AniList GraphQL API for manga search
 * and metadata retrieval. This provider handles all AniList-specific data
 * transformations and provides fallback mechanisms for error cases.
 *
 * @remarks
 * - Uses direct GraphQL API calls through anilistService
 * - Handles data transformation from AniList format to SearchResult format
 * - Provides fallback mechanisms for failed lookups
 * - Implements caching and rate limiting through anilistService
 *
 * @example
 * ```typescript
 * const provider = new AniListSearchProvider();
 *
 * // Search for manga
 * const results = await provider.search('One Piece');
 *
 * // Get detailed metadata
 * const manga = await provider.getMetadata('21');
 * ```
 */
export class AniListSearchProvider implements SearchProvider {
    name = 'anilist';
    /**
     * Verifies that AniList integration is properly configured
     *
     * Checks if the AniList service is enabled and properly configured.
     * This includes verifying API access and any required credentials.
     *
     * @returns Promise<boolean> True if AniList is enabled and configured
     * @throws {Error} If there's an error checking the configuration
     *
     * @example
     * ```typescript
     * if (await provider.verifyAnilistConfig()) {
     *   logger.info('AniList integration is ready');
     * }
     * ```
     */
    private async verifyAnilistConfig(): Promise<boolean> {
        try {
            return await anilistService.initialize();
        }
        catch (error: unknown) {
            logger.error(`Failed to verify AniList config: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    /**
     * Formats an AniList date object into a standardized string
     *
     * Converts AniList's partial date format (separate year/month/day fields)
     * into a standardized ISO date string. Handles missing fields by using
     * default values (01 for missing month/day).
     *
     * @param date - The AniList date object to format
     * @returns string | undefined ISO date string or undefined if invalid
     *
     * @example
     * ```typescript
     * // Complete date
     * formatDate({ year: 2025, month: 3, day: 11 })
     * // Returns: "2025-03-11"
     *
     * // Partial date (missing day)
     * formatDate({ year: 2025, month: 3 })
     * // Returns: "2025-03-01"
     * ```
     */
    private formatDate(date?: AniListDate): string | undefined {
        if (!date?.year)
            return undefined;
        const month = date.month ? String(date.month).padStart(2, '0') : '01';
        const day = date.day ? String(date.day).padStart(2, '0') : '01';
        return `${date.year}-${month}-${day}`;
    }
    /**
     * Builds the basic SearchResult object with core fields
     *
     * Creates the foundational SearchResult with required fields like
     * id, title, cover, description, status, chapters, and volumes.
     *
     * @param media - The raw AniList media object
     * @returns SearchResult The base search result object
     */
    private buildBasicResult(media: AniListMangaResult | AniListMangaDetails): SearchResult {
        const coverUrl = media.coverImage?.large ?? media.coverImage?.medium ?? '/cover-not-found.jpg';

        const result: SearchResult = {
            id: toStringId(media["id"]),
            title: (media["title"].romaji ?? media["title"].english) ?? media["title"].native ?? '',
            cover: coverUrl,
            coverImage: coverUrl,
            ...(media["description"] !== undefined ? { description: media["description"] } : {}),
            ...(media["status"] !== undefined ? { status: this.mapAniListStatus(media["status"]) } : {}),
            ...(media["chapters"] !== undefined ? { chapters: media["chapters"] } : {}),
            ...(media.volumes !== undefined ? { volumes: media.volumes } : {})
        };

        // Log the volume and chapter counts for debugging
        logger.debug(`AniList manga ${media["id"]} (${result["title"]}) has ${media.volumes ?? 'unknown'} volumes and ${media["chapters"] ?? 'unknown'} chapters`);

        // Log the description field specifically
        if (media["description"]) {
            logger.debug(`AniList manga ${media["id"]} (${result["title"]}) has description: ${media["description"].substring(0, 50)}...`);
        } else {
            logger.warn(`AniList manga ${media["id"]} (${result["title"]}) is missing description field`);
        }

        return result;
    }

    /**
     * Adds alternative titles to the search result
     *
     * Collects English, native, and synonym titles that differ from
     * the primary title and adds them to the result.
     *
     * @param media - The raw AniList media object
     * @param result - The search result to modify (mutated in place for builder pattern)
     */
    private addAlternativeTitles(media: AniListMangaResult | AniListMangaDetails, result: SearchResult): void {
        const alternativeTitles: string[] = [];

        if (media["title"].english && media["title"].english !== result["title"]) {
            alternativeTitles.push(media["title"].english);
        }
        if (media["title"].native && media["title"].native !== result["title"]) {
            alternativeTitles.push(media["title"].native);
        }
        if ('synonyms' in media && media.synonyms.length > 0) {
            alternativeTitles.push(...media.synonyms);
        }

        if (alternativeTitles.length > 0) {
            result.alternativeTitles = alternativeTitles; // eslint-disable-line no-param-reassign -- Builder pattern: intentionally mutating result object
        }
    }

    /**
     * Adds genres, scores, and popularity to the search result
     *
     * Includes genre list, average score, and popularity metrics
     * if available in the media data.
     *
     * @param media - The raw AniList media object
     * @param result - The search result to modify (mutated in place for builder pattern)
     */
    private addGenresAndScores(media: AniListMangaResult | AniListMangaDetails, result: SearchResult): void {
        if ('genres' in media && media["genres"].length > 0) {
            result.genres = media["genres"]; // eslint-disable-line no-param-reassign -- Builder pattern: intentionally mutating result object
        }

        if (media.averageScore !== undefined) {
            result.score = media.averageScore; // eslint-disable-line no-param-reassign -- Builder pattern: intentionally mutating result object
        }

        if (media.popularity !== undefined) {
            result.popularity = media.popularity; // eslint-disable-line no-param-reassign -- Builder pattern: intentionally mutating result object
        }
    }

    /**
     * Adds start and end date fields to the search result
     *
     * Converts AniList date objects to formatted strings and
     * adds them to the result if available.
     *
     * @param media - The raw AniList media object
     * @param result - The search result to modify (mutated in place for builder pattern)
     */
    private addDateFields(media: AniListMangaResult | AniListMangaDetails, result: SearchResult): void {
        const startDate = this.formatDate(media.startDate);
        if (startDate) {
            result.startDate = startDate; // eslint-disable-line no-param-reassign -- Builder pattern: intentionally mutating result object
        }

        if ('endDate' in media) {
            const endDate = this.formatDate(media.endDate);
            if (endDate) {
                result.endDate = endDate; // eslint-disable-line no-param-reassign -- Builder pattern: intentionally mutating result object
            }
        }
    }

    /**
     * Adds staff information to the search result
     *
     * Transforms AniList staff edges into standardized staff objects
     * with names and roles.
     *
     * @param media - The raw AniList media object
     * @param result - The search result to modify (mutated in place for builder pattern)
     */
    private addStaffInfo(media: AniListMangaResult | AniListMangaDetails, result: SearchResult): void {
        if ('staff' in media && media.staff.edges) {
            // eslint-disable-next-line no-param-reassign -- Builder pattern: intentionally mutating result object
            result.staff = media.staff.edges.filter(edge => edge.node?.name?.full).map(edge => ({
                id: 0, // Staff ID not available in AniList API
                name: edge.node?.name?.full ?? '',
                role: edge.role ?? 'UNKNOWN'
                // image omitted (not available in AniList API)
            }));
        }
    }

    /**
     * Adds tag information to the search result
     *
     * Transforms AniList tags into standardized tag objects
     * with names, ranks, and spoiler flags.
     *
     * @param media - The raw AniList media object
     * @param result - The search result to modify (mutated in place for builder pattern)
     */
    private addTagsInfo(media: AniListMangaResult | AniListMangaDetails, result: SearchResult): void {
        if ('tags' in media) {
            // eslint-disable-next-line no-param-reassign -- Builder pattern: intentionally mutating result object
            result["tags"] = media["tags"].filter(tag => tag.name).map(tag => ({
                id: 0, // Tag ID not available in AniList API
                name: tag["name"] ?? '',
                category: undefined,
                rank: tag.rank,
                isGeneralSpoiler: false,
                isMediaSpoiler: false
            }));
        }
    }

    /**
     * Adds external links to the search result
     *
     * Transforms AniList external links into standardized link objects
     * with URLs and site names.
     *
     * @param media - The raw AniList media object
     * @param result - The search result to modify (mutated in place for builder pattern)
     */
    private addExternalLinks(media: AniListMangaResult | AniListMangaDetails, result: SearchResult): void {
        if ('externalLinks' in media) {
            // eslint-disable-next-line no-param-reassign -- Builder pattern: intentionally mutating result object
            result.externalLinks = media.externalLinks.filter(link => link.url && link.site).map(link => ({
                id: 0, // Link ID not available in AniList API
                url: link.url ?? '',
                site: link.site ?? ''
                // type omitted (not available in AniList API)
            }));
        }
    }

    /**
     * Transforms AniList media data into a standardized SearchResult
     *
     * Converts AniList's media format into the application's standardized
     * SearchResult format. Handles all data mapping, including complex fields
     * like character lists and relations.
     *
     * @param media - The raw AniList media object
     * @returns SearchResult The transformed search result
     *
     * @remarks
     * - Handles missing or partial data gracefully
     * - Provides default values for required fields
     * - Logs detailed debug information during transformation
     * - Preserves all available metadata from AniList
     *
     * @example
     * ```typescript
     * const anilistData = await anilistService.getMangaDetails(21);
     * const result = transformAniListMedia(anilistData);
     * logger.info(result["title"]); // Standardized manga data
     * ```
     */
    private transformAniListMedia(media: AniListMangaResult | AniListMangaDetails): SearchResult {
        logger.debug(`Raw AniList media object for ${media["id"]}: ${JSON.stringify({
            id: media["id"],
            title: media["title"],
            description: media["description"] ? 'Present (length: ' + media["description"].length + ')' : 'Missing',
            volumes: media.volumes,
            chapters: media.chapters
        })}`);

        const result = this.buildBasicResult(media);
        this.addAlternativeTitles(media, result);
        this.addGenresAndScores(media, result);
        this.addDateFields(media, result);
        this.addStaffInfo(media, result);
        this.addTagsInfo(media, result);
        this.addExternalLinks(media, result);

        return result;
    }
    /**
     * Maps AniList publication status to internal status format
     *
     * Converts AniList-specific status values to the application's
     * standardized status format. Provides consistent status mapping
     * across different data sources.
     *
     * @param status - The AniList status string
     * @returns string The mapped internal status
     *
     * @example
     * ```typescript
     * mapAniListStatus('RELEASING')  // Returns: 'ONGOING'
     * mapAniListStatus('FINISHED')   // Returns: 'COMPLETED'
     * mapAniListStatus('HIATUS')     // Returns: 'HIATUS'
     * ```
     *
     * Status mappings:
     * - FINISHED -> COMPLETED
     * - RELEASING -> ONGOING
     * - NOT_YET_RELEASED -> UPCOMING
     * - CANCELLED -> CANCELLED
     * - HIATUS -> HIATUS
     */
    private mapAniListStatus(status?: string): string {
        if (!status)
            return 'UNKNOWN';
        return mapToMangaStatus(status);
    }
    /**
     * Creates a basic SearchResult for fallback scenarios
     *
     * Generates a minimal valid SearchResult when complete data is unavailable.
     * Used as a fallback to ensure the application always receives valid data
     * even when lookups fail.
     *
     * @param id - The manga ID or generated ID
     * @param title - The manga title or fallback title
     * @returns SearchResult A basic valid search result
     *
     * @example
     * ```typescript
     * // When lookup fails
     * const fallback = createBasicSearchResult('404', 'Unknown Manga');
     *
     * // With known title
     * const basic = createBasicSearchResult('temp-1', 'One Piece');
     * ```
     */
    private createBasicSearchResult(id: string, title: string): SearchResult {
        return {
            id,
            title,
            description: '',
            cover: '/cover-not-found.jpg',
            coverImage: '/cover-not-found.jpg',
            status: 'Unknown',
            alternativeTitles: [],
            genres: [],
            chapters: null,
            volumes: null
        };
    }
    /**
     * Searches for manga on AniList
     *
     * Performs a search query against the AniList API with pagination support.
     * Transforms all results into the standardized SearchResult format.
     *
     * @param query - The search query string
     * @param options - Optional search configuration
     * @returns Promise<SearchResult[]> Array of search results
     * @throws {Error} If the search operation fails
     *
     * @remarks
     * - Handles pagination automatically
     * - Transforms all results to standard format
     * - Includes detailed error logging
     * - Does not require authentication
     *
     * @example
     * ```typescript
     * // Basic search
     * const results = await provider.search('One Piece');
     *
     * // Search with pagination
     * const page2 = await provider.search('manga', {
     *   offset: 10,
     *   limit: 10
     * });
     * ```
     */
    async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        // AniList search doesn't require authentication, so we can skip the enabled check
        try {
            logger.info(`Searching AniList for: "${query}"`);
            // Get search options
            const perPage = options?.limit ?? 10;
            // Search for manga using the optimized basic search
            const results = await anilistService.searchManga(query, {
                limit: perPage,
                includeDescription: true
            });
            // Transform results to SearchResult format
            const transformedResults = results.map(media => this.transformAniListMedia(media));
            logger.info(`Found ${transformedResults.length} results from AniList search`);
            logger.debug(`Transformed ${transformedResults.length} AniList results to SearchResult format`);
            return transformedResults;
        }
        catch (error: unknown) {
            logger.error(`AniList search error: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error('Failed to search AniList');
        }
    }
    /**
     * Retrieves detailed manga metadata from AniList
     *
     * Fetches comprehensive manga information using either an ID or title.
     * Includes fallback mechanisms for failed lookups and data validation.
     *
     * @param id - The AniList manga ID
     * @param title - Optional title for fallback search
     * @returns Promise<SearchResult> Complete manga metadata
     * @throws {Error} If metadata retrieval fails with no valid fallback
     *
     * @remarks
     * Fallback behavior:
     * 1. Tries ID lookup first
     * 2. Falls back to title search if ID fails
     * 3. Creates basic result if both fail
     *
     * @example
     * ```typescript
     * // Get by ID
     * const manga = await provider.getMetadata('21');
     *
     * // Get with fallback title
     * const manga = await provider.getMetadata('invalid', 'One Piece');
     * ```
     */
    async getMetadata(id: string, title?: string): Promise<SearchResult> {
        try {
            // Check if the ID is valid
            const mangaId = toNumberId(id);
            if (isNaN(mangaId)) {
                logger.warn(`Invalid AniList ID: ${id}, will try to use title fallback if available`);
                // If we have a title, try to search by title instead
                if (title) {
                    return await this.getMetadataByTitle(title);
                }
                // If no title is provided, create a basic result with the ID as the title
                logger.error(`Invalid AniList ID: ${id} and no title provided for fallback`);
                return this.createBasicSearchResult(id, title ?? `Manga ${id}`);
            }
            // Get manga details using the complete info query to get all available data
            const manga = await anilistService.getMangaDetails(mangaId);
            if (!manga) {
                logger.warn(`No manga found for AniList ID: ${id}, will try to use title fallback if available`);
                // If we have a title, try to search by title instead
                if (title) {
                    return await this.getMetadataByTitle(title);
                }
                // If no title is provided, create a basic result with the ID as the title
                logger.error(`No manga found for AniList ID: ${id} and no title provided for fallback`);
                return this.createBasicSearchResult(id, title ?? `Manga ${id}`);
            }
            // Transform to SearchResult format
            return this.transformAniListMedia(manga);
        }
        catch (error: unknown) {
            // Log the error
            logger.error(`AniList metadata error: ${error instanceof Error ? error.message : String(error)}`);
            // Try fallback if title is provided
            if (title) {
                logger.info(`Attempting fallback search by title: "${title}"`);
                try {
                    return await this.getMetadataByTitle(title);
                }
                catch (fallbackError: unknown) {
                    logger.error(`Fallback search also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
                }
            }
            // Create a basic result if all else fails
            return this.createBasicSearchResult(id, title ?? `Manga ${id}`);
        }
    }
    /**
     * Retrieves metadata by performing a title search
     *
     * Fallback method that searches for a manga by title and uses the
     * first result as the metadata source. Used when ID lookup fails.
     *
     * @param title - The manga title to search for
     * @returns Promise<SearchResult> Metadata from best matching result
     * @throws {Error} If no results are found
     *
     * @remarks
     * - Uses standard search with limit 1
     * - Returns basic result if no matches found
     * - Logs all fallback attempts for debugging
     *
     * @example
     * ```typescript
     * // When ID lookup fails
     * const manga = await provider.getMetadataByTitle('One Piece');
     * ```
     */
    private async getMetadataByTitle(title: string): Promise<SearchResult> {
        logger.info(`Searching for manga by title: "${title}"`);
        try {
            // Search for the manga by title
            const searchResults = await this.search(title);
            if (searchResults.length === 0) {
                logger.warn(`No search results found for title: "${title}"`);
                return this.createBasicSearchResult(`title-${Date.now()}`, title);
            }
            // Use the first result
            const firstResult = searchResults[0];
            if (!firstResult) {
                logger.warn(`First search result is undefined for title: "${title}"`);
                return this.createBasicSearchResult(`title-${Date.now()}`, title);
            }
            logger.info(`Using first search result: "${firstResult["title"]}" (ID: ${firstResult["id"]})`);
            return firstResult;
        }
        catch (error: unknown) {
            // If search fails, create a basic result
            logger.error(`Error searching by title: ${error instanceof Error ? error.message : String(error)}`);
            return this.createBasicSearchResult(`title-${Date.now()}`, title);
        }
    }
}
// Create and export default instance
export const anilistProvider = new AniListSearchProvider();
