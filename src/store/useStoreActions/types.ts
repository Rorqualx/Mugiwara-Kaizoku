/**
 * Store Actions Types Module
 *
 * Type definitions for the useStoreActions hook.
 * Contains all shared types, interfaces, and type aliases.
 *
 * Extracted from: useStoreActions.ts
 *
 * @module store/useStoreActions/types
 */

import type { Prisma, Manga, Chapter } from '@prisma/client';

// Re-export Prisma types for convenience
export type { Manga, Chapter } from '@prisma/client';

/**
 * Manga type with all related entities included
 *
 * Represents a complete manga record with:
 * - Metadata information
 * - Library relationship
 * - Chapter relationships
 */
export type MangaWithRelations = Prisma.MangaGetPayload<{
  include: {
    Metadata: true;
    Library: true;
    Chapter: true;
  };
}>;

/**
 * Updated manga type with specific relationship handling
 *
 * Extends the base manga type with:
 * - Chapter relationships
 * - Out of sync chapter tracking
 * - Monitoring configuration
 */
export type UpdatedManga = Omit<Manga, 'monitoringConfig'> & {
  chapters: Chapter[];
  outOfSyncChapters: Array<Omit<Chapter, 'manga' | 'chapter'>>;
  monitoringConfig: unknown;
};

/**
 * Valid keys for integration settings
 * Used for type-safe updates to integration configurations
 */
export type IntegrationSettingKey = 'enabled' | 'host' | 'user' | 'password' | 'libraries';

/**
 * Settings update input type
 *
 * Represents the payload for updating a setting value
 */
export interface SettingsUpdateInput {
  key: string;
  value: string | boolean | number;
}

/**
 * Return type for useStoreActions hook
 *
 * Combines all store actions with custom handlers
 * Note: Uses Record<string, unknown> to avoid conflicts between store methods with same names but different signatures
 */
export type UseStoreActionsReturn = Record<string, unknown> & {
  handleUpdateManga: (id: number, updates: Partial<MangaWithRelations>) => Promise<void>;
  handleDownload: (mangaId: number, chapterIds: number[]) => Promise<void>;
  handleSync: (mangaId: number) => Promise<void>;
  handleUpdateSettings: (key: string, value: string | boolean | number) => Promise<void>;
};
