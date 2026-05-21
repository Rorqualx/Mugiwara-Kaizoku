/**
 * MangaDex Metadata Library
 * Unified metadata from MangaDex + ComicVine + AniList
 */
export * from './types';
export { RateLimiter, TTLCache, HttpClient } from './core';
export type { RateLimitConfig, HttpClientConfig } from './core';
export { isValidUUID, assertUUID, stripHtml, parsePartialDate, firstNonEmpty, deduplicateStrings, mergeArraysByKey, preferLonger, } from './core';
export { MangaDexClient, MangaDexApiError, createDefaultClient, MangaDexProvider, mapMangaDexManga, mapMangaDexChapter, } from './providers/mangadex';
export type { MangaDexClientConfig } from './providers/mangadex';
export { ComicVineClient, ComicVineProvider, mapComicVineVolume, extractChapterRange, extractThemes, extractCoverFromPage, cleanDescription, } from './providers/comicvine';
export type { ComicVineClientConfig } from './providers/comicvine';
export { AniListClient, AniListProvider, mapAniListMedia, SEARCH_MANGA, GET_MANGA_DETAILS, } from './providers/anilist';
export type { AniListClientConfig } from './providers/anilist';
export { MetadataMerger, MetadataEnricher, } from './metadata';
export type { MergerConfig, EnricherConfig } from './metadata';
export type { UnifiedManga, UnifiedVolume, UnifiedChapter, CoverImages, Creator, Character, StoryArc, ExternalLinks, MediaRelation, Recommendation, ScoreInfo, EnrichedMetadata, CompletenessScore, LocalizedString, MetadataProvider, SearchResult, ProviderResult, ProviderConfig, DataSource, PublicationStatus, ContentRating, PublicationDemographic, MangaFormat, CreatorRole, CharacterRole, RelationType, EnrichmentTier, UUID, LanguageCode, } from './types';
//# sourceMappingURL=index.d.ts.map