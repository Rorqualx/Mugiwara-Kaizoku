/**
 * Provider Binding Helper Functions
 *
 * Extracted from manga.ts bindProvider mutation to reduce complexity.
 * Handles metadata fetching and provider entry creation.
 */

import { logger } from '@/utils/logger';

import type { Manga } from '@prisma/client';

/**
 * Provider metadata entry structure
 */
interface ProviderEntry {
  providerId: string;
  boundAt: string;
  Metadata?: Record<string, unknown>;
  fetchedAt?: string;
}

/**
 * Type guard for search result with required fields
 */
function isValidSearchResult(result: unknown): result is {
  title: string;
  description?: string;
  genres?: string[];
  status?: string;
  chapters?: number;
  volumes?: number;
} {
  return (
    typeof result === 'object' &&
    result !== null &&
    'title' in result &&
    typeof (result as { title: unknown }).title === 'string'
  );
}

/**
 * Helper to safely get string value from object
 */
function safeGetStringOptional(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'string' && value !== '') {
      return value;
    }
  }
  return undefined;
}

/**
 * Helper to safely get value from object
 */
function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Fetch metadata from provider
 *
 * Searches for manga using unified provider registry and extracts metadata.
 * Returns null if fetch fails or no results found.
 *
 * @param provider - Provider name
 * @param mangaTitle - Manga title to search
 * @returns Fetched metadata or null
 */
export async function fetchProviderMetadata(
  provider: string,
  mangaTitle: string
): Promise<Record<string, unknown> | null> {
  try {
    const { unifiedProviderRegistry } = await import('@/server/services/search/UnifiedProviderRegistry');
    const results = await unifiedProviderRegistry.searchWithProvider(
      provider,
      mangaTitle,
      { limit: 1 }
    );

    if (results.length === 0) {
      logger.warn(`No results found for ${mangaTitle} on ${provider}`);
      return null;
    }

    const firstResult = results[0];
    if (!firstResult || !isValidSearchResult(firstResult)) {
      logger.warn(`Invalid search result structure from ${provider}`);
      return null;
    }

    return {
      title: firstResult.title,
      description: firstResult.description ?? '',
      coverUrl: safeGetStringOptional(firstResult, 'coverUrl') ?? safeGetStringOptional(firstResult, 'cover_url') ?? '',
      genres: firstResult.genres ?? [],
      authors: Array.isArray(safeGet(firstResult, 'authors')) ? safeGet(firstResult, 'authors') as unknown[] : [],
      status: firstResult.status ?? '',
      chapters: firstResult.chapters ?? 0,
      volumes: firstResult.volumes ?? 0
    };
  } catch (error) {
    logger.warn(`Failed to fetch metadata from ${provider}:`, error);
    return null;
  }
}

/**
 * Create provider entry for binding
 *
 * @param providerId - Provider-specific ID
 * @param metadata - Optional fetched metadata
 * @returns Provider entry object
 */
export function createProviderEntry(
  providerId: string,
  metadata: Record<string, unknown> | null
): ProviderEntry {
  const entry: ProviderEntry = {
    providerId,
    boundAt: new Date().toISOString()
  };

  if (metadata !== null) {
    entry.Metadata = metadata;
    entry.fetchedAt = new Date().toISOString();
  }

  return entry;
}

/**
 * Pin fields to write when a provider is manually bound.
 *
 * `Manga.selectedSourceId` is the manual AniList pin: the enrichment pipeline
 * fetches that id straight from AniList, bypassing the matcher. Only an
 * AniList bind may write it (and always does, so a stale or junk value is
 * replaced). `Manga.sourceId` follows the rebind when AniList is the manga's
 * primary source, since it keys the "already in library" lookup.
 */
export function pinFieldsForBind(
  manga: Pick<Manga, 'source'>,
  provider: string,
  providerId: string
): { selectedSourceId?: string; sourceId?: string } {
  if (provider !== 'anilist') return {};
  return {
    selectedSourceId: providerId,
    ...(manga.source === 'anilist' ? { sourceId: providerId } : {})
  };
}

/**
 * Pin fields to clear when a provider is unbound. Unbinding AniList drops the
 * manual pin — pins are exempt from rejections, so leaving it would re-fetch
 * the entity the user just removed.
 */
export function pinFieldsForUnbind(provider: string): { selectedSourceId?: null } {
  return provider === 'anilist' ? { selectedSourceId: null } : {};
}

/**
 * Get current provider metadata as mutable record
 *
 * @param manga - Manga entity
 * @returns Provider metadata record
 */
export function getCurrentProviderMetadata(
  manga: Manga
): Record<string, unknown> {
  return (manga.providerMetadata ?? {}) as Record<string, unknown>;
}
