/**
 * Entity Metadata Utilities
 *
 * This module provides utility functions for safely accessing and manipulating
 * metadata properties from manga and chapter entities, ensuring type safety
 * when working with Prisma's JSON fields.
 */
// import { logger } from '../utils/logger';
import { MangaPublicationStatus, MangaFileStatus } from '@prisma/client';

import { isObject } from './type-guards';

import type { Prisma, Manga as MangaEntity } from '@prisma/client';

/**
 * Helper to safely get a property from a Record<string, unknown>
 */
function safeGetProperty(record: Record<string, unknown>, property: string): unknown {
  if (property in record) {
    return record[property];
  }
  return undefined;
}

/**
 * Type guard to check if value is a provider object with id or provider field
 */
interface ProviderObject {
  id?: string;
  provider?: string;
  [key: string]: unknown;
}

function isProviderObject(value: unknown): value is ProviderObject {
  return isObject(value) && ('id' in value || 'provider' in value);
}

/**
 * Type guard to check if value is an array of strings
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
// Type for Manga with metadata relation included
// type MangaWithMetadata = Prisma.MangaGetPayload<{
//   include: {
//     Metadata: true;
//   };
// }>;
/**
 * Safely accesses a string property from manga's provider metadata
 */
export function getProviderMetadataString(manga: MangaEntity | null | undefined, property: string, defaultValue: string = ''): string {
  if (!manga?.providerMetadata) {
    return defaultValue;
  }
  const metadata = manga.providerMetadata as Record<string, unknown>;
  const value = safeGetProperty(metadata, property);
  return typeof value === 'string' ? value : defaultValue;
}
/**
 * Safely accesses a number property from manga's provider metadata
 */
export function getProviderMetadataNumber(manga: MangaEntity | null | undefined, property: string, defaultValue: number = 0): number {
  if (!manga?.providerMetadata) {
    return defaultValue;
  }
  const metadata = manga.providerMetadata as Record<string, unknown>;
  const value = safeGetProperty(metadata, property);
  return typeof value === 'number' ? value : defaultValue;
}
/**
 * Safely accesses a boolean property from manga's provider metadata
 */
export function getProviderMetadataBoolean(manga: MangaEntity | null | undefined, property: string, defaultValue: boolean = false): boolean {
  if (!manga?.providerMetadata) {
    return defaultValue;
  }
  const metadata = manga.providerMetadata as Record<string, unknown>;
  const value = safeGetProperty(metadata, property);
  return typeof value === 'boolean' ? value : defaultValue;
}
/**
 * Safely accesses a string array property from manga's provider metadata
 */
export function getProviderMetadataStringArray(manga: MangaEntity | null | undefined, property: string, defaultValue: string[] = []): string[] {
  if (!manga?.providerMetadata) {
    return defaultValue;
  }
  const metadata = manga.providerMetadata as Record<string, unknown>;
  const value = safeGetProperty(metadata, property);
  return isStringArray(value) ? value : defaultValue;
}
/**
 * Safely accesses the publication status from manga
 */
export function getPublicationStatus(manga: MangaEntity | null | undefined, defaultValue: MangaPublicationStatus = MangaPublicationStatus.UNKNOWN): MangaPublicationStatus {
  if (!manga) {
    return defaultValue;
  }
  return manga.publicationStatus;
}
/**
 * Safely accesses the file status from manga
 */
export function getFileStatus(manga: MangaEntity | null | undefined, defaultValue: MangaFileStatus = MangaFileStatus.PENDING): MangaFileStatus {
  if (!manga) {
    return defaultValue;
  }
  return manga.fileStatus;
}
/**
 * Safely accesses a date property from manga's provider metadata
 */
export function getProviderMetadataDate(manga: MangaEntity | null | undefined, property: string, defaultValue: Date | null = null): Date | null {
  if (!manga?.providerMetadata) {
    return defaultValue;
  }
  const metadata = manga.providerMetadata as Record<string, unknown>;
  const value = safeGetProperty(metadata, property);
  if (!value) {
    return defaultValue;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const date = new Date(value);
      return isNaN(date.getTime()) ? defaultValue : date;
    }
    catch (_error: unknown) {
      return defaultValue;
    }
  }
  return defaultValue;
}
/**
 * Safely accesses provider-specific data from a manga
 */
export function getProviderData(manga: MangaEntity | null | undefined, providerId: string): unknown | undefined {
  if (!manga?.providerMetadata) {
    return undefined;
  }
  const metadata = manga.providerMetadata as Record<string, unknown>;
  // Check if metadata has provider-specific sections
  const providerSection = safeGetProperty(metadata, providerId);
  if (providerSection) {
    return providerSection;
  }
  // Check if metadata has a providers array
  const providers = safeGetProperty(metadata, 'providers');
  if (Array.isArray(providers)) {
    return providers.find((p: unknown) => {
      if (isProviderObject(p)) {
        return p.id === providerId || p.provider === providerId;
      }
      return false;
    });
  }
  return undefined;
}
/**
 * Gets all provider metadata from a manga
 */
export function getAllProviderData(manga: MangaEntity | null | undefined): Record<string, unknown> {
  if (!manga?.providerMetadata) {
    return {};
  }
  return manga.providerMetadata as Record<string, unknown>;
}
/**
 * Gets raw provider data from a manga
 */
