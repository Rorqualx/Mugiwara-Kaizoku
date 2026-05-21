/**
 * Chapter Creation Types
 *
 * Type definitions for chapter creation operations.
 * Used across all chapter-creation modules for consistent data structures.
 */

/**
 * Type for chapter data to be created in database
 *
 * Contains all fields required for Prisma chapter.createMany operations.
 * Used throughout the chapter creation pipeline.
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
 * Type for chapter enrichment data from providers (e.g., Fandom)
 *
 * Maps chapter numbers to enrichment data that supplements
 * the primary chapter information from sources like ComicVine.
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

/**
 * Normalized volume data interface
 *
 * Provides a common structure regardless of provider.
 * Used to standardize volume data from ComicVine, Fandom, AniList, Wikipedia, etc.
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
 * Result from pre-parsed handler
 *
 * Contains chapters created and updated global index for sequential processing.
 */
export interface PreParsedHandlerResult {
  chapters: ChapterToCreate[];
  globalChapterIndex: number;
}

/**
 * Result from fallback handler
 *
 * Contains estimated chapters and updated global index.
 */
export interface FallbackHandlerResult {
  chapters: ChapterToCreate[];
  globalChapterIndex: number;
}

/**
 * Function type for parsing chapters from description
 *
 * Used by description parser handler for ComicVine chapter extraction.
 */
export type ParseChaptersFromDescriptionFn = (desc: string | undefined) => Array<{
  chapterNumber: number;
  title?: string;
}>;
