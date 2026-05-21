/**
 * Metadata AniList Router
 *
 * This module handles fetching and processing metadata from the AniList GraphQL API.
 * It provides the fetchAnilistMetadata procedure which retrieves comprehensive manga
 * information including titles, cover images, staff, characters, and more.
 *
 * Features:
 * - GraphQL API integration with AniList
 * - Comprehensive metadata extraction (titles, images, descriptions, staff, etc.)
 * - Enhanced data transformation (tags → themes, staff → authors/artists)
 * - Type-safe data access using safeGet utilities
 * - Robust error handling with AsyncResult pattern
 *
 * Data Transformations:
 * - Cover images: Extracted from nested coverImage object (extraLarge > large > medium)
 * - Tags: Mapped to both tags and themes arrays for UI flexibility
 * - Authors: Extracted from staff with "Story" or "Original" roles
 * - Artists: Extracted from staff with "Art" or "Illustration" roles
 * - Dates: Formatted from AniList's structured date objects (year-month-day)
 */

import { z } from 'zod';

import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { safeGet, safeGetString, isRecord } from './metadata-utils';

/**
 * Extract cover image URL from manga object
 * Tries extraLarge > large > medium from coverImage object, then falls back to string values
 */
function extractCoverImage(manga: unknown): string | undefined {
  if (!isRecord(manga)) return undefined;

  // Extract from nested coverImage object (AniList API returns { large, medium, extraLarge })
  const coverImage = safeGet(manga, 'coverImage');
  if (coverImage && typeof coverImage === 'object') {
    const coverImageObj = coverImage as unknown;
    return (
      safeGetString(coverImageObj, 'extraLarge') ??
      safeGetString(coverImageObj, 'large') ??
      safeGetString(coverImageObj, 'medium')
    );
  }

  // Fallback to string coverImage or coverUrl
  if (typeof coverImage === 'string') {
    return coverImage;
  }

  const coverUrl = safeGetString(manga, 'coverUrl');
  if (typeof coverUrl === 'string') {
    return coverUrl;
  }

  return undefined;
}

/**
 * Extract primary title from manga object
 * Prioritizes: english > romaji > native from the title object
 */
function extractPrimaryTitle(manga: unknown): string | undefined {
  if (!isRecord(manga)) return undefined;

  const titleObj = safeGet(manga, 'title');
  if (isRecord(titleObj)) {
    return (
      safeGetString(titleObj, 'english') ??
      safeGetString(titleObj, 'romaji') ??
      safeGetString(titleObj, 'native')
    );
  }

  // Fallback to direct title field if it exists
  const directTitle = safeGet(manga, 'title');
  if (typeof directTitle === 'string') return directTitle;

  return undefined;
}

/**
 * Extract alternative titles from manga object
 * Returns existing alternativeTitles array or creates one from title
 */
function extractAlternativeTitles(manga: unknown): string[] {
  if (!isRecord(manga)) return [];

  const altTitles = safeGet(manga, 'alternativeTitles');
  if (Array.isArray(altTitles) && altTitles.length > 0) {
    return altTitles as string[];
  }

  // Build from title object if no alternativeTitles
  const titleObj = safeGet(manga, 'title');
  if (isRecord(titleObj)) {
    const titles: string[] = [];
    const english = safeGetString(titleObj, 'english');
    const romaji = safeGetString(titleObj, 'romaji');
    const native = safeGetString(titleObj, 'native');
    if (english) titles.push(english);
    if (romaji && romaji !== english) titles.push(romaji);
    if (native && native !== english && native !== romaji) titles.push(native);
    if (titles.length > 0) return titles;
  }

  const title = safeGet(manga, 'title');
  return title ? [String(title)] : [];
}

/**
 * Extract tags from manga object
 * Handles both string tags and object tags with 'name' property
 */
function extractTags(manga: unknown): unknown[] {
  if (!isRecord(manga)) return [];

  const tags = safeGet(manga, 'tags');
  if (!Array.isArray(tags)) return [];

  return tags
    .map((t: unknown) => {
      if (typeof t === 'string') return t;
      if (isRecord(t)) return safeGet(t, 'name');
      return null;
    })
    .filter(Boolean);
}

/**
 * Extract themes from manga object tags
 * AniList tags serve as themes in the Universal Import Wizard
 */
function extractThemes(manga: unknown): unknown[] {
  if (!isRecord(manga)) return [];

  const tags = safeGet(manga, 'tags');
  if (!Array.isArray(tags)) return [];

  const extractedThemes = tags
    .map((t: unknown) => {
      if (typeof t === 'string') return t;
      if (isRecord(t)) return safeGet(t, 'name');
      return null;
    })
    .filter(Boolean);

  logger.info('[AniList tRPC] Extracted themes from tags:', {
    rawTagsCount: tags.length,
    extractedThemesCount: extractedThemes.length,
    first3Themes: extractedThemes.slice(0, 3),
  });

  return extractedThemes;
}

