/**
 * Unified Domain Type Guards
 *
 * This module provides unified type guards for domain entities that resolve
 * conflicts between adapter-specific guards and domain guards.
 *
 * Strategy:
 * - Domain guards take precedence for core business logic
 * - Adapter guards remain for adapter-specific validation
 * - This module provides aliases and unified interfaces
 *
 * @module UnifiedDomainGuards
 * @category TypeGuards
 * @subcategory Domain
 */

import {
  isMangaMetadata as adapterIsMangaMetadata,
  isSearchResult as adapterIsSearchResult,
  isExtendedMangaSearchResult as adapterIsExtendedMangaSearchResult
} from '../adapters/native-download/modules/core-manga';

// Re-export domain guards with clear naming
import {
  isChapter as domainIsChapter,
  isChapterList as domainIsChapterList,
  isChapterDownloadStatus as domainIsChapterDownloadStatus,
  isChapterReadStatus as domainIsChapterReadStatus,
  isChapterSource as domainIsChapterSource
} from './chapter-guards';
import {
  isManga as domainIsManga,
  isMangaSearchResult as domainIsMangaSearchResult,
  isMangaMetadata as domainIsMangaMetadata,
  isMangaStatus as domainIsMangaStatus,
  isMangaProvider as domainIsMangaProvider
} from './manga-guards';
import {
  isProvider as domainIsProvider,
  isProviderStatus as domainIsProviderStatus,
  isProviderConfig as domainIsProviderConfig,
  isProviderCapability as domainIsProviderCapability,
  isProviderType as domainIsProviderType
} from './provider-guards';
import {
  isSearchResult as domainIsSearchResult,
  isSearchQuery as domainIsSearchQuery,
  isSearchFilter as domainIsSearchFilter,
  isSearchResponse as domainIsSearchResponse,
  isSearchSuggestion as domainIsSearchSuggestion
} from './search-guards';

// Import adapter guards for unified interfaces

// ============================================================================
// Unified Manga Type Guards
// ============================================================================

/**
 * Unified manga type guard - prefers domain definition
 */
export const isManga = domainIsManga;

/**
 * Unified manga search result type guard - prefers domain definition
 */
export const isMangaSearchResult = domainIsMangaSearchResult;

/**
 * Unified manga metadata type guard - uses adapter implementation for compatibility
 */
export const isMangaMetadata = adapterIsMangaMetadata;

/**
 * Extended manga search result type guard - adapter-specific
 */
export const isExtendedMangaSearchResult = adapterIsExtendedMangaSearchResult;

/**
 * Unified search result type guard - uses adapter implementation for compatibility
 */
export const isSearchResult = adapterIsSearchResult;

/**
 * Unified manga status type guard
 */
export const isMangaStatus = domainIsMangaStatus;

/**
 * Unified manga provider type guard
 */
export const isMangaProvider = domainIsMangaProvider;

// ============================================================================
// Unified Chapter Type Guards
// ============================================================================

/**
 * Unified chapter type guard
 */
export const isChapter = domainIsChapter;

/**
 * Unified chapter list type guard
 */
export const isChapterList = domainIsChapterList;

/**
 * Unified chapter download status type guard
 */
export const isChapterDownloadStatus = domainIsChapterDownloadStatus;

/**
 * Unified chapter read status type guard
 */
export const isChapterReadStatus = domainIsChapterReadStatus;

/**
 * Unified chapter source type guard
 */
export const isChapterSource = domainIsChapterSource;

// ============================================================================
// Unified Provider Type Guards
// ============================================================================

/**
 * Unified provider type guard
 */
export const isProvider = domainIsProvider;

/**
 * Unified provider status type guard
 */
export const isProviderStatus = domainIsProviderStatus;

/**
 * Unified provider config type guard
 */
export const isProviderConfig = domainIsProviderConfig;

/**
 * Unified provider capability type guard
 */
export const isProviderCapability = domainIsProviderCapability;

/**
 * Unified provider type type guard
 */
export const isProviderType = domainIsProviderType;

// ============================================================================
// Unified Search Type Guards
// ============================================================================

/**
 * Unified search query type guard
 */
export const isSearchQuery = domainIsSearchQuery;

/**
 * Unified search filter type guard
 */
export const isSearchFilter = domainIsSearchFilter;

/**
 * Unified search response type guard
 */
export const isSearchResponse = domainIsSearchResponse;

/**
 * Unified search suggestion type guard
 */
export const isSearchSuggestion = domainIsSearchSuggestion;

// ============================================================================
// Compatibility Aliases
// ============================================================================

/**
 * @deprecated Use isMangaMetadata instead
 */
export const isDomainMangaMetadata = domainIsMangaMetadata;

/**
 * @deprecated Use isSearchResult instead
 */
export const isDomainSearchResult = domainIsSearchResult;

/**
 * @deprecated Use isMangaMetadata instead
 */
export const isAdapterMangaMetadata = adapterIsMangaMetadata;

/**
 * @deprecated Use isSearchResult instead
 */
export const isAdapterSearchResult = adapterIsSearchResult;