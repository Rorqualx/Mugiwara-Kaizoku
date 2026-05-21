/**
 * API V1 Response Type Guards
 *
 * This module contains type guards for validating API V1 response objects,
 * ensuring type safety for all outgoing API responses.
 *
 * @module ApiV1ResponseTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  MangaResponse,
  ChapterResponse,
  LibraryResponse,
  MetadataResponse,
  JobResponse,
  ApiKeyListResponse,
  ApiKeyDetailResponse,
  VolumeResponse,
  UserResponse,
  BulkOperationResponse,
  ErrorResponse
} from "@/types/api/v1/responses";

/**
 * Type guard for MangaResponse
 * Validates that an object conforms to the MangaResponse interface
 */
export function isMangaResponse(obj: unknown): obj is MangaResponse {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for ChapterResponse
 * Validates that an object conforms to the ChapterResponse interface
 */
export function isChapterResponse(obj: unknown): obj is ChapterResponse {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for LibraryResponse
 * Validates that an object conforms to the LibraryResponse interface
 */
export function isLibraryResponse(obj: unknown): obj is LibraryResponse {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for MetadataResponse
 * Validates that an object conforms to the MetadataResponse interface
 */
export function isMetadataResponse(obj: unknown): obj is MetadataResponse {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for JobResponse
 * Validates that an object conforms to the JobResponse interface
 */
export function isJobResponse(obj: unknown): obj is JobResponse {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for ApiKeyListResponse
 * Validates that an object conforms to the ApiKeyListResponse interface
 */
export function isApiKeyListResponse(obj: unknown): obj is ApiKeyListResponse {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for ApiKeyDetailResponse
 * Validates that an object conforms to the ApiKeyDetailResponse interface
 */
export function isApiKeyDetailResponse(obj: unknown): obj is ApiKeyDetailResponse {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for VolumeResponse
 * Validates that an object conforms to the VolumeResponse interface
 */
export function isVolumeResponse(obj: unknown): obj is VolumeResponse {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for UserResponse
 * Validates that an object conforms to the UserResponse interface
 */
export function isUserResponse(obj: unknown): obj is UserResponse {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for BulkOperationResponse
 * Validates that an object conforms to the BulkOperationResponse interface
 */
export function isBulkOperationResponse(obj: unknown): obj is BulkOperationResponse {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for ErrorResponse
 * Validates that an object conforms to the ErrorResponse interface
 */
export function isErrorResponse(obj: unknown): obj is ErrorResponse {
  return typeof obj === "object" && obj !== null;
}