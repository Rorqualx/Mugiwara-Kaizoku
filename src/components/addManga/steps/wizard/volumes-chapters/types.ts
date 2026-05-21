/**
 * VolumesChaptersStep Types
 *
 * Shared type definitions and type guards for the VolumesChaptersStep component.
 * Extracted from VolumesChaptersStep.tsx to reduce file size and improve reusability.
 */

import type { Dispatch, SetStateAction } from 'react';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a Record object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if an object has a specific property
 */
export function hasProperty<K extends string>(
  obj: Record<string, unknown>,
  key: K
): obj is Record<K, unknown> {
  return key in obj;
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Logger interface for component logging
 */
export interface Logger {
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Progress tracking for ComicVine scraping operations
 */
export interface ScrapingProgress {
  status: 'idle' | 'scraping' | 'complete' | 'error';
  operation: string;
  current: number;
  total: number;
  startTime: number;
  itemsPerSecond: number;
  estimatedTimeRemaining: number;
}

/**
 * Props for the VolumesChaptersStep component
 */
export interface VolumesChaptersStepProps {
  // URL parsing
  manualVolumeUrl: string;
  setManualVolumeUrl: (url: string) => void;
  handleVolumeUrlParse: (urlOverride?: string) => void;
  isParsingVolumeUrl: boolean;
  isScrapingComicVineChapters: boolean;

  // Chapter parsing
  parseChapterDetails: boolean;
  setParseChapterDetails: (value: boolean) => void;

  // Display data
  displayVolumes: unknown[];
  allChapterUrls: unknown[];
  volumesData: unknown;

  // Source selection
  volumeDisplaySource: string;
  setVolumeDisplaySource: (source: string) => void;
  chapterDisplaySource: string;
  setChapterDisplaySource: (source: string) => void;
  provider: string;
  selectedSourcesMetadata: Record<string, unknown>;
  selectedSources: string[];

  // Selection state
  selectedVolumes: (number | string)[];
  setSelectedVolumes: Dispatch<SetStateAction<(number | string)[]>>;
  selectedChapters: unknown[];
  setSelectedChapters: Dispatch<SetStateAction<unknown[]>>;

  // Fetching state
  isBatchFetching: boolean;
  batchFetchProgress: { current: number; total: number };
  handleBatchFetchChapterCovers: () => void;

  // Chapter metadata
  chapterMetadataCache: Map<string, unknown>;
  mediaGallery: unknown;
  setMediaGallery?: Dispatch<SetStateAction<unknown>>;
  fetchChapterMetadataOnHover: (url: string) => Promise<unknown>;
  loadingChapterMetadata: boolean;

  // ComicVine specific
  handleComicVineChapterScraping: (volumeNumber: number) => void;

  // Logger
  logger: Logger;

  // Progressive fetching
  isProgressiveFetching?: boolean;
  progressiveFetchProgress?: { completed: number; total: number };
  failedChapterUrls?: Map<string, number>;
  retryFailedChapters?: () => Promise<void>;

  // ComicVine scraping progress
  comicVineScrapingProgress?: ScrapingProgress | undefined;
}

// ============================================================================
// Source Option Type
// ============================================================================

/**
 * Option for source dropdown selects
 */
export interface SourceOption {
  value: string;
  label: string;
}
