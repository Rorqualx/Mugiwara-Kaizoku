/**
 * ComicVine API Zod Schemas
 *
 * This module provides Zod schemas for validating ComicVine API responses.
 * These schemas ensure runtime type safety for external ComicVine data.
 *
 * @module schemas/comicvine
 */

import { z } from 'zod';

import {
  NullableString,
  NullableNumber,
  createDefaultArraySchema,
  createLenientSchema,
} from './common';

// ============================================================================
// Image Schema
// ============================================================================

/**
 * ComicVine image object with multiple size URLs
 */
export const ComicVineImageSchema = createLenientSchema({
  icon_url: NullableString,
  medium_url: NullableString,
  screen_url: NullableString,
  screen_large_url: NullableString,
  small_url: NullableString,
  super_url: NullableString,
  thumb_url: NullableString,
  tiny_url: NullableString,
  original_url: NullableString,
});

export type ComicVineImageValidated = z.infer<typeof ComicVineImageSchema>;

// ============================================================================
// Entity Reference Schemas (for nested objects)
// ============================================================================

/**
 * Generic entity reference (id, name, api_detail_url)
 */
export const ComicVineEntityRefSchema = createLenientSchema({
  id: z.number(),
  name: NullableString,
  api_detail_url: NullableString,
});

export type ComicVineEntityRefValidated = z.infer<typeof ComicVineEntityRefSchema>;

/**
 * Publisher reference
 */
export const ComicVinePublisherSchema = createLenientSchema({
  id: z.number(),
  name: NullableString,
  api_detail_url: NullableString,
  site_detail_url: NullableString,
});

export type ComicVinePublisherValidated = z.infer<typeof ComicVinePublisherSchema>;

/**
 * Person credit (creator with role)
 */
export const ComicVinePersonCreditSchema = createLenientSchema({
  id: z.number(),
  name: NullableString,
  api_detail_url: NullableString,
  role: NullableString,
});

export type ComicVinePersonCreditValidated = z.infer<typeof ComicVinePersonCreditSchema>;

/**
 * Issue reference (for first_issue, last_issue)
 */
export const ComicVineIssueRefSchema = createLenientSchema({
  id: z.number(),
  name: NullableString,
  issue_number: NullableString,
  api_detail_url: NullableString,
});

export type ComicVineIssueRefValidated = z.infer<typeof ComicVineIssueRefSchema>;

// ============================================================================
// Main Entity Schemas
// ============================================================================

/**
 * ComicVine Issue (chapter/issue)
 */
export const ComicVineIssueSchema = createLenientSchema({
  id: z.number(),
  name: NullableString,
  issue_number: NullableString,
  image: ComicVineImageSchema.nullable().optional(),
  description: NullableString,
  api_detail_url: NullableString,
  site_detail_url: NullableString,
  cover_date: NullableString,
  store_date: NullableString,
  volume: createLenientSchema({
    id: z.number(),
    name: NullableString,
    api_detail_url: NullableString,
  }).nullable().optional(),
  character_credits: createDefaultArraySchema(ComicVineEntityRefSchema),
  person_credits: createDefaultArraySchema(ComicVinePersonCreditSchema),
});

export type ComicVineIssueValidated = z.infer<typeof ComicVineIssueSchema>;

/**
 * ComicVine Volume (series)
 */
export const ComicVineVolumeSchema = createLenientSchema({
  id: z.number(),
  name: NullableString,
  image: ComicVineImageSchema.nullable().optional(),
  description: NullableString,
  api_detail_url: NullableString,
  site_detail_url: NullableString,
  deck: NullableString,
  start_year: z.union([z.number(), z.string()]).nullable().optional(),
  publisher: ComicVinePublisherSchema.nullable().optional(),
  count_of_issues: NullableNumber,
  volume_number: NullableNumber,
  date_added: NullableString,
  date_last_updated: NullableString,
  aliases: z.union([z.string(), createDefaultArraySchema(z.string())]).nullable().optional(),
  genres: createDefaultArraySchema(ComicVineEntityRefSchema),
  first_issue: ComicVineIssueRefSchema.nullable().optional(),
  last_issue: ComicVineIssueRefSchema.nullable().optional(),
  characters: createDefaultArraySchema(ComicVineEntityRefSchema),
  person_credits: createDefaultArraySchema(ComicVinePersonCreditSchema),
  issues: createDefaultArraySchema(ComicVineIssueRefSchema),
  resource_type: NullableString,
  concept_credits: createDefaultArraySchema(ComicVineEntityRefSchema),
  location_credits: createDefaultArraySchema(ComicVineEntityRefSchema),
  object_credits: createDefaultArraySchema(ComicVineEntityRefSchema),
  team_credits: createDefaultArraySchema(ComicVineEntityRefSchema),
  story_arc_credits: createDefaultArraySchema(ComicVineEntityRefSchema),
});

