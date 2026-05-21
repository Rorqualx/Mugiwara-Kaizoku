/**
 * API Client Base Classes
 * 
 * This module exports base classes for different types of API clients.
 * These classes provide a foundation for specific client implementations.
 */

// Common base API client
export {
  ApiClient,
  type ApiClientConfig,
  type ConnectionStatus
} from './ApiClient';

// Download client base class
export {
  DownloadClient,
  type DownloadItem,
  type AddDownloadOptions,
  type GetStatusOptions
} from './DownloadClient';

// Metadata provider base class
export {
  MetadataProvider,
  type Manga,
  type Chapter,
  type Author,
  type SearchOptions
} from './MetadataProvider';

// Re-export Prisma enums that are used by MetadataProvider
export { MangaPublicationStatus, ContentRating, PublicationDemographic } from '@prisma/client';