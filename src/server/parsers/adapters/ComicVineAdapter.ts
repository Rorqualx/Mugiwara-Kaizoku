/**
 * ComicVine Adapter for Unified Parser
 *
 * Integrates ComicVine API with the unified parser system
 */

import axios from 'axios';

import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import { DataNormalizer } from '../core/DataNormalizer';
import { createSourceInfo, convertToMangaStatus, convertToNormalizedImages, nullToUndefined } from '../utils/typeConverters';

import type { NormalizedMangaData, NormalizedChapter } from '../core/DataNormalizer';
import type { AxiosInstance } from 'axios';

// ============================================================================
// Types
// ============================================================================
interface IssueData {
  id: string;
  title: string;
  issueNumber: string;
  description: string;
  coverDate: string | undefined;
  storeDate: string | undefined;
  coverImage: string;
  url: string;
  volumeId: string | undefined;
  volumeName: string | undefined;
}
interface CharacterData {
  id: string;
  name: string;
  realName: string | undefined;
  description: string;
  aliases: string[] | undefined;
  birth: string | undefined;
  gender: string;
  image: string;
  publisher: string | undefined;
  creators: Array<{
    id: number;
    name: string;
  }> | undefined;
  url: string;
}
interface PersonData {
  id: string;
  name: string;
  description: string;
  aliases: string[] | undefined;
  birth: string | undefined;
  death: string | undefined;
  gender: string;
  hometown: string | undefined;
  country: string | undefined;
  image: string;
  url: string;
}
interface ComicVineVolume {
  id: number;
  name: string;
  site_detail_url: string;
  api_detail_url: string;
  description?: string;
  aliases?: string;
  publisher?: {
    id: number;
    name: string;
  };
  image?: {
    icon_url: string;
    medium_url: string;
    screen_url: string;
    screen_large_url: string;
    small_url: string;
    super_url: string;
    thumb_url: string;
    tiny_url: string;
    original_url: string;
  };
  count_of_issues?: number;
  start_year?: string;
  first_issue?: {
    id: number;
    name: string;
    issue_number: string;
  };
  last_issue?: {
    id: number;
    name: string;
    issue_number: string;
  };
  date_added?: string;
  date_last_updated?: string;
}
interface ComicVineIssue {
  id: number;
  name?: string;
  issue_number: string;
  site_detail_url: string;
  api_detail_url: string;
  description?: string;
  aliases?: string;
  cover_date?: string;
  store_date?: string;
  image?: {
    icon_url: string;
    medium_url: string;
    screen_url: string;
    screen_large_url: string;
    small_url: string;
    super_url: string;
    thumb_url: string;
    tiny_url: string;
    original_url: string;
  };
  volume?: {
    id: number;
    name: string;
  };
}
interface ComicVineCharacter {
  id: number;
  name: string;
  site_detail_url: string;
  api_detail_url: string;
  description?: string;
  real_name?: string;
  aliases?: string;
  birth?: string;
  gender?: number;
  image?: {
    icon_url: string;
    medium_url: string;
    screen_url: string;
    screen_large_url: string;
    small_url: string;
    super_url: string;
    thumb_url: string;
    tiny_url: string;
    original_url: string;
  };
  publisher?: {
    id: number;
    name: string;
  };
  creators?: Array<{
    id: number;
    name: string;
  }>;
}
interface ComicVinePerson {
  id: number;
  name: string;
  site_detail_url: string;
  api_detail_url: string;
  description?: string;
  aliases?: string;
  birth?: string;
  death?: string;
  gender?: number;
  hometown?: string;
  country?: string;
  image?: {
    icon_url: string;
    medium_url: string;
    screen_url: string;
    screen_large_url: string;
    small_url: string;
    super_url: string;
    thumb_url: string;
    tiny_url: string;
    original_url: string;
  };
}
interface ComicVineResponse<T> {
  error: string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  results: T;
}
// ============================================================================
// ComicVine Adapter Implementation
// ============================================================================
export class ComicVineAdapter {
  private api: AxiosInstance;
  private normalizer: DataNormalizer;
  private apiKey: string;
  private baseUrl = 'https://comicvine.gamespot.com/api';

