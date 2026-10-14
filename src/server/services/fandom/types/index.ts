/**
 * Fandom Types - Barrel Export
 * Re-exports all types and configurations for backwards compatibility
 */

// All interfaces and types
export type {
  FandomPageMetadata,
  MediaWikiSearchResult,
  MediaWikiPage,
  MediaWikiImageInfo,
  PortableInfoboxData,
  InfoboxItem,
  InfoboxTitle,
  InfoboxData,
  InfoboxImage,
  InfoboxGroup,
  InfoboxHeader,
  FandomCharacterData,
  FandomMangaData,
  FandomSearchResult,
  FandomAPIConfig,
  MediaWikiAPIResponse,
  CacheEntry,
  WikiConfig
} from './interfaces';

// Type guard function
export { isFandomMangaData, FandomAPIError } from './interfaces';

// Wiki configurations
export { POPULAR_WIKIS, FALLBACK_WIKIS } from './popular-wikis';
