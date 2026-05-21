/**
 * Wikipedia & Fandom Metadata Helpers
 *
 * Foundation utilities for Wikipedia and Fandom metadata processing.
 * Provides URL parsing, data merging, and type-safe property access helpers.
 *
 * This module is shared across:
 * - metadata-wikipedia.ts (Wikipedia/Fandom search)
 * - metadata-fandom-enhanced.ts (Enhanced metadata fetching)
 * - metadata-fandom-fetch.ts (Volume/chapter data)
 *
 * All functions follow strict type safety patterns with no `any` types.
 */

/**
 * Enhanced metadata result structure
 * Combines data from FandomService.getMangaInfo() and FandomService.getPageMetadata()
 */
export interface EnhancedMetadataResult {
  title: string;
  alternativeTitles: string[];
  coverArt: {
    primary: string;
    gallery: string[];
    volumeCovers: string[];
    characterArt: string[];
  };
  descriptions: {
    synopsis?: string;
    plot?: string;
    background?: string;
    history?: string;
  };
  links: {
    volumesPage?: string;
    chaptersPage?: string;
    charactersPage?: string;
    arcsPage?: string;
  };
  publication: {
    author?: string;
    illustrator?: string;
    publisher?: {
      japan?: string;
      english?: string;
    };
    demographic?: string;
    genres: string[];
    themes: string[];
    status?: string;
    startDate?: string;
    endDate?: string;
    volumes?: number;
    chapters?: number;
  };
  volumeList?: unknown[];
  chapters?: unknown[];
}

/**
 * Parse a Fandom wiki URL to extract subdomain and manga title
 *
 * Handles URL format: https://subdomain.fandom.com/wiki/Title_Here_(manga)
 * Cleans up common suffixes like "(manga)" and "(series)"
 * Converts underscores to spaces and URL-decodes the title
 *
 * @param url - Full Fandom URL (e.g., https://fire-force.fandom.com/wiki/Fire_Force_(manga))
 * @returns Object with subdomain and cleaned title
 * @throws Error if URL cannot be parsed or is missing required components
 *
 * @example
 * parseFandomUrl('https://fire-force.fandom.com/wiki/Fire_Force_(manga)')
 * // Returns: { subdomain: 'fire-force', title: 'Fire Force' }
 */
export function parseFandomUrl(url: string): {
  subdomain: string;
  title: string;
} {
  // Extract from URL format: https://subdomain.fandom.com/wiki/Title_Here_(manga)
  const urlParts = new URL(url);
  const hostParts = urlParts.hostname.split('.');
  const subdomain = hostParts[0]; // e.g., 'fire-force'
  const pathParts = urlParts.pathname.split('/wiki/');

  let title = '';
  if (pathParts.length > 1 && pathParts[1]) {
    title = decodeURIComponent(pathParts[1])
      .replace(/_/g, ' ')
      .replace(/\s*\(manga\)\s*$/i, '')
      .replace(/\s*\(series\)\s*$/i, '')
      .trim();
  }

  if (!title || !subdomain) {
    throw new Error('Could not extract title and subdomain from URL');
  }

  return { subdomain, title };
}

/**
 * Safely access property on unknown object
 *
 * @param obj - Object to access (type-safe unknown)
 * @param key - Property key to retrieve
 * @returns Property value or undefined if not found
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Safely access string property on unknown object
 *
 * @param obj - Object to access (type-safe unknown)
 * @param key - Property key to retrieve
 * @returns String value or undefined if not found or not a string
 */
