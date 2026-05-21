/**
 * Zod schemas for metadata provider APIs
 *
 * AniList, ComicVine, Fandom, etc.
 */

import { z } from 'zod';

// ============================================================================
// ANILIST
// ============================================================================

export const AniListMediaCoverImageSchema = z.object({
  large: z.string().url().optional(),
  extraLarge: z.string().url().optional(),
  medium: z.string().url().optional(),
});

export const AniListMediaTitleSchema = z.object({
  romaji: z.string().optional(),
  english: z.string().optional(),
  native: z.string().optional(),
});

export const AniListMediaSchema = z.object({
  id: z.number(),
  idMal: z.number().optional(),
  title: AniListMediaTitleSchema,
  description: z.string().optional(),
  coverImage: AniListMediaCoverImageSchema.optional(),
  bannerImage: z.string().url().optional(),
  genres: z.array(z.string()).optional(),
  tags: z.array(z.object({
    id: z.number(),
    name: z.string(),
    rank: z.number().optional(),
  })).optional(),
  averageScore: z.number().optional(),
  popularity: z.number().optional(),
  status: z.string().optional(),
  chapters: z.number().optional(),
  volumes: z.number().optional(),
  startDate: z.object({
    year: z.number().optional(),
    month: z.number().optional(),
    day: z.number().optional(),
  }).optional(),
  endDate: z.object({
    year: z.number().optional(),
    month: z.number().optional(),
    day: z.number().optional(),
  }).optional(),
});

export type AniListMedia = z.infer<typeof AniListMediaSchema>;

export const AniListMediaResponseSchema = z.object({
  data: z.object({
    Media: AniListMediaSchema,
  }),
});

export type AniListMediaResponse = z.infer<typeof AniListMediaResponseSchema>;

export const AniListActivityResponseSchema = z.object({
  data: z.object({
    Page: z.object({
      activities: z.array(z.object({
        id: z.number(),
        type: z.string(),
        userId: z.number(),
        createdAt: z.number(),
        media: AniListMediaSchema.optional(),
      })),
    }),
  }),
});

export type AniListActivityResponse = z.infer<typeof AniListActivityResponseSchema>;

// ============================================================================
// COMICVINE
// ============================================================================

export const ComicVineImageSchema = z.object({
  icon_url: z.string().url().optional(),
  medium_url: z.string().url().optional(),
  screen_url: z.string().url().optional(),
  screen_large_url: z.string().url().optional(),
  small_url: z.string().url().optional(),
  super_url: z.string().url().optional(),
  thumb_url: z.string().url().optional(),
  tiny_url: z.string().url().optional(),
  original_url: z.string().url().optional(),
});

export const ComicVineVolumeSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().optional(),
  image: ComicVineImageSchema.optional(),
  publisher: z.object({
    id: z.number(),
    name: z.string(),
  }).optional(),
  start_year: z.string().optional(),
  count_of_issues: z.number().optional(),
  api_detail_url: z.string().url().optional(),
  site_detail_url: z.string().url().optional(),
});

export type ComicVineVolume = z.infer<typeof ComicVineVolumeSchema>;

export const ComicVineResponseSchema = z.object({
  error: z.string(),
  limit: z.number(),
  offset: z.number(),
  number_of_page_results: z.number(),
  number_of_total_results: z.number(),
  status_code: z.number(),
  results: z.unknown(),
});

export type ComicVineResponse<T = unknown> = {
  error: string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  results: T;
};

// ============================================================================
// FANDOM
// ============================================================================

export const FandomArticleSchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string().url(),
  thumbnail: z.string().url().optional(),
  abstract: z.string().optional(),
});

export const FandomSearchResponseSchema = z.object({
  items: z.array(FandomArticleSchema),
  total: z.number(),
  batches: z.number().optional(),
  currentBatch: z.number().optional(),
});

export type FandomSearchResponse = z.infer<typeof FandomSearchResponseSchema>;

// ============================================================================
// Safe Parsers
// ============================================================================

export function parseAniListMediaResponse(data: unknown): AniListMediaResponse | null {
  const result = AniListMediaResponseSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('AniList media response validation failed:', result.error.issues);
  return null;
}

export function parseComicVineResponse<T>(
  data: unknown,
  resultsSchema: z.ZodType<T>
): ComicVineResponse<T> | null {
  const result = ComicVineResponseSchema.safeParse(data);
  if (!result.success) {
    console.error('ComicVine response validation failed:', result.error.issues);
    return null;
  }

  const resultsResult = resultsSchema.safeParse(result.data.results);
  if (!resultsResult.success) {
    console.error('ComicVine results validation failed:', resultsResult.error.issues);
    return null;
  }

  return {
    ...result.data,
    results: resultsResult.data,
  };
}

export function parseFandomSearchResponse(data: unknown): FandomSearchResponse | null {
  const result = FandomSearchResponseSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Fandom search response validation failed:', result.error.issues);
  return null;
}
