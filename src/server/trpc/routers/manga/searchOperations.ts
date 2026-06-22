/**
 * Search Operations Router
 *
 * Handles all search-related manga operations including:
 * - Basic manga search
 * - Multi-provider search
 * - Provider confirmation search
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { detectErrorType } from '@/server/services/search/unified-registry/registry-utils';
import { protectedProcedure, uncachedPublicProcedure } from '@/server/trpc/procedures';
import { membershipWhere, requireUserId } from '@/server/trpc/routers/_shared/library-access';
import { router } from '@/server/trpc/trpc';
import type { ProviderErrorInfo } from '@/types/search-types/provider.types';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import {
  cleanSearchTitle,
  isRecord,
  searchProviderWithTimeout,
  transformSearchResults,
  type StandardizedMangaResult
} from './search-helpers';

// ===================================
// ZOD SCHEMAS
// ===================================

const includeSchema = z.object({
  library: z.boolean().optional(),
  metadata: z.boolean().optional(),
  chapters: z.boolean().optional(),
  volumes: z.boolean().optional(),
}).optional();

const searchSchema = z.object({
  source: z.string().min(1),
  keyword: z.string().min(1)
});

const providerConfirmationSearchSchema = z.object({
  title: z.string(),
  providers: z.array(z.string())
});

// ===================================
// HELPER FUNCTIONS
// ===================================

/**
 * Get timeout duration based on provider complexity
 * Extended timeout for providers that make multi-step API calls
 */
function getProviderTimeout(providerName: string): number {
  // Extended timeout for providers that make multi-step API calls:
  // - WIKIPEDIA: search, parse, enrich
  // - FANDOM: MediaWiki API + v1 API + article details + page metadata
  const extendedTimeoutProviders = ['WIKIPEDIA', 'FANDOM'];
  return extendedTimeoutProviders.includes(providerName.toUpperCase()) ? 15000 : 5000;
}

/**
 * Initialize and get provider registry with validation
 *
 * @returns Promise resolving to initialized registry
 */
async function getProviderRegistry(): Promise<{
  get: (name: string) => unknown;
  getAll: () => Record<string, unknown>;
}> {
  const { getInitializedProviderRegistry } = await import('../../../services/search/ensureProviderRegistry');
  return getInitializedProviderRegistry();
}

/**
 * Type for chapter from Prisma
 */
interface ChapterRecord {
  id: number;
  title: string;
  number?: number | null;
  chapterNumber?: number | null;
  volume?: number | null;
  coverImage?: string | null;
  pages?: number | null;
  releaseDate?: Date | null;
  description?: string | null;
}

/**
 * Type for manga with metadata from Prisma
 */
interface MangaWithMetadata {
  id: number;
  title: string;
  // providerMetadata is on Manga model, not Metadata!
  providerMetadata?: unknown;
  Chapter?: ChapterRecord[];
  Volume?: {
    id: number;
    number: number;
    title: string | null;
    coverImage: string | null;
    chapterStart: number | null;
    chapterEnd: number | null;
  }[];
  Metadata?: {
    summary?: string | null;
    cover?: string | null;
    coverLarge?: string | null;
    coverMedium?: string | null;
    status?: string;
    genres?: string[];
    startDate?: Date | null;
    endDate?: Date | null;
    synonyms?: string[];
    volumes?: number | null;
    chapters?: number | null;
  } | null;
}

/**
 * Get the best available cover from metadata
 *
 * @param metadata - Manga metadata
 * @returns Cover URL or empty string
 */
function extractCoverUrl(metadata: MangaWithMetadata['Metadata']): string {
  if (!metadata) return '';
  return metadata.cover ?? metadata.coverLarge ?? metadata.coverMedium ?? '';
}

/**
 * Build where clause for library search
 * Supports filtering by keyword and optionally excluding manga with files
 */
