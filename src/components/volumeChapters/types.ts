/**
 * Type Definitions for Volume Chapters Components
 *
 * Contains all TypeScript interfaces and types used across the volumeChapters module.
 * Supports multi-provider metadata from AniList, ComicVine, Fandom, and Wikipedia.
 *
 * Extracted from: volumeChaptersTable.tsx
 */

import type { ID } from '@/types/common';

import type { VolumeTuple } from '../virtualizedVolumeList';
import type { ProgressMap } from './hooks/reading-progress';
import type { FileVerificationMap } from './utils';
import type { Chapter } from "@prisma/client";

/**
 * Slim chapter type representing only the fields needed by detail page UI.
 * The server `get` procedure uses a select to return only these 18 fields
 * instead of all 51, reducing payload by ~80% for large manga.
 *
 * Using Pick<Chapter> ensures structural compatibility:
 * - Full `Chapter` objects are assignable to `ChapterListItem` (has all these fields + more)
 * - Components accepting `ChapterListItem` work with both full and slim data
 */
export type ChapterListItem = Pick<Chapter,
  | 'id' | 'title' | 'index' | 'chapterNumber' | 'downloadStatus' | 'monitored'
  | 'pageCount' | 'releaseDate' | 'fileName' | 'volume' | 'coverImage' | 'description'
  | 'size' | 'mangaId' | 'isRead' | 'filePath' | 'downloadUrl' | 'mangadexId'
  | 'alternativeTitles'
>;

/**
 * Interface for chapter data nested within volume data
 */
export interface ChapterDataInVolume {
    index?: number;
    chapterNumber?: number;
    number?: number;
    title?: string;
    name?: string;
    chapterTitle?: string;
    coverImageUrl?: string;
    coverUrl?: string;
    cover?: string;
    coverImage?: string;
    description?: string;
    synopsis?: string;
    summary?: string;
    pageCount?: number;
    pages?: number;
    releaseDate?: string;
}

/**
 * Interface for parsed provider metadata structure
 * Supports dynamic provider data from various sources
 */
export interface ParsedProviderMetadata {
    importProfile?: {
        chapterSource?: string;
        primarySource?: string;
        volumeSource?: string;
    };
    comicvine?: {
        rawData?: {
            issues?: unknown[];
        };
        metadata?: {
            issues?: unknown[];
        };
        volumeData?: unknown[];
    };
    wikipedia_chapters?: {
        volumeList?: unknown[];
        chapters?: unknown[];
    };
    fandom?: {
        volumeData?: unknown[];
    };
    anilist?: {
        volumeData?: unknown[];
    };
    // Dynamic provider keys
    [key: string]: unknown;
}

/**
 * Interface for volume data from various providers
 * Supports multiple property naming conventions to handle data from:
 * - ComicVine (issueNumber, issue_number, cover_date, store_date)
 * - Fandom (volumeTitle, volumeName, volumeSummary)
 * - AniList (basic volume/chapter counts)
 * - Wikipedia (simplified structure)
 */
export interface VolumeData {
    // Volume identifiers
    volumeNumber?: number;
    number?: number;

    // Titles (various naming conventions)
    volumeTitle?: string;
    name?: string;
    volumeName?: string;
    title?: string;

    // Cover images (various naming conventions)
    coverImage?: string;
    coverImageUrl?: string;
    coverUrl?: string;
    cover?: string;

    // Descriptions (various naming conventions)
    volumeSummary?: string;
    description?: string;
    summary?: string;
    synopsis?: string;

    // Dates (various naming conventions)
    releaseDate?: string;
    publishDate?: string;
    publish_date?: string;
    cover_date?: string;
    storeDate?: string;
    store_date?: string;

    // Issue-specific (ComicVine)
    issueNumber?: number;
    issue_number?: number;

    // Nested data
    chapters?: ChapterDataInVolume[];

    // Additional metadata
    publisher?: string;
    pageCount?: number;
    page_count?: number;
    sourceUrl?: string;
    url?: string;
    site_detail_url?: string;

    // ComicVine image object
    image?: {
        medium_url?: string;
        screen_url?: string;
        small_url?: string;
        thumb_url?: string;
        original_url?: string;
    };
}

/**
 * Metadata about volumes and chapters from manga
 */
export interface MangaVolumeMetadata {
    /** Number of volumes in the manga */
    volumes?: number | null;
    /** Number of chapters in the manga */
    chapters?: number | null;
}

/**
 * Simplified manga structure for volume grouping
 */
