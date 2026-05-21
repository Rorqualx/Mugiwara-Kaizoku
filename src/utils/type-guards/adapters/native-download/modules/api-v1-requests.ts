/**
 * API V1 Request Type Guards
 *
 * This module contains type guards for validating API V1 request objects,
 * ensuring type safety for all incoming API requests.
 *
 * @module ApiV1RequestTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  PaginationRequest,
  FilterRequest,
  CreateMangaRequest,
  UpdateMangaRequest,
  CreateChapterRequest,
  UpdateChapterRequest,
  DownloadRequest,
  SearchRequest,
  CreateTaskRequest,
  CreateUserRequest,
  UpdateUserRequest,
  LoginRequest,
  RefreshTokenRequest,
  UpdateConfigRequest,
  LibraryScanRequest,
  MetadataRefreshRequest,
  ExportRequest,
  ImportRequest,
  CreateVolumeRequest,
  UpdateVolumeRequest,
  DeleteVolumeRequest,
  DeleteUserRequest,
  BulkOperationRequest
} from "@/types/api/v1/requests";

import {
  validateMangaCoreProperties,
  validateMangaOptionalProperties,
  validateMangaUpdateProperties
} from "./api-v1-request-utils";

/**
 * Type guard for PaginationRequest
 * Validates that an object conforms to the PaginationRequest interface
 */
export function isPaginationRequest(obj: unknown): obj is PaginationRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("page" in candidate) || typeof candidate["page"] === "number") &&
    (!("pageSize" in candidate) || typeof candidate["pageSize"] === "number") &&
    (!("sortBy" in candidate) || typeof candidate["sortBy"] === "string") &&
    (!("sortOrder" in candidate) || "sortOrder" in candidate)
  );
}

/**
 * Type guard for FilterRequest
 * Validates that an object conforms to the FilterRequest interface
 */
export function isFilterRequest(obj: unknown): obj is FilterRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("status" in candidate) || Array.isArray(candidate["status"])) &&
    (!("source" in candidate) || Array.isArray(candidate["source"])) &&
    (!("tags" in candidate) || Array.isArray(candidate["tags"]) && candidate["tags"].every((x: unknown) => typeof x === "string")) &&
    (!("genres" in candidate) || Array.isArray(candidate["genres"]) && candidate["genres"].every((x: unknown) => typeof x === "string")) &&
    (!("authors" in candidate) || Array.isArray(candidate["authors"]) && candidate["authors"].every((x: unknown) => typeof x === "string")) &&
    (!("search" in candidate) || typeof candidate["search"] === "string")
  );
}

/**
 * Type guard for CreateMangaRequest
 * Validates that an object conforms to the CreateMangaRequest interface
 */
export function isCreateMangaRequest(obj: unknown): obj is CreateMangaRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateMangaCoreProperties(candidate) &&
    validateMangaOptionalProperties(candidate)
  );
}

/**
 * Type guard for UpdateMangaRequest
 * Validates that an object conforms to the UpdateMangaRequest interface
 */
export function isUpdateMangaRequest(obj: unknown): obj is UpdateMangaRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return validateMangaUpdateProperties(candidate);
}

/**
 * Type guard for CreateChapterRequest
 * Validates that an object conforms to the CreateChapterRequest interface
 */
export function isCreateChapterRequest(obj: unknown): obj is CreateChapterRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["mangaId"] === "number" &&
    typeof candidate["number"] === "number" &&
    (!("title" in candidate) || typeof candidate["title"] === "string") &&
    (!("volume" in candidate) || typeof candidate["volume"] === "number") &&
    (!("releaseDate" in candidate) || typeof candidate["releaseDate"] === "string") &&
    (!("pages" in candidate) || typeof candidate["pages"] === "number") &&
    (!("url" in candidate) || typeof candidate["url"] === "string")
  );
}

/**
 * Type guard for UpdateChapterRequest
 * Validates that an object conforms to the UpdateChapterRequest interface
 */
