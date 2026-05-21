/**
 * Zod schemas for localStorage data
 *
 * Used for validating JSON.parse() data from localStorage
 */

import { z } from 'zod';

/**
 * Recent search history
 */
export const RecentSearchSchema = z.object({
  query: z.string(),
  timestamp: z.number(),
  type: z.enum(['manga', 'chapter', 'general']).optional(),
});

export const RecentSearchesSchema = z.array(RecentSearchSchema);

export type RecentSearch = z.infer<typeof RecentSearchSchema>;
export type RecentSearches = z.infer<typeof RecentSearchesSchema>;

/**
 * Reading progress stored in localStorage
 */
export const LocalReadingProgressSchema = z.object({
  chapterId: z.number(),
  mangaId: z.number(),
  currentPage: z.number(),
  totalPages: z.number(),
  lastReadAt: z.number(), // timestamp
  scrollPosition: z.number().optional(),
});

export type LocalReadingProgress = z.infer<typeof LocalReadingProgressSchema>;

/**
 * Genre blacklist data
 */
export const GenreBlacklistDataSchema = z.object({
  blacklistedGenres: z.array(z.string()),
  lastUpdated: z.number(),
  version: z.number().optional(),
});

export type GenreBlacklistData = z.infer<typeof GenreBlacklistDataSchema>;

/**
 * Theme configuration
 */
export const ThemeConfigSchema = z.object({
  colorScheme: z.enum(['light', 'dark', 'auto']),
  primaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  compactMode: z.boolean().optional(),
  animations: z.boolean().optional(),
});

export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

/**
 * User preferences
 */
export const UserPreferencesSchema = z.object({
  readingMode: z.enum(['single', 'double', 'continuous']).optional(),
  readingDirection: z.enum(['ltr', 'rtl']).optional(),
  autoBookmark: z.boolean().optional(),
  showChapterTitles: z.boolean().optional(),
  notifications: z.object({
    newChapters: z.boolean().optional(),
    updates: z.boolean().optional(),
    system: z.boolean().optional(),
  }).optional(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/**
 * Add manga wizard state
 */
export const AddMangaWizardStateSchema = z.object({
  step: z.number(),
  selectedProvider: z.string().optional(),
  searchQuery: z.string().optional(),
  selectedManga: z.object({
    id: z.union([z.string(), z.number()]),
    title: z.string(),
    coverImage: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
  lastSaved: z.number(),
});

export type AddMangaWizardState = z.infer<typeof AddMangaWizardStateSchema>;

/**
 * Generic localStorage wrapper
 */
export const LocalStorageItemSchema = z.object({
  value: z.unknown(),
  timestamp: z.number(),
  version: z.number().optional(),
  expiresAt: z.number().optional(),
});

export type LocalStorageItem<T = unknown> = {
  value: T;
  timestamp: number;
  version?: number;
  expiresAt?: number;
};

/**
 * Safe parsers
 */
export function parseRecentSearches(data: unknown): RecentSearches | null {
  const result = RecentSearchesSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Recent searches validation failed:', result.error.issues);
  return null;
}

export function parseLocalReadingProgress(data: unknown): LocalReadingProgress | null {
  const result = LocalReadingProgressSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Reading progress validation failed:', result.error.issues);
  return null;
}

export function parseGenreBlacklistData(data: unknown): GenreBlacklistData | null {
  const result = GenreBlacklistDataSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Genre blacklist validation failed:', result.error.issues);
  return null;
}

export function parseThemeConfig(data: unknown): ThemeConfig | null {
  const result = ThemeConfigSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Theme config validation failed:', result.error.issues);
  return null;
}

export function parseAddMangaWizardState(data: unknown): AddMangaWizardState | null {
  const result = AddMangaWizardStateSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Add manga wizard state validation failed:', result.error.issues);
  return null;
}

/**
 * Generic localStorage item parser
 */
export function parseLocalStorageItem<T>(
  data: unknown,
  valueSchema: z.ZodType<T>
): LocalStorageItem<T> | null {
  const result = LocalStorageItemSchema.safeParse(data);
  if (!result.success) {
    console.error('localStorage item validation failed:', result.error.issues);
    return null;
  }

  const valueResult = valueSchema.safeParse(result.data.value);
  if (!valueResult.success) {
    console.error('localStorage item value validation failed:', valueResult.error.issues);
    return null;
  }

  return {
    ...result.data,
    value: valueResult.data,
  };
}
