/**
 * Volume Detail Modal Types
 *
 * Type definitions and interfaces for the VolumeDetailModal component
 * and its sub-components.
 *
 * Extracted from: VolumeDetailModal.tsx (lines 59-123)
 */

import type { TransmissionConfig, DelugeConfig, NZBGetConfig } from '@/types/config.types';

// ============================================================================
// API/Settings Types
// ============================================================================

/**
 * Settings data structure returned from API
 * Contains configuration for various download clients
 */
export interface SettingsData {
  /** Transmission client configuration */
  transmission?: TransmissionConfig;
  /** Deluge client configuration */
  deluge?: DelugeConfig;
  /** NZBGet client configuration */
  nzbget?: NZBGetConfig;
  /** qBittorrent client configuration */
  qbittorrent?: { enabled: boolean; host?: string; port?: number; username?: string; password?: string };
  /** Allow additional settings properties */
  [key: string]: unknown;
}

// ============================================================================
// Volume Data Types
// ============================================================================

/**
 * Volume data structure containing information about a manga volume
 */
export interface VolumeData {
  /** Volume number in the series */
  volumeNumber: number;
  /** Title of the volume */
  title?: string;
  /** URL to the volume cover image */
  coverImage?: string;
  /** Volume description text */
  description?: string;
  /** Original release date */
  releaseDate?: Date | string;
  /** Store/publication date */
  storeDate?: Date | string;
  /** Issue number identifier */
  issueNumber?: string;
  /** List of chapters in this volume */
  chapters?: Array<{
    index: number;
    title: string;
    number?: string;
  }>;
  /** Publisher name */
  publisher?: string;
  /** Total page count */
  pageCount?: number;
  /** URL to the source/external link */
  sourceUrl?: string;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for the VolumeDetailModal component
 */
export interface VolumeDetailModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Volume data to display */
  volume: VolumeData | null;
  /** ID of the manga this volume belongs to */
  mangaId?: number | undefined;
  /** Title of the manga */
  mangaTitle?: string;
  /** Callback when a chapter is clicked */
  onChapterClick?: (chapterIndex: number) => void;
  /** Control which tab opens initially ('details', 'chapters', or 'search') */
  initialTab?: string;
}

// ============================================================================
// Search Types
// ============================================================================

/**
 * Search result type for DataTable display
 */
export interface SearchResult {
  /** Unique identifier for the result */
  guid: string;
  /** Protocol type (e.g., 'torrent', 'usenet') */
  protocol?: string;
  /** Publication date of the release */
  publishDate: string;
  /** Title of the release */
  title: string;
  /** Name of the indexer that found this result */
  indexerName: string;
  /** File size in bytes */
  size: number;
  /** Number of seeders (for torrents) */
  seeders?: number;
  /** Number of leechers (for torrents) */
  leechers?: number;
  /** URL to more information about this release */
  infoUrl?: string;

  // Parsed metadata from releaseParser
  /** Languages included in the release */
  languages?: string[];
  /** Primary audio language */
  audioLanguage?: string;
  /** Whether the release contains multiple languages */
  isMultiLanguage?: boolean;
  /** Whether this is an official release */
  isOfficial?: boolean;
  /** Quality designation (e.g., 'Digital', 'Scan') */
  quality?: string;
  /** File format (e.g., 'CBZ', 'PDF') */
  format?: string;
  /** Publisher of the release */
  publisher?: string;
}

/**
 * Sort status type for mantine-datatable
 * Tracks which column is being sorted and in what direction
 */
export type SortStatus<T> = {
  /** The column accessor being sorted */
  columnAccessor: keyof T | string;
  /** Sort direction */
  direction: 'asc' | 'desc';
};
