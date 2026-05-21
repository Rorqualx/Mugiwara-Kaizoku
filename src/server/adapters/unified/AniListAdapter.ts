/**
 * Unified AniList Adapter
 * 
 * Refactored AniList adapter using the UnifiedBaseAdapter pattern.
 * Provides comprehensive manga metadata from AniList GraphQL API.
 */

import { MangaPublicationStatus } from '@prisma/client';
import axios from 'axios';

import type { 
  MangaSearchResult,
  PartialUnifiedMetadata,
  SearchOptions,
  PersonInfo,
  TagInfo,
  CoverImages
} from '@/types/search.types';
import type { 
  AsyncResult} from '@/utils/async-result';
import { 
  createSuccessResult} from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import { mapToMangaStatus } from '@/utils/status-mapper';


import { 
  UnifiedBaseAdapter 
} from '../UnifiedBaseAdapter';

import type { 
  UnifiedAdapterConfig,
  AdapterCapabilities 
} from '../UnifiedBaseAdapter';
import type { MangaFormat } from '@prisma/client';
import type { AxiosInstance } from 'axios';

// ============================================================================
// AniList Types
// ============================================================================

interface AniListMedia {
  id: number;
  idMal?: number | null;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
    userPreferred?: string | null;
  };
  description?: string | null;
  status?: string | null;
  format?: string | null;
  genres?: string[] | null;
  tags?: Array<{
    name: string;
    rank: number;
    isMediaSpoiler?: boolean;
  }> | null;
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
    medium?: string | null;
    color?: string | null;
  } | null;
  bannerImage?: string | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  endDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  volumes?: number | null;
  chapters?: number | null;
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  staff?: {
    edges?: Array<{
      role?: string | null;
      node?: {
        name?: {
          full?: string | null;
          native?: string | null;
        } | null;
      } | null;
    }> | null;
  } | null;
  siteUrl?: string | null;
  isAdult?: boolean | null;
  countryOfOrigin?: string | null;
  synonyms?: string[] | null;
}

interface AniListResponse {
  data?: {
    Page?: {
      media?: AniListMedia[] | null;
    } | null;
    Media?: AniListMedia | null;
  } | null;
}

// ============================================================================
// Configuration
// ============================================================================

export interface AniListAdapterConfig extends UnifiedAdapterConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
}

// ============================================================================
// AniList Adapter Implementation
// ============================================================================

export class AniListAdapter extends UnifiedBaseAdapter<AniListResponse, AniListAdapterConfig> {
  // ============================================================================
  // Properties
  // ============================================================================
  
  readonly adapterName = 'AniListAdapter';
  readonly adapterType = 'metadata' as const;
  readonly providerName = 'AniList';
  readonly baseConfidence = 0.95; // High confidence due to comprehensive data
  readonly capabilities: AdapterCapabilities = {
    search: true,
    metadata: true,
    chapters: false, // AniList doesn't provide chapter details
    batchOperations: true,
    caching: true,
    rateLimit: true
  };
  
  private client: AxiosInstance;
  private readonly graphqlEndpoint = 'https://graphql.anilist.co';
  
  // ============================================================================
  // Constructor
  // ============================================================================
  
