/**
 * Unified AniList Adapter
 * 
 * AniList provider adapter that transforms AniList API responses to the
 * unified metadata format. AniList is considered the highest priority
 * provider due to its comprehensive and well-structured data.
 */

import { MangaPublicationStatus } from '@prisma/client';

import type { PartialUnifiedMetadata, PersonInfo, StaffInfo, CharacterInfo, RankingInfo, ExternalLinkInfo, ExternalIds } from '@/types/search.types';
import { MangaFormat} from '@/types/search.types';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import { toNumberId, toStringId } from '@/utils/id-converters';


import { AniListService} from '../services/anilist/service';

import { BaseMetadataAdapter } from './base-metadata-adapter';

import type { BaseProviderConfig, ProviderSearchOptions } from './base-metadata-adapter';
/**
 * AniList-specific configuration
 */
export interface AniListConfig extends BaseProviderConfig {
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}
/**
 * AniList API response structure
 */
export interface AniListResponse {
  id: number;
  idMal?: number;
  title: {
    romaji?: string;
    english?: string;
    native?: string;
  };
  description?: string;
  format?: string;
  status?: string;
  startDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  endDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  season?: string;
  seasonYear?: number;
  chapters?: number;
  volumes?: number;
  countryOfOrigin?: string;
  isLicensed?: boolean;
  source?: string;
  coverImage?: {
    extraLarge?: string;
    large?: string;
    medium?: string;
    color?: string;
  };
  bannerImage?: string;
  genres?: string[];
  synonyms?: string[];
  averageScore?: number;
  meanScore?: number;
  popularity?: number;
  favourites?: number;
  trending?: number;
  rankings?: Array<{
    id: number;
    rank: number;
    type: string;
    format: string;
    year?: number;
    season?: string;
    allTime: boolean;
    context: string;
  }>;
  tags?: Array<{
    id: number;
    name: string;
    description?: string;
    category?: string;
    rank?: number;
    isGeneralSpoiler?: boolean;
    isMediaSpoiler?: boolean;
    isAdult?: boolean;
  }>;
  relations?: {
    edges?: Array<{
      id: number;
      relationType: string;
      node: {
        id: number;
        type: string;
        format?: string;
        title: {
          romaji?: string;
          english?: string;
          native?: string;
        };
      };
    }>;
  };
  characters?: {
    edges?: Array<{
      id: number;
      role: string;
      node: {
        id: number;
        name: {
          first?: string;
          middle?: string;
          last?: string;
          full?: string;
          native?: string;
        };
        image?: {
          large?: string;
          medium?: string;
        };
        description?: string;
      };
    }>;
  };
  staff?: {
    edges?: Array<{
      id: number;
      role: string;
      node: {
        id: number;
        name: {
          first?: string;
          middle?: string;
          last?: string;
          full?: string;
          native?: string;
        };
        image?: {
          large?: string;
          medium?: string;
        };
      };
    }>;
  };
  externalLinks?: Array<{
    id: number;
    url: string;
    site: string;
    type?: string;
    language?: string;
  }>;
  siteUrl?: string;
  isAdult?: boolean;
  updatedAt?: number;
}
/**
 * Unified AniList adapter implementation
 */
export class UnifiedAniListAdapter extends BaseMetadataAdapter<AniListResponse, AniListConfig> {
  readonly providerName = 'anilist';
  readonly priority = 100; // Highest priority
  readonly baseConfidence = 0.95; // Very high confidence
  private client: AniListService;
  constructor(config: AniListConfig) {
    super(config);
    this.client = new AniListService();
    // The AniListService will initialize with its own configuration
  }
  /**
   * Validate AniList response structure
   */
  validateRawData(data: unknown): data is AniListResponse {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    // Must have ID and title
    if (!obj['id'] || typeof obj['id'] !== 'number') return false;
    if (!obj['title'] || typeof obj['title'] !== 'object') return false;
    // At least one title must exist
    const title = obj['title'] as Record<string, unknown>;
    const romaji = title['romaji'];
    const english = title['english'];
    const native = title['native'];
    if (!romaji && !english && !native) return false;
    return true;
  }
  /**
   * Transform AniList data to unified metadata format
   */
  transform(rawData: AniListResponse): Promise<AsyncResult<PartialUnifiedMetadata, Error>> {
    try {
      const { title, alternativeTitles } = this.buildTitleData(rawData);
      const covers = this.buildCoverImages(rawData.coverImage);
      const { authors, artists } = this.extractStaff(rawData.staff);
      const characters = this.extractCharacters(rawData.characters);
      const tags = this.extractTags(rawData["tags"] ?? []);
      const genres = rawData["genres"] ?? [];
      const externalIds = this.buildExternalIds(rawData);
      const dateFields = this.buildDateFields(rawData);

      const metadata: PartialUnifiedMetadata = {
        title,
        alternativeTitles,
        covers,
        ...this.buildOptionalFields(rawData),
        description: this.cleanHtml(rawData["description"] ?? ''),
        status: this.mapAniListStatus(rawData["status"]),
        format: this.mapAniListFormat(rawData.format),
        ...dateFields,
        authors: authors.map(a => a["name"]),
        artists: artists.map(a => a["name"]),
        persons: [...authors, ...artists],
        characters,
        genres,
        tags,
        externalIds
      };
      return Promise.resolve(createSuccessResult(metadata));
    } catch (error: unknown) {
      this.logger.error('Error transforming AniList data:', error);
      return Promise.resolve(createErrorResult(error instanceof Error ? error : new Error(String(error))));
    }
  }

