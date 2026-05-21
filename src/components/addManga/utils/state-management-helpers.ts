/**
 * State Management Helper Utilities
 * 
 * Provides type-safe utilities for managing state updates in AddManga components
 * to fix SetStateAction type mismatches and ensure consistent field selection structure
 */

import type { SetStateAction } from 'react';
// ============================================
// Standardized Type Definitions
// ============================================

/**
 * Standardized field selection structure
 * All field selections MUST use 'source' (not 'sourceId')
 */
export interface FieldSelection {
  /** The source/provider of this value (e.g., 'anilist', 'comicvine', 'auto-merged') */
  source: string;
  /** The actual value */
  value: unknown;
  /** Optional confidence score (0-1) */
  confidence?: number;
  /** Whether this was manually edited by the user */
  isManuallyEdited?: boolean;
  /** Timestamp of last update */
  lastUpdated?: string;
}

/**
 * Field selections state type
 */
export type FieldSelectionsState = Record<string, FieldSelection>;
/**
 * Partial field selection update
 */
export type PartialFieldSelection = {
  source?: string;
  value?: unknown;
  confidence?: number;
  isManuallyEdited?: boolean;
};
// ============================================
// Type Guards
// ============================================

/**
 * Check if an object is a valid FieldSelection
 */
export function isFieldSelection(obj: unknown): obj is FieldSelection {
  if (!obj || typeof obj !== 'object') return false;
  if (!('source' in obj) || !('value' in obj)) return false;
  if (typeof obj["source"] !== 'string') return false;
  return true;
}

/**
 * Check if an object is a valid FieldSelectionsState
 */
export function isFieldSelectionsState(obj: unknown): obj is FieldSelectionsState {
  if (!obj || typeof obj !== 'object') return false;
  return Object.values(obj).every(isFieldSelection);
}

// ============================================
// State Update Helpers
// ============================================

/**
 * Create a proper field selection object
 */
export function createFieldSelection(
  source: string,
  value: unknown,
  options?: Partial<Omit<FieldSelection, 'source' | 'value'>>
): FieldSelection {
  return {
    source,
    value,
    ...(options?.confidence !== undefined ? { confidence: options.confidence } : {}),
    ...(options?.isManuallyEdited !== undefined ? { isManuallyEdited: options.isManuallyEdited } : {}),
    lastUpdated: options?.lastUpdated ?? new Date().toISOString()
  };
}

/**
 * Create a field selections update for SetStateAction
 * Ensures type compatibility with React's setState
 */
export function createFieldSelectionsUpdate(
  updates: Partial<Record<string, FieldSelection | undefined>>
): (prev: FieldSelectionsState) => FieldSelectionsState {
  return (prev: FieldSelectionsState) => {
    const newState: FieldSelectionsState = { ...prev };
    Object.entries(updates).forEach(([field, selection]) => {
      if (selection !== undefined) {
        newState[field] = selection;
      }
    });
    return newState;
  };
}

/**
 * Merge field selections with existing state
 * Handles conditional updates based on value presence
 */
export function mergeFieldSelections(
  prev: FieldSelectionsState,
  updates: Record<string, { source: string; value: unknown } | undefined>
): FieldSelectionsState {
  const result: FieldSelectionsState = { ...prev };
  Object.entries(updates).forEach(([field, update]) => {
    if (update !== undefined && update.value !== null) {
      result[field] = createFieldSelection(update["source"], update.value);
    }
  });
  return result;
}

/**
 * Create conditional field selection updates
 * Only includes fields with truthy values
 */
export function createConditionalUpdates(
  source: string,
  fields: Record<string, unknown>
): Partial<Record<string, FieldSelection>> {
  const updates: Partial<Record<string, FieldSelection>> = {};
  Object.entries(fields).forEach(([field, value]) => {
    if (value !== null && value !== '') {
      // Special handling for arrays - only include if non-empty
      if (Array.isArray(value) && value.length === 0) {
        return;
      }
      
      updates[field] = createFieldSelection(source, value);
    }
  });
  return updates;
}

/**
 * Fix legacy field selection format
 * Converts sourceId to source
 */
export function fixLegacyFieldSelection(
  selection: unknown
): FieldSelection | undefined {
  if (!selection || typeof selection !== 'object') return undefined;

  const selectionObj = selection as Record<string, unknown>;

  // Handle legacy format with sourceId
  if ('sourceId' in selectionObj && !('source' in selectionObj)) {
    const confidence = selectionObj["confidence"] as number | undefined;
    const isManuallyEdited = selectionObj["isManuallyEdited"] as boolean | undefined;

    return createFieldSelection(
      selectionObj["sourceId"] as string,
      selectionObj["value"] ?? selectionObj["data"],
      {
        ...(confidence !== undefined ? { confidence } : {}),
        ...(isManuallyEdited !== undefined ? { isManuallyEdited } : {})
      }
    );
  }

  // Handle correct format
  if (isFieldSelection(selection)) {
    return selection;
  }

  // Handle partial updates
  if ('source' in selectionObj && 'value' in selectionObj) {
    return createFieldSelection(selectionObj["source"] as string, selectionObj["value"]);
  }

  return undefined;
}

