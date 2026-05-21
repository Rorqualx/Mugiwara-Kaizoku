/**
 * AniList GraphQL client
 * No API key required for public data
 * Rate limit: 90 requests/minute
 */

import { HttpClient } from '../../core/http-client';
import { ApiError, RateLimitError } from '../../types/errors';
import {
  AniListGraphQLResponse,
  AniListPageResponse,
  AniListMediaResponse,
  AniListMedia,
} from './types';
import { SEARCH_MANGA, GET_MANGA_DETAILS } from './queries';

export interface AniListClientConfig {
  rateLimit?: {
    maxRequests: number;
    perMilliseconds: number;
  };
  cacheTtlMs?: number;
}

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

export class AniListClient {
  private readonly http: HttpClient;
  private retryCount = 0;
  private readonly maxRetries = 3;

  constructor(config?: AniListClientConfig) {
    this.http = new HttpClient({
      baseURL: ANILIST_ENDPOINT,
      timeout: 30000,
      userAgent: 'MangaDex-Metadata-Client/2.0.0',
      rateLimit: config?.rateLimit ?? {
        maxRequests: 90,
        perMilliseconds: 60000,
      },
      cacheTtlMs: config?.cacheTtlMs ?? 5 * 60 * 1000,
      source: 'anilist',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  /** Search for manga */
  async searchManga(query: string, limit: number = 10): Promise<AniListMedia[]> {
    const response = await this.graphqlRequest<AniListPageResponse>(SEARCH_MANGA, {
      search: query,
      page: 1,
      perPage: Math.min(limit, 50),
    });

    return response.Page.media;
  }

  /** Get full manga details by AniList ID */
  async getMangaDetails(id: number): Promise<AniListMedia> {
    const response = await this.graphqlRequest<AniListMediaResponse>(GET_MANGA_DETAILS, {
      id,
    });

    return response.Media;
  }

  /** Execute a GraphQL request with retry on 429 */
  private async graphqlRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.http.post<AniListGraphQLResponse<T>>('', {
        query,
        variables,
      });

      if (response.errors && response.errors.length > 0) {
        const firstError = response.errors[0]!;

        if (firstError.status === 429) {
          return this.retryWithBackoff<T>(query, variables);
        }

        throw new ApiError(
          `AniList GraphQL error: ${firstError.message}`,
          firstError.status,
          response.errors,
          undefined,
          'anilist'
        );
      }

      this.retryCount = 0;
      return response.data;
    } catch (error) {
      if (error instanceof RateLimitError) {
        return this.retryWithBackoff<T>(query, variables);
      }
      throw error;
    }
  }

  /** Retry with exponential backoff */
  private async retryWithBackoff<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    if (this.retryCount >= this.maxRetries) {
      this.retryCount = 0;
      throw new RateLimitError(
        'AniList rate limit exceeded after retries',
        undefined,
        'anilist'
      );
    }

    this.retryCount++;
    const waitMs = Math.pow(2, this.retryCount) * 1000; // 2s, 4s, 8s
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    return this.graphqlRequest<T>(query, variables);
  }
}
