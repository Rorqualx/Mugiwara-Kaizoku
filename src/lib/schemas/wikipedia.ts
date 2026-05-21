/**
 * Wikipedia API Zod Schemas
 *
 * This module provides Zod schemas for validating Wikipedia MediaWiki API responses.
 * These schemas ensure runtime type safety for external Wikipedia data.
 *
 * @module schemas/wikipedia
 */

import { z } from 'zod';

import {
  NullableString,
  NullableNumber,
  createDefaultArraySchema,
  createLenientSchema,
} from './common';

// ============================================================================
// API Response Schemas (mirror MediaWiki API structure)
// ============================================================================

/**
 * Wikipedia API page response
 */
export const WikipediaApiPageSchema = createLenientSchema({
  title: NullableString,
  extract: NullableString,
  pageid: NullableNumber,
});

export type WikipediaApiPageValidated = z.infer<typeof WikipediaApiPageSchema>;

/**
 * Wikipedia API search result item
 */
export const WikipediaApiSearchResultSchema = createLenientSchema({
  pageid: z.number(),
  title: z.string(),
});

export type WikipediaApiSearchResultValidated = z.infer<typeof WikipediaApiSearchResultSchema>;

/**
 * Wikipedia section metadata
 */
export const WikipediaSectionSchema = createLenientSchema({
  toclevel: NullableNumber,
  level: NullableString,
  line: NullableString,
  number: NullableString,
  index: NullableString,
  fromtitle: NullableString,
  byteoffset: NullableNumber,
  anchor: NullableString,
});

export type WikipediaSectionValidated = z.infer<typeof WikipediaSectionSchema>;

/**
 * Wikipedia API response structure
 */
export const WikipediaApiResponseSchema = createLenientSchema({
  query: z.object({
    pages: z.record(z.string(), WikipediaApiPageSchema).optional(),
    search: createDefaultArraySchema(WikipediaApiSearchResultSchema),
  }).optional(),
});

export type WikipediaApiResponseValidated = z.infer<typeof WikipediaApiResponseSchema>;

/**
 * Wikipedia parse API response
 */
export const WikipediaParseResponseSchema = createLenientSchema({
  parse: z.object({
    title: NullableString,
    pageid: NullableNumber,
    text: z.object({
      '*': z.string(),
    }).optional(),
    sections: createDefaultArraySchema(WikipediaSectionSchema),
  }).passthrough().optional(),
});

export type WikipediaParseResponseValidated = z.infer<typeof WikipediaParseResponseSchema>;

// ============================================================================
// Domain Schemas (business entities)
// ============================================================================

/**
 * Wikipedia search result structure
 */
export const WikipediaSearchResultSchema = createLenientSchema({
  pageId: z.number(),
  title: z.string(),
  extract: NullableString,
  url: z.string(),
  isDisambiguation: z.boolean().optional(),
  redirectTo: NullableString,
});

export type WikipediaSearchResultValidated = z.infer<typeof WikipediaSearchResultSchema>;

/**
 * Chapter information extracted from Wikipedia
 */
export const WikipediaChapterSchema = createLenientSchema({
  number: z.union([z.string(), z.number()]),
  title: NullableString,
  volumeNumber: NullableNumber,
  releaseDate: NullableString,
  pages: NullableNumber,
});

export type WikipediaChapterValidated = z.infer<typeof WikipediaChapterSchema>;

/**
 * Volume information from Wikipedia
 */
export const WikipediaVolumeSchema = createLenientSchema({
  number: z.number(),
  title: NullableString,
  alternativeTitles: createDefaultArraySchema(z.string()),
  chapters: createDefaultArraySchema(WikipediaChapterSchema),
  originalReleaseDate: NullableString,
  englishReleaseDate: NullableString,
  isbn: NullableString,
  isbn13: NullableString,
  chapterRange: NullableString,
  description: NullableString,
  summary: NullableString,
  pages: NullableNumber,
  specialEdition: NullableString,
});

export type WikipediaVolumeValidated = z.infer<typeof WikipediaVolumeSchema>;

/**
 * Publication status enum
 */