function buildLibrarySearchWhereClause(
  keyword: string,
  onlyWithoutFiles: boolean
): Record<string, unknown> {
  const noFilesCondition = { NOT: { Chapter: { some: { downloadStatus: 'COMPLETED' as const } } } };

  // If no keyword but filtering by files, return just the file filter
  if (!keyword.trim()) {
    return onlyWithoutFiles ? noFilesCondition : {};
  }

  // Normalize search query: strip trailing numbers, volume indicators, etc.
  let normalizedKeyword = keyword;
  normalizedKeyword = normalizedKeyword.replace(/\s*(?:v|vol\.?|volume)\s*\d+(?:-\d+)?/gi, '');
  normalizedKeyword = normalizedKeyword.replace(/\s+\d+$/g, '');
  normalizedKeyword = normalizedKeyword.replace(/\s+/g, ' ').trim();
  if (normalizedKeyword.length === 0) normalizedKeyword = keyword;

  // Split into words for OR matching
  const words = normalizedKeyword.split(/\s+/).filter((w) => w.length >= 2);
  const titleConditions = words.length > 1
    ? { OR: words.map((word) => ({ title: { contains: word, mode: 'insensitive' as const } })) }
    : { title: { contains: normalizedKeyword, mode: 'insensitive' as const } };

  if (!onlyWithoutFiles) {
    return titleConditions;
  }

  // Combine title search with file filter
  return { AND: [titleConditions, noFilesCondition] };
}

/**
 * Transform database Chapter records to library chapter format
 */
function transformChaptersToLibraryFormat(chapters: ChapterRecord[]): {
  id: string;
  number: number;
  title: string;
  volumeNumber?: number;
  coverImage?: string;
  pages?: number;
  releaseDate?: string;
  summary?: string;
}[] {
  return chapters
    .filter((ch) => (ch.number ?? ch.chapterNumber) !== null)
    .map((ch) => {
      const chapterNum = ch.number ?? ch.chapterNumber ?? 0;
      const result: {
        id: string;
        number: number;
        title: string;
        volumeNumber?: number;
        coverImage?: string;
        pages?: number;
        releaseDate?: string;
        summary?: string;
      } = {
        id: `library-ch-${ch.id}`,
        number: chapterNum,
        title: ch.title,
      };
      // Only add optional fields if they have values
      if (ch.volume !== null && ch.volume !== undefined) result.volumeNumber = ch.volume;
      if (ch.coverImage) result.coverImage = ch.coverImage;
      if (ch.pages !== null && ch.pages !== undefined) result.pages = ch.pages;
      if (ch.releaseDate) result.releaseDate = ch.releaseDate.toISOString();
      if (ch.description) result.summary = ch.description;
      return result;
    })
    .sort((a, b) => a.number - b.number);
}

/**
 * Transform a library manga into a standardized result
 *
 * @param manga - Manga record from database
 * @returns Standardized manga result
 */
// eslint-disable-next-line complexity -- Database-to-API transformation requires mapping all optional Metadata fields; complexity reflects field coverage not control flow
function transformLibraryManga(manga: MangaWithMetadata): StandardizedMangaResult {
  const metadata = manga.Metadata;
  const coverUrl = extractCoverUrl(metadata);

  // Transform Chapter records to library format for file matching
  const libraryChapters = manga.Chapter ? transformChaptersToLibraryFormat(manga.Chapter) : [];

  // Transform Volume records to library format for file matching (includes cover images)
  const libraryVolumes = manga.Volume?.map((vol) => ({
    id: vol.id,
    number: vol.number,
    title: vol.title ?? undefined,
    coverImage: vol.coverImage ?? undefined,
    chapterStart: vol.chapterStart ?? undefined,
    chapterEnd: vol.chapterEnd ?? undefined,
  })).sort((a, b) => a.number - b.number) ?? [];

  return {
    id: toStringId(manga.id),
    title: manga.title,
    alternativeTitles: metadata?.synonyms ?? [],
    description: metadata?.summary ?? '',
    cover: coverUrl,
    coverImage: coverUrl,
    status: metadata?.status ?? 'Unknown',
    genres: metadata?.genres ?? [],
    score: 0,
    popularity: 0,
    startDate: metadata?.startDate?.toISOString() ?? null,
    endDate: metadata?.endDate?.toISOString() ?? null,
    source: 'library',
    inLibrary: true,
    libraryId: manga.id,
    // providerMetadata is on Manga model, not Metadata!
    providerMetadata: manga.providerMetadata ?? null,
    // Include actual chapter records from database for file matching
    libraryChapters: libraryChapters.length > 0 ? libraryChapters : null,
    // Include actual volume records from database for file matching (with cover images)
    libraryVolumes: libraryVolumes.length > 0 ? libraryVolumes : null,
    // Include volume/chapter counts
    volumes: metadata?.volumes ?? null,
    chapters: metadata?.chapters ?? null,
  };
}

