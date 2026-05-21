/**
 * Manga Detail Types
 *
 * Type definitions for manga detail display components.
 *
 * Extracted from: mangaDetail.tsx (lines 62-123)
 */

/**
 * Type definition for manga data with metadata and chapters
 *
 * Represents the complete manga entity with associated metadata
 * and chapter information for display in detail views.
 */
export type MangaWithMetadataAndChapters = {
  /** Manga ID */
  id: number;
  /** Manga title */
  title: string;
  /** Update check interval */
  interval: string;
  /** Metadata source provider */
  source: string;
  /** Search provider (e.g., 'anilist', 'mangadex') */
  searchProvider?: string;
  /** Path to manga files */
  libraryPath?: string | null;
  /** Metadata information */
  metadata: {
    /** Cover image URL */
    cover: string | null;
    /** Related URLs */
    urls: string[];
    /** Alternative titles */
    synonyms: string[];
    /** Publication status */
    status: string;
    /** Manga description */
    summary: string | null;
    /** Genre categories */
    genres: string[];
    /** Additional tags */
    tags: string[];
    /** Author names */
    authors?: string[];
    /** Primary language */
    language?: string | null;
    /** Available languages */
    languages?: string[];
    /** Quality profile name */
    qualityProfile?: string | null;
    /** Average page resolution */
    averageResolution?: string | null;
    /** Total page count */
    pageCount?: number | null;
    /** Publisher name */
    publisher?: string | null;
    /** Artist names */
    artists?: string[];
    /** Publication start date */
    startDate?: Date | null;
    /** Publication end date */
    endDate?: Date | null;
  };
  /** Chapter information */
  chapters?: {
    /** Chapter ID */
    id: number;
    /** File name */
    fileName: string | undefined;
    /** Chapter index */
    index: number;
    /** File size in bytes */
    size: number;
    /** Number of pages */
    pageCount?: number | null;
    /** Chapter title */
    title: string;
    /** Download status */
    downloadStatus?: string;
    /** Volume number */
    volume?: number | null;
  }[];
  /** Volume metadata from normalized Volume table */
  volumes?: Array<{
    id: number;
    number: number;
    title: string | null;
    coverImage: string | null;
    chapterStart: number | null;
    chapterEnd: number | null;
    totalChapters: number | null;
    releaseDate: Date | null;
    isbn: string | null;
    pageCount: number | null;
    description: string | null;
    publisher: string | null;
  }>;
};
