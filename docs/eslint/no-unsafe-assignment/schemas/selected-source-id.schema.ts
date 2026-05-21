/**
 * Zod schema for Selected Source ID
 *
 * Used when parsing manga.selectedSourceId from database
 * Can be either a single string or a JSON object with multiple providers
 */

import { z } from 'zod';

/**
 * Provider selection configuration
 */
export const ProviderSelectionSchema = z.object({
  default: z.string().optional(),
  metadata: z.string().optional(),
  chapters: z.string().optional(),
  covers: z.string().optional(),
  volumes: z.string().optional(),
});

export type ProviderSelection = z.infer<typeof ProviderSelectionSchema>;

/**
 * Selected source can be either:
 * 1. A single provider ID string
 * 2. A provider selection object
 */
export const SelectedSourceIdSchema = z.union([
  z.string(),
  ProviderSelectionSchema,
]);

export type SelectedSourceId = z.infer<typeof SelectedSourceIdSchema>;

/**
 * Safe parser that handles both string and object formats
 *
 * @param data - Unknown data (could be string or already parsed object)
 * @returns Parsed selection or null on error
 */
export function parseSelectedSourceId(data: unknown): SelectedSourceId | null {
  // If it's a string, try to parse it as JSON first
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      const result = SelectedSourceIdSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
    } catch {
      // Not JSON, treat as plain string
      return data;
    }
  }

  // Otherwise validate as-is
  const result = SelectedSourceIdSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  console.error('SelectedSourceId validation failed:', result);
  return null;
}

/**
 * Type guard for SelectedSourceId
 */
export function isSelectedSourceId(value: unknown): value is SelectedSourceId {
  return SelectedSourceIdSchema.safeParse(value).success;
}

/**
 * Check if selection is a multi-provider configuration
 */
export function isMultiProviderSelection(
  value: SelectedSourceId
): value is ProviderSelection {
  return typeof value === 'object' && value !== null;
}

/**
 * Get default provider from selection
 */
export function getDefaultProvider(selection: SelectedSourceId): string | null {
  if (typeof selection === 'string') {
    return selection;
  }
  return selection.default ?? null;
}