  /**
   * Create a ComicVine adapter
   * @param options Configuration options (apiKey required)
   * @param axiosInstance Optional axios instance for testing (dependency injection)
   */
  constructor(
    options: {
      apiKey: string;
      userAgent?: string;
    },
    axiosInstance?: AxiosInstance
  ) {
    if (!options.apiKey) {
      throw new Error('ComicVine API key is required');
    }
    this.apiKey = options.apiKey;
    this.api = axiosInstance ?? axios.create({
      baseURL: this.baseUrl,
      headers: {
        'User-Agent': options.userAgent ?? 'Unified-Metadata-Parser/1.0'
      },
      params: {
        api_key: this.apiKey,
        format: 'json'
      }
    });
    this.normalizer = new DataNormalizer();
  }
  /**
   * Search for volumes (manga/comics)
   */
  async search(query: string, options: {
    limit?: number;
    offset?: number;
    resources?: string;
    fieldList?: string[];
  } = {}): Promise<NormalizedMangaData[]> {
    try {
      const params: Record<string, string | number> = {
        query,
        resources: options.resources ?? 'volume',
        limit: options.limit ?? 20,
        offset: options.offset ?? 0
      };
      if (options.fieldList?.length) {
        params["field_list"] = options.fieldList.join(',');
      }
      const response = await this.api.get<ComicVineResponse<ComicVineVolume[]>>('/search', {
        params
      });
      if (response.data.status_code !== 1) {
        throw new Error(`ComicVine API error: ${response.data.error}`);
      }
      const volumes = response.data.results;
      return await Promise.all(volumes.map(v => this.normalizeVolume(v)));
    } catch (error: unknown) {
      logger.error('ComicVine search failed', { error });
      throw new Error(`Failed to search ComicVine: ${error}`);
    }
  }
  /**
   * Get volume (manga/comic series) details
   */
  async getVolume(volumeId: number | string): Promise<NormalizedMangaData> {
    try {
      const response = await this.api.get<ComicVineResponse<ComicVineVolume>>(`/volume/4050-${volumeId}/`, {
        params: {
          field_list: 'id,name,description,image,publisher,count_of_issues,start_year,first_issue,last_issue,site_detail_url,aliases,date_added,date_last_updated'
        }
      });
      if (response.data.status_code !== 1) {
        throw new Error(`ComicVine API error: ${response.data.error}`);
      }
      const volume = response.data.results;
      return await this.normalizeVolume(volume, true);
    } catch (error: unknown) {
      logger.error('Failed to get volume', { error, volumeId });
      throw new Error(`Failed to get volume ${volumeId}: ${error}`);
    }
  }
  /**
   * Get issues for a volume - handles pagination to fetch all issues
   */
  async getIssues(volumeId: number | string, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<IssueData[]> {
    try {
      const allIssues: ComicVineIssue[] = [];
      let offset = options.offset ?? 0;
      const limit = options.limit ?? 100;
      let hasMore = true;
      // Continue fetching until we have all issues
      // Sequential pagination is required: each response determines if more pages exist
      while (hasMore) {
        const params: Record<string, string | number> = {
          filter: `volume:${volumeId}`,
          sort: 'issue_number:asc',
          limit: limit,
          offset: offset,
          field_list: 'id,name,issue_number,description,cover_date,store_date,image,site_detail_url'
        };
        // eslint-disable-next-line no-await-in-loop -- Pagination requires sequential requests; parallel would cause rate limiting
        const response = await this.api.get<ComicVineResponse<ComicVineIssue[]>>('/issues', {
          params
        });
        if (response.data.status_code !== 1) {
          throw new Error(`ComicVine API error: ${response.data.error}`);
        }
        allIssues.push(...response.data.results);
        // Check if there are more pages
        const totalResults = response.data.number_of_total_results;
        const currentResults = offset + response.data.results.length;
        hasMore = currentResults < totalResults;
        offset += limit;
        // Safety check to prevent infinite loops (max 10 pages)
        if (offset >= 1000) {
          logger.warn(`Stopping pagination at offset ${offset} for volume ${volumeId}`);
          break;
        }
      }
      logger.info(`Fetched ${allIssues.length} issues for volume ${volumeId}`);
      return allIssues.map(issue => this.normalizeIssue(issue));
    } catch (error: unknown) {
      logger.error('Failed to get issues', { error, volumeId });
      throw new Error(`Failed to get issues for volume ${volumeId}: ${error}`);
    }
  }
  /**
   * Get issue details
   */
  async getIssue(issueId: number | string): Promise<unknown> {
    try {
      const response = await this.api.get<ComicVineResponse<ComicVineIssue>>(`/issue/4000-${issueId}/`);
      if (response.data.status_code !== 1) {
        throw new Error(`ComicVine API error: ${response.data.error}`);
      }
      return this.normalizeIssue(response.data.results);
    } catch (error: unknown) {
      logger.error('Failed to get issue', { error, issueId });
      throw new Error(`Failed to get issue ${issueId}: ${error}`);
    }
  }
  /**
   * Get character details
   */
  async getCharacter(characterId: number | string): Promise<unknown> {
    try {
      const response = await this.api.get<ComicVineResponse<ComicVineCharacter>>(`/character/4005-${characterId}/`);
      if (response.data.status_code !== 1) {
        throw new Error(`ComicVine API error: ${response.data.error}`);
      }
      return this.normalizeCharacter(response.data.results);
    } catch (error: unknown) {
      logger.error('Failed to get character', { error, characterId });
      throw new Error(`Failed to get character ${characterId}: ${error}`);
    }
  }
  /**
   * Get person (creator) details
   */
  async getPerson(personId: number | string): Promise<unknown> {
    try {
      const response = await this.api.get<ComicVineResponse<ComicVinePerson>>(`/person/4040-${personId}/`);
      if (response.data.status_code !== 1) {
        throw new Error(`ComicVine API error: ${response.data.error}`);
      }
      return this.normalizePerson(response.data.results);
    } catch (error: unknown) {
      logger.error('Failed to get person', { error, personId });
      throw new Error(`Failed to get person ${personId}: ${error}`);
    }
  }
  /**
   * Search across multiple resource types
   */
  async searchAll(query: string, options: {
    limit?: number;
  } = {}): Promise<{
    volumes: NormalizedMangaData[];
    issues: IssueData[];
    characters: CharacterData[];
    people: PersonData[];
  }> {
    try {
      const searchOptions: Record<string, unknown> = {
        resources: 'volume'
      };
      if (options.limit !== undefined) {
        searchOptions['limit'] = options.limit;
      }
      const searchPromises = [this.search(query, searchOptions as { limit?: number; offset?: number; resources?: string; fieldList?: string[] }), this.searchResource(query, 'issue', options.limit), this.searchResource(query, 'character', options.limit), this.searchResource(query, 'person', options.limit)];
      const [volumes, issues, characters, people] = await Promise.all(searchPromises);
      return {
        volumes: volumes as NormalizedMangaData[],
        issues: (issues ?? []).map((i: unknown) => this.normalizeIssue(i as ComicVineIssue)),
        characters: (characters ?? []).map((c: unknown) => this.normalizeCharacter(c as ComicVineCharacter)),
        people: (people ?? []).map((p: unknown) => this.normalizePerson(p as ComicVinePerson))
      };
    } catch (error: unknown) {
      logger.error('Failed to search all resources', { error });
      throw new Error(`Failed to search all resources: ${error}`);
    }
  }
  // ============================================================================
  // Private Helper Methods
  // ============================================================================
  /**
   * Search specific resource type
   */
  private async searchResource(query: string, resource: string, limit?: number): Promise<unknown[]> {
    try {
      const response = await this.api.get<ComicVineResponse<unknown[]>>('/search', {
        params: {
          query,
          resources: resource,
          limit: limit ?? 10
        }
      });
      if (response.data.status_code !== 1) {
        return [];
      }
      return response.data.results;
    } catch (error: unknown) {
      logger.error('Failed to search resource', { error, resource });
      return [];
    }
  }
  /**
   * Parse volume aliases into array of alternative titles
   */
  private parseAlternativeTitles(aliases?: string): string[] {
    if (!aliases) return [];
    return aliases.split('\n').filter(a => a.trim());
  }

  /**
   * Extract cover image URL from volume image object
   */
  private extractCoverImage(image?: ComicVineVolume['image']): string {
    return (image?.original_url ?? image?.super_url ?? image?.screen_large_url) ?? '';
  }

  /**
   * Convert IssueData array to NormalizedChapter array
   */
  private convertIssuesToChapters(issues: IssueData[]): NormalizedChapter[] {
    return issues.map((ch) => ({
      number: parseFloat(ch.issueNumber) || 0,
      title: ch.title,
      releaseDate: this.parseIssueDate(ch.coverDate, ch.storeDate)
    }) as NormalizedChapter);
  }

  /**
   * Parse issue date from cover or store date
   */
  private parseIssueDate(coverDate?: string, storeDate?: string): Date | undefined {
    if (coverDate) return new Date(coverDate);
    if (storeDate) return new Date(storeDate);
    return undefined;
  }

  /**
   * Extract optional metadata fields from volume
   */
  private extractOptionalMetadata(volume: ComicVineVolume): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    const countOfIssues = nullToUndefined(volume.count_of_issues);
    if (countOfIssues !== undefined) {
      metadata['totalChapters'] = countOfIssues;
    }
    if (volume.start_year !== undefined) {
      metadata['year'] = parseInt(volume.start_year);
    }
    if (volume.publisher?.name !== undefined) {
      metadata['publisher'] = volume.publisher.name;
    }
    return metadata;
  }

