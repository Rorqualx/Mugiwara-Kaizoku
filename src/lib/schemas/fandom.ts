/**
 * Fandom API Zod Schemas
 *
 * This module provides Zod schemas for validating Fandom API responses.
 * These schemas ensure runtime type safety for external Fandom data.
 *
 * @module schemas/fandom
 */

import { z } from 'zod';

import {
  NullableString,
  NullableNumber,
  createDefaultArraySchema,
  createLenientSchema,
} from './common';

// ============================================================================
// MediaWiki API Schemas
// ============================================================================

/**
 * MediaWiki search result
 */
export const MediaWikiSearchResultSchema = createLenientSchema({
  pageid: z.number(),
  ns: z.number(),
  title: z.string(),
  snippet: NullableString,
  size: NullableNumber,
  wordcount: NullableNumber,
  timestamp: NullableString,
});

export type MediaWikiSearchResultValidated = z.infer<typeof MediaWikiSearchResultSchema>;

/**
 * MediaWiki revision slot
 */
export const MediaWikiRevisionSlotSchema = createLenientSchema({
  '*': z.string(),
  contentmodel: z.string(),
  contentformat: z.string(),
});

export type MediaWikiRevisionSlotValidated = z.infer<typeof MediaWikiRevisionSlotSchema>;

/**
 * MediaWiki page
 */
export const MediaWikiPageSchema = createLenientSchema({
  pageid: z.number(),
  ns: z.number(),
  title: z.string(),
  revisions: z.array(
    createLenientSchema({
      slots: createLenientSchema({
        main: MediaWikiRevisionSlotSchema.optional(),
      }).optional(),
    })
  ).optional(),
  categories: z.array(
    createLenientSchema({
      ns: z.number(),
      title: z.string(),
    })
  ).optional(),
  images: z.array(
    createLenientSchema({
      ns: z.number(),
      title: z.string(),
    })
  ).optional(),
  pageprops: createLenientSchema({
    infoboxes: NullableString,
  }).optional(),
});

export type MediaWikiPageValidated = z.infer<typeof MediaWikiPageSchema>;

/**
 * MediaWiki image info
 */
export const MediaWikiImageInfoSchema = createLenientSchema({
  url: z.string(),
  descriptionurl: z.string(),
  descriptionshorturl: z.string(),
  size: NullableNumber,
  width: NullableNumber,
  height: NullableNumber,
  thumburl: NullableString,
  thumbwidth: NullableNumber,
  thumbheight: NullableNumber,
  mime: NullableString,
});

export type MediaWikiImageInfoValidated = z.infer<typeof MediaWikiImageInfoSchema>;

/**
 * MediaWiki API response
 */
export const MediaWikiAPIResponseSchema = <T extends z.ZodTypeAny>(querySchema: T): ReturnType<typeof createLenientSchema> =>
  createLenientSchema({
    batchcomplete: NullableString,
    continue: z.record(z.string(), z.string()).optional(),
    query: querySchema.optional(),
    error: createLenientSchema({
      code: z.string(),
      info: z.string(),
      '*': NullableString,
    }).optional(),
  });

// ============================================================================
// Fandom V1 API Schemas
// ============================================================================

/**
 * Fandom V1 search item
 */
export const FandomV1SearchItemSchema = createLenientSchema({
  id: z.number(),
  title: z.string(),
  url: z.string(),
  ns: z.number(),
  quality: NullableNumber,
  snippet: NullableString,
});

export type FandomV1SearchItemValidated = z.infer<typeof FandomV1SearchItemSchema>;

/**
 * Fandom V1 article details
 */
export const FandomV1ArticleDetailsSchema = createLenientSchema({
  id: z.number(),
  title: z.string(),
  ns: z.number(),
  url: z.string(),
  type: z.string(),
  abstract: z.string(),
  thumbnail: NullableString,
  original_dimensions: createLenientSchema({
    width: z.number(),
    height: z.number(),
  }).optional(),
});

export type FandomV1ArticleDetailsValidated = z.infer<typeof FandomV1ArticleDetailsSchema>;