export interface MangaForVolumeGrouping {
    /** Chapters associated with this manga */
    chapters: Chapter[];
    /** Source of the manga data (e.g., 'anilist', 'comicvine') */
    source?: string;
    /** Title of the manga */
    title?: string;
    /** Additional metadata about volumes and chapters */
    metadata?: MangaVolumeMetadata | null;
    /** Provider metadata for extracting additional info */
    providerMetadata?: unknown;
}

/**
 * Base props shared between different expansion control scenarios
 */
interface VolumeChaptersTableBaseProps {
    /** Volume number to display */
    volumeNumber: number;
    /** Array of chapters in this volume */
    chapters: Chapter[];
    /** Manga ID for download context */
    mangaId?: number | undefined;
    /** Manga title for download context */
    mangaTitle?: string | undefined;
    /** Callback for toggling chapter monitoring */
    onToggleMonitoring?: (chapterId: ID, monitored: boolean) => void;
    /** Callback for automatic chapter search */
    onAutoSearch?: (chapterId: ID) => void;
    /** Callback for manual chapter search */
    onManualSearch?: (chapterId: ID) => void;
    /** Optional custom volume title */
    volumeTitle?: string | null;
    /** Optional chapter range string (e.g., "1-4") */
    chapterRange?: string | null;
    /** Optional volume cover URL */
    volumeCover?: string | null;
    /** Optional enriched volume data from wizard */
    volumeData?: VolumeData | null;
    /** Optional provider metadata for extracting additional chapter info */
    providerMetadata?: string | Record<string, unknown> | null | undefined;
    /** Selected source provider (e.g., 'fandom', 'anilist', 'comicvine') */
    selectedSource?: string;
    /** Optional callback when chapter is clicked (for external modal management) */
    onChapterClick?: (chapter: Chapter, enrichedChapter: Chapter) => void;
    /** Optional callback to trigger force refresh */
    onForceRefresh?: () => void;
    /** Parent-level progress map to avoid N+1 queries */
    parentProgressMap?: ProgressMap | undefined;
    /** Parent-level file verification to avoid N+1 queries */
    parentFileVerification?: FileVerificationMap | undefined;
}

/**
 * Props for the VolumeChaptersTable component
 * Using discriminated union to handle different expansion control scenarios
 */
export type VolumeChaptersTableProps = (VolumeChaptersTableBaseProps & {
    /** Global expansion state, applied to all volumes */
    allExpanded: boolean;
}) | (VolumeChaptersTableBaseProps & {
    /** Component manages its own expansion state */
    allExpanded?: undefined;
});

/**
 * Props for the VolumeGroupedChapters component
 */
export interface VolumeGroupedChaptersProps {
    /** Manga data with chapters and metadata */
    manga: MangaForVolumeGrouping;
    /** Manga ID from router - use this instead of deriving from chapters to prevent stale data */
    mangaId?: number;
    /** Callback for toggling chapter monitoring */
    onToggleMonitoring?: (chapterId: ID, monitored: boolean) => void;
    /** Callback for automatic chapter search */
    onAutoSearch?: (chapterId: ID) => void;
    /** Callback for manual chapter search */
    onManualSearch?: (chapterId: ID) => void;
    /** Optional callback when chapter is clicked (for external modal management) */
    onChapterClick?: (chapter: Chapter, enrichedChapter: Chapter) => void;
    /** Optional callback to trigger force refresh */
    onForceRefresh?: () => void;
    /** Optional volume titles from provider metadata */
    volumeTitles?: Record<number, string>;
    /** Optional volume covers from raw provider data */
    volumeCovers?: Record<number, string>;
    /** Optional enriched volume data from wizard (raw provider data) */
    enrichedVolumeData?: unknown[];
    /** Raw provider data from wizard containing enriched volume/chapter info */
    rawProviderData?: unknown;
    /** Optional provider metadata for extracting additional info */
    providerMetadata?: unknown;
    /** Selected sources from manga */
    selectedSourceId?: unknown;
    /** Parent-level progress map to avoid N+1 queries */
    parentProgressMap?: ProgressMap | undefined;
    /** Parent-level file verification to avoid N+1 queries */
    parentFileVerification?: FileVerificationMap | undefined;
}

/**
 * Result of the placeholder chapter generation
 */
export type PlaceholderVolumeMap = Map<number, Chapter[]>;

/**
 * Async state for volume processing
 */
export interface VolumeProcessingState {
    /** Array of volume tuples containing volume number and chapters */
    volumes: VolumeTuple[];
    /** Stats about the volumes and chapters */
    stats: {
        /** Total number of volumes */
        volumeCount: number;
        /** Total number of chapters */
        chapterCount: number;
        /** Metadata volume count (if available) */
        metadataVolumes?: number;
        /** Metadata chapter count (if available) */
        metadataChapters?: number;
    };
}
