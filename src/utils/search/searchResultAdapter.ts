import { ProviderType } from '@prisma/client';

import type { SearchResult, MangaSearchResult } from '@/types/search.types';



import { toStringId } from "../id-converters";
import { logger } from '../logging';

import type { MangaPublicationStatus } from '@prisma/client';


/**
 * Search Result Adapter Module
 *
 * This module provides utilities for adapting search results from various sources
 * into a consistent format for use in the application's UI components.
 *
 * It ensures proper typing, validation, and standardization of search results
 * across different metadata providers.
 */

// Define type guards locally since metadata-guards doesn't exist
function isValidSearchResultArray(results: unknown): results is SearchResult[] {
    if (!Array.isArray(results))
        return false;
    return results.every(r => r && typeof r === 'object' && 'id' in r && 'title' in r && 'provider' in r);
}
/**
 * Adapts raw search results to the standardized SearchResult format
 *
 * @param results - The raw search results from various providers
 * @returns An array of standardized SearchResult objects
 */
export function adaptSearchResults(results: unknown[]): SearchResult[] {
    if (!Array.isArray(results)) {
        logger.warn('adaptSearchResults called with non-array data: ' + typeof results);
        return [];
    }
    // If the results are already valid SearchResult objects, return them as-is
    if (isValidSearchResultArray(results)) {
        return results as SearchResult[];
    }
    // Otherwise, attempt to adapt each result to the SearchResult format
    const adaptedResults: SearchResult[] = [];
    for (const item of results) {
        try {
            const adaptedResult = adaptSearchResult(item);
            if (adaptedResult) {
                adaptedResults.push(adaptedResult);
            }
        }
        catch (error: unknown) {
            logger.warn(`Error adapting search result: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
            logger.warn(`Item: ${typeof item === 'object' ? JSON.stringify(item).substring(0, 100) + '...' : String(item)}`);
        }
    }
    return adaptedResults;
}
/**
 * Adapts a single search result to the standardized SearchResult format
 *
 * @param result - The raw search result from a provider
 * @returns A standardized SearchResult object or null if adaptation fails
 */
export function adaptSearchResult(result: unknown): SearchResult | null {
    if (!result || typeof result !== 'object') {
        return null;
    }
    // Try to extract common fields from the result
    const obj = result as Record<string, unknown>;
    // Required fields
    const id = extractId(obj);
    if (!id)
        return null;
    const title = extractTitle(obj);
    if (!title)
        return null;
    // Determine the provider type from the result
    const providerType = determineProviderType(obj);
    // Create a base search result with required fields
    const baseResult: MangaSearchResult = {
        id,
        title,
        provider: extractProvider(obj) ?? 'unknown'
    };
    const coverImage = extractCoverImage(obj) ?? extractCover(obj);
    if (coverImage !== undefined) {
        baseResult.coverImage = coverImage;
    }
    const description = extractDescription(obj);
    if (description !== undefined) {
        baseResult.description = description;
    }
    const status = extractStatus(obj) as MangaPublicationStatus | undefined;
    if (status !== undefined) {
        baseResult.status = status;
    }
    const alternativeTitles = extractAlternativeTitles(obj);
    if (alternativeTitles !== undefined) {
        baseResult.alternativeTitles = alternativeTitles;
    }
    const genres = extractGenres(obj);
    if (genres !== undefined) {
        baseResult.genres = genres;
    }
    const chapters = extractChapters(obj);
    if (chapters !== null && chapters !== undefined) {
        baseResult.chapters = chapters;
    }
    const volumes = extractVolumes(obj);
    if (volumes !== null && volumes !== undefined) {
        baseResult.volumes = volumes;
    }
    // Create a full search result with the provider type
    const searchResult: SearchResult = {
        ...baseResult,
        type: 'manga', // Default type for search results
        source: extractSource(obj),
        providerType,
        rawData: obj,
        metadataComplete: checkMetadataCompleteness(baseResult)
    } as SearchResult;
    return searchResult;
}
/**
 * Extracts an ID from a search result object
 */
function extractId(obj: Record<string, unknown>): string {
    if ('id' in obj) {
        const id = obj["id"];
        if (typeof id === 'string')
            return id;
        if (typeof id === 'number')
            return toStringId(id);
    }
    // Try alternative id fields
    if ('mangaId' in obj && (typeof obj["mangaId"] === 'string' || typeof obj["mangaId"] === 'number')) {
        return toStringId(obj["mangaId"]);
    }
    if ('sourceId' in obj && typeof obj["sourceId"] === 'string') {
        return obj["sourceId"];
    }
    return '';
}
/**
 * Extracts a title from a search result object
 */
function extractTitle(obj: Record<string, unknown>): string {
    if ('title' in obj) {
        const title = obj["title"];
        if (typeof title === 'string')
            return title;
        // Handle nested title object common in AniList results
        if (title && typeof title === 'object' && 'romaji' in title) {
            const titleObj = title as Record<string, unknown>;
            if (typeof titleObj["romaji"] === 'string')
                return titleObj["romaji"];
            if (typeof titleObj["english"] === 'string')
                return titleObj["english"];
        }
    }
    if ('name' in obj && typeof obj["name"] === 'string') {
        return obj["name"];
    }
    return '';
}
/**
 * Extracts a cover URL from a search result object
 */
function extractCover(obj: Record<string, unknown>): string | undefined {
    if ('coverUrl' in obj && typeof obj["coverUrl"] === 'string') {
        return obj["coverUrl"];
    }
    if ('cover' in obj && typeof obj["cover"] === 'string') {
        return obj["cover"];
    }
    return undefined;
}
/**
 * Extracts a cover image URL from a search result object
 */
function extractCoverImage(obj: Record<string, unknown>): string | undefined {
    if ('coverImage' in obj) {
        const cover = obj["coverImage"];
        if (typeof cover === 'string')
            return cover;
        // Handle nested coverImage object common in AniList results
        if (cover && typeof cover === 'object' && 'large' in cover) {
            const coverObj = cover as Record<string, unknown>;
            if (typeof coverObj["large"] === 'string')
                return coverObj["large"];
            if (typeof coverObj["medium"] === 'string')
                return coverObj["medium"];
            if (typeof coverObj["small"] === 'string')
                return coverObj["small"];
        }
    }
    if ('imageUrl' in obj && typeof obj["imageUrl"] === 'string') {
        return obj["imageUrl"];
    }
    // Fallback to cover if coverImage isn't available
    return extractCover(obj);
}
/**
 * Extracts a description from a search result object
 */
function extractDescription(obj: Record<string, unknown>): string | undefined {
    if ('description' in obj && typeof obj["description"] === 'string') {
        return obj["description"];
    }
    if ('summary' in obj && typeof obj["summary"] === 'string') {
        return obj["summary"];
    }
    if ('deck' in obj && typeof obj["deck"] === 'string') {
        return obj["deck"];
    }
    return undefined;
}
/**
 * Extracts a status from a search result object
 */
function extractStatus(obj: Record<string, unknown>): string | undefined {
    if ('status' in obj && typeof obj["status"] === 'string') {
        return obj["status"];
    }
    return undefined;
}
/**
 * Extracts alternative titles from a search result object
 */
function extractAlternativeTitles(obj: Record<string, unknown>): string[] | undefined {
    if ('alternativeTitles' in obj) {
        const titles = obj["alternativeTitles"];
        if (Array.isArray(titles) && titles.every(t => typeof t === 'string')) {
            return titles as string[];
        }
    }
    if ('synonyms' in obj) {
        const synonyms = obj["synonyms"];
        if (Array.isArray(synonyms) && synonyms.every(s => typeof s === 'string')) {
            return synonyms as string[];
        }
    }
    if ('aliases' in obj) {
        const aliases = obj["aliases"];
        if (Array.isArray(aliases) && aliases.every(a => typeof a === 'string')) {
            return aliases as string[];
        }
    }
    return undefined;
}
/**
 * Extracts a score from a search result object
 */
/**
 * Extracts genres from a search result object
 */
function extractGenres(obj: Record<string, unknown>): string[] | undefined {
    if ('genres' in obj) {
        const genres = obj["genres"];
        if (Array.isArray(genres)) {
            // Handle both string arrays and object arrays
            return genres.map(g => {
                if (typeof g === 'string') {
                    return g;
                }
                if (typeof g === 'object' && g !== null && 'name' in g) {
                    const genreObj = g as Record<string, unknown>;
                    if (typeof genreObj["name"] === 'string') {
                        return genreObj["name"];
                    }
                }
                return '';
            }).filter(g => g !== '');
        }
    }
    return undefined;
}
/**
 * Extracts chapters count from a search result object
 */
function extractChapters(obj: Record<string, unknown>): number | null | undefined {
    if ('chapters' in obj) {
        const chapters = obj["chapters"];
        if (typeof chapters === 'number')
            return chapters;
        if (typeof chapters === 'string') {
            const parsed = parseInt(chapters, 10);
            return isNaN(parsed) ? null : parsed;
        }
    }
    return undefined;
}
/**
 * Extracts volumes count from a search result object
 */
function extractVolumes(obj: Record<string, unknown>): number | null | undefined {
    if ('volumes' in obj) {
        const volumes = obj["volumes"];
        if (typeof volumes === 'number')
            return volumes;
        if (typeof volumes === 'string') {
            const parsed = parseInt(volumes, 10);
            return isNaN(parsed) ? null : parsed;
        }
    }
    if ('volumeCount' in obj && typeof obj["volumeCount"] === 'number') {
        return obj["volumeCount"];
    }
    return undefined;
}
/**
 * Extracts provider name from a search result object
 */
function extractProvider(obj: Record<string, unknown>): string | undefined {
    if ('provider' in obj && typeof obj["provider"] === 'string') {
        return obj["provider"];
    }
    return undefined;
}
/**
 * Extracts source from a search result object
 */
function extractSource(obj: Record<string, unknown>): string {
    if ('source' in obj && typeof obj["source"] === 'string') {
        return obj["source"];
    }
    // Default to 'unknown' if no source is available
    return 'UNKNOWN';
}
/**
 * Determines the provider type from a search result object
 */
function determineProviderType(obj: Record<string, unknown>): ProviderType {
    if ('providerType' in obj && typeof obj["providerType"] === 'string') {
        // Check if the value is a valid ProviderType
        switch (obj["providerType"]) {
            case 'anilist':
                return ProviderType.METADATA;
            case 'comicvine':
                return ProviderType.METADATA;
            case 'fandom':
                return ProviderType.METADATA;
            case 'prowlarr':
                return ProviderType.DOWNLOAD;
            default:
                break;
        }
    }
    // Use source as fallback to determine provider type
    if ('source' in obj && typeof obj["source"] === 'string') {
        switch (obj["source"].toLowerCase()) {
            case 'anilist':
                return ProviderType.METADATA;
            case 'comicvine':
                return ProviderType.METADATA;
            case 'fandom':
                return ProviderType.METADATA;
            case 'prowlarr':
                return ProviderType.DOWNLOAD;
            default:
                break;
        }
    }
    // Default to custom provider type if unable to determine
    return ProviderType.ALL;
}
/**
 * Checks if a search result has complete metadata
 */
function checkMetadataCompleteness(result: MangaSearchResult): boolean {
    // A result is considered to have complete metadata if it has:
    // - title
    // - description
    // - cover image
    // - genres
    return !!(result["title"] && (result["description"] || result["description"] === '') && result.coverImage && result["genres"] && result["genres"].length > 0);
}
