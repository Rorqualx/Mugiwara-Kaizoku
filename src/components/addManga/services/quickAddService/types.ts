/**
 * Quick Add Service - Type Definitions
 *
 * Shared type definitions for quick-add service modules.
 * Defines interfaces for progress tracking, preferences, and service configuration.
 *
 * @module components/addManga/services/quickAddService/types
 */

import type { AppRouter } from '@/server/trpc/root';
import type { ExtendedMangaSearchResult, FallbackMode, MangaMetadata } from '@/types/search.types';
import type { WizardFormData } from '@/types/universalImportWizard.types';

import type { TRPCClient } from '@trpc/client';

// ============================================================================
// Progress & Stage Types
// ============================================================================

/**
 * Quick-add progress stages
 */
export type QuickAddStage =
  | 'loading_preferences'
  | 'auto_matching'
  | 'fetching_metadata'
  | 'fetching_volumes'
  | 'constructing_data'
  | 'importing'
  | 'complete'
  | 'error';

/**
 * Quick-add progress callback data
 */
export interface QuickAddProgress {
  stage: QuickAddStage;
  message: string;
  /** Progress percentage (0-100) */
  progress?: number;
}

/**
 * Quick-add callbacks for progress and completion
 */
export interface QuickAddCallbacks {
  onProgress?: (progress: QuickAddProgress) => void;
  onSuccess?: (mangaId: number) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Preferences Types
// ============================================================================

/**
 * Field provider preferences from settings
 */
export interface FieldProviderPreferences {
  enabled: boolean;
  /** Field name to provider priority list mapping */
  preferences: Record<string, string[]>;
  /** Whether auto-matching is enabled (defaults to true) */
  autoMatchEnabled?: boolean;
  /**
   * Fallback mode for when primary provider has no data
   * - 'priority': Use 2nd, 3rd, 4th priority in order
   * - 'confidence': Use whichever remaining provider has highest match confidence
   */
  fallbackMode: FallbackMode;
}

// ============================================================================
// Auto-Match Types
// ============================================================================

/**
 * Configuration for auto-matching providers
 */
export interface AutoMatchConfig {
  /** Whether auto-matching is enabled */
  enabled: boolean;
  /** Minimum confidence threshold for matches (0.0 to 1.0) */
  confidenceThreshold: number;
  /** Timeout in milliseconds for matching operation */
  timeoutMs: number;
  /** List of providers to search for matches */
  providersToSearch: string[];
}

/**
 * Result from auto-matching providers
 */
export interface AutoMatchResult {
  /** List of providers that returned matches */
  matchedProviders: string[];
  /** Search results from matched providers, keyed by provider name */
  enrichedSearchResults: Record<string, ExtendedMangaSearchResult[]>;
  /** Confidence scores for each matched provider */
  matchConfidences: Record<string, number>;
  /** Merged metadata from all matches (optional) */
  mergedMetadata?: MangaMetadata;
  /** Providers that were skipped (already had results or filtered out) */
  skippedProviders: string[];
  /** Errors encountered during matching, keyed by provider */
  errors: Record<string, string>;
}

/**
 * Field-level source preferences for volume and chapter data
 * Matches VolumeFieldSources from SourceSelection component
 */
export interface VolumeFieldSources {
  /** Source for volume cover images */
  volumeCover: string;
  /** Source for volume summary/description */
  volumeSummary: string;
  /** Source for volume title */
  volumeTitle: string;
  /** Source for chapter cover images */
  chapterCover: string;
  /** Source for chapter summary/description */
  chapterSummary: string;
  /** Source for chapter title */
  chapterTitle: string;
}

// ============================================================================
// Volume Data Types
// ============================================================================

/**
 * Volume data structure from provider fetch operations
 */
export interface FetchedVolumeData {
  provider: string;
  volumes: unknown[];
  totalVolumes: number;
  totalChapters: number;
  volumeDetails?: unknown[];
}

/**
 * Extended fetched volume data with multi-provider support
 */
export interface ExtendedFetchedVolumeData extends FetchedVolumeData {
  comicVineData?: FetchedVolumeData;
  fandomData?: FetchedVolumeData;
  secondaryData?: FetchedVolumeData;
}

/**
 * Volume data object for import operations
 */
export interface VolumesDataObject {
  volumes?: unknown[];
  totalVolumes?: number;
  totalChapters?: number;
  provider?: string;
  comicVineData?: FetchedVolumeData;
  fandomData?: FetchedVolumeData;
  secondaryData?: FetchedVolumeData;
}

// ============================================================================
// Field Selection Types
// ============================================================================

/**
 * Field selection with source and confidence tracking
 */
export interface FieldSelection {
  source: string;
  value: unknown;
  confidence?: number;
}

/**
 * Map of field names to their selections
 */
export type FieldSelectionMap = Record<string, FieldSelection>;

// ============================================================================
// Import Options Types
// ============================================================================

/**
 * Options for performImport method
 */
export interface PerformImportOptions {
  searchData: {
    searchResult: ExtendedMangaSearchResult;
    allSearchResults: Record<string, ExtendedMangaSearchResult[]> | undefined;
  };
  formData: Partial<WizardFormData>;
  fieldSelections: FieldSelectionMap;
  selections: {
    volumes: (number | string)[];
    chapters: unknown[];
  };
  volumesData: VolumesDataObject;
  /** Field-level source preferences for volumes and chapters */
  volumeFieldSources: VolumeFieldSources;
  /** User-configured provider preferences from settings */
  providerPreferences: {
    volumeProvider: string;
    chapterProvider: string;
  };
  config: {
    libraryId: number;
    onProgress?: (progress: QuickAddProgress) => void;
  };
  /** User's explicitly selected metadata for each provider - preserves correct edition selection */
  selectedSourcesMetadata?: Record<string, unknown> | undefined;
}

// ============================================================================
// Service Dependency Types
// ============================================================================

/**
 * Dependencies for QuickAddService
 * Enables dependency injection for testing
 */
export interface QuickAddServiceDependencies {
  trpcClient: TRPCClient<AppRouter>;
}

/**
 * Provider metadata lookup structure
 */
export interface ProviderMetadataMap {
  fandomMetadata: Record<string, unknown> | undefined;
  comicvineMetadata: Record<string, unknown> | undefined;
  wikipediaMetadata: Record<string, unknown> | undefined;
  mangadexMetadata: Record<string, unknown> | undefined;
}

// ============================================================================
// Auto-Selection Result Types
// ============================================================================

/**
 * Result from auto-selecting volumes and chapters
 */
export interface AutoSelectResult {
  selectedVolumes: (number | string)[];
  selectedChapters: unknown[];
  volumesData: VolumesDataObject;
}

// ============================================================================
// Build Additional Data Types
// ============================================================================

/**
 * Options for buildAdditionalData function
 * Groups 11 parameters into logical categories for better maintainability
 */
export interface BuildAdditionalDataOptions {
  /** Core identifiers and search context */
  core: {
    libraryId: number;
    searchResult: ExtendedMangaSearchResult;
  };
  /** Volume and chapter data */
  volumes: {
    finalVolumesData: { volumes?: unknown[]; totalVolumes?: number; totalChapters?: number };
    selectedVolumes: (number | string)[];
    selectedChapters: unknown[];
  };
  /** Provider source configuration */
  sources: {
    sourcesMetadata: Record<string, unknown>;
    volumeDisplaySource: string;
    chapterDisplaySource: string;
  };
  /** External ID mappings */
  externalIds: { anilistId?: string; malId?: string; comicVineId?: string };
  /** Field selection configuration */
  fieldConfig: {
    fieldSelections: FieldSelectionMap;
    volumeFieldSources: VolumeFieldSources;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Fields that should have numeric values (0 is invalid)
 */
export const NUMERIC_FIELDS = new Set(['chapters', 'volumes', 'averageScore', 'popularity']);

/**
 * Invalid status values that should be skipped
 */
export const INVALID_STATUS_VALUES = new Set(['UNKNOWN', 'unknown', 'Unknown', '']);