/**
 * Fandom V1 API response
 */
export const FandomV1APIResponseSchema = <T extends z.ZodTypeAny>(itemsSchema: T): ReturnType<typeof createLenientSchema> =>
  createLenientSchema({
    items: itemsSchema.optional(),
    basepath: NullableString,
    offset: NullableNumber,
    total: NullableNumber,
    error: createLenientSchema({
      message: z.string(),
      code: NullableNumber,
    }).optional(),
  });

// ============================================================================
// Infobox Schemas
// ============================================================================

/**
 * Infobox title item
 */
export const InfoboxTitleSchema = createLenientSchema({
  type: z.literal('title'),
  data: createLenientSchema({
    value: z.string(),
  }),
});

/**
 * Infobox data item
 */
export const InfoboxDataSchema = createLenientSchema({
  type: z.literal('data'),
  data: createLenientSchema({
    label: z.string(),
    value: z.string(),
    source: NullableString,
  }),
});

/**
 * Infobox image item
 */
export const InfoboxImageSchema = createLenientSchema({
  type: z.literal('image'),
  data: z.array(
    createLenientSchema({
      url: NullableString,
      caption: NullableString,
      source: NullableString,
    })
  ),
});

/**
 * Infobox header item
 */
export const InfoboxHeaderSchema = createLenientSchema({
  type: z.literal('header'),
  data: createLenientSchema({
    value: z.string(),
  }),
});

/**
 * Infobox item (union of all types)
 */
export const InfoboxItemSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    InfoboxTitleSchema,
    InfoboxDataSchema,
    InfoboxImageSchema,
    InfoboxHeaderSchema,
    InfoboxGroupSchema,
  ])
);

/**
 * Infobox group item (recursive)
 */
export const InfoboxGroupSchema = createLenientSchema({
  type: z.literal('group'),
  data: createLenientSchema({
    value: z.array(InfoboxItemSchema),
    layout: NullableString,
  }),
});

/**
 * Portable infobox data
 */
export const PortableInfoboxDataSchema = createLenientSchema({
  type: z.literal('infobox'),
  data: z.array(InfoboxItemSchema),
});

export type PortableInfoboxDataValidated = z.infer<typeof PortableInfoboxDataSchema>;

// ============================================================================
// Chapter & Volume Schemas
// ============================================================================

/**
 * Fandom chapter
 */
export const FandomChapterSchema = createLenientSchema({
  chapterNumber: NullableString,
  number: z.union([z.number(), z.string()]).nullable().optional(),
  title: NullableString,
  alternativeTitles: createDefaultArraySchema(z.string()),
  url: NullableString,
  coverUrl: NullableString,
  coverImage: NullableString,
  volumeNumber: NullableNumber,
  volume: NullableNumber,
  summary: NullableString,
  pages: NullableNumber,
  releaseDate: NullableString,
});

export type FandomChapterValidated = z.infer<typeof FandomChapterSchema>;

/**
 * Fandom volume
 */
export const FandomVolumeSchema = createLenientSchema({
  volumeNumber: NullableNumber,
  number: NullableNumber,
  title: NullableString,
  url: NullableString,
  coverUrl: NullableString,
  coverImage: NullableString,
  releaseDate: NullableString,
  isbn: NullableString,
  description: NullableString,
  chapterCount: NullableNumber,
  chapters: createDefaultArraySchema(FandomChapterSchema),
});

export type FandomVolumeValidated = z.infer<typeof FandomVolumeSchema>;

// ============================================================================
// Main Manga Data Schema
// ============================================================================

/**
 * Fandom manga cover art
 */
export const FandomCoverArtSchema = createLenientSchema({
  primary: NullableString,
  gallery: createDefaultArraySchema(z.string()),
  volumeCovers: createDefaultArraySchema(z.string()),
});

export type FandomCoverArtValidated = z.infer<typeof FandomCoverArtSchema>;

/**
 * Fandom serialization info
 */
export const FandomSerializationSchema = createLenientSchema({
  magazine: NullableString,
  startDate: NullableString,
  endDate: NullableString,
});

