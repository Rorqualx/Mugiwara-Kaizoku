/**
 * Reader Hooks - Shared Type Definitions
 *
 * Centralized type definitions for all reader hooks.
 */

import type { MangaFile, DoublePageUrls, ReaderSettings } from '@/types/reader/reader-types';

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/** Response from chapter info API */
export interface ChapterInfoResponse {
  title: string;
  format: string;
  pageCount: number;
}

/** Response from progress API */
export interface ProgressResponse {
  currentPage: number;
}

/** Chapter navigation data from tRPC query */
export interface ChapterNavigationData {
  nextChapter?: { id: number } | null;
  prevChapter?: { id: number } | null;
}

// =============================================================================
// PRELOAD STATS
// =============================================================================

/** Statistics from PreloaderService */
export interface PreloadStats {
  cacheSize: number;
  averageSpeed: number;
  isPreloading: boolean;
  queueSize: number;
}

// =============================================================================
// SUB-HOOK RETURN TYPES
// =============================================================================

/** Return type for useReaderArchive hook */
export interface UseReaderArchiveReturn {
  pages: string[];  // URL strings for each page
  isLoading: boolean;
  error: Error | null;
  loadChapter: (mangaId: number, chapterId: number) => Promise<void>;
  getPageUrl: (pageNumber: number) => string | null;
  currentMangaId: number | null;
  currentChapterId: number | null;
  /** Reload the current chapter (e.g., after source switch) */
  reloadCurrentChapter: () => Promise<void>;
}

/** Return type for useReaderProgress hook */
export interface UseReaderProgressReturn {
  saveProgress: (page: number) => void;
}

/** Return type for useReaderPageNavigation hook */
export interface UseReaderPageNavigationReturn {
  getDoublePageUrls: (pageNumber: number) => DoublePageUrls;
  currentDoublePageUrls: DoublePageUrls;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
}

/** Return type for useReaderChapterNavigation hook */
export interface UseReaderChapterNavigationReturn {
  chapterNavigation: ChapterNavigationData | undefined;
  isLoadingNavigation: boolean;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
  jumpToChapter: (chapterId: number) => Promise<void>;
}

/** Return type for useReaderPreload hook */
export interface UseReaderPreloadReturn {
  preloadStats: PreloadStats;
}

// =============================================================================
// MAIN HOOK RETURN TYPE
// =============================================================================

/** Return type for the main useReader hook */
export interface UseReaderReturn {
  // State
  file: MangaFile | null;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: Error | null;
  settings: ReaderSettings;
  pages: string[];  // URL strings for each page
  currentDoublePageUrls: DoublePageUrls;
  preloadStats: PreloadStats;

  // Chapter Navigation
  chapterNavigation: ChapterNavigationData | undefined;
  isLoadingNavigation: boolean;

  // Functions
  loadChapter: (mangaId: number, chapterId: number) => Promise<void>;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  updateSettings: (updates: Partial<ReaderSettings>) => void;
  getPageUrl: (pageNumber: number) => string | null;
  getDoublePageUrls: (pageNumber: number) => DoublePageUrls;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
  jumpToChapter: (chapterId: number) => Promise<void>;
  /** Reload the current chapter (e.g., after source switch) */
  reloadCurrentChapter: () => Promise<void>;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/** Type guard for ChapterInfoResponse */
export function isValidChapterInfo(data: unknown): data is ChapterInfoResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const record = data as Record<string, unknown>;
  return (
    'title' in record &&
    typeof record['title'] === 'string' &&
    'format' in record &&
    typeof record['format'] === 'string' &&
    'pageCount' in record &&
    typeof record['pageCount'] === 'number'
  );
}

/** Type guard for ProgressResponse */
export function isValidProgress(data: unknown): data is ProgressResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const record = data as Record<string, unknown>;
  return (
    'currentPage' in record &&
    typeof record['currentPage'] === 'number'
  );
}
