/**
 * Library Filtering Utilities Module
 *
 * Shared type definitions and imports used across all filtering modules.
 *
 * Extracted from: filtering.ts (lines 1-20)
 */

import { ChapterStatus, MangaPublicationStatus } from '@prisma/client';

import type { SortOption, FilterOption, SearchField, AdvancedFilter } from '@/store/libraryViewSlice';



import type { Chapter, Prisma } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Type for Manga with metadata included
 */
export type MangaWithMetadata = Prisma.MangaGetPayload<{
  include: {
    Metadata: true;
    Chapter: true;
  };
}>;

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { ChapterStatus, MangaPublicationStatus };
export type { SortOption, FilterOption, SearchField, AdvancedFilter, Chapter, Prisma };