export type FandomSerializationValidated = z.infer<typeof FandomSerializationSchema>;

/**
 * Fandom staff member
 */
export const FandomStaffSchema = createLenientSchema({
  name: z.string(),
  role: z.string(),
});

export type FandomStaffValidated = z.infer<typeof FandomStaffSchema>;

/**
 * Fandom metadata
 */
export const FandomMetadataSchema = createLenientSchema({
  japaneseTitle: NullableString,
  alternativeTitles: createDefaultArraySchema(z.string()),
  author: NullableString,
  artist: NullableString,
  publisher: NullableString,
  demographic: NullableString,
  genres: createDefaultArraySchema(z.string()),
  format: NullableString,
  status: NullableString,
  startDate: NullableString,
  endDate: NullableString,
  serialization: FandomSerializationSchema.optional(),
  staff: createDefaultArraySchema(FandomStaffSchema),
});

export type FandomMetadataValidated = z.infer<typeof FandomMetadataSchema>;

/**
 * Fandom character
 */
export const FandomCharacterRefSchema = createLenientSchema({
  name: z.string(),
  role: NullableString,
  url: NullableString,
  image: NullableString,
});

export type FandomCharacterRefValidated = z.infer<typeof FandomCharacterRefSchema>;

/**
 * Fandom arc (rich format)
 */
export const FandomArcSchema = createLenientSchema({
  name: z.string(),
  chapters: createDefaultArraySchema(z.string()),
});

export type FandomArcValidated = z.infer<typeof FandomArcSchema>;

/**
 * Fandom links
 */
export const FandomLinksSchema = createLenientSchema({
  mainPage: NullableString,
  volumesPage: NullableString,
  charactersPage: NullableString,
});

export type FandomLinksValidated = z.infer<typeof FandomLinksSchema>;

/**
 * Fandom stats
 */
export const FandomStatsSchema = createLenientSchema({
  totalVolumes: NullableNumber,
  totalChapters: NullableNumber,
  lastUpdated: z.union([z.date(), z.string()]).nullable().optional(),
});

export type FandomStatsValidated = z.infer<typeof FandomStatsSchema>;

/**
 * Fandom source type
 */
export const FandomSourceSchema = z.enum(['dynamic', 'static', 'hybrid']);

export type FandomSourceValidated = z.infer<typeof FandomSourceSchema>;

/**
 * Complete Fandom manga data
 */
export const FandomMangaDataSchema = createLenientSchema({
  // Core identification
  title: z.string(),
  alternativeTitles: createDefaultArraySchema(z.string()),

  // Basic metadata
  author: NullableString,
  publisher: NullableString,
  magazine: NullableString,
  published: NullableString,
  genres: createDefaultArraySchema(z.string()),
  demographic: NullableString,
  status: NullableString,
  format: NullableString,

  // Description system
  synopsis: NullableString,
  description: NullableString,
  descriptions: z.record(z.string(), z.string()).optional(),
  reception: NullableString,

  // Cover art system
  coverImage: NullableString,
  images: createDefaultArraySchema(z.string()),
  coverArt: FandomCoverArtSchema.optional(),
  gallery: createDefaultArraySchema(z.string()),

  // Volume/Chapter counts
  volumes: NullableString,
  chapters: NullableString,
  totalChapters: NullableNumber,

  // Rich volume list
  volumeList: createDefaultArraySchema(FandomVolumeSchema),

  // Rich chapter list
  chapterList: createDefaultArraySchema(FandomChapterSchema),

  // Rich metadata
  metadata: FandomMetadataSchema.optional(),

  // Characters
  characters: createDefaultArraySchema(FandomCharacterRefSchema),

  // Story arcs (support both rich and simple formats)
  arcs: z.union([
    z.array(FandomArcSchema),
    z.array(z.string()),
  ]).optional(),

  // Links
  links: FandomLinksSchema.optional(),

  // Stats
  stats: FandomStatsSchema.optional(),

  // Legacy date fields
  startDate: NullableString,
  publishDate: NullableString,
  endDate: NullableString,
  publicationDemographic: NullableString,

  // Source tracking
  source: FandomSourceSchema.optional(),
});