/**
 * Extract authors from manga staff or authors array
 * Looks for staff with "Story" or "Original" role, falls back to authors array
 */
function extractAuthors(manga: unknown): unknown[] {
  if (!isRecord(manga)) return [];

  const staff = safeGet(manga, 'staff');
  const edges = isRecord(staff) ? safeGet(staff, 'edges') : undefined;

  // Log staff edges for debugging
  logger.info('[AniList] extractAuthors - staff edges:', {
    hasStaff: !!staff,
    hasEdges: Array.isArray(edges),
    edgesCount: Array.isArray(edges) ? edges.length : 0,
    firstEdgeRole: Array.isArray(edges) && edges.length > 0 ? safeGet(edges[0], 'role') : 'none',
  });

  if (Array.isArray(edges)) {
    const staffAuthors = edges
      .filter((e: unknown) => {
        if (!isRecord(e)) return false;
        const role = safeGet(e, 'role');
        const isMatch = typeof role === 'string' && (role.includes('Story') || role.includes('Original'));
        if (isMatch) {
          logger.info('[AniList] extractAuthors - found matching role:', { role });
        }
        return isMatch;
      })
      .map((e: unknown) => {
        if (!isRecord(e)) return null;
        const node = safeGet(e, 'node');
        if (!isRecord(node)) return null;
        const name = safeGet(node, 'name');
        if (!isRecord(name)) return null;
        return safeGet(name, 'full');
      })
      .filter(Boolean);

    logger.info('[AniList] extractAuthors - extracted authors:', {
      authorsCount: staffAuthors.length,
      authors: staffAuthors,
    });

    if (staffAuthors.length > 0) return staffAuthors;
  }

  const authors = safeGet(manga, 'authors');
  if (Array.isArray(authors)) {
    return authors
      .map((a: unknown) => {
        if (typeof a === 'string') return a;
        if (isRecord(a)) return safeGet(a, 'name');
        return null;
      })
      .filter(Boolean);
  }

  return [];
}

/**
 * Extract artists from manga staff
 * Looks for staff with "Art" or "Illustration" role
 */
function extractArtists(manga: unknown): unknown[] {
  if (!isRecord(manga)) return [];

  const staff = safeGet(manga, 'staff');
  const edges = isRecord(staff) ? safeGet(staff, 'edges') : undefined;

  if (!Array.isArray(edges)) return [];

  return edges
    .filter((e: unknown) => {
      if (!isRecord(e)) return false;
      const role = safeGet(e, 'role');
      return typeof role === 'string' && (role.includes('Art') || role.includes('Illustration'));
    })
    .map((e: unknown) => {
      if (!isRecord(e)) return null;
      const node = safeGet(e, 'node');
      if (!isRecord(node)) return null;
      const name = safeGet(node, 'name');
      if (!isRecord(name)) return null;
      return safeGet(name, 'full');
    })
    .filter(Boolean);
}

/**
 * Format date from AniList structured date object
 * Returns formatted string "YYYY-MM-DD" with trailing dashes removed
 */
function formatDate(dateObj: unknown): string | undefined {
  if (!isRecord(dateObj)) return undefined;

  const year = safeGet(dateObj, 'year') ?? '';
  const month = safeGet(dateObj, 'month');
  const day = safeGet(dateObj, 'day');

  return `${year}-${String(month ?? '').padStart(2, '0')}-${String(day ?? '').padStart(2, '0')}`.replace(/-+$/, '');
}

/**
 * Extract start date from manga object
 */
function extractStartDate(manga: unknown, providerData: unknown): string | undefined {
  if (!isRecord(manga)) return undefined;

  const startDate = safeGet(manga, 'startDate');
  if (isRecord(startDate)) {
    return formatDate(startDate);
  }

  return isRecord(providerData) ? (safeGet(providerData, 'startDate') as string | undefined) : undefined;
}

/**
 * Extract end date from manga object
 */
function extractEndDate(manga: unknown, providerData: unknown): string | undefined {
  if (!isRecord(manga)) return undefined;

  const endDate = safeGet(manga, 'endDate');
  if (isRecord(endDate)) {
    return formatDate(endDate);
  }

  return isRecord(providerData) ? (safeGet(providerData, 'endDate') as string | undefined) : undefined;
}

/**
 * Extract chapters count from manga object
 */
