/**
 * Type guards and validation utilities for search results
 *
 * This module provides type guards and validation functions for ensuring
 * search results are properly typed and contain expected data.
 */
import type { SearchResult } from '@/types/search.types';

import { logger } from '../logging';

import type { MangaPublicationStatus } from '@prisma/client';

/**
 * Type guard to check if an object is a valid SearchResult
 *
 * @param value - Value to check
 * @returns boolean indicating if the value is a valid SearchResult
 */
export function isSearchResult(value: unknown): value is SearchResult {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const obj = value as Record<string, unknown>;
    // Check for required properties
    if (!('id' in obj) || typeof obj["id"] !== 'string') {
        return false;
    }
    if (!('title' in obj) || typeof obj["title"] !== 'string') {
        return false;
    }
    // Cover image should be a string if present
    if ('cover' in obj && obj["cover"] !== null && typeof obj["cover"] !== 'string') {
        return false;
    }
    // Cover image should be a string if present
    if ('coverImage' in obj && obj["coverImage"] !== null && typeof obj["coverImage"] !== 'string') {
        return false;
    }
    return true;
}
/**
 * Type guard to validate that a value is a string array
 * @param value - Value to check
 * @returns boolean indicating if value is string[]
 */
function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * Validates and extracts required fields
 */
function validateRequiredFields(
    obj: Record<string, unknown>,
    providerId: string
): Pick<SearchResult, 'id' | 'title' | 'provider' | 'type'> {
    return {
        id: typeof obj["id"] === 'string' ? obj["id"] : `unknown-${Date.now()}`,
        title: typeof obj["title"] === 'string' ? obj["title"] : 'Untitled',
        provider: typeof obj["provider"] === 'string' ? obj["provider"] : providerId,
        type: 'manga', // Default type for search results
    };
}

/**
 * Validates and extracts cover image fields
 */
function validateCoverImages(
    obj: Record<string, unknown>
): Partial<Pick<SearchResult, 'cover' | 'coverImage'>> {
    const result: Partial<Pick<SearchResult, 'cover' | 'coverImage'>> = {};

    if (typeof obj["cover"] === 'string' || typeof obj["coverImage"] === 'string') {
        result.cover = typeof obj["cover"] === 'string' ? obj["cover"] :
            typeof obj["coverImage"] === 'string' ? obj["coverImage"] :
                '/cover-not-found.jpg';
    }

    if (typeof obj["coverImage"] === 'string' || typeof obj["cover"] === 'string') {
        result.coverImage = typeof obj["coverImage"] === 'string' ? obj["coverImage"] :
            typeof obj["cover"] === 'string' ? obj["cover"] :
                '/cover-not-found.jpg';
    }

    return result;
}

/**
 * Validates and extracts string fields
 */
function validateStringFields(obj: Record<string, unknown>): Partial<SearchResult> {
    const result: Partial<SearchResult> = {};

    if (typeof obj["description"] === 'string') result.description = obj["description"];
    if (typeof obj["status"] === 'string') result.status = obj["status"] as MangaPublicationStatus;
    if (typeof obj["format"] === 'string') result.format = obj["format"];
    if (typeof obj["url"] === 'string') result.url = obj["url"];
    if (typeof obj["wikiUrl"] === 'string') result.wikiUrl = obj["wikiUrl"];
    if (typeof obj["siteDetailUrl"] === 'string') result.siteDetailUrl = obj["siteDetailUrl"];
    if (typeof obj["author"] === 'string') result.author = obj["author"];
    if (typeof obj["imageUrl"] === 'string') result.imageUrl = obj["imageUrl"];
    if (typeof obj["artist"] === 'string') result.artist = obj["artist"];
    if (typeof obj["publisher"] === 'string') result.publisher = obj["publisher"];
    if (typeof obj["bannerImage"] === 'string') result.bannerImage = obj["bannerImage"];

    return result;
}

/**
 * Validates and extracts number fields
 */
function validateNumberFields(obj: Record<string, unknown>): Partial<SearchResult> {
    const result: Partial<SearchResult> = {};

    if (typeof obj["score"] === 'number') result.score = obj["score"];
    if (typeof obj["totalChapters"] === 'number') result.totalChapters = obj["totalChapters"];
    if (typeof obj["volumes"] === 'number') result.volumes = obj["volumes"];
    if (typeof obj["chapters"] === 'number') result.chapters = obj["chapters"];
    if (typeof obj["anilistId"] === 'number') result.anilistId = obj["anilistId"];
    if (typeof obj["averageScore"] === 'number') result.averageScore = obj["averageScore"];
    if (typeof obj["popularity"] === 'number') result.popularity = obj["popularity"];
    if (typeof obj["trending"] === 'number') result.trending = obj["trending"];
    if (typeof obj["year"] === 'number') result.year = obj["year"];

    return result;
}

/**
 * Validates and extracts array fields (using isStringArray from Agent 1)
 */
function validateArrayFields(obj: Record<string, unknown>): Partial<SearchResult> {
    const result: Partial<SearchResult> = {};

    if (isStringArray(obj["alternativeTitles"])) result.alternativeTitles = obj["alternativeTitles"];
    if (isStringArray(obj["genres"])) result.genres = obj["genres"];
    if (isStringArray(obj["authors"])) result.authors = obj["authors"];
    if (isStringArray(obj["artists"])) result.artists = obj["artists"];
    if (Array.isArray(obj["tags"])) result.tags = obj["tags"];

    return result;
}

/**
 * Validates and extracts metadata and date fields
 */
function validateMetadataFields(obj: Record<string, unknown>): Partial<SearchResult> {
    const result: Partial<SearchResult> = {};

    if (obj["metadata"] !== undefined && obj["metadata"] !== null) {
        result.metadata = obj["metadata"];
    }
    if (obj["startDate"] !== undefined && obj["startDate"] !== null) {
        result.startDate = obj["startDate"];
    }
    if (obj["endDate"] !== undefined && obj["endDate"] !== null) {
        result.endDate = obj["endDate"];
    }

    return result;
}

/**
 * Safely transform search result from API to valid SearchResult
 *
 * @param result - Raw result from API
 * @param providerId - Provider ID to associate with the result
 * @returns Validated SearchResult or null if invalid
 */
export function validateAndTransformResult(result: unknown, providerId: string): SearchResult | null {
    try {
        // First, do basic validation of the result
        if (!result || typeof result !== 'object') {
            logger.warn(`Invalid search result from ${providerId}: not an object`);
            return null;
        }
        const obj = result as Record<string, unknown>;

        // Build result by merging all validated field groups
        const validatedResult: SearchResult = {
            ...validateRequiredFields(obj, providerId),
            ...validateCoverImages(obj),
            ...validateStringFields(obj),
            ...validateNumberFields(obj),
            ...validateArrayFields(obj),
            ...validateMetadataFields(obj),
        };

        return validatedResult;
    }
    catch (error: unknown) {
        logger.error(`Error validating search result from ${providerId}:`, error instanceof Error ? error.message : String(error));
        return null;
    }
}
/**
 * Process an array of search results with validation
 *
 * @param results - Array of raw search results
 * @param providerId - Provider ID to associate with results
 * @returns Array of validated search results (invalid results are filtered out)
 */
export function processSearchResults(results: unknown[], providerId: string): SearchResult[] {
    if (!Array.isArray(results)) {
        logger.warn(`Invalid search results from ${providerId}: not an array`);
        return [];
    }
    // Map and validate each result, filtering out invalid ones
    return results
        .map(result => validateAndTransformResult(result, providerId))
        .filter((result): result is SearchResult => result !== null);
}
