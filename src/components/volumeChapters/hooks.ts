/**
 * Volume Chapters Table - Custom Hooks
 *
 * React hooks for data fetching, mutations, and state management.
 * Handles chapter monitoring, downloads, progress tracking, and file verification.
 *
 * Architecture:
 * - hooks/volume-enrichment-types.ts - Types and helpers (481 lines)
 * - hooks/reading-progress.ts - Progress tracking (104 lines)
 * - hooks/monitoring.ts - Monitoring mutations (112 lines)
 * - hooks/download.ts - Download mutations (109 lines)
 * - hooks/volume-enrichment.ts - Volume enrichment (424 lines)
 *
 * Total: 5 modules, ~1230 lines
 * Original: 560 lines -> Refactored into focused modules
 */

// Re-export everything from modules for backward compatibility
export {
  // Volume metadata and processing hooks (NEW)
  useVolumeMetadata,
  useVolumeProcessing,

  // Type exports
  type EnrichedVolumeData,
  type EnrichedChapter,
  type VolumeEnrichmentParams,
  type ComicVineIssue,
  type WikipediaVolume,
  type ProviderVolume,
  type ProviderChapter,
  type ImportProfile,

  // Type guards
  isComicVineIssue,
  isWikipediaVolume,
  isProviderVolume,
  safeParseProviderMetadata,

  // Reading progress hooks
  useChapterProgress,
  useProgressMap,
  useChapterFileVerification,

  // Monitoring hooks
  useToggleVolumeMonitoring,
  useToggleChapterMonitoring,
  type ToggleMonitoringMutationOptions,

  // Download hooks
  useQuickDownloadVolume,
  type QuickDownloadMutationOptions,

  // Volume enrichment hook
  useEnrichedVolumeModalData
} from './hooks/index';

// Re-export types from types.ts for backward compatibility
export type { VolumeData, ChapterDataInVolume, ParsedProviderMetadata } from './types';
