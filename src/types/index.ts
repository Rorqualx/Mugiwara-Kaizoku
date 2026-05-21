/**
 * Types Index
 * 
 * This is the main entry point for all type definitions in the application.
 * Prisma types should be imported directly from @prisma/client
 * Custom types are in search.types and other specific files
 */

// Re-export Prisma types for convenience - but avoid conflicts
export * from '@prisma/client';

// Re-export custom search and UI types - selectively to avoid conflicts
export {
  // Interfaces and types
  type MangaSearchResult,
  type MangaMetadata,
  type SearchResult,
  type UnifiedSearchResult,
  type ExtendedMangaSearchResult,
  type ProviderSearchResult,
  type ExternalLink,
  type SearchOptions,
  type AniListSearchResult,
  type ComicVineSearchResult,
  // Type helpers
  type ID,
  type MangaWithRelations,
  type LibraryWithRelations,
  // Constants
  METADATA_FIELDS
} from './search.types';

// Re-export API types - selectively to avoid conflicts
export * from './api/v1/responses';
export * from './api/v1/websocket';
// Export error types from utils
export type { ApiError } from '../utils/error-handling';

// Export convenient namespaces
import * as API from './api/common';

export {
  API
};