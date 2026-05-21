/**
 * Merge Tool Types
 *
 * Type definitions for the merge tool.
 */

/**
 * Provider chapter interface
 */
export interface ProviderChapter {
  chapterNumber: number;
  title?: string;
  volume?: number;
  description?: string;
  coverImage?: string;
  pages?: number;
  pageCount?: number;
  source?: string;
}

/**
 * Parameters for the merge tool
 */
export interface MergeToolParams {
  /** Type of merge to perform */
  mergeType: 'intelligent' | 'selected' | 'chapters';
  /** Manga ID to merge metadata for */
  mangaId: number;
  /** Available providers (for intelligent merge) */
  availableProviders?: string[];
  /** Selected providers mapping field->provider (for selected merge) */
  selectedProviders?: Record<string, string>;
  /** User preferences for provider priorities (for intelligent merge) */
  userPreferences?: Record<string, string[]>;
  /** Provider chapters data (for chapters merge) */
  providerChapters?: ProviderChapter[];
  /** Force refresh from APIs */
  forceRefresh?: boolean;
}