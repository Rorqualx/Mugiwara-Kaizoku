/**
 * AniList Adapter for Unified Parser
 * 
 * Integrates AniList GraphQL API with the unified parser system
 */

import axios from 'axios';

import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import { DataNormalizer, type NormalizedMangaData } from '../core/DataNormalizer';
import { createSourceInfo, convertToMangaStatus, convertToNormalizedImages, convertToExternalLinks, toDate } from '../utils/typeConverters';

import type { AxiosInstance } from 'axios';

// ============================================================================
// GraphQL Queries
// ============================================================================

const SEARCH_QUERY = `
  query SearchManga($search: String!, $page: Int, $perPage: Int, $isAdult: Boolean) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(search: $search, type: MANGA, sort: SEARCH_MATCH, isAdult: $isAdult) {
        id
        idMal
        title {
          romaji
          english
          native
          userPreferred
        }
        description
        format
        status
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
        chapters
        volumes
        coverImage {
          extraLarge
          large
          medium
        }
        bannerImage
        genres
        tags {
          name
          rank
          category
        }
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
        averageScore
        popularity
        favourites
        siteUrl
        countryOfOrigin
        isAdult
      }
    }
  }
`;
const GET_MANGA_QUERY = `
  query GetManga($id: Int!) {
    Media(id: $id, type: MANGA) {
      id
      idMal
      title {
        romaji
        english
        native
        userPreferred
      }
      description
      format
      status
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
      chapters
      volumes
      coverImage {
        extraLarge
        large
        medium
      }
      bannerImage
      genres
      synonyms
      tags {
        name
        rank
        category
        isGeneralSpoiler
        isMediaSpoiler
      }
      characters {
        edges {
          role
          node {
            name {
              full
              native
            }
            image {
              large
              medium
            }
          }
        }
      }
      staff {
        edges {
          role
          node {
            name {
              full
              native
            }
            image {
              large
              medium
            }
          }
        }
      }
      relations {
        edges {
          relationType
          node {
            id
            title {
              romaji
              english
            }
            type
            format
          }
        }
      }
      recommendations {
        edges {
          node {
            mediaRecommendation {
              id
              title {
                romaji
                english
              }
            }
          }
        }
      }
      stats {
        scoreDistribution {
          score
          amount
        }
        statusDistribution {
          status
          amount
        }
      }
      averageScore
      meanScore
      popularity
      favourites
      trending
      siteUrl
      externalLinks {
        site
        url
      }
      countryOfOrigin
      isAdult
      updatedAt
    }
  }
`;
const TRENDING_QUERY = `
  query TrendingManga($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: MANGA, sort: TRENDING_DESC) {
        id
        title {
          romaji
          english
          native
          userPreferred
        }
        coverImage {
          large
        }
        trending
        popularity
        averageScore
      }
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface AniListTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
  userPreferred?: string | null;
}
interface AniListDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}
interface AniListCoverImage {
  extraLarge?: string | null;
  large?: string | null;
  medium?: string | null;
}
interface AniListTag {
  name: string;
  rank?: number;
  category?: string;
  isGeneralSpoiler?: boolean;
  isMediaSpoiler?: boolean;
}
interface AniListStaff {
  edges: Array<{
    role: string;
    node: {
      name: {
        full?: string;
        native?: string;
      };
    };
  }>;
}
interface AniListMedia {
  id: number;
  idMal?: number | null;
  title: AniListTitle;
  description?: string | null;
  format?: string | null;
  status?: string | null;
  startDate?: AniListDate | null;
  endDate?: AniListDate | null;
  chapters?: number | null;
  volumes?: number | null;
  coverImage?: AniListCoverImage | null;
  bannerImage?: string | null;
  genres?: string[] | null;
  synonyms?: string[] | null;
  tags?: AniListTag[] | null;
  staff?: AniListStaff | null;
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  trending?: number | null;
  siteUrl?: string | null;
  externalLinks?: Array<{
    site: string;
    url: string;
  }> | null;
  countryOfOrigin?: string | null;
  isAdult?: boolean | null;
  updatedAt?: number | null;
}

// GraphQL Response Types
interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

interface SearchPageData {
  Page: {
    pageInfo: {
      total: number;
      currentPage: number;
      lastPage: number;
      hasNextPage: boolean;
    };
    media: AniListMedia[];
  };
}

interface MediaData {
  Media: AniListMedia;
}

interface RecommendationsData {
  Media: {
    recommendations: {
      edges: Array<{
        node: {
          rating?: number;
          mediaRecommendation: AniListMedia | null;
        };
      }>;
    };
  };
}

// ============================================================================
// AniList Adapter Implementation
// ============================================================================

export class AniListAdapter {
  private api: AxiosInstance;
  private normalizer: DataNormalizer;
  private baseUrl = 'https://graphql.anilist.co';

  /**
   * Create an AniList adapter
   * @param options Configuration options
   * @param axiosInstance Optional axios instance for testing (dependency injection)
   */
  constructor(
    options: {
      accessToken?: string;
      clientId?: string;
      clientSecret?: string;
    } = {},
    axiosInstance?: AxiosInstance
  ) {
    this.api = axiosInstance ?? axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.accessToken && {
          'Authorization': `Bearer ${options.accessToken}`
        })
      }
    });
    this.normalizer = new DataNormalizer();
  }

  /**
   * Search for manga
   */
  async search(query: string, options: {
    page?: number;
    perPage?: number;
    genres?: string[];
    tags?: string[];
    format?: string;
    status?: string;
    yearGreater?: number;
    yearLesser?: number;
    isAdult?: boolean;
  } = {}): Promise<NormalizedMangaData[]> {
    try {
      const variables = {
        search: query,
        page: options.page ?? 1,
        perPage: options.perPage ?? 20,
        isAdult: options.isAdult
      };
      const response = await this.api.post<GraphQLResponse<SearchPageData>>('', {
        query: SEARCH_QUERY,
        variables
      });

      const responseData: GraphQLResponse<SearchPageData> = response.data;

      if (responseData.errors && responseData.errors.length > 0) {
        throw new Error(responseData.errors[0]?.message ?? 'Unknown GraphQL error');
      }

      if (!responseData.data) {
        throw new Error('No data returned from AniList API');
      }

      const media: AniListMedia[] = responseData.data.Page.media;
      return media.map(m => this.normalizeManga(m));
    } catch (error: unknown) {
      // Handle rate limit errors
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] as string | undefined;
        const message = retryAfter
          ? `AniList API rate limit exceeded. Retry after ${retryAfter} seconds.`
          : 'AniList API rate limit exceeded (429)';
        logger.warn('AniList rate limit hit', { query, retryAfter });
        throw new Error(message);
      }

      logger.error('AniList search failed', { error, query });
      throw new Error(`Failed to search AniList: ${error}`);
    }
  }

  /**
   * Get manga by ID
   */
  async getManga(mangaId: number | string): Promise<NormalizedMangaData> {
    try {
      const response = await this.api.post<GraphQLResponse<MediaData>>('', {
        query: GET_MANGA_QUERY,
        variables: {
          id: typeof mangaId === 'string' ? toNumberId(mangaId) : mangaId
        }
      });

      const responseData: GraphQLResponse<MediaData> = response.data;

      if (responseData.errors && responseData.errors.length > 0) {
        throw new Error(responseData.errors[0]?.message ?? 'Unknown GraphQL error');
      }

      if (!responseData.data) {
        throw new Error('No data returned from AniList API');
      }

      const manga: AniListMedia = responseData.data.Media;
      return this.normalizeManga(manga);
    } catch (error: unknown) {
      // Handle rate limit errors
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] as string | undefined;
        const message = retryAfter
          ? `AniList API rate limit exceeded. Retry after ${retryAfter} seconds.`
          : 'AniList API rate limit exceeded (429)';
        logger.warn('AniList rate limit hit', { mangaId, retryAfter });
        throw new Error(message);
      }

      logger.error('Failed to get manga', { error, mangaId });
      throw new Error(`Failed to get manga ${mangaId}: ${error}`);
    }
  }

  /**
   * Get trending manga
   */
  async getTrending(options: {
    page?: number;
    perPage?: number;
  } = {}): Promise<NormalizedMangaData[]> {
    try {
      const response = await this.api.post<GraphQLResponse<SearchPageData>>('', {
        query: TRENDING_QUERY,
        variables: {
          page: options.page ?? 1,
          perPage: options.perPage ?? 20
        }
      });

      const responseData: GraphQLResponse<SearchPageData> = response.data;

      if (responseData.errors && responseData.errors.length > 0) {
        throw new Error(responseData.errors[0]?.message ?? 'Unknown GraphQL error');
      }

      if (!responseData.data) {
        throw new Error('No data returned from AniList API');
      }

      const media: AniListMedia[] = responseData.data.Page.media;
      return media.map(m => this.normalizeManga(m));
    } catch (error: unknown) {
      // Handle rate limit errors
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] as string | undefined;
        const message = retryAfter
          ? `AniList API rate limit exceeded. Retry after ${retryAfter} seconds.`
          : 'AniList API rate limit exceeded (429)';
        logger.warn('AniList rate limit hit', { retryAfter });
        throw new Error(message);
      }

      logger.error('Failed to get trending', { error });
      throw new Error(`Failed to get trending manga: ${error}`);
    }
  }

  /**
   * Get manga by MyAnimeList ID
   */
  async getMangaByMalId(malId: number): Promise<NormalizedMangaData | null> {
    try {
      const query = `
        query GetByMalId($malId: Int!) {
          Media(idMal: $malId, type: MANGA) {
            ${this.getMediaFields()}
          }
        }
      `;
      const response = await this.api.post<GraphQLResponse<MediaData>>('', {
        query,
        variables: {
          malId
        }
      });

      const responseData: GraphQLResponse<MediaData> = response.data;

      if (responseData.errors || !responseData.data?.Media) {
        return null;
      }

      const manga: AniListMedia = responseData.data.Media;
      return this.normalizeManga(manga);
    } catch (error: unknown) {
      logger.error('Failed to get manga by MAL ID', { error, malId });
      return null;
    }
  }

  /**
   * Get recommendations for a manga
   */
  async getRecommendations(mangaId: number): Promise<NormalizedMangaData[]> {
    try {
      const query = `
        query GetRecommendations($id: Int!) {
          Media(id: $id, type: MANGA) {
            recommendations {
              edges {
                node {
                  rating
                  mediaRecommendation {
                    ${this.getMediaFields()}
                  }
                }
              }
            }
          }
        }
      `;
      const response = await this.api.post<GraphQLResponse<RecommendationsData>>('', {
        query,
        variables: {
          id: mangaId
        }
      });

      const responseData: GraphQLResponse<RecommendationsData> = response.data;

      if (responseData.errors && responseData.errors.length > 0) {
        throw new Error(responseData.errors[0]?.message ?? 'Unknown GraphQL error');
      }

      if (!responseData.data) {
        return [];
      }

      const recommendations: NormalizedMangaData[] = responseData.data.Media.recommendations.edges
        .filter(edge => edge.node.mediaRecommendation !== null)
        .map(edge => this.normalizeManga(edge.node.mediaRecommendation as AniListMedia));

      return recommendations;
    } catch (error: unknown) {
      logger.error('Failed to get recommendations', { error, mangaId });
      return [];
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get common media fields for queries
   */
  private getMediaFields(): string {
    return `
      id
      idMal
      title {
        romaji
        english
        native
        userPreferred
      }
      description
      format
      status
      chapters
      volumes
      coverImage {
        extraLarge
        large
      }
      genres
      tags {
        name
        rank
      }
      averageScore
      popularity
      siteUrl
    `;
  }

  /**
   * Extract primary title from AniList title object
   */
  private extractPrimaryTitle(title: AniListTitle): string {
    return title.english ?? title.romaji ?? title.userPreferred ?? title.native ?? 'Unknown';
  }

  /**
   * Extract alternative titles from AniList manga
   */
  private extractAlternativeTitles(manga: AniListMedia, primaryTitle: string): string[] {
    const alternativeTitles: string[] = [];
    const { title } = manga;

    if (title.romaji && title.romaji !== primaryTitle) {
      alternativeTitles.push(title.romaji);
    }
    if (title.english && title.english !== primaryTitle) {
      alternativeTitles.push(title.english);
    }
    if (title.native && title.native !== primaryTitle) {
      alternativeTitles.push(title.native);
    }
    if (title.userPreferred && title.userPreferred !== primaryTitle) {
      alternativeTitles.push(title.userPreferred);
    }
    if (manga.synonyms) {
      alternativeTitles.push(...manga.synonyms);
    }

    return alternativeTitles;
  }

  /**
   * Extract authors and artists from staff data
   */
  private extractCreators(staff: AniListStaff | null | undefined): { authors: string[]; artists: string[] } {
    const authors: string[] = [];
    const artists: string[] = [];

    if (!staff) {
      return { authors, artists };
    }

    staff.edges.forEach(edge => {
      const name = edge.node.name.full ?? edge.node.name.native;
      if (!name) return;

      const role = edge.role.toLowerCase();
      if (role.includes('story') || role.includes('author') || role.includes('original')) {
        authors.push(name);
      }
      if (role.includes('art') || role.includes('illustration')) {
        artists.push(name);
      }
    });

    return { authors, artists };
  }

  /**
   * Extract and filter tags
   */
  private extractTags(tags: AniListTag[] | null | undefined): string[] {
    if (!tags) return [];

    return tags
      .filter(tag => !tag.isGeneralSpoiler && !tag.isMediaSpoiler)
      .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
      .map(tag => tag.name);
  }

  /**
   * Get optional properties for normalized data
   */
  private getOptionalProperties(manga: AniListMedia, startDate?: string, endDate?: string): Partial<NormalizedMangaData> {
    const optional: Partial<NormalizedMangaData> = {};

    if (manga.bannerImage) {
      optional.bannerImage = manga.bannerImage;
    }
    if (manga.chapters !== null && manga.chapters !== undefined) {
      optional.totalChapters = manga.chapters;
    }
    if (manga.volumes !== null && manga.volumes !== undefined) {
      optional.totalVolumes = manga.volumes;
    }

    const startDateObj = toDate(startDate);
    if (startDateObj) {
      optional.startDate = startDateObj;
    }

    const endDateObj = toDate(endDate);
    if (endDateObj) {
      optional.endDate = endDateObj;
    }

    if (manga.startDate?.year) {
      optional.year = manga.startDate.year;
    }
    if (manga.averageScore !== null && manga.averageScore !== undefined) {
      optional.rating = manga.averageScore / 10;
    }
    if (manga.popularity !== null && manga.popularity !== undefined) {
      optional.popularity = manga.popularity;
    }
    if (manga.externalLinks && manga.externalLinks.length > 0) {
      optional.externalLinks = convertToExternalLinks(manga.externalLinks);
    }

    return optional;
  }

  /**
   * Normalize AniList manga to unified format
   */
  private normalizeManga(manga: AniListMedia): NormalizedMangaData {
    // Extract core data using helper methods
    const title = this.extractPrimaryTitle(manga.title);
    const alternativeTitles = this.extractAlternativeTitles(manga, title);
    const { authors, artists } = this.extractCreators(manga.staff);
    const tags = this.extractTags(manga.tags);
    const genres = manga.genres ?? [];

    // Format dates
    const startDate = this.formatDate(manga.startDate);
    const endDate = this.formatDate(manga.endDate);

    // Map status and format
    const statusMap: Record<string, string> = {
      'FINISHED': 'COMPLETED',
      'RELEASING': 'ONGOING',
      'NOT_YET_RELEASED': 'UPCOMING',
      'CANCELLED': 'CANCELLED',
      'HIATUS': 'HIATUS'
    };

    const formatMap: Record<string, string> = {
      'MANGA': 'MANGA',
      'NOVEL': 'LIGHT_NOVEL',
      'ONE_SHOT': 'ONE_SHOT'
    };

    // Get optional properties
    const optionalProps = this.getOptionalProperties(manga, startDate, endDate);

    // Handle format field
    const hasFormat = manga.format && typeof manga.format === 'string' && manga.format.trim() !== '';
    const formatValue = hasFormat ? manga.format : null;
    const mappedFormat = formatValue ? (formatMap[formatValue] ?? formatValue) : 'MANGA';

    if (formatValue) {
      logger.debug('AniList manga format mapped', {
        rawFormat: manga.format,
        mappedFormat,
        mangaId: manga.id,
        title
      });
    } else {
      logger.info('AniList format empty, defaulting to MANGA', {
        mangaId: manga.id,
        title,
        rawFormatValue: manga.format
      });
    }

    // Build complete result
    const result: NormalizedMangaData = {
      source: createSourceInfo('anilist'),
      title,
      alternativeTitles,
      description: this.cleanDescription(manga.description),
      authors,
      artist: artists.length > 0 ? artists : authors,
      genres,
      status: convertToMangaStatus(statusMap[manga.status ?? ''] ?? 'UNKNOWN'),
      coverImage: (manga.coverImage?.extraLarge ?? manga.coverImage?.large) ?? '',
      images: convertToNormalizedImages([manga.coverImage?.extraLarge, manga.coverImage?.large, manga.bannerImage].filter(Boolean) as string[]),
      chapters: [],
      volumes: [],
      format: mappedFormat,
      ...optionalProps,
      ...(tags.length > 0 && { themes: tags })
    };

    return result;
  }

  /**
   * Format AniList date
   */
  private formatDate(date?: AniListDate | null): string | undefined {
    if (!date?.year) return undefined;
    const year = date.year;
    const month = date.month ? String(date.month).padStart(2, '0') : '01';
    const day = date.day ? String(date.day).padStart(2, '0') : '01';
    return `${year}-${month}-${day}`;
  }

  /**
   * Clean HTML from description
   */
  private cleanDescription(description?: string | null): string {
    if (!description) return '';
    return description.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAniListAdapter(options?: {
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}): AniListAdapter {
  return new AniListAdapter(options);
}