  /**
   * Build title and alternative titles from raw data
   */
  private buildTitleData(rawData: AniListResponse): { title: string; alternativeTitles: string[] } {
    const title = rawData["title"].english ?? rawData["title"].romaji ?? rawData["title"].native ?? 'Unknown';
    const alternativeTitles: string[] = [];

    if (rawData["title"].romaji && rawData["title"].romaji !== title) {
      alternativeTitles.push(rawData["title"].romaji);
    }
    if (rawData["title"].english && rawData["title"].english !== title) {
      alternativeTitles.push(rawData["title"].english);
    }
    if (rawData["title"].native && rawData["title"].native !== title) {
      alternativeTitles.push(rawData["title"].native);
    }
    if (rawData.synonyms) {
      alternativeTitles.push(...rawData.synonyms);
    }

    return { title, alternativeTitles };
  }

  /**
   * Build external IDs from raw data
   */
  private buildExternalIds(rawData: AniListResponse): ExternalIds {
    return {
      anilistId: rawData["id"],
      ...(rawData.idMal !== undefined && { malId: rawData.idMal })
    };
  }

  /**
   * Build date-related fields from raw data
   */
  private buildDateFields(rawData: AniListResponse): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (rawData.volumes !== undefined) {
      result['volumeCount'] = rawData.volumes;
    }
    if (rawData["chapters"] !== undefined) {
      result['chapterCount'] = rawData["chapters"];
    }

    const startDate = this.normalizeDate(rawData.startDate);
    if (startDate !== null) {
      // normalizeDate returns Date | string | null, convert Date to ISO string
      result['startDate'] = startDate instanceof Date ? startDate.toISOString() : startDate;
    }

    const endDate = this.normalizeDate(rawData.endDate);
    if (endDate !== null) {
      // normalizeDate returns Date | string | null, convert Date to ISO string
      result['endDate'] = endDate instanceof Date ? endDate.toISOString() : endDate;
    }

    const year = rawData.startDate?.year ?? rawData.seasonYear;
    if (year !== undefined) {
      result['year'] = year;
    }

