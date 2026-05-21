/**
 * AniList API Zod Schemas
 *
 * This module provides Zod schemas for validating AniList GraphQL API responses.
 * These schemas ensure runtime type safety for external AniList data.
 *
 * @module schemas/anilist
 */

import { z } from 'zod';

import {
  IdSchema,
  NullableString,
  NullableNumber,
  createDefaultArraySchema,
  createLenientSchema,
} from './common';

/**
 * AniList Media Title Schema
 */
export const AniListTitleSchema = createLenientSchema({
  romaji: NullableString,
  english: NullableString,
  native: NullableString,
  userPreferred: NullableString,
});

export type AniListTitle = z.infer<typeof AniListTitleSchema>;

/**
 * AniList Cover Image Schema
 */
export const AniListCoverImageSchema = createLenientSchema({
  extraLarge: NullableString,
  large: NullableString,
  medium: NullableString,
  color: NullableString,
});

export type AniListCoverImage = z.infer<typeof AniListCoverImageSchema>;

/**
 * AniList Date Schema
 */
export const AniListDateSchema = createLenientSchema({
  year: NullableNumber,
  month: NullableNumber,
  day: NullableNumber,
});

export type AniListDate = z.infer<typeof AniListDateSchema>;

/**
 * AniList Media Status Enum
 */
export const AniListMediaStatusSchema = z.enum([
  'FINISHED',
  'RELEASING',
  'NOT_YET_RELEASED',
  'CANCELLED',
  'HIATUS',
]).nullable();

/**
 * AniList Media Format Enum
 */
export const AniListMediaFormatSchema = z.enum([
  'MANGA',
  'NOVEL',
  'ONE_SHOT',
]).nullable();

/**
 * AniList Staff Name Schema
 */
export const AniListStaffNameSchema = createLenientSchema({
  full: NullableString,
  native: NullableString,
});

/**
 * AniList Staff Schema
 */
export const AniListStaffSchema = createLenientSchema({
  id: IdSchema,
  name: AniListStaffNameSchema.optional(),
});

export type AniListStaff = z.infer<typeof AniListStaffSchema>;

/**
 * AniList Staff Edge Schema
 */
export const AniListStaffEdgeSchema = createLenientSchema({
  node: AniListStaffSchema.optional(),
  role: NullableString,
});

/**
 * AniList Media Tag Schema
 */
export const AniListMediaTagSchema = createLenientSchema({
  id: IdSchema,
  name: z.string(),
  description: NullableString,
  category: NullableString,
  rank: NullableNumber,
  isGeneralSpoiler: z.boolean().optional(),
  isMediaSpoiler: z.boolean().optional(),
  isAdult: z.boolean().optional(),
});

export type AniListMediaTag = z.infer<typeof AniListMediaTagSchema>;

/**
 * AniList External Link Schema
 */
export const AniListExternalLinkSchema = createLenientSchema({
  id: IdSchema,
  url: z.string().url(),
  site: z.string(),
  type: NullableString,
  language: NullableString,
  color: NullableString,
  icon: NullableString,
});

export type AniListExternalLink = z.infer<typeof AniListExternalLinkSchema>;

/**
 * AniList Media Schema (Core entity)
 */
export const AniListMediaSchema = createLenientSchema({
  id: z.number(),
  idMal: NullableNumber,
  title: AniListTitleSchema.optional(),
  description: NullableString,
  coverImage: AniListCoverImageSchema.optional(),
  bannerImage: NullableString,
  status: AniListMediaStatusSchema,
  format: AniListMediaFormatSchema,
  chapters: NullableNumber,
  volumes: NullableNumber,
  genres: createDefaultArraySchema(z.string()),
  tags: createDefaultArraySchema(AniListMediaTagSchema),
  startDate: AniListDateSchema.optional(),
  endDate: AniListDateSchema.optional(),
  averageScore: NullableNumber,
  popularity: NullableNumber,
  favourites: NullableNumber,
  isAdult: z.boolean().optional(),
  countryOfOrigin: NullableString,
  synonyms: createDefaultArraySchema(z.string()),
  externalLinks: createDefaultArraySchema(AniListExternalLinkSchema),
  siteUrl: NullableString,
  staff: z.object({
    edges: createDefaultArraySchema(AniListStaffEdgeSchema),
  }).optional(),
});

export type AniListMedia = z.infer<typeof AniListMediaSchema>;

/**
 * AniList Page Info Schema
 */
export const AniListPageInfoSchema = createLenientSchema({
  total: z.number().optional(),
  perPage: z.number().optional(),
  currentPage: z.number().optional(),
  lastPage: z.number().optional(),
  hasNextPage: z.boolean().optional(),
});

export type AniListPageInfo = z.infer<typeof AniListPageInfoSchema>;

/**
 * AniList Paginated Media Response Schema
 */
export const AniListMediaPageSchema = createLenientSchema({
  pageInfo: AniListPageInfoSchema.optional(),
  media: createDefaultArraySchema(AniListMediaSchema),
});

export type AniListMediaPage = z.infer<typeof AniListMediaPageSchema>;

/**
 * AniList GraphQL Response Schema
 * Generic wrapper for all AniList GraphQL responses
 */
export const createAniListGraphQLResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T): z.ZodObject<{
  data: z.ZodOptional<z.ZodNullable<T>>;
  errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
    message: z.ZodString;
    status: z.ZodOptional<z.ZodNumber>;
    locations: z.ZodOptional<z.ZodArray<z.ZodObject<{
      line: z.ZodNumber;
      column: z.ZodNumber;
    }>>>;
    path: z.ZodOptional<z.ZodArray<z.ZodString>>;
    extensions: z.ZodOptional<z.ZodObject<{
      code: z.ZodOptional<z.ZodString>;
    }, 'passthrough'>>;
  }>>>;
}> =>
  z.object({
    data: dataSchema.nullable().optional(),
    errors: z.array(
      z.object({
        message: z.string(),
        status: z.number().optional(),
        locations: z.array(
          z.object({
            line: z.number(),
            column: z.number(),
          })
        ).optional(),
        path: z.array(z.string()).optional(),
        extensions: z.object({
          code: z.string().optional(),
        }).passthrough().optional(),
      })
    ).optional(),
  });

/**
 * Specific response schemas for common AniList queries
 */

/** Single Media Query Response */
export const AniListMediaQueryResponseSchema = createAniListGraphQLResponseSchema(
  z.object({
    Media: AniListMediaSchema.nullable(),
  })
);

export type AniListMediaQueryResponse = z.infer<typeof AniListMediaQueryResponseSchema>;

/** Media Search Response */
export const AniListMediaSearchResponseSchema = createAniListGraphQLResponseSchema(
  z.object({
    Page: AniListMediaPageSchema.nullable(),
  })
);

export type AniListMediaSearchResponse = z.infer<typeof AniListMediaSearchResponseSchema>;
