/**
 * Chapter Detail Modal - Type Definitions
 *
 * Shared type definitions, interfaces, and re-exports
 * used across all chapter-detail-modal modules.
 *
 * Extracted from: ChapterDetailModal.tsx
 */

import type { TransmissionConfig, DelugeConfig, NZBGetConfig } from '@/types/config.types';

import type { Chapter as ChapterEntity } from '@prisma/client';

// Re-export for convenience
export type { ChapterEntity };

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Settings data structure returned from API
 */
export interface SettingsData {
  transmission?: TransmissionConfig;
  deluge?: DelugeConfig;
  nzbget?: NZBGetConfig;
  qbittorrent?: { enabled: boolean; host?: string; port?: number; username?: string; password?: string };
  [key: string]: unknown;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Sort status type from mantine-datatable
 */
export type SortStatus<T> = {
  columnAccessor: keyof T | string;
  direction: 'asc' | 'desc';
};

/**
 * Props for the ChapterDetailModal component
 */
export interface ChapterDetailModalProps {
  opened: boolean;
  onClose: () => void;
  chapter: ChapterEntity | null;
  mangaTitle?: string;
  mangaId?: number | string | undefined;
  onDownload?: (chapterId: string | number) => void;
  onRead?: (chapterId: string | number) => void;
  initialTab?: string;
}

// ============================================================================
// Search Types
// ============================================================================

/**
 * Search result type for DataTable
 */
export interface SearchResult {
  guid: string;
  protocol?: string;
  publishDate: string;
  title: string;
  indexerName: string;
  size: number;
  seeders?: number;
  leechers?: number;
  infoUrl?: string;

  // Parsed metadata from releaseParser
  languages?: string[];
  audioLanguage?: string;
  isMultiLanguage?: boolean;
  isOfficial?: boolean;
  quality?: string;
  format?: string;
  publisher?: string;
}
