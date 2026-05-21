/**
 * Kapowarr Type Guards - Main Aggregator
 *
 * This file serves as the main aggregator for all Kapowarr type guards,
 * re-exporting all type guard functions from individual domain modules
 * to maintain backward compatibility with the original monolithic file.
 *
 * @module KapowarrTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

// Core infrastructure
import {
  NativeDownloadImageSchema,
  SuwayomiConfigSchema,
  ApiErrorSchema,
  MangaMetadataSchema,
  ChapterSchema,
  VolumeSchema,
  ProviderConfigSchema,
  SearchResultSchema,
  ImportRuleSchema,
  IntegrationConfigSchema
} from './core/schemas';
import {
  validateObjectSchema,
  createTypeGuard,
  hasRequiredProperties
} from './core/utils';


// Domain modules
// API V1 Requests (18 guards)
export {
  isPaginationRequest,
  isCreateMangaRequest,
  isSearchRequest,
  isUpdateMangaRequest,
  isCreateChapterRequest,
  isUpdateChapterRequest,
  isCreateVolumeRequest,
  isUpdateVolumeRequest,
  isDeleteVolumeRequest,
  isCreateUserRequest,
  isUpdateUserRequest,
  isDeleteUserRequest,
  isBulkOperationRequest
} from './modules/api-v1-requests';

// API V1 Responses (7 guards)
export {
  isMangaResponse,
  isChapterResponse,
  isLibraryResponse,
  isVolumeResponse,
  isUserResponse,
  isBulkOperationResponse,
  isErrorResponse
} from './modules/api-v1-responses';

// WebSocket Types (10 guards)
export {
  isAuthMessage,
  isSubscribeMessage,
  isDownloadProgressMessage,
  isScanProgressMessage,
  isNotificationMessage,
  isSystemStatusMessage,
  isJobStatusMessage,
  isMangaUpdateMessage,
  isChapterUpdateMessage,
  isVolumeUpdateMessage
} from './modules/websocket-types';

// Chapter Metadata Types (3 guards)
export {
  isFandomChapter,
  isChapterUpdateInput,
  isChapterCreateInput
} from './modules/chapter-metadata-types';

// Client Types (2 guards)
export {
  isJobError,
  isDomainJob
} from './modules/client-types';

// Common Types (1 guard)
export {
  isPagination
} from './modules/common-types';

// Component Types (6 guards)
export {
  isBaseProps,
  isLayoutProps,
  isFormFieldProps,
  isModalProps,
  isCardProps,
  isButtonProps
} from './modules/component-types';

// Component Types 2 (2 guards)
export {
  isMangaDisplay,
  isGridStyle
} from './modules/component-types-2';

// Components (9 guards)
export {
  isGroupProps,
  isStackProps,
  isLoadingOverlayProps,
  isTextProps,
  isMantineCustomTheme,
  isActionBarProps,
  isHomeActionBarProps,
  isProwlarrContextType,
  isEventListItem,
  isEventModalDetails
} from './modules/components';

// Config Service (6 guards)
export {
  isBaseConfigService,
  isApiConfigService,
  isMetadataConfigService,
  isSearchConfigService,
  isConfigService,
  isDatabaseConfigService
} from './modules/config-service';

// Config Types (16 guards)
export {
  isBaseIntegrationConfig,
  isNativeDownloadConfig,
  isFandomConfig,
  isAnilistConfig,
  isTransmissionConfig,
  isDelugeConfig,
  isSABnzbdConfig,
  isNZBGetConfig,
  isProwlarrConfig,
  isDiscordConfig,
  isEmailConfig,
  isSlackConfig,
  isTelegramConfig,
  isKavitaConfig,
  isKomgaConfig,
  isNestedIntegrationSettings,
  isIntegrationSettings
} from './modules/config-types';

// AniList Types (3 guards)
export {
  isAniListSearchResult,
  isAniListMediaFormat,
  isAniListMediaStatus
} from './modules/anilist-types';

// Unified Search Types (8 guards)
export {
  isSearchOptions,
  isSearchResponse,
  isSearchState,
  isSearchFilters,
  isProviderSearchConfig,
  isUISearchResult,
  isAggregatedSearchResponse,
  isSearchContext
} from './modules/unified-search-types';

// Import Rules Types (11 guards)
export {
  isImportRule,
  isRuleCondition,
  isRuleAction,
  isImportActions,
  isImportContext,
  isParsedFileInfo,
  isParsedMangaInfo,
  isAdvancedPattern,
  isPatternExtractor,
  isRuleValidationResult,
  isRuleTestResult
} from './modules/import-rules-types';

// Kapowarr Types (12 guards)
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
} from './modules/native-download-types';

// External Manga Types (4 guards)
export {
  isExternalAnilistManga,
  isExternalSuwayomiManga,
  isExternalMALManga,
  isExternalKitsuManga
} from './modules/external-manga-types';

// Manga Views (6 guards)
export {
  isMangaListView,
  isMangaDetailView,
  isMangaCardView,
  isMangaOptionView,
  isMangaFormData,
  isMangaSearchResult
} from './modules/manga-views';

// Manga Page Types (4 guards)
export {
  isMangaWithRelations,
  isChapterWithManga,
  isMangaPageProps,
  isMangaDetailProps
} from './modules/manga-page-types';

// Manga Transaction (4 guards)
export {
  isChapterClient,
  isOutOfSyncChapterClient,
  isMangaClient,
  isMangaTransactionClient
} from './modules/manga-transaction';

// Prisma Transaction (2 guards)
export {
  isJobTransaction,
  isTaskPayload
} from './modules/prisma-transaction';

// Provider Interfaces (7 guards)
export {
  isBaseProvider,
  isProviderConfig,
  isIMetadataProviderAdapter,
  isDownloadProvider,
  isSourceProvider,
  isMetadataAdapter,
  isProviderRegistry
} from './modules/provider-interfaces';

// Provider Metadata (5 guards)
export {
  isProviderSettings,
  isLegacyProvider,
  isMetadataWithProviders,
  isLegacyMetadata,
  isProviderMigrationConfig
} from './modules/provider-metadata';

// Provider Types (3 guards)
export {
  isMetadataProvider,
  isSimpleMetadataProvider,
  isProviderSelectOption
} from './modules/provider-types';

// Prowlarr Types (11 guards)
export {
  isSystemStatus,
  isIndexerField,
  isIndexerCapability,
  isProwlarrIndexer,
  isProwlarrSearchResult,
  isProwlarrSettings,
  isProwlarrClientConfig,
  isProwlarrSystemStatus,
  isProwlarrError
} from './modules/prowlarr-types';

// Reader Types (13 guards)
export {
  isMangaFile,
  isFileMetadata,
  isReaderSettings,
  isReadingHistoryItem,
  isBookmark,
  isRenderOptions,
  isImageFilters,
  isReaderState,
  isReadingProgress,
  isGestureHandlers,
  isChapterFile,
  isDoublePageState,
  isDoublePageUrls
} from './modules/reader-types';

// Search Types (4 guards)
// Note: search-types module re-exports from index - these guards are available through other modules

// Extended Search Types (18 guards)
export {
  isExtendedMangaSearchResult
} from './modules/core-manga';

export {
  isProviderSearchResult,
  isSearchResponseWithErrors,
  isExternalLink
} from './modules/provider-integration';

export {
  isNativeDownloadProvider,
  isNativeDownloadManga,
  isNativeDownloadChapter,
  isNativeDownloadSearchResult,
  isTaskEntity,
  isRecentRelease,
  isEnhancedMangaMetadata
} from './modules/native-download-specific';

export {
  isCalendarEvent,
  isFetchRecentReleasesOptions,
  isReleaseScheduleCapabilities,
  isProviderReleaseSchedule
} from './modules/calendar-events';

export {
  isAppConfig,
  isMetadataDetails,
  isProviderMetadata,
  isNotificationTestResult,
  isProviderStatus
} from './modules/notification-config';

// Sources (4 guards)
export {
  isUnifiedSource,
  isMangaSource,
  isSourceFilter,
  isSourceStats
} from './modules/sources';

// Store Types (11 guards)
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
} from './modules/store-types';

// System Status (6 guards)
export {
  isIntegrationStatusData,
  isDatabaseInfo,
  isSystemInfo,
  isDockerInfo,
  isApplicationInfo,
  isSystemStatusResponse
} from './modules/system-status';

// System (6 guards)
export {
  isSystemHealth,
  isSystemSettings,
  isApplicationInfoType,
  isDockerInfoType,
  isExtendedSystemMetrics,
  isIntegrationInfo
} from './modules/system';

// Task Unions (4 guards)
export {
  isTask,
  isTaskWithProgress,
  isJobState,
  isTaskFilter
} from './modules/task-unions';

// Test Types (11 guards)
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
} from './modules/test-types';


// TRPC Router Types (6 guards)
export {
  isProviderInfo,
  isDefaultProviderResponse,
  isProviderToggleInput,
  isProviderSettingsUpdateInput,
  isRedirectedInput,
  isProvidersRouter
} from './modules/trpc-router-types';

// Universal Import Wizard (12 guards)
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
} from './modules/universal-import-wizard';

// User (1 guard)
export {
  isPublicUser
} from './modules/user';

// Export core utilities and schemas for advanced usage
export {
  validateObjectSchema,
  createTypeGuard,
  hasRequiredProperties,
  NativeDownloadImageSchema,
  SuwayomiConfigSchema,
  ApiErrorSchema,
  MangaMetadataSchema,
  ChapterSchema,
  VolumeSchema,
  ProviderConfigSchema,
  SearchResultSchema,
  ImportRuleSchema,
  IntegrationConfigSchema
};

/**
 * @deprecated Use individual module imports instead
 * This aggregator file is maintained for backward compatibility only
 */