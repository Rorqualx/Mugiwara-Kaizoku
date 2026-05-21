/**
 * Volume Type Validators
 *
 * Decomposed type guards for validating Volume objects.
 * Extracted from universal-import-wizard.ts (lines 32-57)
 */

import type { Volume } from "@/types/universalImportWizard.types";

import {
  hasOptionalProperty
} from './universal-import-wizard/utils';

/**
 * Validate basic required properties of a Volume
 */
export function validateVolumeBasicProperties(candidate: Record<string, unknown>): boolean {
  return typeof candidate["title"] === "string";
}

/**
 * Validate numeric properties of a Volume
 */
export function validateVolumeNumericProperties(candidate: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(candidate, "volumeNumber", "number") &&
    hasOptionalProperty(candidate, "number", "number") &&
    hasOptionalProperty(candidate, "chapterCount", "number") &&
    hasOptionalProperty(candidate, "issueNumber", "number")
  );
}

/**
 * Validate string properties of a Volume
 */
export function validateVolumeStringProperties(candidate: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(candidate, "coverImageUrl", "string") &&
    hasOptionalProperty(candidate, "coverUrl", "string") &&
    hasOptionalProperty(candidate, "coverImage", "string") &&
    hasOptionalProperty(candidate, "description", "string") &&
    hasOptionalProperty(candidate, "issueName", "string") &&
    hasOptionalProperty(candidate, "name", "string") &&
    hasOptionalProperty(candidate, "volumeName", "string") &&
    hasOptionalProperty(candidate, "volumeSummary", "string") &&
    hasOptionalProperty(candidate, "url", "string")
  );
}

/**
 * Validate boolean properties of a Volume
 */
export function validateVolumeBooleanProperties(candidate: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(candidate, "needsChapterScraping", "boolean")
  );
}

/**
 * Validate array properties of a Volume
 */
export function validateVolumeArrayProperties(candidate: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(candidate, "chapters", "array")
  );
}

/**
 * Type guard for Volume
 * Validates that an object conforms to the Volume interface
 *
 * Decomposed from original 25-condition function
 */
export function isVolume(obj: unknown): obj is Volume {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateVolumeBasicProperties(candidate) &&
    validateVolumeNumericProperties(candidate) &&
    validateVolumeStringProperties(candidate) &&
    validateVolumeBooleanProperties(candidate) &&
    validateVolumeArrayProperties(candidate)
  );
}