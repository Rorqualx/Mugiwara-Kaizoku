/**
 * Universal Import Wizard Type Guards
 *
 * This module contains type guards for validating universal import wizard type objects,
 * ensuring type safety for manga import workflows, volume and chapter management,
 * metadata preview, field selection, provider options, and import progress tracking.
 *
 * @module UniversalImportWizardTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 *
 * Architecture:
 * - This module aggregates decomposed validators from focused modules
 * - Complex functions extracted to: volume-validators.ts, chapter-validators.ts, wizard-form-validators.ts
 * - Shared utilities in: universal-import-wizard-utils.ts
 */

import type {
  MediaGallery,
  VolumesData,
  BatchFetchProgress,
  ImportProgress,
  MetadataPreviewItem,
  FieldSelectorOption,
  ProviderOption,
  LoadingStates,
  ErrorStates
} from "@/types/universalImportWizard.types";

// Import decomposed validators
import { isChapter } from './chapter-validators';
import { isVolume } from './volume-validators';
import { isWizardFormData } from './wizard-form-validators';

// Re-export decomposed validators
export { isChapter, isVolume, isWizardFormData };

/**
 * Type guard for MediaGallery
 * Validates that an object conforms to the MediaGallery interface
 */
export function isMediaGallery(obj: unknown): obj is MediaGallery {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    Array.isArray(candidate["covers"]) && candidate["covers"].every((x: unknown) => typeof x === "string") &&
    (!("coversWithProviders" in candidate) || "coversWithProviders" in candidate) &&
    Array.isArray(candidate["banners"]) && candidate["banners"].every((x: unknown) => typeof x === "string") &&
    Array.isArray(candidate["gallery"]) && candidate["gallery"].every((x: unknown) => typeof x === "string") &&
    Array.isArray(candidate["volumeCovers"]) && candidate["volumeCovers"].every((x: unknown) => typeof x === "string") &&
    Array.isArray(candidate["chapterCovers"]) && candidate["chapterCovers"].every((x: unknown) => typeof x === "string")
  );
}

/**
 * Type guard for VolumesData
 * Validates that an object conforms to the VolumesData interface
 */
export function isVolumesData(obj: unknown): obj is VolumesData {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    Array.isArray(candidate["volumes"]) &&
    typeof candidate["totalVolumes"] === "number" &&
    typeof candidate["totalChapters"] === "number" &&
    (!("fandom" in candidate) || "fandom" in candidate)
  );
}

/**
 * Type guard for BatchFetchProgress
 * Validates that an object conforms to the BatchFetchProgress interface
 */
export function isBatchFetchProgress(obj: unknown): obj is BatchFetchProgress {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["current"] === "number" &&
    typeof candidate["total"] === "number" &&
    (!("message" in candidate) || typeof candidate["message"] === "string")
  );
}

/**
 * Type guard for ImportProgress
 * Validates that an object conforms to the ImportProgress interface
 */
export function isImportProgress(obj: unknown): obj is ImportProgress {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "status" in candidate &&
    typeof candidate["progress"] === "number" &&
    (!("message" in candidate) || typeof candidate["message"] === "string") &&
    (!("error" in candidate) || typeof candidate["error"] === "string")
  );
}


/**
 * Type guard for MetadataPreviewItem
 * Validates that an object conforms to the MetadataPreviewItem interface
 */
export function isMetadataPreviewItem(obj: unknown): obj is MetadataPreviewItem {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["label"] === "string" &&
    "value" in candidate &&
    (!("badge" in candidate) || typeof candidate["badge"] === "boolean") &&
    (!("color" in candidate) || typeof candidate["color"] === "string")
  );
}

/**
 * Type guard for FieldSelectorOption
 * Validates that an object conforms to the FieldSelectorOption interface
 */
export function isFieldSelectorOption(obj: unknown): obj is FieldSelectorOption {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["value"] === "string" &&
    typeof candidate["label"] === "string" &&
    (!("group" in candidate) || typeof candidate["group"] === "string") &&
    (!("disabled" in candidate) || typeof candidate["disabled"] === "boolean") &&
    (!("data" in candidate) || "data" in candidate)
  );
}

/**
 * Type guard for ProviderOption
 * Validates that an object conforms to the ProviderOption interface
 */
export function isProviderOption(obj: unknown): obj is ProviderOption {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["value"] === "string" &&
    typeof candidate["label"] === "string" &&
    (!("source" in candidate) || typeof candidate["source"] === "string") &&
    (!("provider" in candidate) || typeof candidate["provider"] === "string") &&
    (!("confidence" in candidate) || typeof candidate["confidence"] === "number")
  );
}

/**
 * Type guard for LoadingStates
 * Validates that an object conforms to the LoadingStates interface
 */
export function isLoadingStates(obj: unknown): obj is LoadingStates {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["search"] === "boolean" &&
    typeof candidate["metadata"] === "boolean" &&
    typeof candidate["covers"] === "boolean" &&
    typeof candidate["chapters"] === "boolean" &&
    typeof candidate["submit"] === "boolean"
  );
}

/**
 * Type guard for ErrorStates
 * Validates that an object conforms to the ErrorStates interface
 */
export function isErrorStates(obj: unknown): obj is ErrorStates {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("search" in candidate) || typeof candidate["search"] === "string") &&
    (!("metadata" in candidate) || typeof candidate["metadata"] === "string") &&
    (!("covers" in candidate) || typeof candidate["covers"] === "string") &&
    (!("chapters" in candidate) || typeof candidate["chapters"] === "string") &&
    (!("submit" in candidate) || typeof candidate["submit"] === "string")
  );
}