export function getRawProviderData(manga: MangaEntity | null | undefined): unknown {
  if (!manga?.rawProviderData) {
    return null;
  }
  return manga.rawProviderData;
}
/**
 * Safely converts a string value to an array of strings
 */
export function stringToArray(value: string | undefined | null, separator: string = ','): string[] {
  if (!value) {
    return [];
  }
  return value.
  split(separator).
  map((item) => item.trim()).
  filter((item) => item.length > 0);
}
/**
 * Safely converts an array of strings to a comma-separated string
 */
export function arrayToString(values: string[] | undefined | null): string {
  if (!values || !Array.isArray(values)) {
    return '';
  }
  return values.join(', ');
}
/**
 * Type guard for checking if an object has valid provider metadata
 */
export function hasProviderMetadata(obj: unknown): obj is {
  providerMetadata: Prisma.JsonValue;
} {
  if (!isObject(obj)) {
    return false;
  }
  if (!('providerMetadata' in obj)) {
    return false;
  }
  const record = obj as Record<string, unknown>;
  return record['providerMetadata'] !== null;
}
/**
 * Type guard for checking if an object has raw provider data
 */
export function hasRawProviderData(obj: unknown): obj is {
  rawProviderData: Prisma.JsonValue;
} {
  if (!isObject(obj)) {
    return false;
  }
  if (!('rawProviderData' in obj)) {
    return false;
  }
  const record = obj as Record<string, unknown>;
  return record['rawProviderData'] !== null;
}
/**
 * Helper to extract title from manga or provider metadata
 */
export function getMangaTitle(manga: MangaEntity | null | undefined): string {
  if (!manga)
  return '';
  // First try the direct title field
  if (manga.title)
  return manga.title;
  // Then try mangaTitle field
  if (manga.mangaTitle)
  return manga.mangaTitle;
  // Finally try provider metadata
  return getProviderMetadataString(manga, 'title', '');
}
/**
 * Helper to extract description/summary from manga
 */
export function getMangaDescription(manga: MangaEntity | null | undefined): string {
  if (!manga)
  return '';
  // First try the summary field
  if (manga.summary)
  return manga.summary;
  // Then try provider metadata
  return getProviderMetadataString(manga, 'description', getProviderMetadataString(manga, 'summary', ''));
}
/**
 * Helper to extract cover image URL from provider metadata
 */
export function getMangaCoverUrl(manga: MangaEntity | null | undefined): string {
  if (!manga)
  return '';
  return getProviderMetadataString(manga, 'coverImage', getProviderMetadataString(manga, 'coverUrl', getProviderMetadataString(manga, 'cover', '')));
}
/**
 * Helper to extract genres from provider metadata
 */
export function getMangaGenres(manga: MangaEntity | null | undefined): string[] {
  if (!manga)
  return [];
  return getProviderMetadataStringArray(manga, 'genres', []);
}
/**
 * Helper to extract tags from provider metadata
 */
export function getMangaTags(manga: MangaEntity | null | undefined): string[] {
  if (!manga)
  return [];
  return getProviderMetadataStringArray(manga, 'tags', []);
}
/**
 * Helper to extract authors from provider metadata
 */
export function getMangaAuthors(manga: MangaEntity | null | undefined): string[] {
  if (!manga)
  return [];
  return getProviderMetadataStringArray(manga, 'authors', getProviderMetadataStringArray(manga, 'author', []));
}
/**
 * Helper to extract artists from provider metadata
 */
export function getMangaArtists(manga: MangaEntity | null | undefined): string[] {
  if (!manga)
  return [];
  return getProviderMetadataStringArray(manga, 'artists', getProviderMetadataStringArray(manga, 'artist', []));
}
/**
 * Helper to extract chapter count from provider metadata
 */
export function getMangaChapterCount(manga: MangaEntity | null | undefined): number {
  if (!manga)
  return 0;
  return getProviderMetadataNumber(manga, 'chapters', getProviderMetadataNumber(manga, 'chapterCount', 0));
}
/**
 * Helper to extract volume count from provider metadata
 */
export function getMangaVolumeCount(manga: MangaEntity | null | undefined): number {
  if (!manga)
  return 0;
  return getProviderMetadataNumber(manga, 'volumes', getProviderMetadataNumber(manga, 'volumeCount', 0));
}
// Re-export these with old names for backward compatibility (will be removed later)
export { getProviderMetadataString as getMetadataString, getProviderMetadataNumber as getMetadataNumber, getProviderMetadataBoolean as getMetadataBoolean, getProviderMetadataStringArray as getMetadataStringArray, getPublicationStatus as getStatus, getPublicationStatus as getMetadataStatus, getProviderMetadataDate as getMetadataDate, getProviderData as getProviderMetadata, getAllProviderData as getAllProviderMetadata, hasProviderMetadata as hasValidMetadata };
// Stub functions for removed functionality
export function getMetadataProvenance(__manga: unknown, __property: string): string | undefined {
  // This functionality is removed - provenance is now tracked differently
  return undefined;
}
export function getProvenanceValue(__provenance: unknown, __property: string): string | undefined {
  // This functionality is removed - provenance is now tracked differently
  return undefined;
}
export function hasMetadataProvenance(__obj: unknown): boolean {
  // This functionality is removed - provenance is now tracked differently
  return false;
}