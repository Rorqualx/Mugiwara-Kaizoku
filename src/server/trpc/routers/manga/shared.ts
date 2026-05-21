/**
 * Shared utilities, types, and schemas for manga router modules
 *
 * This file contains common helper functions, type guards, schemas,
 * and constants used across all manga router modules.
 */

import { z } from 'zod';

import type { Prisma } from '@prisma/client';

/**
 * Default chapter limit - set to 0 for no limit
 * Manga like One Piece have 1000+ chapters, so we don't limit by default
 * Can be overridden via query parameters for performance optimization
 */
export const DEFAULT_CHAPTER_LIMIT = 0;

/**
 * Create manga relations include with optional chapter limit
 */
export function createMangaRelations(chapterLimit?: number): {
  Library: boolean;
  Chapter: { orderBy: Array<{ chapterNumber: 'asc' } | { index: 'asc' }>; take?: number };
  Metadata: boolean;
  _count: { select: { Chapter: boolean } };
} {
  return {
    Library: true,
    Chapter: {
      orderBy: [
        { chapterNumber: 'asc' as const },
        { index: 'asc' as const },
      ],
      ...(chapterLimit && chapterLimit > 0 ? { take: chapterLimit } : {})
    },
    Metadata: true,
    _count: {
      select: {
        Chapter: true
      }
    }
  } as const;
}

/**
 * Slim chapter select - only fields needed by the list/detail page UI
 * Reduces payload from ~51 fields to ~18 fields per chapter (~80% smaller)
 */
export const chapterListSelect = {
  id: true,
  title: true,
  index: true,
  chapterNumber: true,
  downloadStatus: true,
  monitored: true,
  pageCount: true,
  releaseDate: true,
  fileName: true,
  volume: true,
  coverImage: true,
  description: true,
  size: true,
  mangaId: true,
  isRead: true,
  filePath: true,
  downloadUrl: true,
  mangadexId: true,
  alternativeTitles: true,
} as const;

export const volumeListSelect = {
  id: true,
  number: true,
  title: true,
  coverImage: true,
  chapterStart: true,
  chapterEnd: true,
  totalChapters: true,
  releaseDate: true,
  isbn: true,
  pageCount: true,
  description: true,
  publisher: true,
} as const;

/**
 * Create manga relations with slim chapter select for list views
 * Returns only the fields needed by the UI, not the full Chapter model
 */
export function createMangaRelationsSlim(chapterLimit?: number): {
  Library: boolean;
  Chapter: { select: typeof chapterListSelect; orderBy: Array<{ chapterNumber: 'asc' } | { index: 'asc' }>; take?: number };
  Volume: { select: typeof volumeListSelect; orderBy: { number: 'asc' } };
  Metadata: boolean;
  _count: { select: { Chapter: boolean } };
} {
  return {
    Library: true,
    Chapter: {
      select: chapterListSelect,
      orderBy: [
        { chapterNumber: 'asc' as const },
        { index: 'asc' as const },
      ],
      ...(chapterLimit && chapterLimit > 0 ? { take: chapterLimit } : {})
    },
    Volume: {
      select: volumeListSelect,
      orderBy: { number: 'asc' as const },
    },
    Metadata: true,
    _count: {
      select: {
        Chapter: true
      }
    }
  } as const;
}

/**
 * Default relations with standard limit
 */
export const includeMangaRelations = createMangaRelations(DEFAULT_CHAPTER_LIMIT);

/**
 * Default slim relations with standard limit
 */
export const includeMangaRelationsSlim = createMangaRelationsSlim(DEFAULT_CHAPTER_LIMIT);

/**
 * Type for manga with all relations included
 * Uses Prisma's GetPayload utility type to infer the correct type
 */
export type MangaWithRelations = Prisma.MangaGetPayload<{
  include: typeof includeMangaRelations;
}>;

/**
 * Type for manga with slim chapter data (only UI-needed fields)
 * Used by the `get` procedure for detail page rendering
 */
export type MangaWithSlimChapters = Prisma.MangaGetPayload<{
  include: typeof includeMangaRelationsSlim;
}>;

/**
 * Slim chapter type with only the fields needed by UI components
 * Alias for a single chapter element from MangaWithSlimChapters
 */
export type ChapterListItem = MangaWithSlimChapters['Chapter'][number];

/**
 * Helper function to safely access properties on unknown objects
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Helper function to safely get a string value from an unknown object
 */
export function safeGetString(obj: unknown, key: string, defaultValue: string = ''): string {
  const value = safeGet(obj, key);
  return typeof value === 'string' ? value : defaultValue;
}

/**
 * Helper function to safely get a number value from an unknown object
 */
export function safeGetNumber(obj: unknown, key: string, defaultValue: number = 0): number {
  const value = safeGet(obj, key);
  return typeof value === 'number' ? value : defaultValue;
}

/**
 * Helper function to safely get a string value or undefined (for use with ??)
 */
export function safeGetStringOptional(obj: unknown, key: string): string | undefined {
  const value = safeGet(obj, key);
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  return undefined;
}

/**
 * Helper function to safely parse a number from unknown value
 */
export function parseNumber(value: unknown, defaultValue: number): number {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Type guard for objects
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Zod schemas for input validation
 */
export const includeSchema = z.object({
  library: z.boolean().optional(),
  metadata: z.boolean().optional(),
  chapters: z.boolean().optional(),
  volumes: z.boolean().optional(),
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
  provider: z.enum(['comicvine', 'fandom', 'wikipedia', 'anilist', 'mangaupdates', 'mangadex', 'mal', 'kitsu']),
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
  /** Optional local path to the manga folder (from scan results) */
  localPath: z.string().optional(),
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