function extractChapters(manga: unknown, providerData: unknown): number | undefined {
  if (!isRecord(manga)) return undefined;

  const chapters = safeGet(manga, 'chapters');
  if (Array.isArray(chapters)) return chapters.length;

  return isRecord(providerData) ? (safeGet(providerData, 'chapters') as number | undefined) : undefined;
}

/**
 * Extract characters from manga object
 */
function extractCharacters(manga: unknown): unknown[] {
  if (!isRecord(manga)) return [];

  const characters = safeGet(manga, 'characters');
  if (!isRecord(characters)) return [];
  const edges = safeGet(characters, 'edges');
  return Array.isArray(edges) ? edges : [];
}

/**
 * Extract staff from manga object
 */
function extractStaff(manga: unknown): unknown[] {
  if (!isRecord(manga)) return [];

  const staff = safeGet(manga, 'staff');
  if (!isRecord(staff)) return [];
  const edges = safeGet(staff, 'edges');
  return Array.isArray(edges) ? edges : [];
}

/**
 * Extract relations from manga object
 */
function extractRelations(manga: unknown): unknown[] {
  if (!isRecord(manga)) return [];

  const relations = safeGet(manga, 'relations');
  if (!isRecord(relations)) return [];
  const edges = safeGet(relations, 'edges');
  return Array.isArray(edges) ? edges : [];
}

/**
 * Extract recommendations from manga object
 */
function extractRecommendations(manga: unknown): unknown[] {
  if (!isRecord(manga)) return [];

  const recommendations = safeGet(manga, 'recommendations');
  if (!isRecord(recommendations)) return [];
  const nodes = safeGet(recommendations, 'nodes');
  return Array.isArray(nodes) ? nodes : [];
}

/** AniList metadata result type */
type AniListMetadataResult = {
  id?: string | number;
  title?: string;
  cover?: string;
  bannerImage?: string;
  description?: string;
  alternativeTitles?: string[];
  synonyms?: string[];
  genres?: string[];
  tags?: string[];
  themes?: string[];
  authors?: string[];
  artists?: string[];
  status?: string;
  format?: string;
  volumes?: number;
  chapters?: number;
  averageScore?: number;
  popularity?: number;
  startDate?: string;
  endDate?: string;
  characters?: unknown[];
  staff?: unknown[];
  relations?: unknown[];
  recommendations?: unknown[];
  countryOfOrigin?: string;
  isAdult?: boolean;
  siteUrl?: string;
};

// Helper to get string field from manga object
function getMangaStringField(manga: unknown, field: string): string | undefined {
  const value = safeGet(manga, field);
  return typeof value === 'string' ? value : undefined;
}

// Helper to get number field with fallback
function getMangaNumberField(manga: unknown, field: string, fallbackSource?: unknown): number | undefined {
  const value = safeGet(manga, field);
  if (typeof value === 'number') return value;
  if (fallbackSource) {
    const fallback = safeGet(fallbackSource, field);
    if (typeof fallback === 'number') return fallback;
  }
  return undefined;
}

