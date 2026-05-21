/**
 * useFieldSource Hook
 *
 * Determines which provider a field value came from.
 */

import { useCallback } from 'react';

import { isString } from '@/utils/type-guards';
import { isRecord } from '@/utils/type-guards/index';

export function useFieldSource(
  selectedSourcesMetadata?: Record<string, unknown>
): (fieldName: string, fieldValue: unknown) => string | 'none' {
  return useCallback((fieldName: string, fieldValue: unknown): string | 'none' => {
    if (!fieldValue || !selectedSourcesMetadata) return 'none';

    // Check if value contains provider suffix
    if (isString(fieldValue)) {
      if (fieldValue.includes('::')) {
        const parts: string[] = fieldValue.split('::');
        if (parts.length > 0) {
          const lastIndex: number = parts.length - 1;
          const lastPart: string | undefined = parts[lastIndex];
          return lastPart ?? 'none';
        }
      }
    }

    // Check each provider's metadata
    for (const [providerName, metadata] of Object.entries(selectedSourcesMetadata)) {
      if (!isRecord(metadata)) continue;

      const providerValue = metadata[fieldName];

      // Handle arrays
      if (Array.isArray(fieldValue) && Array.isArray(providerValue)) {
        const valueSet = new Set(fieldValue);
        const providerSet = new Set(providerValue);
        if (valueSet.size === providerSet.size &&
            [...valueSet].every(v => providerSet.has(v))) {
          return providerName;
        }
      }
      // Handle primitives
      else if (providerValue === fieldValue) {
        return providerName;
      }
    }

    return 'user';
  }, [selectedSourcesMetadata]);
}
