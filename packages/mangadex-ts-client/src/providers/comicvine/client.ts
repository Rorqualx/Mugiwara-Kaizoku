/**
 * ComicVine API client
 * Rate limit: 200 requests/hour (~1 per 18 seconds)
 * Requires API key
 */

import { HttpClient } from '../../core/http-client';
import { ApiError } from '../../types/errors';
import {
  ComicVineResponse,
  CVVolume,
  CVIssue,
  CVSearchResult,
} from './types';

export interface ComicVineClientConfig {
  apiKey: string;
  userAgent?: string;
  cacheTtlMs?: number;
}

const VOLUME_FIELDS = [
  'id', 'name', 'aliases', 'api_detail_url', 'site_detail_url',
  'count_of_issues', 'date_added', 'date_last_updated', 'deck',
  'description', 'image', 'publisher', 'start_year', 'first_issue',
  'last_issue', 'genres', 'characters', 'concepts', 'people', 'story_arcs',
].join(',');

const ISSUE_FIELDS = [
  'id', 'name', 'issue_number', 'api_detail_url', 'site_detail_url',
  'volume', 'date_added', 'date_last_updated', 'cover_date', 'deck',
  'description', 'image', 'person_credits', 'character_credits',
  'story_arc_credits', 'concept_credits',
].join(',');

export class ComicVineClient {
  private readonly http: HttpClient;
  private readonly apiKey: string;

  constructor(config: ComicVineClientConfig) {
    if (!config.apiKey) {
      throw new Error('ComicVine API key is required');
    }
    this.apiKey = config.apiKey;

    this.http = new HttpClient({
      baseURL: 'https://comicvine.gamespot.com/api',
      timeout: 30000,
      userAgent: config.userAgent ?? 'MangaDex-Metadata-Client/2.0.0',
      rateLimit: {
        maxRequests: 1,
        perMilliseconds: 18000, // 200/hour ≈ 1 per 18s
      },
      cacheTtlMs: config.cacheTtlMs ?? 10 * 60 * 1000,
      source: 'comicvine',
      headers: {},
    });
  }

  /** Search volumes (manga series) */
  async searchVolumes(query: string, limit: number = 10): Promise<CVSearchResult[]> {
    const response = await this.http.get<ComicVineResponse<CVSearchResult[]>>(
      `/search/`,
      {
        params: {
          api_key: this.apiKey,
          format: 'json',
          resources: 'volume',
          query,
          limit,
        },
      }
    );

    this.checkResponse(response);
    return response.results;
  }

  /** Get a single volume by ID */
  async getVolume(id: number): Promise<CVVolume> {
    const response = await this.http.get<ComicVineResponse<CVVolume>>(
      `/volume/4050-${id}/`,
      {
        params: {
          api_key: this.apiKey,
          format: 'json',
          field_list: VOLUME_FIELDS,
        },
      }
    );

    this.checkResponse(response);
    return response.results;
  }

  /** Get all issues for a volume (auto-paginated) */
  async getAllIssues(volumeId: number): Promise<CVIssue[]> {
    const allIssues: CVIssue[] = [];
    let offset = 0;
    const pageLimit = 100;

    while (true) {
      const response = await this.http.get<ComicVineResponse<CVIssue[]>>(
        `/issues/`,
        {
          params: {
            api_key: this.apiKey,
            format: 'json',
            filter: `volume:${volumeId}`,
            field_list: ISSUE_FIELDS,
            limit: pageLimit,
            offset,
            sort: 'issue_number:asc',
          },
        }
      );

      this.checkResponse(response);
      allIssues.push(...response.results);

      if (
        allIssues.length >= response.number_of_total_results ||
        response.results.length < pageLimit
      ) {
        break;
      }
      offset += pageLimit;
    }

    return allIssues;
  }

  /** Get a single issue by ID */
  async getIssue(issueId: number): Promise<CVIssue> {
    const response = await this.http.get<ComicVineResponse<CVIssue>>(
      `/issue/4000-${issueId}/`,
      {
        params: {
          api_key: this.apiKey,
          format: 'json',
          field_list: ISSUE_FIELDS,
        },
      }
    );

    this.checkResponse(response);
    return response.results;
  }

  /** Fetch raw HTML page (for scraping) */
  async fetchPage(url: string): Promise<string> {
    const response = await this.http.get<string>(url, {
      skipCache: true,
      responseType: 'text' as any,
      baseURL: undefined as any,
    });
    return response;
  }

  private checkResponse<T>(response: ComicVineResponse<T>): void {
    if (response.status_code !== 1) {
      throw new ApiError(
        `ComicVine error: ${response.error}`,
        response.status_code,
        undefined,
        undefined,
        'comicvine'
      );
    }
  }
}