  constructor(config: AniListAdapterConfig) {
    super(config);
    
    // Initialize axios client
    this.client = axios.create({
      baseURL: this.config.apiUrl ?? this.graphqlEndpoint,
      timeout: this.config.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // Add auth header if token provided
    if (this.config.accessToken) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.config.accessToken}`;
    }
  }
  
  // ============================================================================
  // Required Abstract Methods
  // ============================================================================
  
  /**
   * Validate raw AniList response
   */
  validateRawData(data: unknown): data is AniListResponse {
    if (!data || typeof data !== 'object') return false;

    const response = data as Record<string, unknown>;

    // Check for valid response structure
    const responseData = response['data'];
    if (responseData && typeof responseData === 'object') {
      const dataObj = responseData as Record<string, unknown>;
      // Search response
      const page = dataObj['Page'];
      if (page && typeof page === 'object') {
        const pageObj = page as Record<string, unknown>;
        if (Array.isArray(pageObj['media'])) {
          return true;
        }
      }
      // Single media response
      const media = dataObj['Media'];
      if (media && typeof media === 'object') {
        return true;
      }
    }

    return false;
  }
  
  /**
   * Transform AniList media to unified metadata format
   */
  transform(rawData: AniListResponse): Promise<AsyncResult<PartialUnifiedMetadata, Error>> {
    try {
      // Extract media object
      const media = rawData.data?.Media ?? rawData.data?.Page?.media?.[0];

      if (!media) {
        return Promise.resolve(this.createError('No media data found in response') as AsyncResult<PartialUnifiedMetadata, Error>);
      }

      // Build metadata using helper methods to reduce complexity
      const basicMetadata = this.buildBasicMetadata(media);
      const externalMetadata = this.buildExternalMetadata(media, '');
      const optionalFields = this.buildOptionalFields(media);

      const metadata: PartialUnifiedMetadata = {
        ...basicMetadata,
        ...externalMetadata,
        ...optionalFields,
        status: media.status ? mapToMangaStatus(media.status, 'anilist') : MangaPublicationStatus.UNKNOWN
      } as PartialUnifiedMetadata;

      return Promise.resolve(createSuccessResult(metadata));
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      return Promise.resolve(this.createError('Failed to transform AniList data', errorObj) as AsyncResult<PartialUnifiedMetadata, Error>);
    }
  }
  
  /**
   * Search for manga on AniList
   */
  async search(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>> {
    try {
      // Check cache
      const cacheKey = `search:${query}:${JSON.stringify(options)}`;
      const cached = this.getCached<MangaSearchResult[]>(cacheKey);
      if (cached) {
        return createSuccessResult(cached as MangaSearchResult[]);
      }

      // Check rate limit
      if (!await this.checkRateLimit()) {
        return this.createError('Rate limit exceeded') as AsyncResult<MangaSearchResult[], Error>;
      }

      // Build GraphQL query
      const graphqlQuery = this.buildSearchQuery();
      const variables = {
        search: query,
        type: 'MANGA',
        perPage: options?.limit ?? 20,
        page: 1,
        isAdult: false // Remove includeAdult from options
      };

      // Execute search
      const response = await this.executeWithRetry(async () => {
        return this.client.post('', {
          query: graphqlQuery,
          variables
        });
      });

      // Validate response
      if (!this.validateRawData(response.data)) {
        return this.createError('Invalid response from AniList API') as AsyncResult<MangaSearchResult[], Error>;
      }

      // Transform results in parallel (avoid await-in-loop)
      const media = response.data.data?.Page?.media ?? [];
      const results = await this.transformMediaToSearchResults(media);

      // Cache results
      this.setCached(cacheKey, results);

      return createSuccessResult(results as MangaSearchResult[]);
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      return this.createError(`Search failed for query: ${query}`, errorObj) as AsyncResult<MangaSearchResult[], Error>;
    }
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  /**
   * Extract best title from AniList title object
   */
  private extractTitle(title?: AniListMedia['title']): string {
    if (!title) return 'Unknown';
    
    return title.english ??            title.romaji ??            title.userPreferred ??            title.native ??            'Unknown';
  }
  
  /**
   * Extract alternative titles
   */
  private extractAlternativeTitles(media: AniListMedia): string[] {
    const titles: string[] = [];
    const { title } = media;

    // title is always present per AniListMedia type
    if (title.romaji) titles.push(title.romaji);
    if (title.english && title.english !== title.romaji) {
      titles.push(title.english);
    }
    if (title.native) titles.push(title.native);

    if (media.synonyms) {
      titles.push(...media.synonyms);
    }

    // Remove duplicates and empty strings
    return [...new Set(titles.filter(Boolean))];
  }
  
  /**
   * Extract tags with proper formatting
   */
  private extractTags(tags?: AniListMedia['tags']): TagInfo[] {
    if (!tags) return [];
    
    return tags
      .filter(tag => !tag.isMediaSpoiler)
      .map(tag => ({
        name: tag["name"],
        rank: tag.rank
      }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 20); // Limit to top 20 tags
  }
  
  /**
   * Extract staff members by role
   */
  private extractStaff(
    staff?: AniListMedia['staff'],
    role?: string
  ): PersonInfo[] {
    if (!staff?.edges) return [];

    return staff.edges
      .filter(edge => !role || edge.role?.toLowerCase().includes(role.toLowerCase()))
      .map(edge => ({
        name: edge.node?.name?.full ?? 'Unknown',
        role: 'AUTHOR' as PersonInfo['role'] // Default to AUTHOR
      }))
      .filter(person => person["name"] !== 'Unknown');
  }
  
  /**
   * Extract cover images in multiple sizes
   */
  private extractCoverImages(coverImage?: AniListMedia['coverImage']): CoverImages | undefined {
    if (!coverImage) return undefined;

    const result: CoverImages = {
      large: coverImage.large ?? coverImage.extraLarge ?? '',
      medium: coverImage.medium ?? coverImage.large ?? '',
      small: coverImage.medium ?? '',
      ...(coverImage.color !== null && coverImage.color !== undefined ? { color: coverImage.color } : {})
    };

    return result;
  }

  /**
   * Transform array of AniList media to search results (parallel processing)
   */
  private async transformMediaToSearchResults(media: AniListMedia[]): Promise<MangaSearchResult[]> {
    const transformPromises = media.map(item =>
      this.transform({ data: { Media: item } }).then(result => ({ result, item }))
    );

    const transformResults = await Promise.all(transformPromises);
    const results: MangaSearchResult[] = [];

    for (const { result: transformResult, item } of transformResults) {
      if (transformResult.status === 'success') {
        const metadata = transformResult.data;
        results.push(this.buildSearchResult(metadata, item));
      }
    }

    return results;
  }

  /**
   * Build a single search result from metadata and raw item
   */
  private buildSearchResult(metadata: PartialUnifiedMetadata, item: AniListMedia): MangaSearchResult {
    // Extract alternativeTitles with proper type safety (bracket notation for index signature)
    const altTitles: string[] = Array.isArray(metadata['alternativeTitles'])
      ? (metadata['alternativeTitles'] as string[])
      : [];

    return {
      id: metadata.externalIds?.anilistId ?? toStringId(item.id),
      title: typeof metadata['title'] === 'string' ? metadata['title'] : 'Unknown',
      alternativeTitles: altTitles,
      description: typeof metadata['description'] === 'string' ? metadata['description'] : '',
      coverImage: typeof metadata['coverImage'] === 'string' ? metadata['coverImage'] : '',
      url: item.siteUrl ?? '',
      provider: 'ANILIST' as MangaSearchResult['provider']
    };
  }

  /**
   * Build basic metadata fields from media
   */
  private buildBasicMetadata(media: AniListMedia): Partial<PartialUnifiedMetadata> {
    return {
      title: this.extractTitle(media.title),
      alternativeTitles: this.extractAlternativeTitles(media),
      description: this.normalizeText(media.description),
      genres: media.genres?.filter(Boolean) ?? [],
      tags: this.extractTags(media.tags),
      authors: this.extractStaff(media.staff, 'Story').map(p => p.name),
      artists: this.extractStaff(media.staff, 'Art').map(p => p.name),
      isAdult: media.isAdult ?? false
    };
  }

  /**
   * Build external IDs and provider metadata
   */
  private buildExternalMetadata(media: AniListMedia, query: string): Partial<PartialUnifiedMetadata> {
    return {
      externalIds: {
        anilistId: media.id,
        ...(media.idMal !== null && media.idMal !== undefined ? { malId: media.idMal } : {})
      },
      providerMetadata: [{
        provider: 'anilist',
        data: {
          id: toStringId(media.id),
          ...(media.siteUrl !== null && { url: media.siteUrl })
        },
        confidence: this.calculateConfidence(query, media)
      }]
    };
  }

  /**
   * Build optional fields from media (returns partial object to spread)
   */
  private buildOptionalFields(media: AniListMedia): Partial<PartialUnifiedMetadata> {
    const optional: Partial<PartialUnifiedMetadata> = {};

    if (media.format) {
      optional.format = media.format as MangaFormat;
    }
    if (media.startDate?.year) {
      optional.startDate = new Date(media.startDate.year, 0, 1).toISOString();
    }
    if (media.endDate?.year) {
      optional.endDate = new Date(media.endDate.year, 0, 1).toISOString();
    }
    if (media.volumes !== null && media.volumes !== undefined) {
      optional.volumeCount = media.volumes;
    }
    if (media.chapters !== null && media.chapters !== undefined) {
      optional.chapterCount = media.chapters;
    }
    const covers = this.extractCoverImages(media.coverImage);
    if (covers) {
      optional.covers = covers;
    }
    if (media.bannerImage !== null && media.bannerImage !== undefined) {
      (optional as Record<string, unknown>)['bannerImage'] = media.bannerImage;
    }
    if (media.popularity !== null && media.popularity !== undefined) {
      (optional as Record<string, unknown>)['popularity'] = media.popularity;
    }
    if (media.countryOfOrigin !== null && media.countryOfOrigin !== undefined) {
      (optional as Record<string, unknown>)['countryOfOrigin'] = media.countryOfOrigin;
    }

    return optional;
  }

  /**
   * Build GraphQL query for search
   */
  private buildSearchQuery(): string {
    return `
      query ($search: String, $type: MediaType, $perPage: Int, $page: Int, $isAdult: Boolean) {
        Page(page: $page, perPage: $perPage) {
          media(search: $search, type: $type, isAdult: $isAdult, sort: SEARCH_MATCH) {
            id
            idMal
            title {
              romaji
              english
              native
              userPreferred
            }
            description
            status
            format
            genres
            tags {
              name
              rank
              isMediaSpoiler
            }
            coverImage {
              extraLarge
              large
              medium
              color
            }
            bannerImage
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            volumes
            chapters
            averageScore
            meanScore
            popularity
            staff {
              edges {
                role
                node {
                  name {
                    full
                    native
                  }
                }
              }
            }
            siteUrl
            isAdult
            countryOfOrigin
            synonyms
          }
        }
      }
    `;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default AniListAdapter;