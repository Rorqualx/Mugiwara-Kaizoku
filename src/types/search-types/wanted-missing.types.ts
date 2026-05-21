/**
 * Wanted and Missing Chapter Types Module
 *
 * Types for wanted items tracking, missing chapter detection,
 * and download history management.
 *
 * Extracted from: search.types.ts
 */

// ============================================================================
// Imports
// ============================================================================

import type { DownloadStatus as DownloadHistoryStatus } from './enums.types';

// ============================================================================
// Wanted Item Types
// ============================================================================

export interface WantedItem {
  id: string;
  mangaId: string;
  chapterId?: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WantedItemsResponse {
  items: WantedItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// Missing Item Types
// ============================================================================

export interface MissingItem {
  id: string;
  mangaId: string;
  mangaTitle: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle?: string;
  volumeNumber?: number;
  releaseDate?: Date | string;
  pageCount?: number;
  downloadStatus?: string;
  monitored: boolean;
  missingAt: Date;
  // Additional fields for wanted pages
  totalMissing?: number;
  firstMissingChapter?: string;
  lastMissingChapter?: string;
  dateDetected?: Date;
  // Manga metadata for table display
  coverImage?: string;
  language?: string;
}

export interface MissingItemsResponse {
  items: MissingItem[];
  total: number;
  page: number;
  pageSize: number;
  totalMangaAffected?: number;
  totalChaptersMissing?: number;
}

// ============================================================================
// Download History Types
// ============================================================================

export interface DownloadHistoryEntry {
  id: string;
  mangaId: string;
  chapterId: string;
  mangaTitle: string;
  chapterTitle?: string;
  chapterNumber: string;
  downloadedAt: Date;
  status: DownloadHistoryStatus;
  size?: number;
  quality?: string;
  provider?: string;
  // Additional fields for wanted pages
  metadata?: {
    mangaTitle: string;
    chapterNumber: string;
  };
  source?: string;
  downloadClient?: string;
  downloadSize?: number;
  downloadSpeed?: number;
  startTime?: Date;
  endTime?: Date;
  errorMessage?: string;
}

export interface DownloadHistoryResponse {
  entries: DownloadHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  stats?: {
    totalDownloads: number;
    successfulDownloads: number;
    failedDownloads: number;
    averageSpeed?: number;
  };
}
