/**
 * Manga Router Validation Schemas
 *
 * Zod validation schemas for all manga router procedures.
 * Used for input validation in tRPC procedures.
 *
 * Extracted from: helpers.ts (lines 118-238)
 */

import { z } from 'zod';

// ============================================================================
// Input Validation Schemas
// ============================================================================

export const includeSchema = z.object({
  library: z.boolean().optional(),
  metadata: z.boolean().optional(),
  chapters: z.boolean().optional(),
}).optional();

export const idSchema = z.object({
  id: z.number()
});

export const mangaIdSchema = z.object({
  mangaId: z.number()
});

export const bindSchema = z.object({
  mangaId: z.number(),
  anilistId: z.string(),
  title: z.string(),
  detail: z.string()
});

export const downloadSchema = z.object({
  mangaId: z.number(),
  chapterIndex: z.number().optional()
});

export const searchSchema = z.object({
  source: z.string().min(1),
  keyword: z.string().min(1)
});

export const providerConfirmationSearchSchema = z.object({
  title: z.string(),
  providers: z.array(z.string())
});

export const bindProviderSchema = z.object({
  mangaId: z.number(),
  provider: z.enum(['comicvine', 'fandom', 'wikipedia', 'anilist', 'mangadex']),
  providerId: z.string(),
  fetchMetadata: z.boolean().optional().default(true)
});

export const mergeMetadataFromProvidersSchema = z.object({
  mangaId: z.number(),
  fieldSelections: z.array(z.object({
    field: z.string(),
    provider: z.string(),
    value: z.unknown()
  }))
});

export const addMangaSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  source: z.string().min(1, 'Source is required'),
  searchProvider: z.string().optional(),
  interval: z.string().optional(),
  mangaId: z.string().optional(),
  libraryId: z.number(),
  metadata: z.object({
    cover: z.string().nullable().optional(),
    coverLarge: z.string().nullable().optional(),
    bannerImage: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    genres: z.array(z.string()).optional(),
    volumes: z.number().nullable().optional(),
    chapters: z.number().nullable().optional(),
    urls: z.array(z.string()).optional(),
    sourceId: z.string().optional(),
    alternativeTitles: z.array(z.string()).optional(),
    authors: z.array(z.string()).optional(),
    artists: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    format: z.string().nullable().optional(),
    idMal: z.number().nullable().optional(),
    averageScore: z.number().nullable().optional(),
    popularity: z.number().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    countryOfOrigin: z.string().nullable().optional(),
    publisher: z.string().nullable().optional(),
    externalLinks: z.array(z.object({
      url: z.string(),
      site: z.string()
    })).optional(),
    synonyms: z.array(z.string()).optional(),
    chapterUrls: z.array(z.string()).optional(),
    shouldFetchChapterDetails: z.boolean().optional(),
    sourceUrl: z.string().optional(),
    volumesUrl: z.string().optional(),
    dynamicSections: z.record(z.string()).optional()
  }).optional(),
  mlCorrected: z.boolean().optional(),
  selectedSourceId: z.string().optional(),
  metadataConfidence: z.number().optional(),
  providerMetadata: z.union([z.array(z.object({
    providerId: z.string(),
    externalId: z.union([z.string(), z.number()]),
    metadata: z.record(z.unknown())
  })), z.record(z.unknown())]).optional(),
  rawProviderData: z.record(z.unknown()).optional(),
  downloadConfig: z.object({
    autoDownload: z.boolean().optional(),
    downloadQuality: z.string().optional(),
    startChapter: z.number().optional(),
    endChapter: z.number().optional()
  }).optional()
});

export const updateProviderPreferencesSchema = z.object({
  id: z.number(),
  preferences: z.record(z.object({
    provider: z.string(),
    value: z.unknown()
  }))
});
