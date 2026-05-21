/**
 * ComicVine Adapter Type Guards
 *
 * Type guards for ComicVine adapter types and API responses
 */

import type {
  ComicVineAdapterConfig,
  ComicVineVolume,
  ComicVineIssue,
  ComicVineImage,
  ComicVinePublisher,
  ComicVineCharacter,
  ComicVineCreator,
  ComicVineSearchResult,
  ComicVineVolumeDetails,
  ComicVineIssueDetails,
  ComicVineConfig
} from "@/types/adapters/comicvine";

/**
 * Check if a value is a ComicVineAdapterConfig
 */
export function isComicVineAdapterConfig(obj: unknown): obj is ComicVineAdapterConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["apiKey"] === "string" &&
    (!("baseUrl" in candidate) || typeof candidate["baseUrl"] === "string") &&
    (!("preferredPublisher" in candidate) || typeof candidate["preferredPublisher"] === "string") &&
    (!("includeVariants" in candidate) || typeof candidate["includeVariants"] === "boolean")
  );
}

/**
 * Validate required ComicVineVolume fields
 */
function validateComicVineVolumeRequired(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string"
  );
}

/**
 * Validate optional string fields for ComicVineVolume
 */
function validateComicVineVolumeStrings(candidate: Record<string, unknown>): boolean {
  return (
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("deck" in candidate) || typeof candidate["deck"] === "string") &&
    (!("start_year" in candidate) || typeof candidate["start_year"] === "string") &&
    (!("api_detail_url" in candidate) || typeof candidate["api_detail_url"] === "string") &&
    (!("site_detail_url" in candidate) || typeof candidate["site_detail_url"] === "string") &&
    (!("date_added" in candidate) || typeof candidate["date_added"] === "string") &&
    (!("date_last_updated" in candidate) || typeof candidate["date_last_updated"] === "string") &&
    (!("resource_type" in candidate) || typeof candidate["resource_type"] === "string")
  );
}

/**
 * Validate optional object/array fields for ComicVineVolume
 */
function validateComicVineVolumeObjects(candidate: Record<string, unknown>): boolean {
  return (
    (!("count_of_issues" in candidate) || typeof candidate["count_of_issues"] === "number") &&
    (!("image" in candidate) || "image" in candidate) &&
    (!("publisher" in candidate) || "publisher" in candidate) &&
    (!("characters" in candidate) || Array.isArray(candidate["characters"])) &&
    (!("people" in candidate) || Array.isArray(candidate["people"])) &&
    (!("first_issue" in candidate) || "first_issue" in candidate) &&
    (!("last_issue" in candidate) || "last_issue" in candidate)
  );
}

/**
 * Check if a value is a ComicVineVolume
 */
export function isComicVineVolume(obj: unknown): obj is ComicVineVolume {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateComicVineVolumeRequired(candidate) &&
    validateComicVineVolumeStrings(candidate) &&
    validateComicVineVolumeObjects(candidate)
  );
}

/**
 * Validate required ComicVineIssue fields
 */
function validateComicVineIssueRequired(candidate: Record<string, unknown>): boolean {
  return typeof candidate["id"] === "string";
}

/**
 * Validate optional string fields for ComicVineIssue
 */
function validateComicVineIssueStrings(candidate: Record<string, unknown>): boolean {
  return (
    (!("issue_number" in candidate) || typeof candidate["issue_number"] === "string") &&
    (!("name" in candidate) || typeof candidate["name"] === "string") &&
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("cover_date" in candidate) || typeof candidate["cover_date"] === "string") &&
    (!("store_date" in candidate) || typeof candidate["store_date"] === "string") &&
    (!("api_detail_url" in candidate) || typeof candidate["api_detail_url"] === "string") &&
    (!("site_detail_url" in candidate) || typeof candidate["site_detail_url"] === "string")
  );
}

/**
 * Validate optional object fields for ComicVineIssue
 */
