/**
 * Test Types Type Guards
 *
 * This module contains type guards for validating test type objects,
 * ensuring type safety for testing infrastructure, API mocking, event simulation,
 * and test data management across the application's testing framework.
 *
 * @module TestTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  TestApiRequest,
  TestApiResponse,
  TestUserContext,
  TestTRPCContext,
  TestEvent,
  TestEventResponse,
  TestEventSettings,
  TestAniListSettings,
  TestAniListManga,
  TestTask,
  TestSettings,
  TestManga
} from "@/types/test-types";

/**
 * Type guard for TestApiRequest
 * Validates that an object conforms to the TestApiRequest interface
 */
export function isTestApiRequest(obj: unknown): obj is TestApiRequest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "headers" in candidate
  );
}

/**
 * Type guard for TestApiResponse
 * Validates that an object conforms to the TestApiResponse interface
 */
export function isTestApiResponse(obj: unknown): obj is TestApiResponse {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for TestUserContext
 * Validates that an object conforms to the TestUserContext interface
 */
export function isTestUserContext(obj: unknown): obj is TestUserContext {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    "role" in candidate
  );
}

/**
 * Type guard for TestTRPCContext
 * Validates that an object conforms to the TestTRPCContext interface
 */
export function isTestTRPCContext(obj: unknown): obj is TestTRPCContext {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "req" in candidate &&
    "res" in candidate &&
    (!("user" in candidate) || "user" in candidate)
  );
}

/**
 * Type guard for TestEvent
 * Validates that an object conforms to the TestEvent interface
 */
export function isTestEvent(obj: unknown): obj is TestEvent {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    "type" in candidate &&
    "source" in candidate &&
    "level" in candidate &&
    typeof candidate["message"] === "string" &&
    (!("details" in candidate) || "details" in candidate) &&
    (!("relatedID" in candidate) || typeof candidate["relatedID"] === "string") &&
    (!("relatedEntityType" in candidate) || typeof candidate["relatedEntityType"] === "string") &&
    candidate["timestamp"] instanceof Date &&
    (!("userId" in candidate) || "userId" in candidate)
  );
}

/**
 * Type guard for TestEventResponse
 * Validates that an object conforms to the TestEventResponse interface
 */
export function isTestEventResponse(obj: unknown): obj is TestEventResponse {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    Array.isArray(candidate["events"]) &&
    typeof candidate["total"] === "number" &&
    typeof candidate["page"] === "number" &&
    typeof candidate["pageSize"] === "number" &&
    typeof candidate["totalPages"] === "number"
  );
}

/**
 * Type guard for TestEventSettings
 * Validates that an object conforms to the TestEventSettings interface
 */
export function isTestEventSettings(obj: unknown): obj is TestEventSettings {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    typeof candidate["metadata"] === "string" &&
    candidate["createdAt"] instanceof Date &&
    candidate["updatedAt"] instanceof Date
  );
}

/**
 * Type guard for TestAniListSettings
 * Validates that an object conforms to the TestAniListSettings interface
 */
export function isTestAniListSettings(obj: unknown): obj is TestAniListSettings {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    typeof candidate["metadata"] === "string"
  );
}

/**
 * Validates basic required properties for TestAniListManga
 */
function validateBasicInfo(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate["id"] === "number" &&
    "title" in candidate
  );
}

/**
 * Validates optional string properties for TestAniListManga
 */
function validateOptionalStrings(candidate: Record<string, unknown>): boolean {
  return (
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("status" in candidate) || typeof candidate["status"] === "string") &&
    (!("countryOfOrigin" in candidate) || typeof candidate["countryOfOrigin"] === "string") &&
    (!("source" in candidate) || typeof candidate["source"] === "string")
  );
}

/**
 * Validates optional array properties for TestAniListManga
 */
function validateOptionalArrays(candidate: Record<string, unknown>): boolean {
  return (
    (!("genres" in candidate) || Array.isArray(candidate["genres"]) && candidate["genres"].every((x: unknown) => typeof x === "string")) &&
    (!("synonyms" in candidate) || Array.isArray(candidate["synonyms"]) && candidate["synonyms"].every((x: unknown) => typeof x === "string"))
  );
}

/**
 * Validates optional object properties for TestAniListManga
 */
function validateOptionalObjects(candidate: Record<string, unknown>): boolean {
  return (
    (!("coverImage" in candidate) || "coverImage" in candidate) &&
    (!("tags" in candidate) || "tags" in candidate) &&
    (!("startDate" in candidate) || "startDate" in candidate) &&
    (!("endDate" in candidate) || "endDate" in candidate) &&
    (!("chapters" in candidate) || "chapters" in candidate) &&
    (!("volumes" in candidate) || "volumes" in candidate) &&
    (!("staff" in candidate) || "staff" in candidate) &&
    (!("characters" in candidate) || "characters" in candidate)
  );
}

/**
 * Validates optional number properties for TestAniListManga
 */
function validateOptionalNumbers(candidate: Record<string, unknown>): boolean {
  return (
    (!("averageScore" in candidate) || typeof candidate["averageScore"] === "number") &&
    (!("popularity" in candidate) || typeof candidate["popularity"] === "number")
  );
}

/**
 * Validates optional boolean properties for TestAniListManga
 */
function validateOptionalBooleans(candidate: Record<string, unknown>): boolean {
  return (
    (!("isAdult" in candidate) || typeof candidate["isAdult"] === "boolean")
  );
}

/**
 * Type guard for TestAniListManga
 * Validates that an object conforms to the TestAniListManga interface
 */
export function isTestAniListManga(obj: unknown): obj is TestAniListManga {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateBasicInfo(candidate) &&
    validateOptionalStrings(candidate) &&
    validateOptionalArrays(candidate) &&
    validateOptionalObjects(candidate) &&
    validateOptionalNumbers(candidate) &&
    validateOptionalBooleans(candidate)
  );
}

/**
 * Type guard for TestTask
 * Validates that an object conforms to the TestTask interface
 */
export function isTestTask(obj: unknown): obj is TestTask {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    typeof candidate["type"] === "string" &&
    typeof candidate["status"] === "string" &&
    typeof candidate["priority"] === "number" &&
    "payload" in candidate &&
    (!("result" in candidate) || "result" in candidate) &&
    (!("error" in candidate) || typeof candidate["error"] === "string") &&
    candidate["createdAt"] instanceof Date &&
    candidate["updatedAt"] instanceof Date &&
    (!("startedAt" in candidate) || candidate["startedAt"] instanceof Date) &&
    (!("completedAt" in candidate) || candidate["completedAt"] instanceof Date)
  );
}

/**
 * Type guard for TestSettings
 * Validates that an object conforms to the TestSettings interface
 */
export function isTestSettings(obj: unknown): obj is TestSettings {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    "metadata" in candidate &&
    candidate["createdAt"] instanceof Date &&
    candidate["updatedAt"] instanceof Date
  );
}

/**
 * Type guard for TestManga
 * Validates that an object conforms to the TestManga interface
 */
export function isTestManga(obj: unknown): obj is TestManga {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    typeof candidate["title"] === "string" &&
    (!("metadata" in candidate) || "metadata" in candidate)
  );
}