/**
 * Create a safe state updater that ensures type compatibility
 */
export function createSafeStateUpdater<T>(
  updates: Partial<T>
): SetStateAction<T> {
  return (prev: T) => ({
    ...prev,
    ...updates
  });
}

/**
 * Create a field selection state updater for specific fields
 */
export function updateFieldSelections(
  field: string,
  source: string,
  value: unknown
): (prev: FieldSelectionsState) => FieldSelectionsState {
  return (prev) => ({
    ...prev,
    [field]: createFieldSelection(source, value)
  });
}

/**
 * Batch update multiple field selections
 */
export function batchUpdateFieldSelections(
  updates: Array<{ field: string; source: string; value: unknown }>
): (prev: FieldSelectionsState) => FieldSelectionsState {
  return (prev) => {
    const newState = { ...prev };
    updates.forEach(({ field, source, value }) => {
      if (value !== null) {
        newState[field] = createFieldSelection(source, value);
      }
    });
    return newState;
  };
}

// ============================================
// Specialized Updaters for Common Patterns
// ============================================

/**
 * Update field selections from enhanced data (e.g., AniList enhancement)
 */
export function updateFromEnhancedData(
  provider: string,
  enhancedData: Record<string, unknown>
): (prev: FieldSelectionsState) => FieldSelectionsState {
  return (prev): FieldSelectionsState => {
    const updates = createConditionalUpdates(provider, {
      cover: enhancedData["cover"] || enhancedData["coverImage"],
      description: enhancedData["description"] || enhancedData["synopsis"],
      genres: enhancedData["genres"],
      volumes: enhancedData["volumes"],
      chapters: enhancedData["chapters"],
      authors: enhancedData["authors"] || enhancedData["staff"],
      alternativeTitles: enhancedData["alternativeTitles"] || enhancedData["synonyms"],
      startDate: enhancedData["startDate"],
      endDate: enhancedData["endDate"],
      status: enhancedData["status"],
      publisher: enhancedData["publisher"],
      tags: enhancedData["tags"],
      format: enhancedData["format"]
    });
    // Special handling for alternative titles - merge instead of replace
    if (updates["alternativeTitles"] && prev["alternativeTitles"]) {
      const merged = [
        ...(Array.isArray(prev["alternativeTitles"].value) ? prev["alternativeTitles"].value as unknown[] : []),
        ...(Array.isArray(updates["alternativeTitles"].value) ? updates["alternativeTitles"].value as unknown[] : [])
      ];
      updates["alternativeTitles"] = createFieldSelection(
        'auto-merged',
        [...new Set(merged)]
      );
    }
    
    return { ...prev, ...updates } as FieldSelectionsState;
  };
}

/**
 * Clear field selections for specific fields
 */
export function clearFieldSelections(
  fields: string[]
): (prev: FieldSelectionsState) => FieldSelectionsState {
  return (prev) => {
    const newState = { ...prev };
    fields.forEach(field => {
      delete newState[field];
    });
    return newState;
  };
}

/**
 * Reset all field selections to defaults
 */
export function resetFieldSelections(): FieldSelectionsState {
  return {};
}

// ============================================
// Type Conversion Helpers
// ============================================

/**
 * Convert a string or number to SetStateAction<string | null>
 */
export function toStringStateAction(
  value: string | number | null
): SetStateAction<string | null> {
  if (value === null) return null;
  return typeof value === 'string' ? value : String(value);
}

/**
 * Convert any value to a proper SetStateAction
 */
export function toStateAction<T>(value: T | ((prev: T) => T)): SetStateAction<T> {
  return value;
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate field selections before submission
 */
export function validateFieldSelections(
  selections: FieldSelectionsState,
  requiredFields: string[] = []
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  // Check required fields
  requiredFields.forEach(field => {
    if (selections[field]?.value === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  // Validate structure
  Object.entries(selections).forEach(([field, selection]) => {
    if (!isFieldSelection(selection)) {
      errors.push(`Invalid field selection for ${field}`);
    }
  });
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// Export all types and utilities
// ============================================

// Types are already exported at their definition, no need to re-export

export default {
  createFieldSelection,
  createFieldSelectionsUpdate,
  mergeFieldSelections,
  createConditionalUpdates,
  fixLegacyFieldSelection,
  createSafeStateUpdater,
  updateFieldSelections,
  batchUpdateFieldSelections,
  updateFromEnhancedData,
  clearFieldSelections,
  resetFieldSelections,
  toStringStateAction,
  toStateAction,
  validateFieldSelections,
  isFieldSelection,
  isFieldSelectionsState
};
