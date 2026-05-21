/**
 * Zod schema for Raw Provider Data
 *
 * Used when parsing manga.rawProviderData from database
 * Contains raw volume/chapter data from manga providers
 */

import { z } from 'zod';

/**
 * Chapter data from provider
 */
export const ProviderChapterSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().optional(),
  chapterNumber: z.number().optional(),
  volumeNumber: z.number().optional(),
  pages: z.number().optional(),
  releaseDate: z.string().optional(),
  url: z.string().url().optional(),
});

export type ProviderChapter = z.infer<typeof ProviderChapterSchema>;

/**
 * Volume data from provider
 */
export const ProviderVolumeSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().optional(),
  volumeNumber: z.number().optional(),
  coverImage: z.string().url().optional(),
  chapters: z.array(ProviderChapterSchema).optional(),
  releaseDate: z.string().optional(),
  description: z.string().optional(),
});

export type ProviderVolume = z.infer<typeof ProviderVolumeSchema>;

/**
 * Complete raw provider data schema
 */
export const RawProviderDataSchema = z.object({
  volumes: z.array(ProviderVolumeSchema).optional(),
  chapters: z.array(ProviderChapterSchema).optional(),
  totalVolumes: z.number().optional(),
  totalChapters: z.number().optional(),
  selectedCover: z.string().url().optional(),
  selectedBanner: z.string().url().optional(),
  providerId: z.string().optional(),
  providerName: z.string().optional(),
  lastSynced: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type RawProviderData = z.infer<typeof RawProviderDataSchema>;

/**
 * Safe parser with error handling
 */
export function parseRawProviderData(data: unknown): RawProviderData | null {
  const result = RawProviderDataSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.error('RawProviderData validation failed:', result.error.issues);
  return null;
}

/**
 * Type guard for RawProviderData
 */
export function isRawProviderData(value: unknown): value is RawProviderData {
  return RawProviderDataSchema.safeParse(value).success;
}
