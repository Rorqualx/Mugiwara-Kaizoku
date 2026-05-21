/**
 * Adapter Types Index
 *
 * Explicit type exports for tree-shaking optimization.
 * Import specific types to avoid loading all adapter definitions.
 */

// Native download types (re-exported from native-download-types)
export type {
  NativeDownloadProviderConfig,
  NativeDownloadAdapterConfig,
  NativeDownloadAdapterInstanceConfig,
  NativeDownloadImage,
  NativeDownloadApiManga,
  NativeDownloadScrapedManga,
  NativeDownloadScrapedChapter,
  NativeDownloadMangaData,
  NativeDownloadChapterData,
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
  NativeDownloadSearchOptions,
  NativeDownloadSearchParams,
  NativeDownloadSearchResult,
  DownloadLink,
  WebsiteValidationResult,
  MetadataSourceInfo,
  INativeDownloadAdapter,
  NativeDownloadProviderAdapter,
} from './native-download-types';

// ComicVine types
export type {
  ComicVineAdapterConfig,
  ComicVineVolume,
  ComicVineIssue,
  ComicVineImage,
  ComicVinePublisher,
  ComicVineCharacter,
  ComicVineCreator,
  ComicVineSearchResult,
  ComicVineApiResponse,
  ComicVineVolumeDetails,
  ComicVineIssueDetails,
  ComicVineConfig,
} from './comicvine';

// AniList types
export type {
  AniListAdapterConfig,
  AniListMedia,
  AniListDate,
  AniListTag,
  AniListCharacter,
  AniListStaff,
  AniListMediaEdge,
  AniListCharacterEdge,
  AniListStaffEdge,
  AniListStudioEdge,
  AniListAiringScheduleEdge,
  AniListMediaTrendEdge,
  AniListReviewEdge,
  AniListRecommendationEdge,
  AniListStudio,
  AniListAiringSchedule,
  AniListMediaTrend,
  AniListExternalLink,
  AniListStreamingEpisode,
  AniListMediaRank,
  AniListMediaListEntry,
  AniListReview,
  AniListRecommendation,
  PageInfo,
  AniListApiResponse,
  AniListConfig,
} from './anilist';

// Suwayomi types
export type {
  SuwayomiConfig,
  SuwayomiManga,
  SuwayomiChapter,
  SuwayomiSource,
  SuwayomiCategory,
  SuwayomiDownload,
  SuwayomiExtension,
} from './suwayomi';