    return result;
  }

  /**
   * Build optional fields from raw data
   */
  private buildOptionalFields(rawData: AniListResponse): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (rawData.bannerImage !== undefined) {
      result['bannerImage'] = rawData.bannerImage;
    }

    return result;
  }
  /**
   * Search for manga
   */
  async search(query: string, options?: ProviderSearchOptions): Promise<AsyncResult<PartialUnifiedMetadata[], Error>> {
    try {
      const searchResults = await this.client.searchManga(query, {
        limit: options?.limit ?? 10
      });
      // searchManga returns an array directly, not an AsyncResult
      const results = Array.isArray(searchResults) ? searchResults : [];

      // Transform all results in parallel
      const transformPromises = results.map(result =>
        this.transform(result as AniListResponse)
      );
      const transformedResults = await Promise.all(transformPromises);

      // Filter to only successful transformations
      const successfulResults = transformedResults
        .filter(isSuccess)
        .map(result => result.data);

      return createSuccessResult(successfulResults);
    } catch (error: unknown) {
      this.logger.error('Error searching AniList:', error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Get metadata by ID
   */
  async getById(id: string | number): Promise<AsyncResult<PartialUnifiedMetadata, Error>> {
    try {
      const result = await this.client.getMangaDetails(toNumberId(id));
      // Cast to AniListResponse (matches transform parameter type)
      return await this.transform(result as AniListResponse);
    } catch (error: unknown) {const _errorMessage = error instanceof Error ? error.message : String(error);
this.logger.error(`Error fetching AniList manga ${id}:`, error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Map AniList status to unified status
   */
  private mapAniListStatus(status?: string): MangaPublicationStatus {
    if (!status) return MangaPublicationStatus.UNKNOWN;
    const statusMap: Record<string, MangaPublicationStatus> = {
      'RELEASING': MangaPublicationStatus.ONGOING,
      'FINISHED': MangaPublicationStatus.COMPLETED,
      'NOT_YET_RELEASED': MangaPublicationStatus.UPCOMING,
      'CANCELLED': MangaPublicationStatus.CANCELLED,
      'HIATUS': MangaPublicationStatus.HIATUS
    };
    return statusMap[status] ?? MangaPublicationStatus.UNKNOWN;
  }
  /**
   * Map AniList format to unified format
   */
  private mapAniListFormat(format?: string): MangaFormat {
    if (!format) return MangaFormat.UNKNOWN;
    const formatMap: Record<string, MangaFormat> = {
      'MANGA': MangaFormat.MANGA,
      'NOVEL': MangaFormat.NOVEL,
      'ONE_SHOT': MangaFormat.ONE_SHOT
    };
    return formatMap[format] ?? MangaFormat.UNKNOWN;
  }
  /**
   * Extract staff information
   */
  private extractStaff(staffData?: AniListResponse['staff']): {
    authors: PersonInfo[];
    artists: PersonInfo[];
    staff: StaffInfo[];
  } {
    const authors: PersonInfo[] = [];
    const artists: PersonInfo[] = [];
    const staff: StaffInfo[] = [];
    if (!staffData?.edges) {
      return {
        authors,
        artists,
        staff
      };
    }
    for (const edge of staffData.edges) {
      const personImage = edge.node.image?.large ?? edge.node.image?.medium;
      const person: PersonInfo = {
        name: edge.node["name"].full ?? `${edge.node["name"].first ?? ''} ${edge.node["name"].last ?? ''}`.trim(),
        role: 'AUTHOR',
        // Will be updated based on role
        id: toStringId(edge.node["id"]),
        ...(personImage !== undefined && { image: personImage })
      };
      const staffMember: StaffInfo = {
        ...person
      };
      staff.push(staffMember);
      // Categorize based on role
      const roleStr = edge.role.toLowerCase();
      if (roleStr.includes('story') || roleStr.includes('author') || roleStr.includes('writer')) {
        authors.push({
          ...person,
          role: 'AUTHOR'
        });
      } else if (roleStr.includes('art') || roleStr.includes('illustrat') || roleStr.includes('draw')) {
        artists.push({
          ...person,
          role: 'ARTIST'
        });
      }
    }
    return {
      authors,
      artists,
      staff
    };
  }
  /**
   * Extract character information
   */
  private extractCharacters(characterData?: AniListResponse['characters']): CharacterInfo[] {
    if (!characterData?.edges) return [];
    return characterData.edges.map(edge => {
      const charImage = edge.node.image?.large ?? edge.node.image?.medium;
      const charDesc = edge.node.description;
      return {
        id: toStringId(edge.node["id"]),
        name: edge.node["name"].full ?? `${edge.node["name"].first ?? ''} ${edge.node["name"].last ?? ''}`.trim(),
        role: edge.role as 'MAIN' | 'SUPPORTING' | 'BACKGROUND',
        ...(charImage !== undefined && { image: charImage }),
        ...(charDesc !== undefined && { description: charDesc })
      };
    });
  }
  /**
   * Extract rankings
   */
  private extractRankings(rankings?: AniListResponse['rankings']): RankingInfo[] {
    if (!rankings) return [];
    return rankings.map(ranking => {
      const result: RankingInfo = {
        type: this.mapRankingType(ranking.type),
        rank: ranking.rank,
        context: ranking.allTime ? 'ALL_TIME' : ranking.year ? 'YEARLY' : ranking.season ? 'SEASONAL' : 'ALL_TIME',
        ...(ranking.year !== undefined && { year: ranking.year }),
        ...(ranking.season !== undefined && { season: ranking.season as 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL' })
      };
      return result;
    });
  }
  /**
   * Map ranking type
   */
  private mapRankingType(type: string): 'POPULAR' | 'RATED' | 'TRENDING' | 'FAVORITED' {
    const typeMap: Record<string, 'POPULAR' | 'RATED' | 'TRENDING' | 'FAVORITED'> = {
      'POPULAR': 'POPULAR',
      'RATED': 'RATED',
      'SCORE': 'RATED',
      'TRENDING': 'TRENDING',
      'FAVOURITED': 'FAVORITED'
    };
    return typeMap[type.toUpperCase()] ?? 'POPULAR';
  }
  /**
   * Extract external links
   */
  private extractExternalLinks(links?: AniListResponse['externalLinks']): ExternalLinkInfo[] {
    if (!links) return [];
    return links.map(link => {
      const linkType = link.type === 'OTHER' ? undefined : link.type;
      const result: ExternalLinkInfo = {
        url: link.url,
        site: link.site,
        ...(linkType !== undefined && { type: linkType as 'INFO' | 'STREAMING' | 'SOCIAL' }),
        ...(link.language !== undefined && { language: link.language })
      };
      return result;
    });
  }
  /**
   * Map country to language
   */
  private mapCountryToLanguage(country?: string): string | null {
    if (!country) return null;
    const countryLanguageMap: Record<string, string> = {
      'JP': 'Japanese',
      'KR': 'Korean',
      'CN': 'Chinese',
      'TW': 'Chinese',
      'US': 'English',
      'GB': 'English',
      'FR': 'French',
      'DE': 'German',
      'IT': 'Italian',
      'ES': 'Spanish'
    };
    return countryLanguageMap[country] ?? null;
  }
  /**
   * Extract provider-specific fields
   */
  protected extractProviderSpecificFields(rawData: unknown): Record<string, unknown> {
    const data = rawData as AniListResponse;
    return {
      isLicensed: data.isLicensed,
      source: data["source"],
      trending: data.trending,
      siteUrl: data.siteUrl,
      relations: data.relations,
      season: data.season,
      seasonYear: data.seasonYear,
      updatedAt: data.updatedAt
    };
  }
}