export function safeGetString(obj: unknown, key: string): string | undefined {
  const value = safeGet(obj, key);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Safely access number property on unknown object
 *
 * @param obj - Object to access (type-safe unknown)
 * @param key - Property key to retrieve
 * @returns Number value or undefined if not found or not a number
 */
export function safeGetNumber(obj: unknown, key: string): number | undefined {
  const value = safeGet(obj, key);
  return typeof value === 'number' ? value : undefined;
}

/**
 * Safely access array property on unknown object
 *
 * @param obj - Object to access (type-safe unknown)
 * @param key - Property key to retrieve
 * @returns Array value or undefined if not found or not an array
 */
export function safeGetArray(obj: unknown, key: string): unknown[] | undefined {
  const value = safeGet(obj, key);
  return Array.isArray(value) ? value : undefined;
}

/**
 * Safely access string array property on unknown object
 *
 * @param obj - Object to access (type-safe unknown)
 * @param key - Property key to retrieve
 * @returns String array or empty array if not found or not a string array
 */
export function safeGetStringArray(obj: unknown, key: string): string[] {
  const value = safeGetArray(obj, key);
  if (!value) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Extract title and alternative titles from metadata sources
 */
function extractTitles(mangaInfo: unknown, pageMetadata: unknown): {
  title: string;
  alternativeTitles: string[];
} {
  const title =
    safeGetString(mangaInfo, 'title') ??
    safeGetString(pageMetadata, 'title') ??
    '';
  const alternativeTitles = safeGetStringArray(mangaInfo, 'alternativeTitles');
  return { title, alternativeTitles };
}

/**
 * Extract cover art data from metadata sources
 */
function extractCoverArt(
  mangaInfo: unknown,
  pageMetadata: unknown
): EnhancedMetadataResult['coverArt'] {
  const primary =
    safeGetString(mangaInfo, 'coverImage') ??
    safeGetString(pageMetadata, 'coverImage') ??
    '';
  const gallery =
    safeGetArray(pageMetadata, 'gallery') ??
    safeGetArray(mangaInfo, 'images') ??
    [];
  return {
    primary,
    gallery: gallery as string[],
    volumeCovers: [],
    characterArt: [],
  };
}

/**
 * Extract description fields from metadata sources
 */
function extractDescriptions(
  mangaInfo: unknown,
  pageMetadata: unknown
): EnhancedMetadataResult['descriptions'] {
  const synopsis =
    safeGetString(mangaInfo, 'synopsis') ??
    safeGetString(pageMetadata, 'synopsis') ??
    safeGetString(mangaInfo, 'description') ??
    '';
  const reception = safeGetString(mangaInfo, 'reception');
  return {
    ...(synopsis && { synopsis }),
    ...(reception && { history: reception }),
  };
}

/**
 * Extract author, artist, and publisher information
 */
function extractCreatorInfo(
  mangaInfo: unknown,
  pageMetadata: unknown
): {
  author?: string;
  illustrator?: string;
  publisher?: { japan: string };
} {
  const author =
    safeGetString(mangaInfo, 'author') ??
    safeGetString(pageMetadata, 'author');
  const artist = safeGetString(pageMetadata, 'artist');
  const publisherValue =
    safeGetString(mangaInfo, 'publisher') ??
    safeGetString(pageMetadata, 'publisher');
  const publisher = publisherValue ? { japan: publisherValue } : undefined;

  return {
    ...(author && { author }),
    ...(artist && { illustrator: artist }),
    ...(publisher && { publisher }),
  };
}

/**
 * Extract publication status and date information
 */
function extractPublicationDates(
  mangaInfo: unknown,
  pageMetadata: unknown
): {
  status?: string;
  startDate?: string;
  endDate?: string;
} {
  const status =
    safeGetString(mangaInfo, 'status') ??
    safeGetString(pageMetadata, 'status');
  const startDate =
    safeGetString(mangaInfo, 'startDate') ??
    safeGetString(pageMetadata, 'startDate') ??
    safeGetString(mangaInfo, 'publishDate');
  const endDate =
    safeGetString(mangaInfo, 'endDate') ??
    safeGetString(pageMetadata, 'endDate');

  return {
    ...(status && { status }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  };
}

/**
 * Extract genre and demographic information
 */
function extractGenreInfo(
  mangaInfo: unknown,
  pageMetadata: unknown
): {
  genres: string[];
  demographic?: string;
} {
  const genres =
    safeGetStringArray(mangaInfo, 'genres').length > 0
      ? safeGetStringArray(mangaInfo, 'genres')
      : safeGetStringArray(pageMetadata, 'genres');
  const demographic =
    safeGetString(mangaInfo, 'demographic') ??
    safeGetString(pageMetadata, 'demographic') ??
    safeGetString(mangaInfo, 'publicationDemographic');

  return {
    genres,
    ...(demographic && { demographic }),
  };
}

/**
 * Extract volume and chapter count information
 */
function extractCounts(
  mangaInfo: unknown,
  pageMetadata: unknown
): {
  volumes?: number;
  chapters?: number;
} {
  const volumes =
    safeGetNumber(mangaInfo, 'volumes') ??
    safeGetNumber(pageMetadata, 'totalVolumes');
  const chapters =
    safeGetNumber(mangaInfo, 'totalChapters') ??
    safeGetNumber(pageMetadata, 'totalChapters');

  return {
    ...(volumes !== undefined && { volumes }),
    ...(chapters !== undefined && { chapters }),
  };
}

/**
 * Extract publication information from metadata sources
 */
function extractPublicationInfo(
  mangaInfo: unknown,
  pageMetadata: unknown
): EnhancedMetadataResult['publication'] {
  const creatorInfo = extractCreatorInfo(mangaInfo, pageMetadata);
  const dateInfo = extractPublicationDates(mangaInfo, pageMetadata);
  const genreInfo = extractGenreInfo(mangaInfo, pageMetadata);
  const counts = extractCounts(mangaInfo, pageMetadata);

  return {
    ...creatorInfo,
    ...genreInfo,
    themes: [],
    ...dateInfo,
    ...counts,
  };
}

/**
 * Extract volume and chapter lists from metadata sources
 */
function extractVolumesAndChapters(
  mangaInfo: unknown,
  pageMetadata: unknown,
  inputUrl: string
): {
  volumeList: unknown[];
  chapters: unknown[];
  links: EnhancedMetadataResult['links'];
} {
  const volumeList =
    safeGetArray(pageMetadata, 'volumes') ??
    safeGetArray(mangaInfo, 'volumeList') ??
    [];
  const chapters = safeGetArray(pageMetadata, 'chapters') ?? [];
  const volumesListUrl = safeGetString(pageMetadata, 'volumesListUrl');
  const volumesPage =
    volumesListUrl ??
    (() => {
      try {
        const urlParts = new URL(inputUrl);
        return `${urlParts.protocol}//${urlParts.host}/wiki/List_of_Volumes`;
      } catch {
        return undefined;
      }
    })();

  return {
    volumeList,
    chapters,
    links: {
      ...(volumesPage && { volumesPage }),
    },
  };
}

/**
 * Merge data from FandomService mangaInfo and pageMetadata into enhanced metadata structure
 *
 * Combines data from two sources with intelligent fallbacks:
 * - mangaInfo: Basic manga info from FandomService.getMangaInfo()
 * - pageMetadata: Page metadata from FandomService.getPageMetadata()
 *
 * Priority: pageMetadata > mangaInfo for volume/chapter lists
 * Priority: mangaInfo > pageMetadata for basic info (title, author, etc.)
 *
 * @param mangaInfo - Basic manga info from FandomService.getMangaInfo()
 * @param pageMetadata - Page metadata from FandomService.getPageMetadata()
 * @param inputUrl - Original URL for fallback volume page construction
 * @returns Merged enhanced metadata object with type-safe structure
 */
export function mergeMetadata(
  mangaInfo: unknown,
  pageMetadata: unknown,
  inputUrl: string
): EnhancedMetadataResult {
  const { title, alternativeTitles } = extractTitles(mangaInfo, pageMetadata);
  const coverArt = extractCoverArt(mangaInfo, pageMetadata);
  const descriptions = extractDescriptions(mangaInfo, pageMetadata);
  const publication = extractPublicationInfo(mangaInfo, pageMetadata);
  const { volumeList, chapters, links } = extractVolumesAndChapters(
    mangaInfo,
    pageMetadata,
    inputUrl
  );

  return {
    title,
    alternativeTitles,
    coverArt,
    descriptions,
    links,
    publication,
    volumeList,
    chapters,
  };
}
