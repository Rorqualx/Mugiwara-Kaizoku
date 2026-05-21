/**
 * Zod Schemas for Complex Type Validations
 *
 * This file contains Zod schemas for complex type validations that require
 * more sophisticated validation logic than simple type checking.
 *
 * @module TypeGuardSchemas
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import { z } from 'zod';

/**
 * Base schema for common validation patterns
 */
export const BaseSchemas = {
  /** Validates a non-empty string */
  nonEmptyString: z.string().min(1),

  /** Validates a positive number */
  positiveNumber: z.number().min(0),

  /** Validates a positive integer */
  positiveInteger: z.number().int().min(0),

  /** Validates a valid URL */
  url: z.string().url(),

  /** Validates a valid email */
  email: z.string().email(),

  /** Validates an ISO date string */
  isoDate: z.string().datetime(),

  /** Validates a string array */
  stringArray: z.array(z.string()),

  /** Validates a number array */
  numberArray: z.array(z.number()),

  /** Validates a boolean array */
  booleanArray: z.array(z.boolean()),
} as const;

/**
 * Schema for Kapowarr image validation
 */
export const NativeDownloadImageSchema = z.object({
  coverType: z.string(),
  url: z.string(),
  remoteUrl: z.string().optional(),
});

/**
 * Schema for Native download adapter configuration
 */
export const NativeDownloadAdapterConfigSchema = z.object({
  url: z.string(),
  apiKey: z.string(),
  rootFolder: z.string().optional(),
  qualityProfile: z.string().optional(),
  metadataProfile: z.string().optional(),
  autoSearch: z.boolean().optional(),
  autoMonitor: z.boolean().optional(),
  autoDownload: z.boolean().optional(),
});

/**
 * Schema for Kapowarr API manga
 */
export const NativeDownloadApiMangaSchema = z.object({
  id: z.number(),
  title: z.string(),
  alternativeTitles: z.array(z.string()).optional(),
  sortTitle: z.string().optional(),
  status: z.string().optional(),
  overview: z.string().optional(),
  network: z.string().optional(),
  runtime: z.number().optional(),
  images: z.array(z.unknown()).optional(),
  year: z.number().optional(),
  added: z.string().optional(),
  qualityProfileId: z.number().optional(),
  metadataProfileId: z.number().optional(),
  monitored: z.boolean().optional(),
  rootFolderPath: z.string().optional(),
  folderName: z.string().optional(),
  path: z.string().optional(),
  comicImage: z.string().optional(),
  publisher: z.string().optional(),
  comicCount: z.number().optional(),
  volumeCount: z.number().optional(),
  issueCount: z.number().optional(),
});

/**
 * Schema for Suwayomi configuration
 */
export const SuwayomiConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  url: z.string(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiPath: z.string().optional(),
  downloadPath: z.string().optional(),
  autoDownload: z.boolean().optional(),
  apiKeySources: z.array(z.string()).optional(),
});

/**
 * Schema for Suwayomi manga
 */
export const SuwayomiMangaSchema = z.object({
  id: z.number(),
  sourceId: z.string(),
  url: z.string(),
  title: z.string(),
  artist: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  genre: z.array(z.string()).optional(),
  status: z.string().optional(),
  thumbnail: z.string().optional(),
  inLibrary: z.boolean().optional(),
  initialized: z.boolean().optional(),
});

/**
 * Schema for API error responses
 */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  statusCode: z.number().optional(),
  timestamp: z.string().optional(),
});

/**
 * Schema for pagination metadata
 */
export const PaginationMetadataSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
  totalItems: z.number(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

/**
 * Schema for search parameters
 */
export const SearchParamsSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  sortBy: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
  sourceIds: z.array(z.string()).optional(),
  includeCover: z.boolean().optional(),
});

/**
 * Schema for filter parameters
 */
export const FilterParamsSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'contains', 'greaterThan', 'lessThan', 'in', 'notIn']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown())]),
});

/**
 * Schema for sort parameters
 */
export const SortParamsSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']),
});

/**
 * Schema for API request configuration
 */
export const ApiRequestSchema = z.object({
  method: z.string(),
  path: z.string(),
  query: z.record(z.unknown()).optional(),
  body: z.unknown().optional(),
  headers: z.record(z.string()).optional(),
  auth: z.unknown().optional(),
});

/**
 * Schema for rate limit configuration
 */
export const RateLimitConfigSchema = z.object({
  maxRequests: z.number(),
  windowMs: z.number(),
  delayMs: z.number().optional(),
});

/**
 * Schema for authentication configuration
 */
export const AuthConfigSchema = z.object({
  type: z.enum(['basic', 'bearer', 'apiKey', 'oauth2']),
  username: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
  apiKey: z.string().optional(),
  apiKeyHeader: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scope: z.array(z.string()).optional(),
});

/**
 * Schema for selector configuration
 */
export const SelectorConfigSchema = z.object({
  container: z.string().optional(),
  title: z.string().optional(),
  cover: z.string().optional(),
  description: z.string().optional(),
  chapters: z.string().optional(),
  nextPage: z.string().optional(),
});

/**
 * Schema for download link
 */
