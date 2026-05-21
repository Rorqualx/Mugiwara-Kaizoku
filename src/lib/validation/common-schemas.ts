/**
 * Common Zod Schemas for External API Validation
 *
 * This module provides reusable Zod schemas for validating external API responses
 * and raw provider data. These schemas help replace unsafe type assertions with
 * proper runtime validation.
 *
 * @module validation/common-schemas
 * @security Validates all external data before use
 * @security Prevents injection of malformed data
 *
 * @example
 * // Before (unsafe):
 * const data = JSON.parse(str) as RawProviderData;
 *
 * // After (safe):
 * const parsed = parseJSON(str, RawProviderDataSchema);
 * if (parsed !== null) {
 *   // data is now validated and typed
 *   console.log(parsed.totalVolumes);
 * }
 */

import { z } from 'zod';

// ============================================================================
// Provider Data Schemas
// ============================================================================

/**
 * Schema for raw provider chapter data
 *
 * @remarks
 * Used for validating chapter data from external providers
 */
export const RawChapterDataSchema = z.object({
  number: z.number().optional(),
  title: z.string().optional(),
  pages: z.number().optional(),
  url: z.string().url().optional(),
  releaseDate: z.string().optional(),
});

export type RawChapterData = z.infer<typeof RawChapterDataSchema>;

/**
 * Schema for raw provider volume data
 *
 * @remarks
 * Used for validating volume data from external providers
 */
export const RawVolumeDataSchema = z.object({
  title: z.string(),
  number: z.number().optional(),
  chapters: z.array(RawChapterDataSchema).optional(),
  coverImage: z.string().url().optional(),
});

export type RawVolumeData = z.infer<typeof RawVolumeDataSchema>;

/**
 * Schema for raw provider data (most common pattern in codebase)
 *
 * @remarks
 * - Used extensively in manga metadata services
 * - Validates volumes, chapters, and media assets
 * - Allows optional fields to accommodate different providers
 */
export const RawProviderDataSchema = z.object({
  volumes: z.array(RawVolumeDataSchema).optional(),
  totalVolumes: z.number().optional(),
  totalChapters: z.number().optional(),
  selectedCover: z.string().url().optional(),
  selectedBanner: z.string().url().optional(),
  status: z.string().optional(),
  description: z.string().optional(),
});

export type RawProviderData = z.infer<typeof RawProviderDataSchema>;

// ============================================================================
// AniList API Schemas
// ============================================================================

/**
 * Schema for AniList title object
 */
export const AniListTitleSchema = z.object({
  romaji: z.string(),
  english: z.string().optional().nullable(),
  native: z.string().optional().nullable(),
});

/**
 * Schema for AniList cover image object
 */
export const AniListCoverImageSchema = z.object({
  large: z.string().url().optional().nullable(),
  medium: z.string().url().optional().nullable(),
  extraLarge: z.string().url().optional().nullable(),
});

/**
 * Schema for AniList media response
 *
 * @remarks
 * Validates responses from AniList GraphQL API
 */
