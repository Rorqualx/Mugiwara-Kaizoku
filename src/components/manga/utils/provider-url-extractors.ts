/**
 * Provider URL Extraction Utilities
 *
 * Modular functions for extracting provider URLs from manga metadata
 * Separated to reduce complexity in main utility file
 *
 * @module components/manga/utils/provider-url-extractors
 */

import type { MangaWithRelations } from '@/types/search.types';

/**
 * Type guard for provider metadata
 */
interface ProviderMetadata {
  providerId: string;
  externalId?: string | number;
}

/**
 * Check if an item is valid provider metadata
 */
function isProviderMetadata(item: unknown): item is ProviderMetadata {
  return (
    item !== null &&
    typeof item === 'object' &&
    'providerId' in item &&
    typeof (item as { providerId?: unknown }).providerId === 'string'
  );
}

/**
 * Type guard for link objects
 */
interface LinkObject {
  url: string;
  site?: string;
}

/**
 * Check if an item is a valid link object
 */
function isLinkObject(item: unknown): item is LinkObject {
  return (
    item !== null &&
    typeof item === 'object' &&
    'url' in item &&
    typeof (item as { url?: unknown }).url === 'string'
  );
}

/**
 * Extract ID from source fields (manga.sourceId or Metadata.sourceId)
 *
 * @param manga - The manga entity
 * @param source - The provider source name
 * @returns The source ID if found
 */
export function extractIdFromSourceFields(
  manga: MangaWithRelations,
  source: string
): string | undefined {
  // Check manga.sourceId when manga.source matches
  if (manga.source.toLowerCase() === source && manga.sourceId) {
    return manga.sourceId;
  }

  // Check manga.Metadata.sourceId when Metadata.source matches
  if (manga.Metadata?.source?.toLowerCase() === source && manga.Metadata.sourceId) {
    return manga.Metadata.sourceId;
  }

  return undefined;
}

/**
 * Extract ID from provider metadata
 *
 * @param manga - The manga entity
 * @param source - The provider source name
 * @returns The external ID if found
 */
export function extractIdFromProviderMetadata(
  manga: MangaWithRelations,
  source: string
): string | number | undefined {
  if (
    !manga.providerMetadata ||
    !Array.isArray(manga.providerMetadata) ||
    manga.providerMetadata.length === 0
  ) {
    return undefined;
  }

  const provider = manga.providerMetadata.find(
    p => isProviderMetadata(p) && p.providerId.toLowerCase() === source
  );

  if (provider && isProviderMetadata(provider) && provider.externalId !== undefined) {
    return provider.externalId;
  }

  return undefined;
}

/**
 * Extract Anilist ID from external links
 *
 * @param link - The link object to check
 * @returns The extracted ID if found
 */
function extractAnilistId(link: LinkObject): string | undefined {
  if (!link.url.includes('anilist.co')) {
    return undefined;
  }

  const match = link.url.match(/anilist\.co\/manga\/(\d+)/);
  return match?.[1];
}

/**
 * Extract ComicVine ID from external links
 *
 * @param link - The link object to check
 * @returns The extracted ID if found
 */
function extractComicVineId(link: LinkObject): string | undefined {
  if (!link.url.includes('comicvine.gamespot.com')) {
    return undefined;
  }

  const match = link.url.match(/comicvine\.gamespot\.com\/.*\/4050-(\d+)/);
  return match?.[1];
}

/**
 * Extract ID from external links based on source
 *
 * @param manga - The manga entity
 * @param source - The provider source name
 * @returns The extracted ID if found
 */
export function extractIdFromExternalLinks(
  manga: MangaWithRelations,
  source: string
): string | undefined {
  if (
    !manga.Metadata ||
    typeof manga.Metadata !== 'object' ||
    !manga.Metadata.externalLinks ||
    !Array.isArray(manga.Metadata.externalLinks) ||
    manga.Metadata.externalLinks.length === 0
  ) {
    return undefined;
  }

  for (const link of manga.Metadata.externalLinks as unknown[]) {
    if (!isLinkObject(link)) {
      continue;
    }

    if (source === 'anilist') {
      const id = extractAnilistId(link);
      if (id) return id;
    } else if (source === 'comicvine') {
      const id = extractComicVineId(link);
      if (id) return id;
    }
  }

  return undefined;
}

/**
 * Build Anilist URL from ID
 *
 * @param id - The Anilist ID
 * @returns The complete URL
 */
export function buildAnilistUrl(id: string | number | undefined): string | null {
  if (id === undefined) {
    return 'https://anilist.co';
  }
  return `https://anilist.co/manga/${id}`;
}

/**
 * Build ComicVine URL from ID
 *
 * @param id - The ComicVine ID
 * @returns The complete URL
 */
export function buildComicVineUrl(id: string | number | undefined): string | null {
  if (id === undefined) {
    return 'https://comicvine.gamespot.com';
  }
  const idStr = String(id);
  const normalized = /^\d+-\d+$/.test(idStr) ? idStr : `4050-${idStr}`;
  return `https://comicvine.gamespot.com/volume/${normalized}/`;
}

/**
 * Get provider homepage URL
 *
 * @param source - The provider source name
 * @returns The homepage URL or null
 */
export function getProviderHomepage(source: string): string | null {
  switch (source) {
    case 'anilist':
      return 'https://anilist.co';
    case 'comicvine':
      return 'https://comicvine.gamespot.com';
    default:
      return null;
  }
}
