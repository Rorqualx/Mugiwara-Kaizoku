/**
 * MangaDex Metadata Library
 * Unified metadata from MangaDex + ComicVine + AniList
 */

// ==================== Unified Types ====================
export * from './types';

// ==================== Core Infrastructure ====================
export { RateLimiter, TTLCache, HttpClient } from './core';
export type { RateLimitConfig, HttpClientConfig } from './core';
export {
  isValidUUID,
  assertUUID,
  stripHtml,
  parsePartialDate,
  firstNonEmpty,
  deduplicateStrings,
  mergeArraysByKey,
  preferLonger,
} from './core';

// ==================== Providers ====================

// MangaDex
export {
  MangaDexClient,
  MangaDexApiError,
  createDefaultClient,
  MangaDexProvider,
  mapMangaDexManga,
  mapMangaDexChapter,
} from './providers/mangadex';
export type { MangaDexClientConfig } from './providers/mangadex';

// ComicVine
export {
  ComicVineClient,
  ComicVineProvider,
  mapComicVineVolume,
  extractChapterRange,
  extractThemes,
  extractCoverFromPage,
  cleanDescription,
} from './providers/comicvine';
export type { ComicVineClientConfig } from './providers/comicvine';

// AniList
export {
  AniListClient,
  AniListProvider,
  mapAniListMedia,
  SEARCH_MANGA,
  GET_MANGA_DETAILS,
} from './providers/anilist';
export type { AniListClientConfig } from './providers/anilist';

// ==================== Metadata Layer ====================
export {
  MetadataMerger,
  MetadataEnricher,
} from './metadata';
export type { MergerConfig, EnricherConfig } from './metadata';

// ==================== Convenience re-exports ====================
export type {
  // Unified types
  UnifiedManga,
  UnifiedVolume,
  UnifiedChapter,
  CoverImages,
  Creator,
  Character,
  StoryArc,
  ExternalLinks,
  MediaRelation,
  Recommendation,
  ScoreInfo,
  EnrichedMetadata,
  CompletenessScore,
  LocalizedString,
  // Provider types
  MetadataProvider,
  SearchResult,
  ProviderResult,
  ProviderConfig,
  // Common types
  DataSource,
  PublicationStatus,
  ContentRating,
  PublicationDemographic,
  MangaFormat,
  CreatorRole,
  CharacterRole,
  RelationType,
  EnrichmentTier,
  UUID,
  LanguageCode,
} from './types';