export const DownloadLinkSchema = z.object({
  url: z.string(),
  page: z.number(),
  pageNumber: z.number().optional(),
  quality: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

/**
 * Schema for website validation result
 */
export const WebsiteValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
  missingFields: z.array(z.string()).optional(),
  capabilities: z.record(z.unknown()).optional(),
});

/**
 * Helper function to create a type guard from a Zod schema
 */
export function createZodTypeGuard<T>(
  schema: z.ZodType<T>
): (obj: unknown) => obj is T {
  return function (obj: unknown): obj is T {
    const result = schema.safeParse(obj);
    return result.success;
  };
}

/**
 * Schema for manga metadata
 */
export const MangaMetadataSchema = z.object({
  id: z.string(),
  title: z.string(),
  alternativeTitles: z.array(z.string()).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  genres: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  authors: z.array(z.string()).optional(),
  artists: z.array(z.string()).optional(),
  coverImage: z.string().optional(),
  coverUrl: z.string().optional(),
  bannerImage: z.string().optional(),
  chapters: z.number().optional(),
  volumes: z.number().optional(),
  year: z.number().optional(),
  publisher: z.string().optional(),
  coverExtraLarge: z.string().optional(),
  coverLarge: z.string().optional(),
  coverMedium: z.string().optional(),
  coverSmall: z.string().optional(),
  cover: z.string().optional(),
  summary: z.string().optional(),
  synonyms: z.array(z.string()).optional(),
  characters: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  urls: z.array(z.string()).optional(),
  rating: z.number().optional(),
  averageScore: z.number().optional(),
  popularity: z.number().optional(),
  countryOfOrigin: z.string().optional(),
  format: z.string().optional(),
  externalLinks: z.array(z.unknown()).optional(),
  source: z.string().optional(),
  sourceId: z.string().optional(),
  language: z.string().optional(),
  languages: z.array(z.string()).optional(),
  idMal: z.number().optional(),
  releaseYear: z.number().optional(),
  isAdult: z.boolean().optional(),
  contentWarnings: z.array(z.string()).optional(),
  covers: z.array(z.unknown()).optional(),
  score: z.number().optional(),
  provider: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema for chapter data
 */
export const ChapterSchema = z.object({
  id: z.string(),
  mangaId: z.string(),
  title: z.string().optional(),
  chapterNumber: z.number().optional(),
  volumeNumber: z.number().optional(),
  pages: z.number().optional(),
  releaseDate: z.string().optional(),
  scanlator: z.string().optional(),
  url: z.string().optional(),
  sourceUrl: z.string().optional(),
  downloadUrl: z.string().optional(),
  downloaded: z.boolean().optional(),
  read: z.boolean().optional(),
  lastReadAt: z.string().optional(),
  filePath: z.string().optional(),
  fileSize: z.number().optional(),
  fileFormat: z.string().optional(),
  fileHash: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema for volume data
 */
export const VolumeSchema = z.object({
  id: z.string(),
  mangaId: z.string(),
  title: z.string().optional(),
  volumeNumber: z.number(),
  chapters: z.array(z.string()).optional(),
  coverImage: z.string().optional(),
  releaseDate: z.string().optional(),
  publisher: z.string().optional(),
  isbn: z.string().optional(),
  pageCount: z.number().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema for provider configuration
 */
export const ProviderConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  enabled: z.boolean(),
  priority: z.number().optional(),
  config: z.record(z.unknown()).optional(),
  capabilities: z.array(z.string()).optional(),
  rateLimit: z.number().optional(),
  timeout: z.number().optional(),
  retryCount: z.number().optional(),
  lastChecked: z.string().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Schema for search result
 */
export const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  provider: z.string(),
  metadata: z.record(z.unknown()).optional(),
  cover: z.string().optional(),
  genres: z.array(z.string()).optional(),
  alternativeTitles: z.array(z.string()).optional(),
  volumes: z.number().optional(),
  chapters: z.number().optional(),
  score: z.number().optional(),
  status: z.string().optional(),
  format: z.string().optional(),
  url: z.string().optional(),
  wikiUrl: z.string().optional(),
  siteDetailUrl: z.string().optional(),
  author: z.string().optional(),
  totalChapters: z.number().optional(),
  imageUrl: z.string().optional(),
  authors: z.array(z.string()).optional(),
  artists: z.array(z.string()).optional(),
  artist: z.string().optional(),
  publisher: z.string().optional(),
  year: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  bannerImage: z.string().optional(),
  anilistId: z.number().optional(),
  averageScore: z.number().optional(),
  popularity: z.number().optional(),
  trending: z.number().optional(),
});

/**
 * Schema for import rule
 */
export const ImportRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  conditions: z.array(z.unknown()),
  actions: z.array(z.unknown()),
  priority: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Schema for integration configuration
 */
export const IntegrationConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  enabled: z.boolean(),
  config: z.record(z.unknown()).optional(),
  capabilities: z.array(z.string()).optional(),
  lastSync: z.string().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Helper function to get detailed validation errors from a Zod schema
 */
export function getValidationErrors<T>(
  schema: z.ZodType<T>,
  obj: unknown
): string[] {
  const result = schema.safeParse(obj);
  if (result.success) {
    return [];
  }

  return result.error.errors.map(error => {
    const path = error.path.length > 0 ? ` at path '${error.path.join('.')}'` : '';
    return `${error.message}${path}`;
  });
}