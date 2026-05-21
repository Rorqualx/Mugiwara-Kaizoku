/**
 * Zod schema for Provider Metadata
 *
 * Used when parsing manga.providerMetadata from database
 * Contains metadata from various manga providers (AniList, MAL, ComicVine, etc.)
 */

import { z } from 'zod';

/**
 * Base metadata shared across all providers
 */
export const BaseProviderMetadataSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().optional(),
  description: z.string().optional(),
  coverImage: z.string().url().optional(),
  bannerImage: z.string().url().optional(),
  genres: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  authors: z.array(z.string()).optional(),
  artists: z.array(z.string()).optional(),
  chapters: z.number().optional(),
  volumes: z.number().optional(),
});

export type BaseProviderMetadata = z.infer<typeof BaseProviderMetadataSchema>;

/**
 * AniList-specific metadata
 */
export const AniListMetadataSchema = BaseProviderMetadataSchema.extend({
  idMal: z.number().optional(),
  averageScore: z.number().min(0).max(100).optional(),
  popularity: z.number().optional(),
  favourites: z.number().optional(),
  countryOfOrigin: z.string().optional(),
  isLicensed: z.boolean().optional(),
});

export type AniListMetadata = z.infer<typeof AniListMetadataSchema>;

/**
 * MyAnimeList-specific metadata
 */
export const MALMetadataSchema = BaseProviderMetadataSchema.extend({
  score: z.number().min(0).max(10).optional(),
  scoredBy: z.number().optional(),
  rank: z.number().optional(),
  popularity: z.number().optional(),
  members: z.number().optional(),
  favorites: z.number().optional(),
});

export type MALMetadata = z.infer<typeof MALMetadataSchema>;

/**
 * ComicVine-specific metadata
 */
export const ComicVineMetadataSchema = BaseProviderMetadataSchema.extend({
  apiDetailUrl: z.string().url().optional(),
  siteDetailUrl: z.string().url().optional(),
  publisher: z.string().optional(),
  dateAdded: z.string().datetime().optional(),
  dateLastUpdated: z.string().datetime().optional(),
});

export type ComicVineMetadata = z.infer<typeof ComicVineMetadataSchema>;

/**
 * Multi-provider metadata container
 * Keys are provider names (anilist, mal, comicvine, etc.)
 */
export const ProviderMetadataSchema = z.record(
  z.string(),
  z.union([
    AniListMetadataSchema,
    MALMetadataSchema,
    ComicVineMetadataSchema,
    BaseProviderMetadataSchema,
  ])
);

export type ProviderMetadata = z.infer<typeof ProviderMetadataSchema>;

/**
 * Safe parser with error handling
 */
export function parseProviderMetadata(data: unknown): ProviderMetadata | null {
  const result = ProviderMetadataSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.error('ProviderMetadata validation failed:', result.error.issues);
  return null;
}

/**
 * Type guard for ProviderMetadata
 */
export function isProviderMetadata(value: unknown): value is ProviderMetadata {
  return ProviderMetadataSchema.safeParse(value).success;
}
