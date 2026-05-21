/**
 * Hook for extracting metadata from manga object
 *
 * @module components/manga/manga-detail-modals/hooks/useMetadataExtractors
 */

import { useMemo } from 'react';

import type { ProviderMetadata } from '@/types/provider-metadata.types';
import type { MangaWithRelations } from '@/types/search.types';
import {
  isObject,
  isArray,
  isString,
  hasProperty,
  hasPropertyOfType
} from '@/utils/type-guards';

// ============================================================================
// Shared Helpers
// ============================================================================

/**
 * Parse providerMetadata (handles string and object formats)
 */
function parseProviderMetadataRaw(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as unknown; } catch { return null; }
  }
  return raw;
}

// ============================================================================
// AniList ID Extraction Helpers
// ============================================================================

/**
 * Extract AniList ID from metadata URLs
 */
function extractAniListIdFromUrls(urls: string[]): string | null {
  for (const url of urls) {
    const match = url.match(/anilist\.co\/manga\/(\d+)/);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Extract AniList ID from an anilist sub-object entry.
 * Handles multiple key formats: providerId, anilistId, id.
 */
function extractAniListIdFromEntry(entry: Record<string, unknown>): string | null {
  if (hasPropertyOfType(entry, 'providerId', isString)) return entry.providerId;
  if ('anilistId' in entry && entry['anilistId'] !== null && entry['anilistId'] !== undefined) {
    return String(entry['anilistId']);
  }
  if (hasPropertyOfType(entry, 'id', isString)) return entry.id;
  return null;
}

/**
 * Extract AniList ID from array-format providerMetadata
 */
function extractAniListIdFromArray(parsedMetadata: unknown[]): string | null {
  const anilistData = parsedMetadata.find((p: unknown) => {
    if (!isObject(p)) return false;
    return hasPropertyOfType(p, 'providerId', isString) && p.providerId === 'anilist';
  });
  if (anilistData && hasPropertyOfType(anilistData, 'externalId', isString)) {
    return anilistData.externalId;
  }
  return null;
}

/**
 * Extract AniList ID from object-format providerMetadata
 */
function extractAniListIdFromObject(parsedMetadata: Record<string, unknown>): string | null {
  if (hasPropertyOfType(parsedMetadata, 'anilistId', isString)) {
    return parsedMetadata.anilistId;
  }
  if (hasProperty(parsedMetadata, 'anilist') && isObject(parsedMetadata['anilist'])) {
    return extractAniListIdFromEntry(parsedMetadata['anilist'] as Record<string, unknown>);
  }
  return null;
}

/**
 * Extract AniList ID from parsed providerMetadata (array or object format)
 */
function extractAniListIdFromProviderMetadata(parsedMetadata: unknown): string | null {
  if (isArray(parsedMetadata)) return extractAniListIdFromArray(parsedMetadata);
  if (isObject(parsedMetadata)) {
    return extractAniListIdFromObject(parsedMetadata as Record<string, unknown>);
  }
  return null;
}

// ============================================================================
// AniList ID Hook
// ============================================================================

/**
 * Hook to extract AniList ID from manga metadata
 *
 * @param manga - Manga object with relations
 * @returns AniList ID or null
 */
export function useAniListIdExtractor(manga: MangaWithRelations | null): string | null {
  return useMemo(() => {
    if (!manga) return null;

    // Priority 1: providerMetadata (explicit binding or search result)
    if ('providerMetadata' in manga && manga.providerMetadata !== null) {
      const parsed = parseProviderMetadataRaw(manga.providerMetadata);
      const fromProvider = extractAniListIdFromProviderMetadata(parsed);
      if (fromProvider) return fromProvider;
    }

    // Priority 2: Metadata.urls fallback
    const fromUrls = manga.Metadata?.urls ? extractAniListIdFromUrls(manga.Metadata.urls) : null;
    if (fromUrls) return fromUrls;

    return null;
  }, [manga]);
}

/**
 * Merge selectedGalleryImages from rawProviderData into baseMetadata.
 * Returns merged ProviderMetadata or null if merge is not applicable.
 */
function mergeGalleryFromRawData(
  baseMetadata: unknown,
  rawProviderData: unknown
): ProviderMetadata | null {
  try {
    const rawData: unknown =
      typeof rawProviderData === 'string' ? JSON.parse(rawProviderData) : rawProviderData;
    if (!isObject(rawData) || !hasProperty(rawData, 'selectedGalleryImages')) return null;

    const metadataObj: unknown =
      typeof baseMetadata === 'string' ? JSON.parse(baseMetadata) : baseMetadata;
    if (!isObject(metadataObj)) return null;

    return {
      ...metadataObj,
      selectedGalleryImages: rawData['selectedGalleryImages']
    } as ProviderMetadata;
  } catch {
    return null;
  }
}

/**
 * Hook to get provider metadata with backward compatibility
 *
 * @param manga - Manga object with relations
 * @returns Provider metadata or null
 */
export function useProviderMetadata(
  manga: MangaWithRelations | null
): ProviderMetadata | string | null {
  return useMemo(() => {
    if (
      !manga ||
      !isObject(manga) ||
      !('providerMetadata' in manga) ||
      manga['providerMetadata'] === null
    ) {
      return null;
    }

    const baseMetadata = manga['providerMetadata'];

    // BACKWARD COMPATIBILITY: Merge selectedGalleryImages from rawProviderData
    if (manga.rawProviderData) {
      const merged = mergeGalleryFromRawData(baseMetadata, manga.rawProviderData);
      if (merged) return merged;
    }

    return baseMetadata as ProviderMetadata | string | null;
  }, [manga]);
}

/**
 * Extracts a provider ID from an array-format providerMetadata
 * Array format: [{ providerId: 'comicvine', externalId: '4050-12345' }]
 */
function extractIdFromArray(parsedMetadata: unknown[], provider: string): string | null {
  const providerData = parsedMetadata.find((p: unknown) => {
    if (!isObject(p)) return false;
    return hasPropertyOfType(p, 'providerId', isString) && p.providerId === provider;
  });
  if (providerData && hasPropertyOfType(providerData, 'externalId', isString)) {
    return providerData.externalId;
  }
  return null;
}

/**
 * Extracts a provider ID from an object-format providerMetadata
 * Object format: { comicvine: { providerId: '4050-12345', boundAt: '...' } }
 * Legacy format: { providerIds: { comicvine: '4050-12345' } }
 */
function extractIdFromObject(parsedMetadata: Record<string, unknown>, provider: string): string | null {
  // Check provider sub-object for various ID key formats
  if (hasProperty(parsedMetadata, provider) && isObject(parsedMetadata[provider])) {
    const providerEntry = parsedMetadata[provider] as Record<string, unknown>;
    // New bindProvider format: { providerId: '4050-12345' }
    if (hasPropertyOfType(providerEntry, 'providerId', isString)) {
      return providerEntry.providerId;
    }
    // Search/merge format: { id: '4050-12345' }
    if (hasPropertyOfType(providerEntry, 'id', isString)) {
      return providerEntry.id;
    }
    // Numeric id format: { id: 12345 }
    if ('id' in providerEntry && providerEntry['id'] !== null && providerEntry['id'] !== undefined) {
      return String(providerEntry['id']);
    }
  }

  // Legacy format: { providerIds: { comicvine: '4050-12345' } }
  if (hasPropertyOfType(parsedMetadata, 'providerIds', isObject)) {
    const providerIds = parsedMetadata['providerIds'] as Record<string, unknown>;
    if (hasPropertyOfType(providerIds, provider, isString)) {
      return providerIds[provider] as string;
    }
  }

  return null;
}

/**
 * Hook to extract provider ID from manga's providerMetadata
 *
 * Reads directly from the manga object (like useAniListIdExtractor)
 * to find the provider binding ID stored by the bindProvider mutation.
 *
 * @param manga - Manga object with relations
 * @param provider - Provider name (e.g., 'comicvine', 'fandom', 'wikipedia')
 * @returns Provider ID or null
 */
export function useProviderIdExtractor(
  manga: MangaWithRelations | null,
  provider: string
): string | null {
  return useMemo(() => {
    if (!manga || !('providerMetadata' in manga) || manga.providerMetadata === null) {
      return null;
    }

    const providerMetadata = manga.providerMetadata;
    const parsedMetadata: unknown =
      typeof providerMetadata === 'string' ? JSON.parse(providerMetadata) : providerMetadata;

    if (isArray(parsedMetadata)) {
      return extractIdFromArray(parsedMetadata, provider);
    }

    if (isObject(parsedMetadata)) {
      return extractIdFromObject(parsedMetadata as Record<string, unknown>, provider);
    }

    return null;
  }, [manga, provider]);
}
