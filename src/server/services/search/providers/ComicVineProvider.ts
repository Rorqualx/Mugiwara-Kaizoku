
import { SortCriteria, SortOrder } from '@prisma/client';
import { MetadataProvider } from '@prisma/client';

import { getComicVineSearchConfig } from '@/server/services/comicvine/search-config';
import { comicvineService } from '@/server/services/comicvine/service';
import type { SearchResult, SearchOptions, ComicVineSearchResult } from '@/types/search.types';
import { ValidationError } from '@/utils/errors';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { BaseSearchProvider } from './BaseSearchProvider';
import { getPreferredLanguage } from './comicvine-language-filter';
import {
  type ComicVineSearchOptions,
  normalizeQueryIfEnabled,
  rankResultsByRelevanceOptimized,
  searchWithVariants,
  needsThemeScraping,
  scrapeAndAssignThemesGenres,
} from './ComicVineProvider/index';
import { SearchResultValidator } from './SearchResultValidator';

/**
 * ComicVine Search Provider
 *
 * Implements the ComicVine search provider using the adapter pattern.
 * Handles transformation between ComicVine's API format and domain types.
 *
 * Optimizations (configurable via search-config.ts):
 * - Multi-query search with title variations (English + Japanese/romanized)
 * - Series page preference (4050 volumes over 4000 issues)
 * - Title normalization applied to search queries
 * - Publisher-based validation/scoring for known manga publishers
 */

// Re-export for consumers
export type { ComicVineSearchOptions };

/**
 * ComicVine search provider implementation
 */
