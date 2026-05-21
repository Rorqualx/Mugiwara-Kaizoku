/**
 * Metadata Conversion Utilities
 *
 * Functions to convert provider-specific data formats to standardized
 * MangaMetadata structure. Handles SearchResult and raw provider data.
 *
 * Extracted from metadataService.ts for better modularity.
 *
 * @module metadata-converters
 */


import { MangaPublicationStatus } from '@prisma/client';

import type { MangaMetadata, SearchResult } from '@/types/search.types';
import { mapToMangaStatus } from '@/utils/status-mapper';


/**
 * Convert SearchResult to MangaMetadata
 *
 * @param result - SearchResult from provider
 * @returns Standardized MangaMetadata
 */
export function convertSearchResultToMetadata(result: SearchResult): MangaMetadata {
    const r = result as unknown as Record<string, unknown>;
    const metadata = r["metadata"] as Record<string, unknown> | undefined;

    const mangaMetadata: MangaMetadata = {
        title: result["title"],
        alternativeTitles: result["alternativeTitles"] ?? [],
        description: result["description"] ?? '',
        coverUrl: result.coverImage ?? '',
        status: metadata?.["status"] !== undefined && metadata["status"] !== null
            ? mapToMangaStatus(metadata["status"] as string)
            : MangaPublicationStatus.UNKNOWN,
        authors: (metadata?.["authors"] as string[] | undefined) ?? [],
        artists: (metadata?.["artists"] as string[] | undefined) ?? [],
        genres: (metadata?.["genres"] as string[] | undefined) ?? [],
        tags: (metadata?.["tags"] as string[] | undefined) ?? []
    };

    if (metadata?.["year"] !== undefined) {
        mangaMetadata.year = metadata["year"] as number;
    }

    return mangaMetadata;
}

/**
 * Convert provider-specific manga data to MangaMetadata
 *
 * @param manga - Provider-specific manga data
 * @param _providerId - Provider identifier (unused but kept for signature)
 * @returns Standardized MangaMetadata with all fields normalized
 */
// eslint-disable-next-line complexity -- Field mapping from provider data to standardized metadata; complexity from number of fields to convert
export function convertToMetadata(manga: unknown, _providerId: string): MangaMetadata {
    const m = manga as Record<string, unknown>;

    // Create a basic metadata object with required defaults
    const metadata: MangaMetadata = {
        title: typeof m["title"] === 'string' ? m["title"] : 'Unknown',
        status: typeof m["publicationStatus"] === 'string'
            ? mapToMangaStatus(m["publicationStatus"] as string)
            : MangaPublicationStatus.UNKNOWN,
        // Add additional required fields with defaults
        alternativeTitles: [],
        description: '',
        authors: [],
        artists: [],
        genres: [],
        tags: [],
        coverUrl: ''
    };

    // Safely copy optional properties if they exist with type checking
    if (typeof m["description"] === 'string') {
        metadata["description"] = m["description"];
    }

    if (typeof m["coverUrl"] === 'string') {
        metadata.coverUrl = m["coverUrl"] as string;
    } else if (typeof m["coverImage"] === 'string' && !metadata.coverUrl) {
        metadata.coverUrl = m["coverImage"] as string;
    }

    // Convert authors from various formats
    if (Array.isArray(m["authors"])) {
        metadata["authors"] = m["authors"].map((author: unknown) => {
            if (typeof author === 'string') return author;
            if (author && typeof (author as Record<string, unknown>)["name"] === 'string')
                return (author as Record<string, unknown>)["name"] as string;
            return 'Unknown Author';
        });
    }

    // Convert genres from various formats
    if (Array.isArray(m["genres"])) {
        metadata["genres"] = m["genres"].map((genre: unknown) => {
            if (typeof genre === 'string') return genre;
            if (genre && typeof (genre as Record<string, unknown>)["name"] === 'string')
                return (genre as Record<string, unknown>)["name"] as string;
            return 'Unknown Genre';
        });
    }

    // Skip links - not part of MangaMetadata interface

    // Add year if available
    if (m["releaseYear"] !== undefined || m["year"] !== undefined) {
        const year = Number(m["releaseYear"] ?? m["year"]);
        if (!isNaN(year)) {
            metadata.year = year;
        }
    }

    // Preserve URL fields - critical for volume/chapter fetching from providers
    const urlFields = ['url', 'wikiUrl', 'providerUrl', 'siteDetailUrl'];
    for (const urlField of urlFields) {
        const urlValue = m[urlField];
        if (typeof urlValue === 'string' && urlValue.length > 0) {
            (metadata as Record<string, unknown>)[urlField] = urlValue;
        }
    }

    // Also check nested metadata object for URL fields
    const nestedMetadata = m['metadata'] as Record<string, unknown> | undefined;
    if (nestedMetadata && typeof nestedMetadata === 'object') {
        for (const urlField of urlFields) {
            const urlValue = nestedMetadata[urlField];
            if (typeof urlValue === 'string' && urlValue.length > 0) {
                // Only set if not already set from top-level
                if (!(metadata as Record<string, unknown>)[urlField]) {
                    (metadata as Record<string, unknown>)[urlField] = urlValue;
                }
            }
        }
    }

    return metadata;
}