export type FandomMangaDataValidated = z.infer<typeof FandomMangaDataSchema>;

// ============================================================================
// Search Result Schema
// ============================================================================

/**
 * Fandom search result type
 */
export const FandomSearchResultTypeSchema = z.enum(['manga', 'character', 'article']);

export type FandomSearchResultTypeValidated = z.infer<typeof FandomSearchResultTypeSchema>;

/**
 * Fandom search result metadata
 */
export const FandomSearchResultMetadataSchema = createLenientSchema({
  author: NullableString,
  chapters: NullableString,
  volumes: NullableString,
  status: NullableString,
  published: NullableString,
});

export type FandomSearchResultMetadataValidated = z.infer<typeof FandomSearchResultMetadataSchema>;

/**
 * Fandom search result
 */
export const FandomSearchResultSchema = createLenientSchema({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  wikiUrl: NullableString,
  type: FandomSearchResultTypeSchema,
  wiki: z.string(),
  thumbnail: NullableString,
  abstract: NullableString,
  score: NullableNumber,
  metadata: FandomSearchResultMetadataSchema.optional(),
});

export type FandomSearchResultValidated = z.infer<typeof FandomSearchResultSchema>;

// ============================================================================
// Character Data Schema
// ============================================================================

/**
 * Fandom character image
 */
export const FandomCharacterImageSchema = createLenientSchema({
  title: z.string(),
  url: z.string(),
  thumburl: NullableString,
  width: NullableNumber,
  height: NullableNumber,
});

export type FandomCharacterImageValidated = z.infer<typeof FandomCharacterImageSchema>;

/**
 * Fandom character section
 */
export const FandomCharacterSectionSchema = createLenientSchema({
  title: z.string(),
  content: z.string(),
});

export type FandomCharacterSectionValidated = z.infer<typeof FandomCharacterSectionSchema>;

/**
 * Fandom character data
 */
export const FandomCharacterDataSchema = createLenientSchema({
  basicInfo: createLenientSchema({
    name: z.string(),
    pageId: z.number(),
    url: z.string(),
  }),
  stats: z.record(z.string(), z.string()),
  images: createDefaultArraySchema(FandomCharacterImageSchema),
  categories: createDefaultArraySchema(z.string()),
  sections: createDefaultArraySchema(FandomCharacterSectionSchema),
  infobox: z.array(PortableInfoboxDataSchema).optional(),
});

export type FandomCharacterDataValidated = z.infer<typeof FandomCharacterDataSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate Fandom manga data with detailed error context
 */
export function validateFandomMangaData(data: unknown): z.SafeParseReturnType<unknown, FandomMangaDataValidated> {
  return FandomMangaDataSchema.safeParse(data);
}

/**
 * Validate Fandom search result with detailed error context
 */
export function validateFandomSearchResult(data: unknown): z.SafeParseReturnType<unknown, FandomSearchResultValidated> {
  return FandomSearchResultSchema.safeParse(data);
}

/**
 * Validate Fandom character data with detailed error context
 */
export function validateFandomCharacterData(data: unknown): z.SafeParseReturnType<unknown, FandomCharacterDataValidated> {
  return FandomCharacterDataSchema.safeParse(data);
}

/**
 * Validate MediaWiki search result with detailed error context
 */
export function validateMediaWikiSearchResult(data: unknown): z.SafeParseReturnType<unknown, MediaWikiSearchResultValidated> {
  return MediaWikiSearchResultSchema.safeParse(data);
}

/**
 * Validate Fandom volume with detailed error context
 */
export function validateFandomVolume(data: unknown): z.SafeParseReturnType<unknown, FandomVolumeValidated> {
  return FandomVolumeSchema.safeParse(data);
}

/**
 * Validate Fandom chapter with detailed error context
 */
export function validateFandomChapter(data: unknown): z.SafeParseReturnType<unknown, FandomChapterValidated> {
  return FandomChapterSchema.safeParse(data);
}