export type ComicVineVolumeValidated = z.infer<typeof ComicVineVolumeSchema>;

/**
 * ComicVine Character
 */
export const ComicVineCharacterSchema = createLenientSchema({
  id: z.number(),
  name: NullableString,
  image: ComicVineImageSchema.nullable().optional(),
  description: NullableString,
  api_detail_url: NullableString,
  site_detail_url: NullableString,
  deck: NullableString,
  real_name: NullableString,
  aliases: NullableString,
  gender: NullableNumber,
  publisher: ComicVinePublisherSchema.nullable().optional(),
  origin: ComicVineEntityRefSchema.nullable().optional(),
  volume_credits: createDefaultArraySchema(ComicVineEntityRefSchema),
});

export type ComicVineCharacterValidated = z.infer<typeof ComicVineCharacterSchema>;

/**
 * ComicVine Creator
 */
export const ComicVineCreatorSchema = createLenientSchema({
  id: z.number(),
  name: NullableString,
  image: ComicVineImageSchema.nullable().optional(),
  description: NullableString,
  api_detail_url: NullableString,
  site_detail_url: NullableString,
  deck: NullableString,
  birth: NullableString,
  country: NullableString,
  volume_credits: createDefaultArraySchema(ComicVineEntityRefSchema),
  issue_credits: createDefaultArraySchema(ComicVineEntityRefSchema),
});

export type ComicVineCreatorValidated = z.infer<typeof ComicVineCreatorSchema>;

// ============================================================================
// Search Result Schema
// ============================================================================

/**
 * ComicVine search result
 */
export const ComicVineSearchResultSchema = createLenientSchema({
  id: z.number(),
  name: z.string(),
  description: NullableString,
  image: ComicVineImageSchema.nullable().optional(),
  resource_type: NullableString,
  count_of_issues: NullableNumber,
  publisher: ComicVinePublisherSchema.nullable().optional(),
  start_year: z.union([z.number(), z.string()]).nullable().optional(),
  api_detail_url: NullableString,
  site_detail_url: NullableString,
  deck: NullableString,
});

export type ComicVineSearchResultValidated = z.infer<typeof ComicVineSearchResultSchema>;

// ============================================================================
// API Response Schemas
// ============================================================================

/**
 * ComicVine API response wrapper (single result)
 */
export const ComicVineApiResponseSchema = <T extends z.ZodTypeAny>(resultSchema: T): z.ZodObject<{
  error: z.ZodString;
  limit: z.ZodNumber;
  offset: z.ZodNumber;
  number_of_page_results: z.ZodNumber;
  number_of_total_results: z.ZodNumber;
  status_code: z.ZodNumber;
  results: T;
  version: z.ZodString;
}, 'passthrough'> =>
  createLenientSchema({
    error: z.string(),
    limit: z.number(),
    offset: z.number(),
    number_of_page_results: z.number(),
    number_of_total_results: z.number(),
    status_code: z.number(),
    results: resultSchema,
    version: z.string(),
  });

/**
 * ComicVine API response wrapper (list results)
 */
export const ComicVineListApiResponseSchema = <T extends z.ZodTypeAny>(resultSchema: T): z.ZodObject<{
  error: z.ZodString;
  limit: z.ZodNumber;
  offset: z.ZodNumber;
  number_of_page_results: z.ZodNumber;
  number_of_total_results: z.ZodNumber;
  status_code: z.ZodNumber;
  results: z.ZodArray<T>;
  version: z.ZodString;
}, 'passthrough'> =>
  createLenientSchema({
    error: z.string(),
    limit: z.number(),
    offset: z.number(),
    number_of_page_results: z.number(),
    number_of_total_results: z.number(),
    status_code: z.number(),
    results: z.array(resultSchema),
    version: z.string(),
  });

/**
 * Pre-built response schemas for common API calls
 */
export const ComicVineVolumeResponseSchema = ComicVineApiResponseSchema(ComicVineVolumeSchema);
export const ComicVineVolumeListResponseSchema = ComicVineListApiResponseSchema(ComicVineVolumeSchema);
export const ComicVineIssueResponseSchema = ComicVineApiResponseSchema(ComicVineIssueSchema);
export const ComicVineIssueListResponseSchema = ComicVineListApiResponseSchema(ComicVineIssueSchema);
export const ComicVineSearchResponseSchema = ComicVineListApiResponseSchema(ComicVineSearchResultSchema);

