/**
 * Zod schemas for search provider responses
 *
 * Used for validating search results from various manga providers
 */

import { z } from 'zod';

/**
 * Base search result shared across providers
 */
export const BaseSearchResultSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  alternativeTitles: z.array(z.string()).optional(),
  description: z.string().optional(),
  coverImage: z.string().url().optional(),
  author: z.string().optional(),
  artist: z.string().optional(),
  status: z.string().optional(),
  genres: z.array(z.string()).optional(),
  year: z.number().optional(),
  rating: z.number().optional(),
});

export type BaseSearchResult = z.infer<typeof BaseSearchResultSchema>;

/**
 * Provider-specific search result
 */
export const ProviderSearchResultSchema = BaseSearchResultSchema.extend({
  providerId: z.string(),
  providerName: z.string(),
  sourceUrl: z.string().url().optional(),
  lastUpdated: z.string().datetime().optional(),
  chapterCount: z.number().optional(),
  volumeCount: z.number().optional(),
});

export type ProviderSearchResult = z.infer<typeof ProviderSearchResultSchema>;

/**
 * Search response with multiple results
 */
export const SearchResponseSchema = z.object({
  results: z.array(ProviderSearchResultSchema),
  total: z.number(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
  hasMore: z.boolean().optional(),
  providerId: z.string().optional(),
  query: z.string().optional(),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/**
 * Multi-provider search response
 */
export const MultiProviderSearchResponseSchema = z.object({
  results: z.record(z.string(), z.array(ProviderSearchResultSchema)),
  totalResults: z.number(),
  providersQueried: z.array(z.string()),
  query: z.string(),
  timestamp: z.string().datetime().optional(),
});

export type MultiProviderSearchResponse = z.infer<typeof MultiProviderSearchResponseSchema>;

/**
 * Prowlarr search result
 */
export const ProwlarrSearchResultSchema = z.object({
  guid: z.string(),
  title: z.string(),
  indexerId: z.number(),
  indexer: z.string(),
  publishDate: z.string().datetime(),
  size: z.number(),
  downloadUrl: z.string().url(),
  infoUrl: z.string().url().optional(),
  categories: z.array(z.number()).optional(),
  seeders: z.number().optional(),
  leechers: z.number().optional(),
});

export type ProwlarrSearchResult = z.infer<typeof ProwlarrSearchResultSchema>;

/**
 * Client search provider response
 */
export const ClientSearchResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    results: z.array(BaseSearchResultSchema),
    provider: z.string(),
    cached: z.boolean().optional(),
  }).optional(),
  error: z.string().optional(),
});

export type ClientSearchResponse = z.infer<typeof ClientSearchResponseSchema>;

/**
 * Safe parsers
 */
export function parseSearchResponse(data: unknown): SearchResponse | null {
  const result = SearchResponseSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Search response validation failed:', result.error.issues);
  return null;
}

export function parseMultiProviderSearchResponse(
  data: unknown
): MultiProviderSearchResponse | null {
  const result = MultiProviderSearchResponseSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Multi-provider search response validation failed:', result.error.issues);
  return null;
}

export function parseClientSearchResponse(data: unknown): ClientSearchResponse | null {
  const result = ClientSearchResponseSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Client search response validation failed:', result.error.issues);
  return null;
}
