/**
 * Download Manager Utilities
 *
 * Type guards and helper functions for download management.
 */

import { isObject, hasProperty } from '@/utils/type-guards';

import type { DownloadPayload, MangaWithTitle } from './types';

/**
 * Type guard to validate DownloadPayload structure
 */
export function isDownloadPayload(value: unknown): value is DownloadPayload {
    return (
        isObject(value) &&
        hasProperty(value, 'method') &&
        hasProperty(value, 'mode') &&
        hasProperty(value, 'chapterIds') &&
        Array.isArray(value['chapterIds']) &&
        value['chapterIds'].every((id: unknown) => typeof id === 'number')
    );
}

/**
 * Type guard for manga with title property
 */
export function isMangaWithTitle(value: unknown): value is MangaWithTitle {
    return isObject(value) && hasProperty(value, 'title') && typeof value['title'] === 'string';
}

/**
 * Extract string value from unknown prowlarr result
 */
export function extractProwlarrString(
    result: Record<string, unknown>,
    ...keys: string[]
): string | undefined {
    for (const key of keys) {
        const value = result[key];
        if (typeof value === 'string') {
            return value;
        }
    }
    return undefined;
}

/**
 * Extract download URL from prowlarr result with priority
 * Prefers magnetUrl > downloadUrl > link > guid
 */
export function extractDownloadUrl(prowlarrResult: Record<string, unknown>): string | undefined {
    return extractProwlarrString(prowlarrResult, 'magnetUrl', 'downloadUrl', 'link', 'guid');
}

/**
 * Detect protocol from URL
 */
export function detectProtocol(url: string): 'torrent' | 'usenet' {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.endsWith('.nzb') || lowerUrl.includes('nzb')) {
        return 'usenet';
    }
    return 'torrent';
}
