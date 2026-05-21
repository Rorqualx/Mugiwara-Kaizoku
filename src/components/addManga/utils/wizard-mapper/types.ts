/**
 * Wizard to Manga Input Mapper - Type Definitions
 *
 * Shared type definitions for the wizard-to-manga-input mapper modules.
 * This module defines the structure of data passed to the manga.add mutation,
 * ensuring all selected wizard data is properly formatted for database insertion.
 *
 * Extracted from: wizardToMangaInputMapper.ts (lines 153-192)
 *
 * @module components/addManga/utils/wizard-mapper/types
 */

/**
 * Volume data structure used in wizard mapper
 */
export interface Volume {
  number: number;
  title: string;
  chapters?: unknown[];
  coverImage?: string;
  releaseDate?: string;
  pages?: number;
  volumeNumber?: number;
  coverImageUrl?: string;
  summary?: string;
  description?: string;
  volumeSummary?: string;
  chapterCount?: number;
}

/**
 * Input type for the manga.add mutation (matches addMangaSchema in tRPC router)
 *
 * This interface represents the complete data structure required to create a new manga
 * entry in the database. It includes required fields for basic manga identification,
 * optional metadata for rich information display, and provider-specific data for
 * future refresh operations.
 *
 * @property {string} title - Primary title of the manga (required)
 * @property {string} source - Provider name (e.g., 'anilist', 'fandom', 'comicvine')
 * @property {number} libraryId - ID of the library to add manga to
 * @property {'never' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'} [interval] - Monitoring interval for new releases
 * @property {string} mangaId - Unique identifier from the source provider
 * @property {string} [searchProvider] - Provider used for initial search (may differ from source)
 * @property {object} [metadata] - Rich metadata fields
 * @property {unknown} [rawProviderData] - Raw provider-specific data (volumes, chapters, etc.)
 * @property {unknown} [providerMetadata] - Provider metadata with import profile
 * @property {boolean} [mlCorrected] - Whether ML corrections were applied
 * @property {string} [selectedSourceId] - JSON-encoded source ID mapping
 * @property {number} [metadataConfidence] - Confidence score for metadata quality (0-1)
 * @property {unknown} [downloadConfig] - Download configuration for automation
 */
export interface MangaAddInput {
  // === Required Core Fields ===
  /** Primary title of the manga */
  title: string;

  /** Provider name (e.g., 'anilist', 'fandom', 'comicvine') */
  source: string;

  /** ID of the library to add manga to */
  libraryId: number;

  /** Unique identifier from the source provider */
  mangaId: string;

  // === Optional Configuration ===
  /** Monitoring interval for new releases */
  interval?: 'never' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

  /** Provider used for initial search (may differ from source) */
  searchProvider?: string;

  // === Metadata Fields ===
  /** Rich metadata for display and organization */
  metadata?: {
    // --- Images ---
    /** Primary cover image URL */
    cover?: string;

    /** High-resolution cover image URL */
    coverLarge?: string;

    /** Banner/header image URL (null if explicitly disabled) */
    bannerImage?: string | null;

    // --- Textual Information ---
    /** Description/synopsis of the manga */
    description?: string;

    /** Publication status (e.g., 'Ongoing', 'Completed', 'Hiatus') */
    status?: string;

    /** Content format (e.g., 'Manga', 'Manhwa', 'Comic') */
    format?: string;

    /** Publisher name */
    publisher?: string;

    /** Country of origin (ISO 3166-1 alpha-2 code) */
    countryOfOrigin?: string;

    // --- Counts ---
    /** Total number of volumes (null if unknown) */
    volumes?: number | null;

    /** Total number of chapters (null if unknown) */
    chapters?: number | null;

    // --- Dates ---
    /** Publication start date (ISO 8601 format) */
    startDate?: string;

    /** Publication end date (ISO 8601 format, if completed) */
    endDate?: string;

    // --- Scores and Popularity ---
    /** Average user score (0-100) */
    averageScore?: number;

    /** Popularity ranking or count */
    popularity?: number;

    // --- External Identifiers ---
    /** MyAnimeList ID */
    idMal?: number;

    // --- Arrays ---
    /** Genre classifications */
    genres?: string[];

    /** Content tags for detailed categorization */
    tags?: string[];

    /** Author names */
    authors?: string[];

    /** Artist/illustrator names */
    artists?: string[];

    /** Alternative titles in various languages */
    alternativeTitles?: string[];

    /** Synonyms and alternative names */
    synonyms?: string[];

    /** External URLs (legacy format) */
    urls?: string[];

    /** External links with site names */
    externalLinks?: Array<{ url: string; site: string }>;

    // --- Provider-Specific ---
    /** Dynamic sections for provider-specific data (e.g., Fandom infoboxes) */
    dynamicSections?: unknown;
  };

  // === Provider-Specific Data ===
  /**
   * Raw provider data including volumes, chapters, and media selections
   * Structure varies by provider but typically includes:
   * - volumes: Volume[] - Detailed volume information
   * - selectedVolumes: (number | string)[] - User-selected volumes
   * - selectedChapters: unknown[] - User-selected chapters
   * - volumeCovers: unknown[] - Cover images for volumes
   * - providerMetadata: Record<string, ProviderMetadata> - Multi-provider metadata
   * - importProfile: object - Import configuration for refresh operations
   */
  rawProviderData?: unknown;

  /**
   * Provider metadata with import profile for field-level tracking
   * Includes field selections, source mappings, and refresh URLs
   */
  providerMetadata?: unknown;

  // === ML and Confidence Tracking ===
  /** Whether ML corrections were applied during import */
  mlCorrected?: boolean;

  /** Confidence score for metadata quality (0-1 scale) */
  metadataConfidence?: number;

  /** JSON-encoded mapping of provider names to source IDs */
  selectedSourceId?: string;

  // === Automation Configuration ===
  /** Download configuration for automated chapter downloads */
  downloadConfig?: unknown;

  // === Local File Path ===
  /** Local path to the manga folder (from scan results) */
  localPath?: string;
}
