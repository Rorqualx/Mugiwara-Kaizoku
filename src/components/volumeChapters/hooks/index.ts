/**
 * Volume Chapters Hooks Barrel Export
 */

// Volume metadata and processing hooks
export { useVolumeMetadata } from './useVolumeMetadata';
export { useVolumeProcessing } from './useVolumeProcessing';

// Re-export existing hooks from other modules
export {
  type EnrichedVolumeData,
  type EnrichedChapter,
  type VolumeEnrichmentParams,
  type ComicVineIssue,
  type WikipediaVolume,
  type ProviderVolume,
  type ProviderChapter,
  type ImportProfile,
  isComicVineIssue,
  isWikipediaVolume,
  isProviderVolume,
  safeParseProviderMetadata,
} from './volume-enrichment-types';

export {
  useChapterProgress,
  useProgressMap,
  useChapterFileVerification,
  type ProgressMap,
  type ReadingProgress,
} from './reading-progress';

export {
  useToggleVolumeMonitoring,
  useToggleChapterMonitoring,
  type ToggleMonitoringMutationOptions,
} from './monitoring';

export {
  useQuickDownloadVolume,
  type QuickDownloadMutationOptions,
} from './download';

export {
  useEnrichedVolumeModalData
} from './volume-enrichment';

// Table state management
export * from './useVolumeTableState';
