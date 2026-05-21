/**
 * Manga Detail Utilities
 *
 * This module provides utility functions for working with manga detail data
 * with proper type safety and validation.
 */

import type { MangaWithRelations } from '@/types/search.types';
import { isObject } from '@/utils/type-guards';

import {
  extractIdFromSourceFields,
  extractIdFromProviderMetadata,
  extractIdFromExternalLinks,
  buildAnilistUrl,
  buildComicVineUrl,
  getProviderHomepage,
} from './utils/provider-url-extractors';

import type { Manga as MangaEntity, Chapter as ChapterEntity } from '@prisma/client';
/**
 * Type guard for checking if an object has valid metadata provenance
 *
 * @param manga - The manga entity to check
 * @returns Whether the manga has valid metadata provenance
 */
export function hasMetadataProvenance(manga: unknown): manga is {
    metadataProvenance: Record<string, string>;
} {
    if (!isObject(manga)) {
        return false;
    }
    if (!('metadataProvenance' in manga)) {
        return false;
    }
    const provenance = (manga as {
        metadataProvenance?: unknown;
    }).metadataProvenance;
    return isObject(provenance);
}
/**
 * Type guard for checking if a manga has a specific provenance field
 *
 * @param manga - The manga entity to check
 * @param field - The provenance field to check for
 * @returns Whether the manga has the specified provenance field
 */
export function hasProvenanceField(manga: unknown, field: string): manga is {
    metadataProvenance: Record<string, string>;
} {
    if (!hasMetadataProvenance(manga)) {
        return false;
    }
    const provenance = manga.metadataProvenance;
    return field in provenance && typeof provenance[field] === 'string';
}
/**
 * Safely get provenance for a field with type safety
 *
 * @param manga - The manga entity
 * @param field - The metadata field to get provenance for
 * @returns The provider ID for the field, or undefined if not available
 */
export function getProvenance(manga: MangaEntity | null | undefined, field: string): string | undefined {
    if (!manga?.providerMetadata) {
        return undefined;
    }
    const providerData = manga.providerMetadata as Record<string, unknown>;
    // Check if providerMetadata contains provenance info
    const provenance = providerData["provenance"] || providerData;
    const value = (provenance as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : undefined;
}
/**
 * Safely splits a comma-separated provenance string
 *
 * @param manga - The manga entity
 * @param field - The metadata field to get provenance for
 * @returns The first provider ID from the comma-separated list, or undefined
 */
export function getFirstProvenance(manga: MangaEntity | null | undefined, field: string): string | undefined {
    const provenance = getProvenance(manga, field);
    if (!provenance) {
        return undefined;
    }
    return provenance.split(', ')[0];
}
/**
 * Count unique volumes from a list of chapters
 *
 * @param chapters - Array of chapter entities
 * @returns Number of unique volumes
 */
export function countVolumes(chapters: ChapterEntity[] | null | undefined): number {
    if (!Array.isArray(chapters) || chapters.length === 0) {
        return 0;
    }
    const volumeSet = new Set<number>();
    for (const chapter of chapters) {
        if (typeof chapter !== 'object') continue;
        // Use the assigned volume number from enrichment pipeline
        if (typeof chapter.volume === 'number' && chapter.volume > 0) {
            volumeSet.add(chapter.volume);
        }
    }
    return volumeSet.size;
}
/**
 * Calculate total size of manga chapters with proper type safety
 *
 * @param manga - The manga entity
 * @returns Total size in bytes
 */
export function calculateTotalSize(manga: MangaWithRelations): number {
    if (!Array.isArray(manga["Chapter"])) {
        return 0;
    }
    return manga["Chapter"].reduce((sum, chapter) => {
        // Type is guaranteed by the array type but check for safety
        if (typeof chapter !== 'object') {
            return sum;
        }
        const fileSize = typeof chapter.size === 'number' ? chapter.size : 0;
        return sum + fileSize;
    }, 0);
}
/**
 * Format file size into human-readable string
 *
 * @param bytes - File size in bytes
 * @returns Formatted file size string with appropriate unit
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0 || isNaN(bytes)) {
        return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    // Ensure positive number for log calculation
    const posBytes = Math.abs(bytes);
    const i = Math.floor(Math.log(posBytes) / Math.log(k));
    // Validate that i is within the range of the sizes array
    const sizeIndex = Math.min(i, sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2)) + ' ' + sizes[sizeIndex];
}
/**
 * Type-safe HTML content parser
 *
 * @param html - The HTML string to parse
 * @returns Sanitized text content
 */
export function stripHtmlTags(html: string | null | undefined): string {
    if (!html) {
        return '';
    }
    return html.replace(/<\/?[^>]+(>|$)/g, '');
}
/**
 * Format date string or Date object with nullish coalescing
 *
 * @param date - The date to format
 * @returns A formatted date string or 'Unknown' if invalid
 */
export function formatDate(date: Date | string | null | undefined): string {
    if (date === null || date === undefined) {
        return 'Unknown';
    }
    try {
        return new Date(date).toLocaleDateString();
    }
    catch (_error: unknown) {
        return 'Unknown';
    }
}
/**
 * Extract a provider URL for external links with type safety
 *
 * @param manga - The manga entity object
 * @returns A provider URL if available, or null if not
 */
export function getProviderUrl(manga: MangaWithRelations): string | null {
    // Early return with null if manga["source"] is null/undefined or not a string
    if (!manga["source"] || typeof manga["source"] !== 'string') {
        return null;
    }

    const source = manga["source"].toLowerCase();

    // Priority 1: Check sourceId fields directly (most reliable)
    let id: string | number | undefined = extractIdFromSourceFields(manga, source);

    // Priority 2: Try to extract ID from provider metadata
    id ??= extractIdFromProviderMetadata(manga, source);

    // Priority 3: Try to extract from external links
    id ??= extractIdFromExternalLinks(manga, source);

    // Generate URLs based on source and ID
    if (source === 'anilist') {
        return buildAnilistUrl(id);
    }

    if (source === 'comicvine') {
        return buildComicVineUrl(id);
    }

    // Return source homepage as fallback
    return getProviderHomepage(source);
}