export class ComicVineProvider extends BaseSearchProvider {
    name = 'comicvine';
    type = MetadataProvider.COMICVINE;
    /**
     * Check if ComicVine provider is enabled
     *
     * @returns Boolean indicating if the provider is enabled
     */
    override async isEnabled(): Promise<boolean> {
        try {
            const { comicvineConfigService } = await import('../../comicvine/configService');
            return await comicvineConfigService.isEnabled();
        }
        catch (error: unknown) {
            logger.error(`Error checking if ComicVine is enabled: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    /**
     * Search for comics on ComicVine
     *
     * Supports optimizations:
     * - Title normalization (removes special chars, etc.)
     * - Multi-query search with alternative titles
     * - Publisher and resource type scoring boosts
     *
     * @param query - Search query string
     * @param options - Optional search configuration with alternative titles
     * @returns Promise with search results
     */
    override async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        try {
            const config = await getComicVineSearchConfig();
            const cvOptions = options as ComicVineSearchOptions | undefined;

            logger.info(`Searching ComicVine for: "${query}"`, {
                enableMultiQuery: config.enableMultiQuery,
                hasAlternativeTitles: !!cvOptions?.alternativeTitles,
            });

            const apiKey = await this.getComicVineApiKey();
            if (!apiKey) {
                logger.warn('ComicVine API key not found in configuration');
                return [];
            }

            // Normalize query if enabled
            const normalizedQuery = normalizeQueryIfEnabled(query, config);

            // Multi-query search if enabled and alternative titles provided
            if (config.enableMultiQuery && cvOptions?.alternativeTitles) {
                const results = await searchWithVariants(
                    normalizedQuery,
                    cvOptions.alternativeTitles,
                    apiKey,
                    this.type,
                    this.buildSearchParams.bind(this),
                    options
                );
                return await this.enrichResultsWithDescriptions(results);
            }

            // Single query search with optimized ranking
            return await this.searchSingleOptimized(normalizedQuery, apiKey, options);
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logApiError('search', errorMessage, { query, options });
            return [];
        }
    }

    /**
     * Perform a single search query with optimized ranking
     */
    private async searchSingleOptimized(
        query: string,
        apiKey: string,
        options?: SearchOptions
    ): Promise<SearchResult[]> {
        const preferredLanguage = await getPreferredLanguage();
        const config = await getComicVineSearchConfig();

        const params = this.buildSearchParams(query, apiKey, options);
        const rawResults = await comicvineService.searchVolumes(params);
        const results = this.processRawResults(rawResults);

        // Use optimized ranking with all scoring factors
        const rankedResults = rankResultsByRelevanceOptimized(
            results,
            query,
            preferredLanguage,
            config,
            rawResults
        );

        logger.info(`ComicVine search for "${query}" returned ${rankedResults.length} results`);
        this.logSearchResults(query, rankedResults, rawResults);

        return this.enrichResultsWithDescriptions(rankedResults);
    }

    /**
     * Enrich search results that are missing descriptions
     * Fetches detailed metadata for results without deck/description
     *
     * @param results - Search results to enrich
     * @returns Enriched search results with descriptions
     */
    private async enrichResultsWithDescriptions(results: SearchResult[]): Promise<SearchResult[]> {
        // Find results that need enrichment (missing deck and description)
        const needsEnrichment = results.filter(r => {
            const cvResult = r as ComicVineSearchResult;
            return !cvResult.deck && !r.description;
        });

        if (needsEnrichment.length === 0) {
            logger.debug('[ComicVine] All results have descriptions, no enrichment needed');
            return results;
        }

        logger.info(`[ComicVine] Enriching ${needsEnrichment.length}/${results.length} results with descriptions`);

        // Fetch detailed metadata for results without descriptions (in parallel, max 5)
        const enrichmentPromises = needsEnrichment.slice(0, 5).map(async (result) => {
            try {
                const detailed = await this.getMetadata(result.id, result.title);
                return { id: result.id, detailed };
            } catch (error) {
                logger.warn(`[ComicVine] Failed to enrich result ${result.id}:`, error);
                return { id: result.id, detailed: null };
            }
        });

        const enriched = await Promise.all(enrichmentPromises);
        const enrichmentMap = new Map(enriched.map(e => [e.id, e.detailed]));

        // Merge enriched data back into results
        return results.map(result => {
            const detailed = enrichmentMap.get(result.id);
            if (!detailed) return result;

            // Merge description/deck from detailed into result
            const cvResult = result as ComicVineSearchResult;
            const cvDetailed = detailed as ComicVineSearchResult;

            return {
                ...result,
                description: cvDetailed.description ?? cvResult.description,
                deck: cvDetailed.deck ?? cvResult.deck,
            } as SearchResult;
        });
    }

    /**
     * Get ComicVine API key from configuration service
     *
     * @returns Promise with API key or null if not found
     */
    private async getComicVineApiKey(): Promise<string | null> {
        const { comicvineConfigService } = await import('../../comicvine/configService');
        return comicvineConfigService.getApiKey();
    }

    /**
     * Build search parameters for ComicVine API
     *
     * @param query - Search query string
     * @param apiKey - ComicVine API key
     * @param options - Optional search configuration
     * @returns Search parameters object
     */
    private buildSearchParams(query: string, apiKey: string, options?: SearchOptions): { query: string; apiKey: string; limit?: number; offset?: number; sort?: string } {
        const limit = options?.limit ?? 20;
        const page = options?.page ?? 1;
        const offset = (page - 1) * limit;

        const sortField = this.mapSortCriteria(options?.sort);
        const sortDirection = this.mapSortOrder(options?.order);

        return {
            query,
            apiKey,
            limit,
            offset,
            ...(sortField && { sort: `${sortField}:${sortDirection}` })
        };
    }

    /**
     * Process and validate raw API results
     *
     * @param rawResults - Raw results from ComicVine API
     * @returns Validated and processed search results
     */
    private processRawResults(rawResults: unknown): SearchResult[] {
        const rawResultsData = rawResults && typeof rawResults === 'object' && 'results' in rawResults ? rawResults.results : [];
        return SearchResultValidator.processResults(Array.isArray(rawResultsData) ? rawResultsData : [], this.type);
    }

    /**
     * Log search results summary for debugging
     */
    private logSearchResults(_query: string, results: SearchResult[], _rawResults: unknown): void {
        const firstResult = results[0];
        if (firstResult) {
            logger.debug('[ComicVineProvider] First result:', {
                title: firstResult.title,
                hasDescription: !!firstResult.description,
                genres: firstResult.genres?.length ?? 0,
                authors: firstResult.authors?.length ?? 0,
            });
        }
    }

    /**
     * Get detailed metadata for a comic from ComicVine
     *
     * @param id - ComicVine volume ID
     * @param title - Optional fallback title if lookup fails
     * @returns Promise with detailed comic data
     */
    override async getMetadata(id: string, title?: string): Promise<SearchResult> {
        try {
            logger.info(`Getting metadata from ComicVine for ID: ${id}`);
            // Get API key from ComicVine config service
            const { comicvineConfigService } = await import('../../comicvine/configService');
            const apiKey = await comicvineConfigService.getApiKey();
            if (!apiKey) {
                throw new ValidationError('ComicVine API key not found in configuration');
            }
            // Get raw volume data from ComicVine API
            const rawVolume = await comicvineService.getVolume(id, apiKey);
            // Process and validate result
            const rawVolumeData = rawVolume && typeof rawVolume === 'object' && 'results' in rawVolume ? rawVolume.results : {};
            const result = SearchResultValidator.validateAndTransform(rawVolumeData ?? {}, this.type);
            if (!result) {
                throw new ValidationError(`Invalid metadata response for volume ID: ${id}`);
            }

            // Scrape themes directly since ComicVine API doesn't return concepts
            // Note: We can't call enrichSearchResult() here as it would create a circular call
            // (enrichSearchResult calls getMetadata internally)
            let enrichedResult: SearchResult = result;
            const siteUrl = (result as ComicVineSearchResult).siteDetailUrl ?? result.url;

            logger.info('[ComicVineProvider.getMetadata] Result before scraping:', {
                id,
                hasSiteUrl: !!siteUrl,
                siteUrl: siteUrl ?? 'NOT SET',
                hasThemes: !!result.themes,
                hasAuthors: !!result.authors
            });

            // Scrape themes/genres if needed
            if (needsThemeScraping(enrichedResult)) {
                enrichedResult = await scrapeAndAssignThemesGenres(enrichedResult, siteUrl);
            }

            logger.info('[ComicVineProvider.getMetadata] Final result:', {
                id,
                hasThemes: !!enrichedResult.themes,
                themesCount: enrichedResult.themes?.length ?? 0,
                themes: enrichedResult.themes ?? [],
                hasCoverImage: !!enrichedResult.coverImage,
                coverImage: enrichedResult.coverImage ?? 'NOT SET'
            });

            return enrichedResult;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
this.logApiError('getMetadata', errorMessage, {
                id
            });
            // Return minimal result for failed lookup
            const minimalResult: ComicVineSearchResult = {
                id,
                title: title ?? id,
                provider: MetadataProvider.COMICVINE,
                volumeId: toNumberId(id),
                comicvineId: id,
                type: undefined
            };
            return minimalResult;
        }
    }
    /**
     * Map domain sort criteria to ComicVine-specific sort field
     *
     * @param criteria - Domain sort criteria
     * @returns ComicVine sort field or undefined
     */
    private mapSortCriteria(criteria?: SortCriteria): string | undefined {
        if (!criteria)
            return undefined;
        switch (criteria) {
            case SortCriteria.TITLE:
                return 'name';
            case SortCriteria.DATE_ADDED:
                return 'date_added';
            case SortCriteria.DATE_UPDATED:
                return 'date_last_updated';
            case SortCriteria.START_DATE:
                return 'start_year';
            default:
                return undefined;
        }
    }
    /**
     * Map domain sort order to ComicVine-specific sort direction
     *
     * @param order - Domain sort order
     * @returns ComicVine sort direction string
     */
    private mapSortOrder(order?: SortOrder): string {
        return order === SortOrder.ASC ? 'asc' : 'desc';
    }
    /**
     * Enrich a search result with detailed metadata
     * Fetches full volume information including description
     * Also scrapes themes from the volume page since API doesn't return concepts
     *
     * @param result - Search result to enrich
     * @returns Promise with enriched search result
     */
    async enrichSearchResult(result: SearchResult): Promise<SearchResult> {
        try {
            if (!this.shouldEnrich(result)) {
                return result;
            }

            const detailed = await this.getMetadata(result["id"], result["title"]);

            let enrichedResult: SearchResult = {
                ...result,
                ...this.mergeMetadataFields(result, detailed),
                ...(detailed.provider === MetadataProvider.COMICVINE
                    ? this.mergeComicVineSpecificFields(detailed)
                    : {})
            };

            // Scrape themes/genres if needed
            if (needsThemeScraping(enrichedResult)) {
                const siteUrl = (enrichedResult as ComicVineSearchResult).siteDetailUrl;
                enrichedResult = await scrapeAndAssignThemesGenres(enrichedResult, siteUrl);
            }

            logger.debug(`Enriched Comic Vine result ${result["id"]}:`, {
                hasDescription: !!enrichedResult["description"],
                descriptionLength: enrichedResult["description"]?.length,
                genres: enrichedResult["genres"],
                themes: enrichedResult.themes,
                authors: enrichedResult["authors"],
                volumes: enrichedResult.volumes
            });

            return enrichedResult;
        } catch (error: unknown) {
            logger.warn(`Failed to enrich Comic Vine result ${result["id"]}: ${error instanceof Error ? error.message : String(error)}`);
            return result;
        }
    }

    /**
     * Check if a search result needs enrichment
     *
     * @param result - Search result to check
     * @returns Boolean indicating if enrichment is needed
     */
    private shouldEnrich(result: SearchResult): boolean {
        return !('metadataComplete' in result && result.metadataComplete);
    }

    /**
     * Merge metadata fields from detailed result into base result
     *
     * @param result - Base search result
     * @param detailed - Detailed search result with metadata
     * @returns Partial search result with merged metadata fields
     */
    private mergeMetadataFields(_result: SearchResult, detailed: SearchResult): Partial<SearchResult> {
        const fields: Partial<SearchResult> = {};

        // Merge each field, preferring detailed over result
        if (detailed["description"]) fields.description = detailed["description"];
        if (detailed["genres"]) fields.genres = detailed["genres"];
        if (detailed["alternativeTitles"]) fields.alternativeTitles = detailed["alternativeTitles"];
        if (detailed["chapters"] !== undefined) fields.chapters = detailed["chapters"];
        if (detailed.volumes !== undefined) fields.volumes = detailed.volumes;
        if (detailed["authors"]) fields.authors = detailed["authors"];
        if (detailed.artists) fields.artists = detailed.artists;
        if (detailed.year) fields.year = detailed.year;
        if (detailed["status"]) fields.status = detailed["status"];
        if (detailed["metadata"]) fields.metadata = detailed["metadata"];
        if (detailed.coverImage) fields.coverImage = detailed.coverImage;

        // Merge themes from result or metadata
        const detailedObj = detailed as unknown as Record<string, unknown>;
        const detailedThemes = detailedObj['themes'] as string[] | undefined;
        const metadataObj = detailed.metadata as Record<string, unknown> | undefined;
        const metadataThemes = metadataObj?.['themes'] as string[] | undefined;
        const themes = detailedThemes ?? metadataThemes;
        if (themes && themes.length > 0) {
            (fields as unknown as Record<string, unknown>)['themes'] = themes;
            logger.debug('[ComicVineProvider] Merged themes from detailed result:', { themes });
        }

        return fields;
    }

    /**
     * Merge ComicVine-specific fields from detailed result
     *
     * @param detailed - Detailed search result with ComicVine-specific fields
     * @returns Partial ComicVine search result with provider-specific fields
     */
    private mergeComicVineSpecificFields(detailed: SearchResult): Partial<ComicVineSearchResult> {
        return {
            ...('deck' in detailed && { deck: (detailed as ComicVineSearchResult).deck }),
            ...('publisher' in detailed && { publisher: (detailed as ComicVineSearchResult).publisher }),
            ...('issuesCount' in detailed && { issuesCount: (detailed as ComicVineSearchResult).issuesCount }),
            ...('volumeId' in detailed && { volumeId: (detailed as ComicVineSearchResult).volumeId }),
            ...('comicvineId' in detailed && { comicvineId: (detailed as ComicVineSearchResult).comicvineId }),
            ...('siteDetailUrl' in detailed && { siteDetailUrl: (detailed as ComicVineSearchResult).siteDetailUrl })
        };
    }
}
// Export singleton instance
export const comicvineProvider = new ComicVineProvider();
