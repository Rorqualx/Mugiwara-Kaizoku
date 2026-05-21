/**
 * Universal Import Wizard Utilities Module
 *
 * Shared helper functions, type definitions, and validation utilities
 * used across all universal import wizard type guard modules.
 *
 * Extracted from: universal-import-wizard.ts
 */

import type {
  Volume,
  Chapter,
  MediaGallery,
  VolumesData,
  BatchFetchProgress,
  ImportProgress,
  WizardFormData,
  MetadataPreviewItem,
  FieldSelectorOption,
  ProviderOption,
  LoadingStates,
  ErrorStates
} from "@/types/universalImportWizard.types";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely access property on unknown object
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === "object" && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Check if value is a record (object with string keys)
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Safely get string property from unknown object
 */
export function safeGetString(obj: unknown, key: string): string | undefined {
  const value = safeGet(obj, key);
  return typeof value === "string" ? value : undefined;
}

/**
 * Safely get number property from unknown object
 */
export function safeGetNumber(obj: unknown, key: string): number | undefined {
  const value = safeGet(obj, key);
  return typeof value === "number" ? value : undefined;
}

/**
 * Safely get boolean property from unknown object
 */
export function safeGetBoolean(obj: unknown, key: string): boolean | undefined {
  const value = safeGet(obj, key);
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Check if array contains only strings
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x: unknown) => typeof x === "string");
}

/**
 * Check if array contains only numbers
 */
export function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((x: unknown) => typeof x === "number");
}

/**
 * Check if property exists and has correct type (optional validation)
 */
export function hasOptionalProperty(
  obj: Record<string, unknown>,
  key: string,
  type: "string" | "number" | "boolean" | "object" | "array"
): boolean {
  if (!(key in obj)) {
    return true; // Optional property can be missing
  }

  const value = obj[key];
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null;
    case "array":
      return Array.isArray(value);
    default:
      return false;
  }
}

/**
 * Check if property exists and has correct type (required validation)
 */
export function hasRequiredProperty(
  obj: Record<string, unknown>,
  key: string,
  type: "string" | "number" | "boolean" | "object" | "array"
): boolean {
  if (!(key in obj)) {
    return false; // Required property must exist
  }

  const value = obj[key];
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null;
    case "array":
      return Array.isArray(value);
    default:
      return false;
  }
}

/**
 * Validate array with custom element validator
 */
export function validateArray<T>(
  value: unknown,
  elementValidator: (element: unknown) => element is T
): value is T[] {
  return Array.isArray(value) && value.every(elementValidator);
}

// ============================================================================
// Type Definitions (Re-export for convenience)
// ============================================================================

export type {
  Volume,
  Chapter,
  MediaGallery,
  VolumesData,
  BatchFetchProgress,
  ImportProgress,
  WizardFormData,
  MetadataPreviewItem,
  FieldSelectorOption,
  ProviderOption,
  LoadingStates,
  ErrorStates
};
