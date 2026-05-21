/**
 * SearchStep Result Adapter
 *
 * Normalizes search results from various providers into
 * ExtendedMangaSearchResult format.
 *
 * Extracted and refactored from: searchStep.tsx (lines 148-286)
 */

import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { toStringId } from '@/utils/id-converters';

import { detectProvider, extractField } from './helpers';

// ============================================================================
// Image Proxy Configuration
// ============================================================================

/**
 * Domains that require proxying due to hotlink protection
 */
const DOMAINS_REQUIRING_PROXY = [
  'comicvine.gamespot.com',
  'static.wikia.nocookie.net'
];

/**
 * Check if a URL needs to be proxied
 */
function needsProxy(url: string): boolean {
  try {
    const parsed = new URL(url);
    return DOMAINS_REQUIRING_PROXY.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Simple hash for client-side proxy path generation
 * Matches the hash format used in image-proxy.ts
 */
function simpleHash(str: string): string {
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1 + char) >>> 0;
    hash2 = ((hash2 << 7) - hash2 + char) >>> 0;
  }
  return hash1.toString(16).padStart(8, '0') + hash2.toString(16).padStart(8, '0');
}

/**
 * Convert an image URL to a proxied URL if needed
 * Uses the /api/image-proxy endpoint to bypass hotlink protection
 */
function proxyImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  // Skip URLs that are already proxied
  if (url.startsWith('/api/image-proxy/')) {
    return url;
  }

  // Only proxy URLs that need it
  if (!needsProxy(url)) {
    return url;
  }

  // Create a unique path based on the URL hash (cleaner than full path)
  try {
    const proxyPath = simpleHash(url);
    return `/api/image-proxy/${proxyPath}?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Base identification fields for a search result
 */
interface BaseIdentificationFields {
  id: string;
  title: string;
  source: string;
  provider: string;
  sourceId: string;
}

/**
 * Cover and visual fields
 */
interface CoverFields {
  coverUrl?: string;
  cover?: string;
  coverImage?: string;
}

/**
 * Metadata fields extracted from result
 */
interface MetadataFields {
  description?: string;
  status?: string;
  alternativeTitles?: string[];
  genres?: string[];
  tags?: unknown[];
  themes?: unknown[];
  authors?: string[];
  artists?: string[];
  author?: string;
  artist?: string;
  volumes?: number;
  chapters?: number;
  startDate?: string;
  endDate?: string;
  published?: string;
  publisher?: string;
  magazine?: string;
  demographic?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create default result when input is invalid
 */
function createDefaultResult(source: string): ExtendedMangaSearchResult {
  return {
    id: `unknown-${Date.now()}`,
    title: 'Unknown Title',
    source,
    sourceId: `${source}-${Date.now()}`,
    provider: source
  } as ExtendedMangaSearchResult;
}

/**
 * Extract base identification fields from result item
 */
function extractBaseFields(
  item: Record<string, unknown>,
  source: string
): BaseIdentificationFields {
  const detectedProvider = detectProvider(item);
  const provider = detectedProvider ?? source;

  // Determine actual source for badge coloring
  const actualSource =
    (item['source'] as string | undefined) ??
    (item['provider'] as string | undefined) ??
    detectedProvider ??
    source;

  // Extract title
  const title = (extractField(item, 'title', provider) as string | undefined) ?? 'Unknown Title';

  // Extract ID
  const id = typeof item['id'] === 'string' || typeof item['id'] === 'number'
    ? toStringId(item['id'])
    : `unknown-${Date.now()}`;

  // Determine sourceId with fallbacks
  const sourceId = typeof item['sourceId'] === 'string'
    ? item['sourceId']
    : typeof item['id'] === 'string' || typeof item['id'] === 'number'
      ? toStringId(item['id'])
      : `${source}-${Date.now()}`;

  return {
    id,
    title,
    source: actualSource,
    provider: actualSource,
    sourceId
  };
}

/**
 * Extract cover-related fields from result item
 * Applies proxy transformation for domains with hotlink protection
 */
function extractCoverFields(
  item: Record<string, unknown>,
  provider: string
): CoverFields {
  // Try multiple field names for cover image
  const rawCoverUrl = (
    extractField(item, 'coverImage', provider) ??
    extractField(item, 'cover', provider) ??
    extractField(item, 'coverUrl', provider)
  ) as string | undefined;

  // Apply proxy transformation if needed (for ComicVine, Fandom, etc.)
  const coverUrl = proxyImageUrl(rawCoverUrl);

  return {
    ...(coverUrl && {
      coverUrl,
      cover: coverUrl,
      coverImage: coverUrl
    })
  };
}

/**
 * Extract metadata fields from result item
 */
function extractMetadataFields(
  item: Record<string, unknown>,
  provider: string
): MetadataFields {
  const description = extractField(item, 'description', provider) as string | undefined;
  const status = extractField(item, 'status', provider) as string | undefined;
  const alternativeTitles = extractField(item, 'alternativeTitles', provider) as string[] | undefined;
  const genres = extractField(item, 'genres', provider) as string[] | undefined;
  // Tags and themes may be objects (AniList: { name, rank }) or strings - preserve as-is for later transformation
  const tags = extractField(item, 'tags', provider) as unknown[] | undefined;
  const themes = extractField(item, 'themes', provider) as unknown[] | undefined;
  const authors = extractField(item, 'authors', provider) as string[] | undefined;
  const artists = extractField(item, 'artists', provider) as string[] | undefined;
  const author = extractField(item, 'author', provider) as string | undefined;
  const artist = extractField(item, 'artist', provider) as string | undefined;
  const volumes = extractField(item, 'volumes', provider) as number | undefined;
  const chapters = extractField(item, 'chapters', provider) as number | undefined;
  const startDate = extractField(item, 'startDate', provider) as string | undefined;
  const endDate = extractField(item, 'endDate', provider) as string | undefined;
  const published = extractField(item, 'published', provider) as string | undefined;
  const publisher = extractField(item, 'publisher', provider) as string | undefined;
  const magazine = extractField(item, 'magazine', provider) as string | undefined;
  const demographic = extractField(item, 'demographic', provider) as string | undefined;

  return {
    ...(description !== undefined && { description }),
    ...(status !== undefined && { status }),
    ...(alternativeTitles !== undefined && { alternativeTitles }),
    ...(genres !== undefined && { genres }),
    ...(tags !== undefined && { tags }),
    ...(themes !== undefined && { themes }),
    ...(authors !== undefined && { authors }),
    ...(artists !== undefined && { artists }),
    ...(author !== undefined && { author }),
    ...(artist !== undefined && { artist }),
    ...(volumes !== undefined && { volumes }),
    ...(chapters !== undefined && { chapters }),
    ...(startDate !== undefined && { startDate }),
    ...(endDate !== undefined && { endDate }),
    ...(published !== undefined && { published }),
    ...(publisher !== undefined && { publisher }),
    ...(magazine !== undefined && { magazine }),
    ...(demographic !== undefined && { demographic }),
  };
}

/**
 * Extract preserved object fields (metadata, rawData, providerSpecific)
 */
function extractPreservedObjects(
  item: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (item['metadata'] && typeof item['metadata'] === 'object') {
    result['metadata'] = item['metadata'];
  }

  if (item['rawData'] && typeof item['rawData'] === 'object') {
    result['rawData'] = item['rawData'];
  }

  if (item['providerSpecific'] && typeof item['providerSpecific'] === 'object') {
    result['providerSpecific'] = item['providerSpecific'];
  }

  return result;
}

/**
 * Extract provider-specific fields (URLs, Fandom fields, ComicVine fields)
 */
function extractProviderSpecificFields(
  item: Record<string, unknown>
): Record<string, unknown> {
  const providerFields = [
    'url',
    'wikiUrl',
    'articlePath',
    'pageId',
    'coverArt',
    'gallery',
    'volumeCovers',
    'issues',
    'issueCount',
    'characters',
    'creators',
    'publisher',
    'siteDetailUrl'
  ];

  const result: Record<string, unknown> = {};

  for (const field of providerFields) {
    if (item[field] !== undefined) {
      result[field] = item[field];
    }
  }

  return result;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Adapt any search result to ExtendedMangaSearchResult format
 *
 * Normalizes results from various providers (AniList, MAL, Fandom, ComicVine, etc.)
 * into a consistent format for the search UI.
 *
 * @param result - The raw search result from any provider
 * @param source - The source/provider identifier
 * @returns Normalized ExtendedMangaSearchResult
 */
export function adaptToMangaSearchResult(
  result: unknown,
  source: string
): ExtendedMangaSearchResult {
  // Handle invalid input
  if (!result || typeof result !== 'object') {
    return createDefaultResult(source);
  }

  const item = result as Record<string, unknown>;
  const detectedProvider = detectProvider(item);
  const provider = detectedProvider ?? source;

  // Combine all extracted fields
  return {
    ...extractBaseFields(item, source),
    ...extractCoverFields(item, provider),
    ...extractMetadataFields(item, provider),
    ...extractPreservedObjects(item),
    ...extractProviderSpecificFields(item)
  } as ExtendedMangaSearchResult;
}
