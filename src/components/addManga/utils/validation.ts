import type { MangaSearchResult, ExtendedMangaSearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

import type { MangaPublicationStatus } from '@prisma/client';
function validateStringArray(value: unknown): string[] | undefined {
    if (!value)
        return undefined;
    if (Array.isArray(value)) {
        return value
            .filter(item => item !== null)
            .map(item => String(item));
    }
    if (typeof value === 'string') {
        return [value];
    }
    return undefined;
}
/**
 * Validates a number value
 */
function validateNumber(value: unknown): number | null {
    if (value === null)
        return null;
    const num = Number(value);
    if (isNaN(num))
        return null;
    // Validate reasonable ranges for manga data
    if (num < 0 || num > 100000)
        return null;
    return num;
}
// ============================================
// Property Access Utilities
// ============================================
/**
 * Safely accesses a nested property with fallbacks
 */
export function safeAccess<T>(obj: unknown, path: string, defaultValue?: T): T | undefined {
    try {
        const keys = path.split('.');
        let current = obj;
        for (const key of keys) {
            if (current === null)
                return defaultValue;
            current = (current as Record<string, unknown>)[key];
        }
        return (current as T) ?? defaultValue;
    }
    catch (error: unknown) {
        if (process.env.NODE_ENV === 'development') {
            logger.warn(`[SafeAccess] Failed to access ${path}:`, error);
        }
        return defaultValue;
    }
}
/**
 * Safely accesses multiple possible property paths
 */
export function safeAccessMultiple<T>(obj: unknown, paths: string[], defaultValue?: T): T | undefined {
    for (const path of paths) {
        const value = safeAccess<T>(obj, path);
        if (value !== undefined)
            return value;
    }
    return defaultValue;
}
/**
 * Gets a property value with multiple fallback locations
 */
export function getPropertyWithFallback(obj: unknown, property: string, fallbackPaths: string[] = []): unknown {
    // Direct property
    if ((obj as Record<string, unknown>)[property] !== undefined) {
        return (obj as Record<string, unknown>)[property];
    }
    // Check fallback paths
    const paths = [
        `metadata.${property}`,
        `rawData.${property}`,
        `providerSpecific.${property}`,
        `data.${property}`,
        ...fallbackPaths
    ];
    return safeAccessMultiple(obj, paths);
}
// ============================================
// Batch Validation
// ============================================
/**
 * Validates a single search result
 */
// eslint-disable-next-line complexity -- Complex validation with multiple property checks
function validateSearchResult(result: unknown, source: string): MangaSearchResult | null {
    if (!result || typeof result !== 'object')
        return null;

    const resultObj = result as Record<string, unknown>;

    const searchResult: MangaSearchResult = {
        id: (resultObj["id"] as string | number) || `${source}-${Date.now()}`,
        title: (resultObj["title"] as string) || 'Unknown Title',
        provider: (resultObj["provider"] as string) || source,
        coverImage: (resultObj["coverImage"] as string) || (resultObj["cover"] as string) || (resultObj["coverUrl"] as string),
        tags: validateStringArray(resultObj["tags"]) ?? [],
        source: (resultObj["source"] as string) || source,
        sourceId: (resultObj["sourceId"] as string) || (resultObj["id"] as string),
    };

    // Add optional properties only if they exist
    const alternativeTitles = validateStringArray(resultObj["alternativeTitles"]);
    if (alternativeTitles !== undefined) searchResult.alternativeTitles = alternativeTitles;

    const description = resultObj["description"];
    if (description !== undefined) searchResult.description = description as string;

    const status = resultObj["status"];
    // Accept status as-is since providers may return different status formats
    // The consuming code should validate against MangaPublicationStatus enum
    if (status !== undefined && typeof status === 'string') searchResult.status = status as MangaPublicationStatus;

    const genres = validateStringArray(resultObj["genres"]);
    if (genres !== undefined) searchResult.genres = genres;

    const externalId = resultObj["externalId"];
    if (externalId !== undefined) searchResult.externalId = externalId as string;

    const url = resultObj["url"];
    if (url !== undefined) searchResult.url = url as string;

    const chapters = resultObj["chapters"] !== undefined ? validateNumber(resultObj["chapters"]) : null;
    if (chapters !== null) searchResult.chapters = chapters;

    const volumes = resultObj["volumes"] !== undefined ? validateNumber(resultObj["volumes"]) : null;
    if (volumes !== null) searchResult.volumes = volumes;

    const year = resultObj["year"] !== undefined ? validateNumber(resultObj["year"]) : null;
    if (year !== null) searchResult.year = year;

    return searchResult;
}
/**
 * Validates an extended search result
 */
function validateExtendedSearchResult(result: unknown, source: string): ExtendedMangaSearchResult | null {
    const base = validateSearchResult(result, source);
    if (!base)
        return null;

    const resultObj = result as Record<string, unknown>;
    const extended: ExtendedMangaSearchResult = { ...base };

    // Add optional extended properties only if they exist
    const authors = validateStringArray(resultObj["authors"]);
    if (authors !== undefined) extended.authors = authors;

    const artists = validateStringArray(resultObj["artists"]);
    if (artists !== undefined) extended.artists = artists;

    const startDate = resultObj["startDate"];
    if (startDate !== undefined) {
        extended.startDate = startDate instanceof Date ? startDate.toISOString() : (startDate as string | null);
    }

    const endDate = resultObj["endDate"];
    if (endDate !== undefined) {
        extended.endDate = endDate instanceof Date ? endDate.toISOString() : (endDate as string | null);
    }

    const anilistId = validateNumber(resultObj["anilistId"]);
    if (anilistId !== null) extended.anilistId = anilistId;

    const malId = validateNumber(resultObj["malId"]);
    if (malId !== null) extended.malId = malId;

    const comicvineId = resultObj["comicvineId"];
    if (comicvineId !== undefined) extended.comicvineId = comicvineId as string;

    const publisher = resultObj["publisher"];
    if (publisher !== undefined) extended.publisher = publisher as string;

    return extended;
}
/**
 * Validates an array of search results
 */
export function validateSearchResults(results: unknown[], source: string = 'unknown'): MangaSearchResult[] {
    if (!Array.isArray(results)) {
        logger.warn(`[Validation] Expected array from ${source}, got:`, typeof results);
        return [];
    }
    return results
        .map((result, index) => {
        const validated = validateSearchResult(result, source);
        if (!validated && process.env.NODE_ENV === 'development') {
            logger.warn(`[Validation] Invalid result at index ${index} from ${source}:`, result);
        }
        return validated;
    })
        .filter((result): result is MangaSearchResult => result !== null);
}
/**
 * Validates an array of extended search results
 */
export function validateExtendedSearchResults(results: unknown[], source: string = 'unknown'): ExtendedMangaSearchResult[] {
    if (!Array.isArray(results)) {
        logger.warn(`[Validation] Expected array from ${source}, got:`, typeof results);
        return [];
    }
    return results
        .map((result, index) => {
        const validated = validateExtendedSearchResult(result, source);
        if (!validated && process.env.NODE_ENV === 'development') {
            logger.warn(`[Validation] Invalid extended result at index ${index} from ${source}:`, result);
        }
        return validated;
    })
        .filter((result): result is ExtendedMangaSearchResult => result !== null);
}
// ============================================
// Development Helpers
// ============================================
/**
 * Logs validation warnings in development
 */
export function logValidationWarning(component: string, message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
        logger.warn(`[${component}] ${message}`, data ?? '');
    }
}
/**
 * Logs property access attempts in development
 */
export function logPropertyAccess(component: string, property: string, found: boolean, value?: unknown): void {
    if (process.env.NODE_ENV === 'development' && !found) {
        logger.warn(`[${component}] Property '${property}' not found, returned:`, value);
    }
}
/**
 * Creates a validation context for a component
 */
export function createValidationContext(componentName: string): {
    validate: (result: unknown) => ExtendedMangaSearchResult | null;
    validateArray: (results: unknown[]) => ExtendedMangaSearchResult[];
    logWarning: (message: string, data?: unknown) => void;
    logAccess: (property: string, found: boolean, value?: unknown) => void;
} {
    return {
        validate: (result: unknown) => validateExtendedSearchResult(result, componentName),
        validateArray: (results: unknown[]) => validateExtendedSearchResults(results, componentName),
        logWarning: (message: string, data?: unknown) => logValidationWarning(componentName, message, data),
        logAccess: (property: string, found: boolean, value?: unknown) => logPropertyAccess(componentName, property, found, value),
    };
}