// ===================================
// HELPERS
// ===================================

interface SingleProviderOutcome {
  results: StandardizedMangaResult[];
  error?: ProviderErrorInfo;
}

async function searchSingleProvider(
  registry: { get: (name: string) => unknown; getAll: () => Record<string, unknown> },
  providerName: string,
  title: string,
): Promise<SingleProviderOutcome> {
  if (!providerName) {
    logger.warn('Undefined provider name passed to searchAcrossProviders');
    return { results: [] };
  }

  const normalizedName = providerName.toLowerCase();
  const provider = registry.get(normalizedName) as { search: (query: string) => Promise<unknown[]> } | undefined;

  if (!provider) {
    logger.warn(`Provider ${normalizedName} not found in registry, skipping. Available: ${Object.keys(registry.getAll()).join(', ')}`);
    return { results: [] };
  }

  if (!title || title.trim() === '') {
    logger.warn(`Empty title passed for provider ${normalizedName}, skipping`);
    return { results: [] };
  }

  try {
    const searchResults = await provider.search(title);
    logger.info(`${normalizedName} search found ${searchResults.length} results for ${title}`);
    return { results: transformSearchResults(searchResults, normalizedName) };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = detectErrorType(error);
    logger.error(`Error searching ${providerName}: ${errorMessage}`);
    return {
      results: [],
      error: { provider: providerName, error: errorMessage, errorType, timestamp: Date.now() },
    };
  }
}

// ===================================
// SEARCH OPERATIONS ROUTER
// ===================================