// Helper to get string array from manga object
function getMangaStringArray(manga: unknown, field: string): string[] {
  const value = safeGet(manga, field);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

// Helper to convert unknown array to string array
function toStringArray(arr: unknown[]): string[] {
  return arr.filter((v): v is string => typeof v === 'string');
}

/**
 * Build AniList metadata result from manga object
 */
function buildAniListMetadataResult(manga: unknown, providerData: unknown): AniListMetadataResult {
  const getStringField = (field: string): string | undefined => getMangaStringField(manga, field);
  const getNumberField = (field: string, fallback?: unknown): number | undefined => getMangaNumberField(manga, field, fallback);

  // Build result with only defined values (exactOptionalPropertyTypes compatibility)
  const result: AniListMetadataResult = {
    alternativeTitles: extractAlternativeTitles(manga),
    synonyms: getMangaStringArray(manga, 'synonyms'),
    genres: getMangaStringArray(manga, 'genres'),
    tags: toStringArray(extractTags(manga)),
    themes: toStringArray(extractThemes(manga)),
    authors: toStringArray(extractAuthors(manga)),
    artists: toStringArray(extractArtists(manga)),
    characters: extractCharacters(manga),
    staff: extractStaff(manga),
    relations: extractRelations(manga),
    recommendations: extractRecommendations(manga),
  };

  // Add optional ID
  const id = safeGet(manga, 'id');
  if (typeof id === 'string' || typeof id === 'number') result.id = id;

  // Add primary title (english > romaji > native)
  const title = extractPrimaryTitle(manga);
  if (title !== undefined) result.title = title;

  // Add optional string fields
  const cover = extractCoverImage(manga);
  if (cover !== undefined) result.cover = cover;
  const bannerImage = getStringField('bannerImage');
  if (bannerImage !== undefined) result.bannerImage = bannerImage;
  const description = getStringField('description');
  if (description !== undefined) result.description = description;
  const status = getStringField('status') ?? getStringField('publicationStatus');
  if (status !== undefined) result.status = status;
  const format = getStringField('format');
  if (format !== undefined) result.format = format;
  const countryOfOrigin = getStringField('countryOfOrigin');
  if (countryOfOrigin !== undefined) result.countryOfOrigin = countryOfOrigin;
  const siteUrl = getStringField('siteUrl');
  if (siteUrl !== undefined) result.siteUrl = siteUrl;

  // Add optional number fields
  const volumes = getNumberField('volumes', providerData);
  if (volumes !== undefined) result.volumes = volumes;
  const chapters = extractChapters(manga, providerData);
  if (chapters !== undefined) result.chapters = chapters;
  const averageScore = getNumberField('averageScore') ?? getNumberField('score');
  if (averageScore !== undefined) result.averageScore = averageScore;
  const popularity = getNumberField('popularity');
  if (popularity !== undefined) result.popularity = popularity;

  // Add optional date fields
  const startDate = extractStartDate(manga, providerData);
  if (startDate !== undefined) result.startDate = startDate;
  const endDate = extractEndDate(manga, providerData);
  if (endDate !== undefined) result.endDate = endDate;

  // Add optional boolean fields
  const isAdult = safeGet(manga, 'isAdult');
  if (typeof isAdult === 'boolean') result.isAdult = isAdult;

  return result;
}

/**
 * Extract AniList ID from URL or return the provided ID
 * @returns The extracted ID or an error
 */
function extractAniListId(url?: string, id?: string): { id: string } | { error: Error } {
  if (id) return { id };

  if (url?.includes('anilist.co')) {
    const match = url.match(/manga\/(\d+)/);
    if (match?.[1]) {
      return { id: match[1] };
    }
    return { error: new Error('Invalid AniList URL format') };
  }

  return { error: new Error('AniList ID or URL is required') };
}

/**
 * Process manga response and return metadata or error
 */
function processMangaResponse(manga: unknown): AsyncResult<AniListMetadataResult, Error> {
  if (manga) {
    const providerData = safeGet(manga, 'providerSpecific') ?? {};
    const resultData = buildAniListMetadataResult(manga, providerData);

    logger.info('✅ [ANILIST MUTATION] Returning success result:', {
      hasData: true,
      dataKeys: Object.keys(resultData),
      alternativeTitles: resultData.alternativeTitles,
      authors: resultData.authors,
      authorsCount: resultData.authors?.length ?? 0,
      artists: resultData.artists,
      artistsCount: resultData.artists?.length ?? 0,
    });

    return createSuccessResult(resultData);
  }

  if (isRecord(manga) && 'error' in manga) {
    const mangaError = manga as { error?: Error };
    const errorToReturn = mangaError.error ?? new Error('Unknown error');
    return createErrorResult(errorToReturn);
  }

  return createErrorResult(new Error('Failed to fetch AniList metadata'));
}

/**
 * Metadata AniList Router
 * Provides procedures for fetching and processing metadata from AniList
 */
export const metadataAnilistRouter = router({
  /**
   * Fetch enhanced metadata from an AniList URL or ID
   *
   * Retrieves comprehensive manga information from AniList's GraphQL API including:
   * - Basic info (title, description, status, scores)
   * - Images (cover, banner)
   * - Staff (authors, artists)
   * - Characters and relations
   * - Publication data (volumes, chapters, dates)
   * - Tags and genres
   */
  fetchAnilistMetadata: publicProcedure
    .input(
      z.object({
        url: z.string().optional(),
        id: z.string().optional(),
      })
    )
    .mutation(async ({ input }): Promise<AsyncResult<AniListMetadataResult, Error>> => {
      logger.info('🔄 [ANILIST MUTATION] Called with input:', input);

      try {
        // Extract ID from input
        const idResult = extractAniListId(input.url, input.id);
        if ('error' in idResult) {
          return createErrorResult(idResult.error);
        }

        logger.info(`Fetching enhanced metadata for AniList ID: ${idResult.id}`);

        // Import AniList service and fetch manga details
        const { anilistService } = await import('../../../services/anilist/service');
        const manga = await anilistService.getMangaDetails(parseInt(idResult.id, 10));

        return processMangaResponse(manga);
      } catch (error: unknown) {
        logger.error(`Error fetching AniList metadata: ${error instanceof Error ? error.message : String(error)}`);
        return createErrorResult(
          error instanceof Error ? error : new Error(`Failed to fetch AniList metadata: ${String(error)}`)
        );
      }
    }),
});
