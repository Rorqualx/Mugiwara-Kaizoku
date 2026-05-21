/**
 * Store Module Index
 * 
 * This module exports the entire application state management system.
 * It centralizes access to all store slices and provides a consistent
 * interface for state management across the application.
 * 
 * Each store slice is configured with domain types for type safety and consistency.
 * 
 * @module store
 */

// Re-export all store slices for centralized access
export { useLibraryStore } from './librarySlice';
export { useLibraryViewStore } from './libraryViewSlice';
export { useMangaStore } from './mangaSlice';
export { useSyncStore } from './syncSlice';
// Note: string enum from Prisma is different from Integrationstring
export { useUIStore } from './uiSlice';
export { useIntegrationStore } from './integrationSlice';
export { useDownloadQueueStore } from './downloadQueueSlice';
export { useJobStore, useJobSelectors } from './jobSlice';
export { useMobileStore } from './mobileSlice';
export { useCalendarStore } from './calendarSlice';
export { useAudioPlayerStore, useAudioPlayerSelectors } from './audioPlayerSlice';

// Export store hooks
export { useStoreActions, useStoreSelectors } from './hooks';

// Re-export types
export type { LibraryState, LibraryStateData, LibraryActions, ScanProgress } from './librarySlice';
export type { LibraryViewState, LibraryViewStateData, LibraryViewActions, ViewType, SortOption, FilterOption, CoverSize } from './libraryViewSlice';
export type { MangaState, MangaStateData, MangaActions, MangaFilters } from './mangaSlice';
export type { SyncState, SyncStateData, SyncActions, SyncTask } from './syncSlice';
export type { UIState, UIStateData, UIActions, FilterState, ThemeConfig, NotificationSettings } from './uiSlice';
export type { JobState, JobStateData, JobActions } from './jobSlice';
export type { 
  IntegrationState, 
  IntegrationStateData, 
  IntegrationActions,
  IntegrationConfig,
  TelegramConfig,
  AppriseConfig,
  ProwlarrConfig,
  AnilistConfig,
  ComicVineConfig,
  FandomConfig,
  SuwayomiConfig,
  TransmissionConfig,
  DelugeConfig,
  SabnzbdConfig,
  NzbgetConfig,
  DownloadClientPreferences,
  IntegrationServiceKey
} from './integrationSlice';
export type { 
  DownloadQueueState, 
  DownloadQueueStateData, 
  DownloadQueueActions, 
  DownloadQueueItem, 
  DownloadStats 
} from './downloadQueueSlice';
export type {
  MobileState,
  MobileStateData,
  MobileActions,
  MobileNavState,
  TouchSettings,
  MobileViewPreferences
} from './mobileSlice';
export type {
  CalendarState,
  CalendarStateData,
  CalendarActions,
  CalendarFilters,
  CalendarViewState,
  ExportPreferences
} from './calendarSlice';
export type {
  AudioPlayerState,
  AudioPlayerStateData,
  AudioPlayerActions,
  AudioPlayerStore,
} from './audioPlayerSlice';