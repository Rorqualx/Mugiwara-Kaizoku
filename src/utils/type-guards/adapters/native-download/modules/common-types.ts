/**
 * Common Types Type Guards
 *
 * This module contains type guards for validating common utility type objects,
 * ensuring type safety for pagination and error handling.
 *
 * @module CommonTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type { Pagination, ErrorResponse } from "@/types/common";

/**
 * Type guard for Pagination
 * Validates that an object conforms to the Pagination interface
 */
export function isPagination(obj: unknown): obj is Pagination {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["page"] === "number" &&
    typeof candidate["limit"] === "number" &&
    (!("total" in candidate) || typeof candidate["total"] === "number") &&
    (!("hasMore" in candidate) || typeof candidate["hasMore"] === "boolean")
  );
}

/**
 * Type guard for ErrorResponse
 * Validates that an object conforms to the ErrorResponse interface
 */
export function isErrorResponse(obj: unknown): obj is ErrorResponse {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["error"] === "string" &&
    (!("message" in candidate) || typeof candidate["message"] === "string") &&
    (!("code" in candidate) || typeof candidate["code"] === "string") &&
    (!("statusCode" in candidate) || typeof candidate["statusCode"] === "number")
  );
}