function validateComicVineIssueObjects(candidate: Record<string, unknown>): boolean {
  return (
    (!("image" in candidate) || "image" in candidate) &&
    (!("volume" in candidate) || "volume" in candidate)
  );
}

/**
 * Check if a value is a ComicVineIssue
 */
export function isComicVineIssue(obj: unknown): obj is ComicVineIssue {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateComicVineIssueRequired(candidate) &&
    validateComicVineIssueStrings(candidate) &&
    validateComicVineIssueObjects(candidate)
  );
}

/**
 * Check if a value is a ComicVineImage
 */
export function isComicVineImage(obj: unknown): obj is ComicVineImage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("icon_url" in candidate) || typeof candidate["icon_url"] === "string") &&
    (!("medium_url" in candidate) || typeof candidate["medium_url"] === "string") &&
    (!("screen_url" in candidate) || typeof candidate["screen_url"] === "string") &&
    (!("screen_large_url" in candidate) || typeof candidate["screen_large_url"] === "string") &&
    (!("small_url" in candidate) || typeof candidate["small_url"] === "string") &&
    (!("super_url" in candidate) || typeof candidate["super_url"] === "string") &&
    (!("thumb_url" in candidate) || typeof candidate["thumb_url"] === "string") &&
    (!("tiny_url" in candidate) || typeof candidate["tiny_url"] === "string") &&
    (!("original_url" in candidate) || typeof candidate["original_url"] === "string")
  );
}

/**
 * Check if a value is a ComicVinePublisher
 */
export function isComicVinePublisher(obj: unknown): obj is ComicVinePublisher {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    (!("api_detail_url" in candidate) || typeof candidate["api_detail_url"] === "string") &&
    (!("site_detail_url" in candidate) || typeof candidate["site_detail_url"] === "string")
  );
}

/**
 * Check if a value is a ComicVineCharacter
 */
export function isComicVineCharacter(obj: unknown): obj is ComicVineCharacter {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    (!("real_name" in candidate) || typeof candidate["real_name"] === "string") &&
    (!("aliases" in candidate) || typeof candidate["aliases"] === "string") &&
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("image" in candidate) || "image" in candidate) &&
    (!("api_detail_url" in candidate) || typeof candidate["api_detail_url"] === "string") &&
    (!("site_detail_url" in candidate) || typeof candidate["site_detail_url"] === "string")
  );
}

/**
 * Check if a value is a ComicVineCreator
 */
export function isComicVineCreator(obj: unknown): obj is ComicVineCreator {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    (!("role" in candidate) || typeof candidate["role"] === "string") &&
    (!("api_detail_url" in candidate) || typeof candidate["api_detail_url"] === "string") &&
    (!("site_detail_url" in candidate) || typeof candidate["site_detail_url"] === "string")
  );
}

/**
 * Check if a value is a ComicVineSearchResult
 */
export function isComicVineSearchResult(obj: unknown): obj is ComicVineSearchResult {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("image" in candidate) || "image" in candidate) &&
    (!("resource_type" in candidate) || typeof candidate["resource_type"] === "string") &&
    (!("count_of_issues" in candidate) || typeof candidate["count_of_issues"] === "number") &&
    (!("publisher" in candidate) || "publisher" in candidate) &&
    (!("start_year" in candidate) || typeof candidate["start_year"] === "string") &&
    (!("api_detail_url" in candidate) || typeof candidate["api_detail_url"] === "string") &&
    (!("site_detail_url" in candidate) || typeof candidate["site_detail_url"] === "string")
  );
}

/**
 * Validate string fields for ComicVineVolumeDetails
 */
function validateVolumeDetailsStrings(candidate: Record<string, unknown>): boolean {
  return (
    (!("aliases" in candidate) || typeof candidate["aliases"] === "string") &&
    (!("date_added" in candidate) || typeof candidate["date_added"] === "string") &&
    (!("date_last_updated" in candidate) || typeof candidate["date_last_updated"] === "string") &&
    (!("deck" in candidate) || typeof candidate["deck"] === "string") &&
    (!("description" in candidate) || typeof candidate["description"] === "string")
  );
}