  /**
   * Normalize ComicVine volume to unified format
   */
  private async normalizeVolume(volume: ComicVineVolume, detailed: boolean = false): Promise<NormalizedMangaData> {
    const alternativeTitles = this.parseAlternativeTitles(volume.aliases);
    const chapters = await this.fetchChaptersIfDetailed(volume, detailed);
    const description = this.cleanDescription(volume["description"]);
    const coverImage = this.extractCoverImage(volume.image);

    const optionalMetadata = this.extractOptionalMetadata(volume);
    const result: Record<string, unknown> = {
      source: createSourceInfo('comicvine'),
      title: volume["name"],
      alternativeTitles,
      description,
      authors: [],
      artist: [],
      genres: [],
      status: convertToMangaStatus('UNKNOWN'),
      coverImage,
      images: convertToNormalizedImages([volume.image?.original_url, volume.image?.super_url, volume.image?.screen_large_url].filter(Boolean) as string[]),
      chapters: this.convertIssuesToChapters(chapters),
      volumes: [],
      ...optionalMetadata
    };

    if (typeof result['title'] !== 'string' || !result['source']) {
      throw new Error('Invalid normalized manga data structure');
    }

    return result as unknown as NormalizedMangaData;
  }

  /**
   * Fetch chapters if detailed mode is enabled
   */
  private async fetchChaptersIfDetailed(volume: ComicVineVolume, detailed: boolean): Promise<IssueData[]> {
    if (!detailed || !volume["id"]) return [];
    try {
      return await this.getIssues(volume["id"]);
    } catch (error: unknown) {
      logger.error('Failed to get issues for volume', { error, volumeId: volume["id"] });
      return [];
    }
  }
  /**
   * Normalize issue data
   */
  private normalizeIssue(issue: ComicVineIssue): IssueData {
    return {
      id: toStringId(issue["id"]),
      title: issue["name"] ?? `Issue #${issue.issue_number}`,
      issueNumber: issue.issue_number,
      description: this.cleanDescription(issue["description"]),
      coverDate: issue.cover_date,
      storeDate: issue.store_date,
      coverImage: (issue.image?.original_url ?? issue.image?.super_url) ?? '',
      url: issue.site_detail_url,
      volumeId: issue.volume?.id ? toStringId(issue.volume["id"]) : undefined,
      volumeName: issue.volume?.name
    };
  }
  /**
   * Normalize character data
   */
  private normalizeCharacter(character: ComicVineCharacter): CharacterData {
    return {
      id: toStringId(character["id"]),
      name: character["name"],
      realName: character.real_name,
      description: this.cleanDescription(character["description"]),
      aliases: character.aliases?.split('\n').filter(a => a.trim()),
      birth: character.birth,
      gender: this.mapGender(character.gender),
      image: (character.image?.original_url ?? character.image?.super_url) ?? '',
      publisher: character.publisher?.name,
      creators: character.creators,
      url: character.site_detail_url
    };
  }
  /**
   * Normalize person (creator) data
   */
  private normalizePerson(person: ComicVinePerson): PersonData {
    return {
      id: toStringId(person["id"]),
      name: person["name"],
      description: this.cleanDescription(person["description"]),
      aliases: person.aliases?.split('\n').filter(a => a.trim()),
      birth: person.birth,
      death: person.death,
      gender: this.mapGender(person.gender),
      hometown: person.hometown,
      country: person.country,
      image: (person.image?.original_url ?? person.image?.super_url) ?? '',
      url: person.site_detail_url
    };
  }
  /**
   * Clean HTML from description
   */
  private cleanDescription(description?: string): string {
    if (!description) return '';
    return description.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\n\s*\n/g, '\n\n').trim();
  }
  /**
   * Map gender code to string
   */
  private mapGender(gender?: number): string {
    switch (gender) {
      case 1:
        return 'Male';
      case 2:
        return 'Female';
      case 3:
        return 'Other';
      default:
        return 'Unknown';
    }
  }
}
// ============================================================================
// Factory Function
// ============================================================================
export function createComicVineAdapter(options: {
  apiKey: string;
  userAgent?: string;
}): ComicVineAdapter {
  return new ComicVineAdapter(options);
}