/**
 * Import Rules Types Type Guards
 *
 * This module contains type guards for validating import rule type objects,
 * ensuring type safety for file import automation and rule processing.
 *
 * @module ImportRulesTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  ImportRule,
  RuleCondition,
  RuleAction,
  ImportActions,
  ImportContext,
  ParsedFileInfo,
  ParsedMangaInfo,
  AdvancedPattern,
  PatternExtractor,
  RuleValidationResult,
  RuleTestResult
} from "@/types/import-rules";

import {
  validateImportActionsLibrary,
  validateImportActionsTags,
  validateImportActionsStatus,
  validateImportActionsSkip,
  validateImportActionsMetadata,
  validateImportActionsPriority,
  validateImportActionsNaming,
  validateImportActionsDestination,
  validateImportActionsReadingDirection
} from "./import-rules-utils";

/**
 * Type guard for ImportRule
 * Validates that an object conforms to the ImportRule interface
 */
export function isImportRule(obj: unknown): obj is ImportRule {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    typeof candidate["enabled"] === "boolean" &&
    Array.isArray(candidate["conditions"]) &&
    Array.isArray(candidate["actions"]) &&
    typeof candidate["priority"] === "number" &&
    candidate["createdAt"] instanceof Date &&
    candidate["updatedAt"] instanceof Date
  );
}

/**
 * Type guard for RuleCondition
 * Validates that an object conforms to the RuleCondition interface
 */
export function isRuleCondition(obj: unknown): obj is RuleCondition {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "operator" in candidate &&
    "value" in candidate &&
    (!("caseSensitive" in candidate) || typeof candidate["caseSensitive"] === "boolean") &&
    (!("negate" in candidate) || typeof candidate["negate"] === "boolean")
  );
}

/**
 * Type guard for RuleAction
 * Validates that an object conforms to the RuleAction interface
 */
export function isRuleAction(obj: unknown): obj is RuleAction {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    Array.isArray(candidate["value"]) &&
    (!("options" in candidate) || "options" in candidate)
  );
}

/**
 * Type guard for ImportActions
 * Validates that an object conforms to the ImportActions interface
 */
export function isImportActions(obj: unknown): obj is ImportActions {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateImportActionsLibrary(candidate) &&
    validateImportActionsTags(candidate) &&
    validateImportActionsStatus(candidate) &&
    validateImportActionsSkip(candidate) &&
    validateImportActionsMetadata(candidate) &&
    validateImportActionsPriority(candidate) &&
    validateImportActionsNaming(candidate) &&
    validateImportActionsDestination(candidate) &&
    validateImportActionsReadingDirection(candidate)
  );
}

/**
 * Type guard for ImportContext
 * Validates that an object conforms to the ImportContext interface
 */
export function isImportContext(obj: unknown): obj is ImportContext {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "availableLibraries" in candidate &&
    "existingManga" in candidate &&
    Array.isArray(candidate["metadataProviders"]) && candidate["metadataProviders"].every((x: unknown) => typeof x === "string") &&
    (!("defaultLibraryId" in candidate) || typeof candidate["defaultLibraryId"] === "number")
  );
}

/**
 * Type guard for ParsedFileInfo
 * Validates that an object conforms to the ParsedFileInfo interface
 */
export function isParsedFileInfo(obj: unknown): obj is ParsedFileInfo {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["path"] === "string" &&
    typeof candidate["filename"] === "string" &&
    typeof candidate["size"] === "number" &&
    typeof candidate["title"] === "string" &&
    (!("group" in candidate) || typeof candidate["group"] === "string") &&
    (!("language" in candidate) || typeof candidate["language"] === "string") &&
    (!("volume" in candidate) || typeof candidate["volume"] === "number") &&
    (!("chapter" in candidate) || typeof candidate["chapter"] === "number") &&
    (!("chapters" in candidate) || Array.isArray(candidate["chapters"]) && candidate["chapters"].every((x: unknown) => typeof x === "number"))
  );
}

/**
 * Type guard for ParsedMangaInfo
 * Validates that an object conforms to the ParsedMangaInfo interface
 */
export function isParsedMangaInfo(obj: unknown): obj is ParsedMangaInfo {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["originalFilename"] === "string" &&
    typeof candidate["cleanTitle"] === "string" &&
    (!("group" in candidate) || typeof candidate["group"] === "string") &&
    (!("volume" in candidate) || typeof candidate["volume"] === "number") &&
    (!("chapter" in candidate) || typeof candidate["chapter"] === "number") &&
    Array.isArray(candidate["chapters"]) && candidate["chapters"].every((x: unknown) => typeof x === "number") &&
    (!("language" in candidate) || typeof candidate["language"] === "string") &&
    (!("quality" in candidate) || typeof candidate["quality"] === "string")
  );
}

/**
 * Type guard for AdvancedPattern
 * Validates that an object conforms to the AdvancedPattern interface
 */
export function isAdvancedPattern(obj: unknown): obj is AdvancedPattern {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    (!("description" in candidate) || typeof candidate["description"] === "string") &&
    typeof candidate["pattern"] === "string" &&
    Array.isArray(candidate["extractors"]) &&
    (!("examples" in candidate) || Array.isArray(candidate["examples"]) && candidate["examples"].every((x: unknown) => typeof x === "string")) &&
    typeof candidate["priority"] === "number"
  );
}

/**
 * Type guard for PatternExtractor
 * Validates that an object conforms to the PatternExtractor interface
 */
export function isPatternExtractor(obj: unknown): obj is PatternExtractor {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "field" in candidate &&
    typeof candidate["groupIndex"] === "number" &&
    (!("transform" in candidate) || "transform" in candidate) &&
    (!("customTransform" in candidate) || typeof candidate["customTransform"] === "string")
  );
}

/**
 * Type guard for RuleValidationResult
 * Validates that an object conforms to the RuleValidationResult interface
 */
export function isRuleValidationResult(obj: unknown): obj is RuleValidationResult {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["valid"] === "boolean" &&
    Array.isArray(candidate["errors"]) && candidate["errors"].every((x: unknown) => typeof x === "string") &&
    Array.isArray(candidate["warnings"]) && candidate["warnings"].every((x: unknown) => typeof x === "string")
  );
}

/**
 * Type guard for RuleTestResult
 * Validates that an object conforms to the RuleTestResult interface
 */
export function isRuleTestResult(obj: unknown): obj is RuleTestResult {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "rule" in candidate &&
    typeof candidate["matched"] === "boolean" &&
    "conditions" in candidate &&
    "actions" in candidate
  );
}