/**
 * Validate array fields for ComicVineVolumeDetails
 */
function validateVolumeDetailsArrays(candidate: Record<string, unknown>): boolean {
  return (
    (!("characters" in candidate) || Array.isArray(candidate["characters"])) &&
    (!("concepts" in candidate) || Array.isArray(candidate["concepts"])) &&
    (!("issues" in candidate) || Array.isArray(candidate["issues"])) &&
    (!("locations" in candidate) || Array.isArray(candidate["locations"])) &&
    (!("objects" in candidate) || Array.isArray(candidate["objects"])) &&
    (!("people" in candidate) || Array.isArray(candidate["people"])) &&
    (!("teams" in candidate) || Array.isArray(candidate["teams"]))
  );
}

/**
 * Validate object fields for ComicVineVolumeDetails
 */
function validateVolumeDetailsObjects(candidate: Record<string, unknown>): boolean {
  return (
    (!("count_of_issues" in candidate) || typeof candidate["count_of_issues"] === "number") &&
    (!("first_issue" in candidate) || "first_issue" in candidate) &&
    (!("last_issue" in candidate) || "last_issue" in candidate) &&
    (!("publisher" in candidate) || "publisher" in candidate)
  );
}

/**
 * Check if a value is a ComicVineVolumeDetails
 */
export function isComicVineVolumeDetails(obj: unknown): obj is ComicVineVolumeDetails {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateVolumeDetailsStrings(candidate) &&
    validateVolumeDetailsArrays(candidate) &&
    validateVolumeDetailsObjects(candidate)
  );
}

/**
 * Validate string fields for ComicVineIssueDetails
 */
function validateIssueDetailsStrings(candidate: Record<string, unknown>): boolean {
  return (
    (!("aliases" in candidate) || typeof candidate["aliases"] === "string") &&
    (!("cover_date" in candidate) || typeof candidate["cover_date"] === "string") &&
    (!("date_added" in candidate) || typeof candidate["date_added"] === "string") &&
    (!("date_last_updated" in candidate) || typeof candidate["date_last_updated"] === "string") &&
    (!("deck" in candidate) || typeof candidate["deck"] === "string") &&
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    (!("store_date" in candidate) || typeof candidate["store_date"] === "string")
  );
}

/**
 * Validate array fields for ComicVineIssueDetails
 */
function validateIssueDetailsArrays(candidate: Record<string, unknown>): boolean {
  return (
    (!("character_credits" in candidate) || Array.isArray(candidate["character_credits"])) &&
    (!("concept_credits" in candidate) || Array.isArray(candidate["concept_credits"])) &&
    (!("location_credits" in candidate) || Array.isArray(candidate["location_credits"])) &&
    (!("object_credits" in candidate) || Array.isArray(candidate["object_credits"])) &&
    (!("person_credits" in candidate) || Array.isArray(candidate["person_credits"])) &&
    (!("team_credits" in candidate) || Array.isArray(candidate["team_credits"]))
  );
}

/**
 * Check if a value is a ComicVineIssueDetails
 */
export function isComicVineIssueDetails(obj: unknown): obj is ComicVineIssueDetails {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateIssueDetailsStrings(candidate) &&
    validateIssueDetailsArrays(candidate) &&
    (!("has_staff_review" in candidate) || typeof candidate["has_staff_review"] === "boolean")
  );
}

/**
 * Check if a value is a ComicVineConfig
 */
export function isComicVineConfig(obj: unknown): obj is ComicVineConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    (!("apiEndpoint" in candidate) || typeof candidate["apiEndpoint"] === "string") &&
    (!("throttleMs" in candidate) || typeof candidate["throttleMs"] === "number")
  );
}