export const searchRouter = router({

  /**
   * Search manga in the local library
   * Searches by title in the user's existing manga collection
   *
   * @param input Search keyword and include options
   * @returns Array of manga matching the search criteria
   */
  searchLibrary: protectedProcedure.input(z.object({
    keyword: z.string().optional().default(''),
    include: includeSchema,
    /** Filter to only show manga without downloaded files */
    onlyWithoutFiles: z.boolean().optional().default(false),
  })).query(async ({ input, ctx }) => {
    try {
      const userId = requireUserId(ctx);
      const whereClause = buildLibrarySearchWhereClause(input.keyword, input.onlyWithoutFiles);

      const result = await ctx.prisma.manga.findMany({
        where: { ...whereClause, ...membershipWhere(userId) },
        include: {
          Library: input.include?.library ?? true,
          Metadata: input.include?.metadata ?? true,
          // Always include Chapters for library search - needed for file matching
          Chapter: true,
          // Include Volumes for cover images
          Volume: {
            select: {
              id: true,
              number: true,
              title: true,
              coverImage: true,
              chapterStart: true,
              chapterEnd: true,
            },
          },
        },
        orderBy: {
          title: 'asc'
        }
      });

      return result.map((manga) => transformLibraryManga(manga as MangaWithMetadata));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error searching library: ${errorMessage}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to search library'
      });
    }
  }),

  /**
   * Search for manga
   *
   * NOTE: Using uncachedPublicProcedure because:
   * 1. Different search queries need different results (cache key collision risk)
   * 2. Providers have their own internal caching (search-helpers.ts cacheProvider)
   * 3. tRPC-level caching was causing all queries to return first query's results
   *
   * @param input Object containing source and keyword
   * @returns Array of search results
   */
  search: uncachedPublicProcedure.input(searchSchema).query(async ({ input }): Promise<StandardizedMangaResult[]> => {
    logger.info(`Manga search request: source=${input["source"]}, keyword=${input.keyword}`);

    // Use our enhanced provider registry initialization
    const { unifiedProviderRegistry } = await import('../../../services/search/UnifiedProviderRegistry');
    const searchProviderRegistry = await getProviderRegistry();

    // Determine provider name
    const providerName = input["source"].toLowerCase();

    // Check if provider is enabled
    const providerState = unifiedProviderRegistry.getProviderState(providerName);
    if (!providerState?.enabled) {
      logger.error(`Provider ${providerName} is disabled or not configured`);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Provider ${providerName} is disabled or not configured. Please enable it in settings or try a different provider.`
      });
    }

    // Get provider instance from the initialized registry
    const provider = searchProviderRegistry.get(providerName);
    if (!provider) {
      logger.error(`Provider ${providerName} not found in registry. Available providers: ${Object.keys(searchProviderRegistry.getAll()).join(', ')}`);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Provider ${providerName} not found. Please try a different provider.`
      });
    }

    try {
      // Check if this is a provider search (mangal service removed)
      if (providerName === 'comicvine' || providerName === 'anilist' || providerName === 'fandom' || providerName === 'wikipedia') {
        // Perform search and transform results
        const searchResults = await (provider as { search: (query: string) => Promise<unknown[]> }).search(input.keyword);
        logger.info(`${providerName} search found ${searchResults.length} results for ${input.keyword}`);

        // Ensure we always have an array of results
        const resultsArray = Array.isArray(searchResults) ? searchResults : [];

        // Use helper to transform and standardize results
        return transformSearchResults(resultsArray, providerName);
      }

      // Mangal service removed - return empty results
      return [];
    } catch (error: unknown) {
      logger.error(`Error in manga search: ${error instanceof Error ? error.message : String(error)}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Search failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }),

  /**
   * Search for manga across multiple providers
   *
   * NOTE: Using uncachedPublicProcedure - providers have their own caching
   *
   * @param input Object containing title and array of providers to search
   * @returns Object with search results grouped by provider, plus any provider errors
   */
  searchAcrossProviders: uncachedPublicProcedure.input(providerConfirmationSearchSchema).query(async ({ input }): Promise<{ results: Record<string, StandardizedMangaResult[]>; providerErrors: ProviderErrorInfo[] }> => {
    logger.info(`Multi-provider search request for title: ${input["title"]}, providers: ${input.providers.join(', ')}`);

    try {
      const registry = await getProviderRegistry();
      const results: Record<string, StandardizedMangaResult[]> = {};
      const providerErrors: ProviderErrorInfo[] = [];

      if (input.providers.length === 0) {
        logger.warn('Empty providers array passed to searchAcrossProviders');
        return { results, providerErrors };
      }

      await Promise.all(input.providers.map(async (providerName) => {
        const outcome = await searchSingleProvider(registry, providerName, input["title"]);
        results[providerName] = outcome.results;
        if (outcome.error) providerErrors.push(outcome.error);
      }));

      return { results, providerErrors };
    } catch (error: unknown) {
      logger.error(`Error in searchAcrossProviders: ${error instanceof Error ? error.message : String(error)}`);
      return { results: {}, providerErrors: [] };
    }
  }),

  /**
   * Search for manga across providers for confirmation step
   * Enhanced version that searches ALL available providers in parallel to provide
   * alternative metadata options, not just the requested providers
   *
   * @param input Object containing title and array of providers to search
   * @returns Object with search results grouped by provider, including metadata from all sources
   */
  searchProviderConfirmation: uncachedPublicProcedure.input(providerConfirmationSearchSchema).query(async ({ input }): Promise<{ results: Record<string, StandardizedMangaResult[]>; providerErrors: ProviderErrorInfo[] }> => {
    logger.info(`Provider confirmation search for title: ${input["title"]}, requested providers: ${input.providers.join(', ')}`);

    try {
      const registry = await getProviderRegistry();
      const results: Record<string, StandardizedMangaResult[]> = {};
      const providerErrors: ProviderErrorInfo[] = [];

      const requestedProviders = input.providers;
      logger.info(`Searching ${requestedProviders.length} requested providers: ${requestedProviders.join(', ')}`);

      if (requestedProviders.length === 0) {
        logger.warn('No providers requested in input');
        return { results, providerErrors };
      }

      await Promise.all(requestedProviders.map(async (providerName) => {
        try {
          results[providerName] = await searchSingleProviderForConfirmation(
            providerName,
            input["title"],
            registry
          );
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorType = detectErrorType(error);
          logger.error(`Error searching ${providerName}: ${errorMessage}`);
          results[providerName] = [];
          providerErrors.push({ provider: providerName, error: errorMessage, errorType, timestamp: Date.now() });
        }
      }));

      const summary = Object.entries(results).map(([provider, items]) => `${provider}: ${items.length}`).join(', ');
      logger.info(`Search complete. Results summary: ${summary}`);
      return { results, providerErrors };
    } catch (error: unknown) {
      logger.error(`Error in searchProviderConfirmation: ${error instanceof Error ? error.message : String(error)}`);
      return { results: {}, providerErrors: [] };
    }
  })
});

// ===================================
// PRIVATE HELPER FUNCTIONS
// ===================================

/**
 * Search a single provider for confirmation with enrichment and caching
 *
 * @param providerName - Name of provider to search
 * @param originalTitle - Original search title
 * @param registry - Provider registry instance
 * @returns Array of standardized results
 */
async function searchSingleProviderForConfirmation(
  providerName: string,
  originalTitle: string,
  registry: { get: (name: string) => unknown }
): Promise<StandardizedMangaResult[]> {
  // Skip undefined provider names
  if (!providerName) {
    logger.warn('Undefined provider name in registry');
    return [];
  }

  // Get provider instance
  const provider = registry.get(providerName);
  if (!provider) {
    logger.warn(`Provider ${providerName} not found in registry despite being listed`);
    return [];
  }

  // Validate title
  if (!originalTitle || originalTitle.trim() === '') {
    logger.warn(`Empty title passed for provider ${providerName}, skipping`);
    return [];
  }

  // Clean title for better search results
  const searchTitle = cleanSearchTitle(originalTitle);
  if (searchTitle !== originalTitle) {
    logger.info(`Using cleaned title "${searchTitle}" instead of "${originalTitle}" for ${providerName}`);
  }

  // Search with timeout and caching
  const searchResults = await searchProviderWithTimeout(
    provider as { search: (query: string) => Promise<unknown[]> },
    searchTitle,
    providerName,
    getProviderTimeout(providerName)
  );

  // Enrich top 3 results with provider marker
  const enrichedResults = enrichTopResults(searchResults, providerName);

  // Standardize and return results
  return transformSearchResults(enrichedResults, providerName);
}

/**
 * Enrich top search results with provider marker
 *
 * @param searchResults - Raw search results
 * @param providerName - Name of provider
 * @returns Results with top 3 enriched
 */
function enrichTopResults(searchResults: unknown[], providerName: string): unknown[] {
  try {
    // Mark top 3 results with provider name
    const enrichedTop = searchResults.slice(0, 3).map((item: unknown) => {
      try {
        if (isRecord(item) && item["id"]) {
          return { ...item, _provider: providerName };
        }
        return item;
      } catch (enrichError) {
        logger.warn(`Failed to enrich result for ${providerName}:`, enrichError);
        return item;
      }
    });

    // Combine enriched and remaining results
    return [...enrichedTop, ...searchResults.slice(3)];
  } catch (enrichmentError) {
    logger.warn(`Enrichment failed for ${providerName}, using standard results:`, enrichmentError);
    return searchResults;
  }
}