export type ComicVineVolumeResponseValidated = z.infer<typeof ComicVineVolumeResponseSchema>;
export type ComicVineVolumeListResponseValidated = z.infer<typeof ComicVineVolumeListResponseSchema>;
export type ComicVineIssueResponseValidated = z.infer<typeof ComicVineIssueResponseSchema>;
export type ComicVineIssueListResponseValidated = z.infer<typeof ComicVineIssueListResponseSchema>;
export type ComicVineSearchResponseValidated = z.infer<typeof ComicVineSearchResponseSchema>;

// ============================================================================
// Scraping Schemas (from FlareSolverr results)
// ============================================================================

/**
 * Chapter prefix types
 */
export const ChapterPrefixSchema = z.enum([
  'Chapter',
  'Spell',
  'Episode',
  'Story',
  'Part',
  'Extra',
  'Special',
]);

export type ChapterPrefixValidated = z.infer<typeof ChapterPrefixSchema>;

/**
 * Scraped chapter from ComicVine
 */
export const ComicVineScrapedChapterSchema = createLenientSchema({
  number: z.string(),
  title: z.string(),
  prefix: ChapterPrefixSchema.optional(),
  romanNumeral: NullableString,
  description: NullableString,
  isFinalChapter: z.boolean().optional(),
  isEpilogue: z.boolean().optional(),
  epilogueNumber: NullableNumber,
  isSpecial: z.boolean().optional(),
});

export type ComicVineScrapedChapterValidated = z.infer<typeof ComicVineScrapedChapterSchema>;

/**
 * Scraped volume with chapters
 */
export const ComicVineScrapedVolumeSchema = createLenientSchema({
  volumeId: z.string(),
  volumeNumber: z.number(),
  volumeTitle: z.string(),
  volumeSummary: NullableString,
  coverImage: NullableString,
  chapters: createDefaultArraySchema(ComicVineScrapedChapterSchema),
  totalChapters: z.number(),
  themes: createDefaultArraySchema(z.string()),
  genres: createDefaultArraySchema(z.string()),
});

export type ComicVineScrapedVolumeValidated = z.infer<typeof ComicVineScrapedVolumeSchema>;

/**
 * Volume URL info for series scraping
 */
export const VolumeUrlInfoSchema = createLenientSchema({
  volumeNumber: z.number(),
  url: z.string(),
  coverUrl: NullableString,
});

export type VolumeUrlInfoValidated = z.infer<typeof VolumeUrlInfoSchema>;

/**
 * Issue with cover info
 */
export const IssueWithCoverInfoSchema = createLenientSchema({
  issueNumber: z.number(),
  title: NullableString,
  url: z.string(),
  coverUrl: NullableString,
});

export type IssueWithCoverInfoValidated = z.infer<typeof IssueWithCoverInfoSchema>;

/**
 * Pagination info from scraped HTML
 */
export const ScrapedPaginationInfoSchema = createLenientSchema({
  currentPage: z.number(),
  totalPages: z.number(),
  nextPageUrl: z.string().nullable(),
  pageUrls: createDefaultArraySchema(z.string()),
});

export type ScrapedPaginationInfoValidated = z.infer<typeof ScrapedPaginationInfoSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate ComicVine volume with detailed error context
 */
export function validateComicVineVolume(data: unknown): z.SafeParseReturnType<unknown, ComicVineVolumeValidated> {
  return ComicVineVolumeSchema.safeParse(data);
}

/**
 * Validate ComicVine issue with detailed error context
 */
export function validateComicVineIssue(data: unknown): z.SafeParseReturnType<unknown, ComicVineIssueValidated> {
  return ComicVineIssueSchema.safeParse(data);
}

/**
 * Validate ComicVine search result with detailed error context
 */
export function validateComicVineSearchResult(data: unknown): z.SafeParseReturnType<unknown, ComicVineSearchResultValidated> {
  return ComicVineSearchResultSchema.safeParse(data);
}

/**
 * Validate ComicVine API response with detailed error context
 */
export function validateComicVineApiResponse<T>(
  data: unknown,
  resultSchema: z.ZodType<T>
): { success: true; data: { results: T; status_code: number; error: string } } | { success: false; error: z.ZodError } {
  const schema = ComicVineApiResponseSchema(resultSchema);
  const parseResult = schema.safeParse(data);

  if (parseResult.success) {
    return {
      success: true,
      data: {
        results: parseResult.data.results as T,
        status_code: parseResult.data.status_code,
        error: parseResult.data.error,
      },
    };
  }

  return {
    success: false,
    error: parseResult.error,
  };
}

/**
 * Validate scraped volume chapters
 */
export function validateScrapedVolumeChapters(data: unknown): z.SafeParseReturnType<unknown, ComicVineScrapedVolumeValidated> {
  return ComicVineScrapedVolumeSchema.safeParse(data);
}
