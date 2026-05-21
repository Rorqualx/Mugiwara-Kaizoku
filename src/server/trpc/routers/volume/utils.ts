/**
 * Volume Router - Shared Utilities
 *
 * Shared utilities, types, and Zod schemas for volume operations.
 *
 * @module server/trpc/routers/volume/utils
 */

import { z } from 'zod';

import { isObject, hasProperty } from '@/utils/type-guards';

import type { Prisma } from '@prisma/client';

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Volume format enum schema
 */
export const volumeFormatSchema = z.enum([
  'TANKOBON',
  'OMNIBUS',
  'DIGITAL',
  'MAGAZINE',
  'SPECIAL',
  'UNKNOWN',
]);

/**
 * Creator role enum schema
 */
export const creatorRoleSchema = z.enum([
  'AUTHOR',
  'ARTIST',
  'EDITOR',
  'COLORIST',
  'LETTERER',
  'COVER_ARTIST',
  'TRANSLATOR',
]);

/**
 * Volume create input schema
 */
export const volumeCreateSchema = z.object({
  mangaId: z.number().int().positive(),
  number: z.number().int().nonnegative(),
  title: z.string().max(500).optional(),
  subtitle: z.string().max(500).optional(),
  alternativeTitle: z.string().max(500).optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  isbn: z.string().max(20).optional(),
  isbn13: z.string().max(20).optional(),
  publisher: z.string().max(255).optional(),
  pageCount: z.number().int().positive().optional(),
  format: volumeFormatSchema.optional(),
  releaseDate: z.coerce.date().optional(),
  coverImage: z.string().max(1000).optional(),
  chapterStart: z.number().optional(),
  chapterEnd: z.number().optional(),
  totalChapters: z.number().int().nonnegative().optional(),
  source: z.string().max(50).optional(),
  sourceId: z.string().max(100).optional(),
  sourceUrl: z.string().max(1000).optional(),
  enrichmentTier: z.number().int().min(1).max(3).optional(),
});

/**
 * Volume update input schema
 */
export const volumeUpdateSchema = volumeCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

/**
 * Volume batch upsert schema
 */
export const volumeBatchSchema = z.object({
  mangaId: z.number().int().positive(),
  source: z.enum(['comicvine', 'fandom', 'anilist', 'wikipedia']),
  volumes: z.array(volumeCreateSchema.omit({ mangaId: true })),
});

/**
 * Volume list query schema
 */
export const volumeListSchema = z.object({
  mangaId: z.number().int().positive(),
  includeChapters: z.boolean().optional().default(false),
  includeProgress: z.boolean().optional().default(false),
  orderBy: z.enum(['number', 'releaseDate', 'createdAt']).optional().default('number'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('asc'),
});

/**
 * Volume search schema
 */
export const volumeSearchSchema = z.object({
  query: z.string().min(1).optional(),
  isbn: z.string().optional(),
  publisher: z.string().optional(),
  source: z.enum(['comicvine', 'fandom', 'anilist', 'wikipedia']).optional(),
  format: volumeFormatSchema.optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

/**
 * Progress update schema
 */
export const progressUpdateSchema = z.object({
  volumeId: z.number().int().positive(),
  chaptersRead: z.number().int().nonnegative().optional(),
  totalChapters: z.number().int().positive(),
  percentComplete: z.number().min(0).max(100).optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
});

/**
 * Creator input schema
 */
export const creatorInputSchema = z.object({
  volumeId: z.number().int().positive(),
  name: z.string().max(255),
  role: creatorRoleSchema,
});

/**
 * Character input schema
 */
export const characterInputSchema = z.object({
  volumeId: z.number().int().positive(),
  name: z.string().max(255),
  isMain: z.boolean().optional().default(false),
});

/**
 * Theme input schema
 */
export const themeInputSchema = z.object({
  volumeId: z.number().int().positive(),
  theme: z.string().max(100),
});

/**
 * Genre input schema
 */
export const genreInputSchema = z.object({
  volumeId: z.number().int().positive(),
  genre: z.string().max(100),
});

/**
 * Story arc input schema
 */
export const storyArcInputSchema = z.object({
  volumeId: z.number().int().positive(),
  arcName: z.string().max(255),
  arcOrder: z.number().int().nonnegative().optional(),
});

// ============================================================================
// Types
// ============================================================================

export type VolumeCreateInput = z.infer<typeof volumeCreateSchema>;
export type VolumeUpdateInput = z.infer<typeof volumeUpdateSchema>;
export type VolumeBatchInput = z.infer<typeof volumeBatchSchema>;
export type VolumeListInput = z.infer<typeof volumeListSchema>;
export type VolumeSearchInput = z.infer<typeof volumeSearchSchema>;
export type ProgressUpdateInput = z.infer<typeof progressUpdateSchema>;

/**
 * Volume with full relations type
 */
export type VolumeWithRelations = Prisma.VolumeGetPayload<{
  include: {
    chapters: true;
    creators: true;
    characters: true;
    themes: true;
    genres: true;
    storyArcs: true;
    progress: true;
  };
}>;

/**
 * Volume with chapters type
 */
export type VolumeWithChapters = Prisma.VolumeGetPayload<{
  include: {
    chapters: {
      orderBy: { chapterNumber: 'asc' };
    };
  };
}>;

/**
 * Volume progress with volume type
 */
export type ProgressWithVolume = Prisma.VolumeProgressGetPayload<{
  include: {
    volume: true;
  };
}>;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Remove undefined values from an object
 *
 * Prisma's exactOptionalPropertyTypes requires null instead of undefined.
 * This helper filters out undefined values before passing to Prisma.
 */
export function filterUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Get user ID from context
 *
 * Safely extracts user ID from the tRPC context using type guards.
 */
export function getUserId(ctx: unknown): string | null {
  if (!isObject(ctx) || !hasProperty(ctx, 'user')) {
    return null;
  }

  const user = ctx['user'];
  if (!isObject(user) || !hasProperty(user, 'id')) {
    return null;
  }

  const userId = user['id'];
  return typeof userId === 'string' || typeof userId === 'number'
    ? String(userId)
    : null;
}

/**
 * Build volume include object based on options
 */
export function buildVolumeInclude(options: {
  includeChapters?: boolean;
  includeProgress?: boolean;
  userId?: string | null;
}): Prisma.VolumeInclude {
  const include: Prisma.VolumeInclude = {
    creators: true,
    characters: true,
    themes: true,
    genres: true,
    storyArcs: true,
  };

  if (options.includeChapters) {
    include.chapters = {
      orderBy: { chapterNumber: 'asc' },
    };
  }

  if (options.includeProgress && options.userId) {
    include.progress = {
      where: { userId: options.userId },
    };
  }

  return include;
}