export const AniListMediaSchema = z.object({
  id: z.number(),
  title: AniListTitleSchema,
  coverImage: AniListCoverImageSchema.optional().nullable(),
  bannerImage: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  genres: z.array(z.string()).optional().nullable(),
  averageScore: z.number().optional().nullable(),
  startDate: z
    .object({
      year: z.number().optional().nullable(),
      month: z.number().optional().nullable(),
      day: z.number().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export type AniListMedia = z.infer<typeof AniListMediaSchema>;

/**
 * Schema for paginated AniList response
 */
export const AniListPageSchema = z.object({
  Page: z.object({
    media: z.array(AniListMediaSchema),
    pageInfo: z
      .object({
        total: z.number().optional(),
        currentPage: z.number().optional(),
        lastPage: z.number().optional(),
        hasNextPage: z.boolean().optional(),
      })
      .optional(),
  }),
});

export type AniListPage = z.infer<typeof AniListPageSchema>;

// ============================================================================
// ComicVine API Schemas
// ============================================================================

/**
 * Schema for ComicVine publisher object
 */
export const ComicVinePublisherSchema = z.object({
  name: z.string(),
  id: z.number().optional(),
});

/**
 * Schema for ComicVine volume response
 *
 * @remarks
 * Validates responses from ComicVine API
 */
export const ComicVineVolumeSchema = z.object({
  id: z.number(),
  name: z.string(),
  start_year: z.string().optional().nullable(),
  count_of_issues: z.number().optional().nullable(),
  publisher: ComicVinePublisherSchema.optional().nullable(),
  description: z.string().optional().nullable(),
  image: z
    .object({
      thumb_url: z.string().url().optional(),
      small_url: z.string().url().optional(),
      medium_url: z.string().url().optional(),
      original_url: z.string().url().optional(),
    })
    .optional()
    .nullable(),
});

export type ComicVineVolume = z.infer<typeof ComicVineVolumeSchema>;

/**
 * Schema for ComicVine API response wrapper
 */
export const ComicVineResponseSchema = z.object({
  status_code: z.number(),
  error: z.string(),
  results: z.array(ComicVineVolumeSchema).optional(),
  number_of_total_results: z.number().optional(),
});

export type ComicVineResponse = z.infer<typeof ComicVineResponseSchema>;

// ============================================================================
// Generic Metadata Schemas
// ============================================================================

/**
 * Generic metadata response schema
 *
 * @remarks
 * Use this for provider-agnostic metadata handling
 */
export const MetadataResponseSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  coverImage: z.string().url().optional(),
  bannerImage: z.string().url().optional(),
  authors: z.array(z.string()).optional(),
  genres: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.string().optional(),
  year: z.number().optional(),
  rating: z.number().optional(),
});

export type MetadataResponse = z.infer<typeof MetadataResponseSchema>;

/**
 * Schema for search result items
 */
export const SearchResultSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  coverImage: z.string().url().optional(),
  description: z.string().optional(),
  year: z.number().optional(),
  status: z.string().optional(),
  score: z.number().optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Schema for paginated search results
 */
export const PaginatedSearchResultsSchema = z.object({
  results: z.array(SearchResultSchema),
  total: z.number().optional(),
  page: z.number().optional(),
  hasNextPage: z.boolean().optional(),
});

export type PaginatedSearchResults = z.infer<
  typeof PaginatedSearchResultsSchema
>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely parse JSON string with Zod schema validation
 *
 * @param json - The JSON string to parse
 * @param schema - The Zod schema to validate against
 * @returns Validated data or null if parsing/validation fails
 *
 * @example
 * const data = parseJSON(rawJson, RawProviderDataSchema);
 * if (data !== null) {
 *   console.log(data.totalVolumes);
 * }
 */
export function parseJSON<T>(json: string, schema: z.ZodSchema<T>): T | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return schema.parse(parsed);
  } catch {
    return null;
  }
}

/**
 * Safely parse JSON with detailed error information
 *
 * @param json - The JSON string to parse
 * @param schema - The Zod schema to validate against
 * @returns Result object with data or error
 *
 * @example
 * const result = parseJSONWithError(rawJson, AniListMediaSchema);
 * if (result.success) {
 *   console.log(result.data.title);
 * } else {
 *   logger.error('Parse failed:', result.error);
 * }
 */
export function parseJSONWithError<T>(
  json: string,
  schema: z.ZodSchema<T>,
):
  | { success: true; data: T }
  | { success: false; error: string; issues?: z.ZodIssue[] } {
  try {
    const parsed: unknown = JSON.parse(json);
    const validated = schema.safeParse(parsed);

    if (validated.success) {
      return { success: true, data: validated.data };
    }

    return {
      success: false,
      error: 'Validation failed',
      issues: validated.error.issues,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Parse failed',
    };
  }
}

/**
 * Validate unknown data against a schema
 *
 * @param data - The data to validate
 * @param schema - The Zod schema to validate against
 * @returns Validated data or null
 *
 * @example
 * const validated = validateData(unknownData, MetadataResponseSchema);
 * if (validated !== null) {
 *   // data is now typed and validated
 * }
 */
export function validateData<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
): T | null {
  try {
    return schema.parse(data);
  } catch {
    return null;
  }
}

/**
 * Create a partial version of a schema (all fields optional)
 *
 * @param schema - The base schema
 * @returns Partial schema with all fields optional
 *
 * @example
 * const PartialMetadataSchema = createPartialSchema(MetadataResponseSchema);
 * const data = validateData(unknown, PartialMetadataSchema);
 */
export function createPartialSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> {
  return schema.partial();
}
