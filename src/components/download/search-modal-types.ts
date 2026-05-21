/**
 * Unified Search Modal Types
 *
 * Type definitions and helper functions for the UnifiedSearchModal component.
 *
 * @module search-modal-types
 */

import type { TransmissionConfig, DelugeConfig, NZBGetConfig } from '@/types/config.types';

import type { DownloadContext } from './DownloadButton';
import type { ChapterStatus } from '@prisma/client';

/**
 * Sort status type from mantine-datatable
 */
export type SortStatus<T> = {
  columnAccessor: keyof T | string;
  direction: 'asc' | 'desc';
};

/**
 * Settings data structure returned from API
 */
export interface SettingsData {
  transmission?: TransmissionConfig;
  deluge?: DelugeConfig;
  nzbget?: NZBGetConfig;
  qbittorrent?: { enabled: boolean; host?: string; port?: number; username?: string; password?: string };
  prowlarrBaseURL?: string;
  prowlarrApiKey?: string;
  [key: string]: unknown;
}

/**
 * Backend search result from manga.searchProwlarr
 */
export interface BackendSearchResult {
  id: string;
  title: string;
  indexer: string;
  size?: number;
  seeders?: number;
  leechers?: number;
  Chapter?: number[];
  publishDate?: string;
  relevanceScore?: number;
  infoUrl?: string;
  languages?: string[];
  audioLanguage?: string;
  isMultiLanguage?: boolean;
  isOfficial?: boolean;
  quality?: string;
  format?: string;
  publisher?: string;
}

/**
 * Enriched search result with calculated fields
 */
export interface EnrichedSearchResult {
  id: string;
  title: string;
  indexer: string;
  size: number;
  seeders: number;
  leechers: number;
  chapters: number[];
  publishDate?: string;
  coveragePercent: number;
  includedMissing: number[];
  relevanceScore: number;
  infoUrl?: string;
  languages?: string[];
  audioLanguage?: string;
  isMultiLanguage?: boolean;
  isOfficial?: boolean;
  quality?: string;
  format?: string;
  publisher?: string;
}

/**
 * Props for UnifiedSearchModal
 */
export interface UnifiedSearchModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** The download context (determines search behavior) */
  context: DownloadContext;
  /** Callback when download succeeds */
  onSuccess?: (() => void) | undefined;
}

/**
 * Get initial search query based on context
 */
export function getInitialQuery(context: DownloadContext): string {
  const mangaTitle = context.manga.title;

  switch (context.type) {
    case 'manga':
      return mangaTitle;
    case 'volume':
      return `${mangaTitle} Vol ${context.volumeNumber}`;
    case 'chapter':
      // index is always available (non-nullable Int in schema)
      return `${mangaTitle} Chapter ${context.chapter.index}`;
    default: {
      // Exhaustive check - should never reach here
      const _exhaustiveCheck: never = context;
      return mangaTitle;
    }
  }
}

/**
 * Get modal title based on context
 */
export function getModalTitle(context: DownloadContext): string {
  switch (context.type) {
    case 'manga':
      return `Search Downloads: ${context.manga.title}`;
    case 'volume':
      return `Search Downloads: ${context.manga.title} Vol. ${context.volumeNumber}`;
    case 'chapter':
      // index is always available (non-nullable Int in schema)
      return `Search Downloads: ${context.manga.title} Ch. ${context.chapter.index}`;
    default: {
      // Exhaustive check - should never reach here
      const _exhaustiveCheck: never = context;
      return `Search Downloads: Unknown`;
    }
  }
}

/**
 * Get chapters that need downloading based on context
 */
export function getMissingChapters(
  context: DownloadContext,
  chapterStatusCompleted: ChapterStatus
): number[] {
  switch (context.type) {
    case 'manga':
      // All chapters are relevant - would need manga.Chapter array
      return [];
    case 'volume':
      return context.chapters
        .filter((ch) => ch.downloadStatus !== chapterStatusCompleted)
        .map((ch) => ch.index);
    case 'chapter':
      return context.chapter.downloadStatus !== chapterStatusCompleted
        ? [context.chapter.index]
        : [];
    default:
      return [];
  }
}
