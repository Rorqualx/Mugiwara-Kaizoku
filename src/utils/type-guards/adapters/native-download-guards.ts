// From: src/types/native-download-types.ts (consolidated from adapters/native-download.ts)
// Re-export all type guards from modular structure

// Core types
export {
  isMetadataSourceInfo,
  isRateLimitConfig,
  isAuthConfig,
  isSelectorMapping,
  isSearchResultSelectors,
  isMangaDetailSelectors,
  isChapterListSelectors,
  isDownloadLinkSelectors,
  isDownloadServiceConfig,
  isNativeDownloadMangaData,
  isNativeDownloadChapterData,
  isINativeDownloadAdapter
} from './native-download/modules/native-download-types';

// Search types
export {
  isExtendedMangaSearchResult,
  isProviderSearchResult,
  isSearchResponseWithErrors,
  isExternalLink,
  isRecentRelease,
  isEnhancedMangaMetadata,
  isFetchRecentReleasesOptions,
  isReleaseScheduleCapabilities,
  isProviderReleaseSchedule,
  isNativeDownloadProvider,
  isNativeDownloadManga,
  isNativeDownloadChapter,
  isNativeDownloadSearchResult,
  isTaskEntity,
  isAppConfig,
  isMetadataDetails,
  isProviderMetadata,
  isNotificationTestResult,
  isProviderStatus,
  isCalendarEvent
} from './native-download';

// Sources
export {
  isUnifiedSource,
  isMangaSource,
  isSourceFilter,
  isSourceStats
} from './native-download/modules/sources';

// Store types
export {
  isLibraryState,
  isLibraryActions,
  isMangaState,
  isMangaActions,
  isUIState,
  isUIActions,
  isDownloadQueueState,
  isDownloadQueueActions,
  isIntegrationState,
  isIntegrationActions,
  isRootState
} from './native-download/modules/store-types';

// System status
export {
  isIntegrationStatusData,
  isDatabaseInfo,
  isSystemInfo,
  isDockerInfo,
  isApplicationInfo,
  isSystemStatusResponse
} from './native-download/modules/system-status';

// Task unions
export {
  isTask,
  isTaskWithProgress,
  isJobState,
  isTaskFilter
} from './native-download/modules/task-unions';

// Test types
export {
  isTestApiRequest,
  isTestApiResponse,
  isTestUserContext,
  isTestTRPCContext,
  isTestEvent,
  isTestEventResponse,
  isTestEventSettings,
  isTestAniListSettings,
  isTestAniListManga,
  isTestTask,
  isTestSettings,
  isTestManga
} from './native-download/modules/test-types';

// Transaction client
export {
  isJobTransaction,
  isTaskPayload
} from './native-download/modules/prisma-transaction';

// TRPC router types
export {
  isProviderInfo,
  isDefaultProviderResponse,
  isProviderToggleInput,
  isProviderSettingsUpdateInput,
  isRedirectedInput,
  isProvidersRouter
} from './native-download/modules/trpc-router-types';

// Universal import wizard
export {
  isVolume,
  isChapter,
  isMediaGallery,
  isVolumesData,
  isBatchFetchProgress,
  isImportProgress,
  isWizardFormData,
  isMetadataPreviewItem,
  isFieldSelectorOption,
  isProviderOption,
  isLoadingStates,
  isErrorStates
} from './native-download/modules/universal-import-wizard';

// User
export {
  isPublicUser
} from './native-download/modules/user';
