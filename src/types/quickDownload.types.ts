/**
 * Quick Download System Type Definitions
 *
 * Types for automated Prowlarr search and selection system.
 * Enables one-click downloads with intelligent release selection.
 */

import type { ScoreBreakdown } from '@/server/services/quickDownload/scoring/types';

import type { ProwlarrSearchResult } from './prowlarr';

/**
 * Quick Download selection criteria
 * Configurable preferences for auto-selecting best release
 */
export interface QuickDownloadCriteria {
  // Format preference (ordered by priority)
  preferredFormats: string[];          // Default: ['CBZ', 'CBR', 'PDF', 'EPUB']

  // Quality indicators
  preferOfficial: boolean;             // Prefer official publisher releases
  preferComplete: boolean;             // Prefer "Complete" collections

  // Health requirements (torrents only)
  minSeeders: number;                  // Minimum seeders required
  seedersWeight: number;               // Score multiplier for seeders

  // Recency preference
  maxAgeDays: number;                  // Prefer uploads within N days

  // Size constraints
  minSizeMB: number;                   // Reject files smaller than this
  maxSizeMB: number;                   // Reject files larger than this

  // Language preference
  preferredLanguages: string[];        // Ordered by preference
  rejectNonPreferredLanguages: boolean; // Hard-reject releases in non-preferred languages

  // Auto-reject criteria
  skipBlocklisted: boolean;            // Always skip blocked releases
}

/**
 * Default criteria for Quick Download
 */
export const DEFAULT_QUICK_DOWNLOAD_CRITERIA: QuickDownloadCriteria = {
  preferredFormats: ['CBZ', 'CBR', 'PDF', 'EPUB'],
  preferOfficial: true,
  preferComplete: true,
  minSeeders: 1,
  seedersWeight: 2,
  maxAgeDays: 365,
  minSizeMB: 10,
  maxSizeMB: 500,
  preferredLanguages: ['English', 'Japanese'],
  rejectNonPreferredLanguages: true,
  skipBlocklisted: true
};

/**
 * Scored search result
 * Pairs a Prowlarr result with its computed score
 */
export type { ScoreBreakdown } from '@/server/services/quickDownload/scoring/types';

export interface ScoredSearchResult {
  result: ProwlarrSearchResult;
  score: number;
  scoreBreakdown?: ScoreBreakdown;
}

/**
 * Quick Download result status
 */
export type QuickDownloadStatus =
  | 'STARTED'      // Download initiated successfully
  | 'FAILED'       // Download failed to start
  | 'NO_RESULTS'   // No matching releases found
  | 'ALL_BLOCKED'; // All results were blocklisted

/**
 * Result for individual chapter Quick Download
 */
export interface QuickDownloadChapterResult {
  chapterId: number;
  status: QuickDownloadStatus;
  releaseTitle?: string;      // Selected release title
  indexer?: string;           // Indexer name
  score?: number;             // Selection score
  error?: string;             // Error message if failed
  searchQueryFailures?: Array<{ searchQuery: string; errorMessage: string; statusCode?: number | undefined }> | undefined;
}

/**
 * Quick Download mode
 */
export type QuickDownloadMode = 'SINGLE' | 'BULK' | 'VOLUME';

/**
 * Quick Download request input
 */
export interface QuickDownloadInput {
  mangaId: number;
  chapterId?: number | undefined;              // For SINGLE mode
  chapterIds?: number[] | undefined;           // For BULK mode
  volumeNumber?: number | undefined;           // For VOLUME mode
  mode: QuickDownloadMode;
  criteria?: Partial<QuickDownloadCriteria> | undefined;  // Optional overrides
}

/**
 * Quick Download response
 */
export interface QuickDownloadResponse {
  success: boolean;
  results: QuickDownloadChapterResult[];
  summary: {
    total: number;
    started: number;
    failed: number;
    noResults: number;
    allBlocked: number;
  };
}

/**
 * Quick Download settings (persisted in Config table)
 */
export interface QuickDownloadSettings extends QuickDownloadCriteria {
  enabled: boolean;                    // Enable Quick Download feature
  fallbackToOriginalSource: boolean;   // Try legacy download if Prowlarr fails
  showConfirmationDialog: boolean;     // Show confirmation before bulk downloads
  notifyOnStart: boolean;              // Show notification when download starts
  showSelectionDetails: boolean;       // Show which release was selected in notification
}

/**
 * Default Quick Download settings
 */
export const DEFAULT_QUICK_DOWNLOAD_SETTINGS: QuickDownloadSettings = {
  enabled: true,
  fallbackToOriginalSource: true,
  showConfirmationDialog: true,
  notifyOnStart: true,
  showSelectionDetails: true,
  ...DEFAULT_QUICK_DOWNLOAD_CRITERIA
};
