/**
 * Native Download Adapter Types
 *
 * This file now primarily re-exports types from the canonical location.
 * All native download types have been consolidated to @/types/adapters/native-download-types
 *
 * @deprecated Import directly from '@/types/adapters/native-download-types' instead
 */

// Re-export all native download types from canonical location
export type {
  // Core provider and adapter types
  NativeDownloadProviderConfig,
  NativeDownloadAdapterConfig,
  NativeDownloadAdapterInstanceConfig,
  NativeDownloadImage,

  // API response types
  NativeDownloadApiManga,

  // Scraper types
  NativeDownloadScrapedManga,
  NativeDownloadScrapedChapter,
  NativeDownloadMangaData,
  NativeDownloadChapterData,

  // Configuration types
  SelectorConfig,
  SelectorMapping,
  SearchResultSelectors,
  MangaDetailSelectors,
  ChapterListSelectors,
  DownloadLinkSelectors,
  RateLimitConfig,
  AuthConfig,
  DownloadServiceConfig,
  Transform,

  // Search types
  NativeDownloadSearchOptions,
  NativeDownloadSearchParams,
  NativeDownloadSearchResult,

  // Utility types
  DownloadLink,
  WebsiteValidationResult,
  MetadataSourceInfo,

  // Adapter interface
  INativeDownloadAdapter,
  NativeDownloadProviderAdapter,

  // Type guards
  isSelectorConfig,
  isNativeDownloadProviderConfig,
  isValidNativeDownloadProviderConfig,
} from './native-download-types';
