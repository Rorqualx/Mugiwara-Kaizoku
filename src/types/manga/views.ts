/**
 * Manga View Models
 * 
 * Lightweight view-specific representations of Manga data
 * optimized for different UI contexts.
 */

import type { MangaPublicationStatus, MangaFileStatus, MangaLibraryStatus } from '@prisma/client';

/**
 * Minimal view for list displays
 */
export interface MangaListView {
  id: number;
  title: string;
  displayTitle: string | null;
  coverUrl: string | null;
  thumbnailUrl: string | null;
  chapterCount: number;
  unreadCount: number;
  publicationStatus: MangaPublicationStatus;
  libraryStatus: MangaLibraryStatus;
  lastUpdatedAt: Date;
  hasNewChapters: boolean;
}

/**
 * Detailed view for manga pages
 */
export interface MangaDetailView extends MangaListView {
  description: string | null;
  summary: string | null;
  authors: Array<{ name: string; role: string }>;
  artists: Array<{ name: string; role: string }>;
  genres: string[];
  tags: string[];
  alternativeTitles: string[];
  score: number | null;
  popularity: number | null;
  releaseYear: number | null;
  source: string;
  sourceUrl: string | null;
  fileStatus: MangaFileStatus;
  lastSyncAt: Date | null;
  errorMessage: string | null;
}

/**
 * Card view for grid displays
 */
export interface MangaCardView {
  id: number;
  title: string;
  displayTitle: string | null;
  coverUrl: string | null;
  thumbnailUrl: string | null;
  latestChapterNumber: string | null;
  latestChapterTitle: string | null;
  unreadCount: number;
  isUpdated: boolean;
  publicationStatus: MangaPublicationStatus;
}

/**
 * Minimal view for select/dropdown options
 */
export interface MangaOptionView {
  id: number;
  title: string;
  displayTitle: string | null;
  source: string;
}

/**
 * Form data for creating/updating manga
 */
export interface MangaFormData {
  title: string;
  displayTitle?: string;
  description?: string;
  summary?: string;
  source: string;
  sourceId?: string;
  sourceUrl?: string;
  libraryId: number;
  searchProvider?: string;
  genres?: string[];
  tags?: string[];
  alternativeTitles?: string[];
  authors?: Array<{ name: string; role: string }>;
  artists?: Array<{ name: string; role: string }>;
  coverUrl?: string;
  thumbnailUrl?: string;
  releaseYear?: number;
  publicationStatus?: MangaPublicationStatus;
  libraryStatus?: MangaLibraryStatus;
}

/**
 * Search result view
 */
export interface MangaSearchResult {
  id: string | number; // Can be external ID
  title: string;
  alternativeTitles?: string[];
  description?: string;
  coverUrl?: string;
  source: string;
  sourceId: string;
  authors?: string[];
  genres?: string[];
  year?: number;
  score?: number;
  isInLibrary?: boolean;
}