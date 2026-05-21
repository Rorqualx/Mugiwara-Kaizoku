/**
 * Manga Router Types Module
 *
 * Core type definitions, interfaces, and constants used across
 * all manga router helper modules.
 *
 * Extracted from: helpers.ts (lines 1-116)
 */

import type { MangaMetadata as BaseMangaMetadata } from '@/types/search.types';

import type { Prisma } from '@prisma/client';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default chapter limit for manga queries - 0 means no limit
 * Manga like One Piece have 1000+ chapters, so we don't limit by default.
 * Virtual scrolling on the frontend handles large chapter lists efficiently.
 */
export const DEFAULT_CHAPTER_LIMIT = 0;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Type for manga with all relations included
 * Uses Prisma's GetPayload utility type to infer the correct type
 */
export type MangaWithRelations = Prisma.MangaGetPayload<{
  include: {
    Library: true;
    Chapter: { orderBy: { index: 'asc' }; take?: number };
    Metadata: true;
    _count: { select: { Chapter: boolean } };
  };
}>;

/**
 * Re-export the unified MangaMetadata type from type-mappings
 */
export type MangaMetadata = BaseMangaMetadata;

/**
 * Interface for search result items returned by providers
 * This helps with type safety when mapping search results
 */
export interface MangaSearchResult {
  id?: string;
  title?: string;
  cover?: string;
  coverImage?: string;
  description?: string;
  status?: string;
  alternativeTitles?: string[];
  score?: number;
  popularity?: number;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  genres?: string[];
}

/**
 * Normalized volume data interface
 * Provides a common structure regardless of provider
 */
export interface NormalizedVolume {
  volumeNumber: number;
  title?: string;
  coverImage?: string;
  downloadUrl?: string;
  releaseDate?: string;
  description?: string;
  chapters?: unknown[];
}

/**
 * Chapter to create type
 */
export type ChapterToCreate = {
  mangaId: number;
  title: string;
  alternativeTitles: string[];
  index: number;
  chapterNumber: number;
  fileName: string;
  size: number;
  downloadStatus: 'PENDING';
  volume: number | null;
  downloadUrl: string | null;
  coverImage: string | null;
  description: string | null;
  releaseDate: Date | null;
  pageCount: number | null;
  monitored: boolean;
  updatedAt: Date;
};

/**
 * Chapter enrichment type
 */
export type ChapterEnrichment = Record<number, {
  title?: string;
  summary?: string;
  coverImage?: string;
  pages?: number;
  releaseDate?: string;
  url?: string;
  alternativeTitles?: string[];
}>;