export const WikipediaPublicationStatusSchema = z.enum([
  'ongoing',
  'finished',
  'hiatus',
  'cancelled',
  'unknown',
]).nullable();

/**
 * Manga type classification enum
 */
export const WikipediaMangaTypeSchema = z.enum([
  'manga',
  'manhwa',
  'manhua',
  'webtoon',
]).nullable();

/**
 * Complete manga metadata from Wikipedia
 */
export const WikipediaMangaDataSchema = createLenientSchema({
  title: z.string(),
  alternativeTitles: createDefaultArraySchema(z.string()),
  description: NullableString,
  synopsis: NullableString,
  plot: NullableString, // deprecated but still present
  coverImage: NullableString,
  author: createDefaultArraySchema(z.string()),
  artist: createDefaultArraySchema(z.string()),
  editor: createDefaultArraySchema(z.string()),
  publisher: NullableString,
  englishPublisher: NullableString,
  imprint: NullableString,
  magazine: NullableString,
  englishMagazine: NullableString,
  originalRun: NullableString,
  startDate: z.date().nullable().optional(),
  endDate: z.date().nullable().optional(),
  status: NullableString,
  publicationStatus: WikipediaPublicationStatusSchema,
  mangaType: WikipediaMangaTypeSchema,
  licensedBy: createDefaultArraySchema(z.string()),
  volumes: NullableNumber,
  chapters: NullableNumber,
  chapterList: createDefaultArraySchema(WikipediaChapterSchema),
  volumeList: createDefaultArraySchema(WikipediaVolumeSchema),
  genres: createDefaultArraySchema(z.string()),
  demographic: NullableString,
  wikipediaUrl: NullableString,
  volumeListUrl: NullableString,
  chapterListUrls: createDefaultArraySchema(z.string()),
});

export type WikipediaMangaDataValidated = z.infer<typeof WikipediaMangaDataSchema>;

// ============================================================================
// Parser Result Schemas
// ============================================================================

/**
 * Wikipedia page type enum
 */
export const WikipediaPageTypeSchema = z.enum([
  'list-page',
  'main-article',
  'section-anchor',
  'disambiguation',
  'unknown',
]).nullable();

/**
 * Wikipedia structure type enum
 */
export const WikipediaStructureTypeSchema = z.enum([
  'wikitable-volumes',
  'media-section',
  'infobox-only',
  'combined',
  'unknown',
]).nullable();

/**
 * Wikipedia adaptive parse result
 */
export const WikipediaParseResultSchema = createLenientSchema({
  success: z.boolean(),
  data: WikipediaMangaDataSchema.nullable(),
  volumes: createDefaultArraySchema(WikipediaVolumeSchema),
  chapters: createDefaultArraySchema(WikipediaChapterSchema),
  error: NullableString,
  pageType: WikipediaPageTypeSchema,
  structureType: WikipediaStructureTypeSchema,
  confidence: z.number().min(0).max(1).optional(),
  durationMs: z.number().optional(),
  usedCache: z.boolean().optional(),
});

export type WikipediaParseResultValidated = z.infer<typeof WikipediaParseResultSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate Wikipedia manga data with detailed error context
 * @param data - Unknown data to validate
 * @returns Validation result with success flag and data or errors
 */
export function validateWikipediaMangaData(data: unknown): z.SafeParseReturnType<unknown, WikipediaMangaDataValidated> {
  return WikipediaMangaDataSchema.safeParse(data);
}

/**
 * Validate Wikipedia parse result with detailed error context
 * @param data - Unknown data to validate
 * @returns Validation result with success flag and data or errors
 */
export function validateWikipediaParseResult(data: unknown): z.SafeParseReturnType<unknown, WikipediaParseResultValidated> {
  return WikipediaParseResultSchema.safeParse(data);
}

/**
 * Validate Wikipedia API response with detailed error context
 * @param data - Unknown data to validate
 * @returns Validation result with success flag and data or errors
 */
export function validateWikipediaApiResponse(data: unknown): z.SafeParseReturnType<unknown, WikipediaApiResponseValidated> {
  return WikipediaApiResponseSchema.safeParse(data);
}
