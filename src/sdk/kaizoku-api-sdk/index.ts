/**
 * Kaizoku API SDK - Main Entry Point
 *
 * This module re-exports all SDK components for backward compatibility.
 * The SDK has been decomposed into focused modules for better maintainability:
 *
 * Architecture:
 * - types.ts: Type definitions and interfaces (~230 lines)
 * - utils.ts: Helper functions and type guards (~70 lines)
 * - api-error.ts: Custom error class (~22 lines)
 * - client-base.ts: Core HTTP client with request handling (~440 lines)
 * - client.ts: Full API client with all endpoints (~480 lines)
 *
 * Original file: kaizoku-api-sdk.ts (1088 lines)
 * Refactored: 5 modules (total ~1240 lines, but each under 500)
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  KaizokuApiConfig,
  ApiResponse,
  PaginationMeta,
  PaginatedResponse,
  MangaResource,
  LibraryResource,
  ChapterResource,
  DownloadResource,
  WebhookResource,
  MetadataProvider,
  CreateMangaRequest,
  UpdateMangaRequest,
  CreateLibraryRequest,
  UpdateLibraryRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  SearchMetadataParams,
  RefreshMetadataRequest,
} from './types';

// ============================================================================
// Error Class Export
// ============================================================================

export { ApiError } from './api-error';

// ============================================================================
// Client Exports
// ============================================================================

export { KaizokuApiClient, createKaizokuApiClient } from './client';

// ============================================================================
// Utility Exports (for advanced users)
// ============================================================================

export {
  isRecord,
  getErrorMessage,
  toError,
  safeJsonParse,
  isApiErrorResponse,
  type ApiErrorResponse,
} from './utils';