export function isUpdateChapterRequest(obj: unknown): obj is UpdateChapterRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("mangaId" in candidate) || typeof candidate["mangaId"] === "number") &&
    (!("number" in candidate) || typeof candidate["number"] === "number") &&
    (!("title" in candidate) || typeof candidate["title"] === "string") &&
    (!("volume" in candidate) || typeof candidate["volume"] === "number") &&
    (!("releaseDate" in candidate) || typeof candidate["releaseDate"] === "string") &&
    (!("pages" in candidate) || typeof candidate["pages"] === "number") &&
    (!("url" in candidate) || typeof candidate["url"] === "string")
  );
}

/**
 * Type guard for DownloadRequest
 * Validates that an object conforms to the DownloadRequest interface
 */
export function isDownloadRequest(obj: unknown): obj is DownloadRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["chapterId"] === "number" &&
    (!("quality" in candidate) || typeof candidate["quality"] === "string") &&
    (!("format" in candidate) || typeof candidate["format"] === "string")
  );
}

/**
 * Type guard for SearchRequest
 * Validates that an object conforms to the SearchRequest interface
 */
export function isSearchRequest(obj: unknown): obj is SearchRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["query"] === "string" &&
    (!("limit" in candidate) || typeof candidate["limit"] === "number") &&
    (!("offset" in candidate) || typeof candidate["offset"] === "number") &&
    (!("sortBy" in candidate) || typeof candidate["sortBy"] === "string") &&
    (!("filters" in candidate) || "filters" in candidate) &&
    (!("sourceIds" in candidate) || Array.isArray(candidate["sourceIds"]) && candidate["sourceIds"].every((x: unknown) => typeof x === "string")) &&
    (!("includeCover" in candidate) || typeof candidate["includeCover"] === "boolean")
  );
}

/**
 * Type guard for CreateTaskRequest
 * Validates that an object conforms to the CreateTaskRequest interface
 */
export function isCreateTaskRequest(obj: unknown): obj is CreateTaskRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["type"] === "string" &&
    (!("params" in candidate) || "params" in candidate) &&
    (!("priority" in candidate) || typeof candidate["priority"] === "number") &&
    (!("schedule" in candidate) || "schedule" in candidate)
  );
}

/**
 * Type guard for CreateUserRequest
 * Validates that an object conforms to the CreateUserRequest interface
 */
export function isCreateUserRequest(obj: unknown): obj is CreateUserRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["username"] === "string" &&
    typeof candidate["email"] === "string" &&
    typeof candidate["password"] === "string" &&
    (!("role" in candidate) || "role" in candidate) &&
    (!("permissions" in candidate) || Array.isArray(candidate["permissions"]) && candidate["permissions"].every((x: unknown) => typeof x === "string"))
  );
}

/**
 * Type guard for UpdateUserRequest
 * Validates that an object conforms to the UpdateUserRequest interface
 */
export function isUpdateUserRequest(obj: unknown): obj is UpdateUserRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("username" in candidate) || typeof candidate["username"] === "string") &&
    (!("email" in candidate) || typeof candidate["email"] === "string") &&
    (!("password" in candidate) || typeof candidate["password"] === "string") &&
    (!("role" in candidate) || "role" in candidate) &&
    (!("permissions" in candidate) || Array.isArray(candidate["permissions"]) && candidate["permissions"].every((x: unknown) => typeof x === "string"))
  );
}

/**
 * Type guard for LoginRequest
 * Validates that an object conforms to the LoginRequest interface
 */
export function isLoginRequest(obj: unknown): obj is LoginRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["username"] === "string" &&
    typeof candidate["password"] === "string" &&
    (!("remember" in candidate) || typeof candidate["remember"] === "boolean")
  );
}

/**
 * Type guard for RefreshTokenRequest
 * Validates that an object conforms to the RefreshTokenRequest interface
 */
export function isRefreshTokenRequest(obj: unknown): obj is RefreshTokenRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["refreshToken"] === "string"
  );
}

/**
 * Type guard for UpdateConfigRequest
 * Validates that an object conforms to the UpdateConfigRequest interface
 */
export function isUpdateConfigRequest(obj: unknown): obj is UpdateConfigRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "config" in candidate
  );
}

/**
 * Type guard for LibraryScanRequest
 * Validates that an object conforms to the LibraryScanRequest interface
 */
