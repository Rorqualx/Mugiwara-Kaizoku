/**
 * Base API Types
 * Common types for metadata providers
 */

import { PublicationDemographic } from '@prisma/client';

import type { MangaMetadata } from '@/types/search.types';



import type { Chapter as ChapterEntity, ContentRating} from '@prisma/client';
/**
 * Cache Manager interface for metadata providers
 */
export interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

/**
 * Manga type for API responses
 */
export interface Manga extends Omit<MangaMetadata, 'chapters'> {
  id: string;
  sourceId: string;
  sourceUrl?: string;
  chapters?: ChapterEntity[];
  artists?: string[];
  contentRating?: ContentRating;
  demographic?: PublicationDemographic;
  providerSpecific?: Record<string, unknown>;
}

// Re-export PublicationDemographic from Prisma for convenience
export { PublicationDemographic };

/**
 * Chapter type for API responses
 * Note: This doesn't extend ChapterEntity because API uses string IDs
 * while Prisma uses numeric IDs
 */
export interface Chapter {
  id: string; // API uses string IDs
  mangaId?: string;
  number: number;
  title?: string;
  url?: string;
  releaseDate?: Date | string;
  pages?: number;
  volume?: number;
  index?: number;
  fileName?: string;
  size?: number;
  pageCount?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Author/Artist type
 */
export interface Author {
  name: string;
  role?: 'Author' | 'Artist' | 'Author & Artist';
  id?: string;
}


/**
 * Search options
 */
export interface SearchOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
  includeMetadata?: boolean;
  // Additional search options for providers
  query?: string;
  offset?: number;
  includeAdult?: boolean;
  genres?: string[];
  excludeGenres?: string[];
  status?: string | string[];
  contentRating?: string[];
  language?: string;
  format?: string;
  categories?: (string | number)[];
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

/**
 * Get chapters options
 */
export interface GetChaptersOptions {
  fromChapter?: number;
  toChapter?: number;
  volume?: number;
  language?: string;
  limit?: number;
  offset?: number;
}

/**
 * API client configuration
 */
export interface ApiClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

// Export all types
export type {
  MangaMetadata,
  ChapterEntity
};
