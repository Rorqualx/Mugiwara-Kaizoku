

import type { SetStateAction } from 'react';
/**
 * Standardized field selection structure
 * Used consistently across all metadata field selections
 */
export interface FieldSelection {
  /** The source/provider of this value */
  source: string;
  /** The actual value */
  value: unknown;
  /** Confidence score (0-1) for this selection */
  confidence?: number;
  /** Whether this was manually edited by the user */
  isManuallyEdited?: boolean;
  /** When this selection was last updated */
  lastUpdated?: string;
}

/**
 * Type for field selections state
 * Maps field names to their selection data
 */
export type FieldSelectionsState = Record<string, FieldSelection>;
/**
 * Type-safe setter for field selections
 */
export type SetFieldSelections = (value: SetStateAction<FieldSelectionsState>) => void;
/**
 * Helper type for partial field selection updates
 * Ensures all updates maintain the correct structure
 */
export type FieldSelectionUpdate = {
  [K in string]?: {
    source: string;
    value: unknown;
    confidence?: number;
    isManuallyEdited?: boolean;
  };
};
/**
 * Factory function to create a field selection
 * Ensures consistent structure
 */
export function createFieldSelection(
  source: string,
  value: unknown,
  options?: {
    confidence?: number;
    isManuallyEdited?: boolean;
    lastUpdated?: string;
  }
): FieldSelection {
  return {
    source,
    value,
    ...(options?.confidence !== undefined ? { confidence: options.confidence } : {}),
    ...(options?.isManuallyEdited !== undefined ? { isManuallyEdited: options.isManuallyEdited } : {}),
    lastUpdated: options?.lastUpdated ?? new Date().toISOString(),
  };
}

/**
 * Helper to create a field selection update object
 * Ensures type safety when updating multiple fields
 */
export function createFieldSelectionUpdate(
  updates: Array<{
    field: string;
    source: string;
    value: unknown;
    confidence?: number;
  }>
): FieldSelectionUpdate {
  const result: FieldSelectionUpdate = {};
  for (const update of updates) {
    result[update.field] = {
      source: update["source"],
      value: update.value,
      ...(update.confidence && { confidence: update.confidence }),
    };
  }

  return result;
}

/**
 * Type guard to check if a value is a valid FieldSelection
 */
export function isFieldSelection(value: unknown): value is FieldSelection {
  return (
    typeof value === 'object' &&
    value !== null &&
    'source' in value &&
    'value' in value &&
    typeof value["source"] === 'string'
  );
}

/**
 * Helper to merge field selections while preserving manual edits
 */
export function mergeFieldSelections(
  current: FieldSelectionsState,
  updates: FieldSelectionUpdate,
  preserveManualEdits = true
): FieldSelectionsState {
  const result = { ...current };
  for (const [field, update] of Object.entries(updates)) {
    if (!update) continue;
    // Skip if field was manually edited and we're preserving edits
    if (preserveManualEdits && result[field]?.isManuallyEdited) {
      continue;
    }
    
    result[field] = createFieldSelection(
      update["source"],
      update.value,
      {
        ...(update.confidence && { confidence: update.confidence }),
        ...(update.isManuallyEdited && { isManuallyEdited: update.isManuallyEdited }),
      }
    );
  }
  
  return result;
}

/**
 * Helper to create a safe state update function
 * Ensures the update maintains correct types
 */
export function createSafeFieldUpdate(
  setFieldSelections: SetFieldSelections,
  updates: FieldSelectionUpdate,
  preserveManualEdits = true
): void {
  setFieldSelections(prev => mergeFieldSelections(prev, updates, preserveManualEdits));
}

/**
 * Export all standardized types
 */
export type { SetStateAction };