export function isLibraryScanRequest(obj: unknown): obj is LibraryScanRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("libraryId" in candidate) || typeof candidate["libraryId"] === "number") &&
    (!("force" in candidate) || typeof candidate["force"] === "boolean")
  );
}

/**
 * Type guard for MetadataRefreshRequest
 * Validates that an object conforms to the MetadataRefreshRequest interface
 */
export function isMetadataRefreshRequest(obj: unknown): obj is MetadataRefreshRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("mangaId" in candidate) || typeof candidate["mangaId"] === "number") &&
    (!("force" in candidate) || typeof candidate["force"] === "boolean")
  );
}

/**
 * Type guard for ExportRequest
 * Validates that an object conforms to the ExportRequest interface
 */
export function isExportRequest(obj: unknown): obj is ExportRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("format" in candidate) || typeof candidate["format"] === "string") &&
    (!("include" in candidate) || Array.isArray(candidate["include"]) && candidate["include"].every((x: unknown) => typeof x === "string")) &&
    (!("exclude" in candidate) || Array.isArray(candidate["exclude"]) && candidate["exclude"].every((x: unknown) => typeof x === "string"))
  );
}

/**
 * Type guard for ImportRequest
 * Validates that an object conforms to the ImportRequest interface
 */
export function isImportRequest(obj: unknown): obj is ImportRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["data"] === "string" &&
    (!("format" in candidate) || typeof candidate["format"] === "string") &&
    (!("overwrite" in candidate) || typeof candidate["overwrite"] === "boolean")
  );
}

/**
 * Type guard for CreateVolumeRequest
 * Validates that an object conforms to the CreateVolumeRequest interface
 */
export function isCreateVolumeRequest(obj: unknown): obj is CreateVolumeRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["mangaId"] === "number" &&
    typeof candidate["volumeNumber"] === "number" &&
    (!("title" in candidate) || typeof candidate["title"] === "string") &&
    (!("coverImage" in candidate) || typeof candidate["coverImage"] === "string") &&
    (!("releaseDate" in candidate) || typeof candidate["releaseDate"] === "string") &&
    (!("publisher" in candidate) || typeof candidate["publisher"] === "string") &&
    (!("isbn" in candidate) || typeof candidate["isbn"] === "string") &&
    (!("pageCount" in candidate) || typeof candidate["pageCount"] === "number")
  );
}

/**
 * Type guard for UpdateVolumeRequest
 * Validates that an object conforms to the UpdateVolumeRequest interface
 */
export function isUpdateVolumeRequest(obj: unknown): obj is UpdateVolumeRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("mangaId" in candidate) || typeof candidate["mangaId"] === "number") &&
    (!("volumeNumber" in candidate) || typeof candidate["volumeNumber"] === "number") &&
    (!("title" in candidate) || typeof candidate["title"] === "string") &&
    (!("coverImage" in candidate) || typeof candidate["coverImage"] === "string") &&
    (!("releaseDate" in candidate) || typeof candidate["releaseDate"] === "string") &&
    (!("publisher" in candidate) || typeof candidate["publisher"] === "string") &&
    (!("isbn" in candidate) || typeof candidate["isbn"] === "string") &&
    (!("pageCount" in candidate) || typeof candidate["pageCount"] === "number")
  );
}

/**
 * Type guard for DeleteVolumeRequest
 * Validates that an object conforms to the DeleteVolumeRequest interface
 */
export function isDeleteVolumeRequest(obj: unknown): obj is DeleteVolumeRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["volumeId"] === "number"
  );
}

/**
 * Type guard for DeleteUserRequest
 * Validates that an object conforms to the DeleteUserRequest interface
 */
export function isDeleteUserRequest(obj: unknown): obj is DeleteUserRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["userId"] === "number"
  );
}

/**
 * Type guard for BulkOperationRequest
 * Validates that an object conforms to the BulkOperationRequest interface
 */
export function isBulkOperationRequest(obj: unknown): obj is BulkOperationRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    Array.isArray(candidate["ids"]) && candidate["ids"].every((x: unknown) => typeof x === "number") &&
    typeof candidate["operation"] === "string" &&
    (!("params" in candidate) || "params" in candidate)
  );
}
