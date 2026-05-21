/**
 * Metadata Builder Utilities
 *
 * Functions for building and manipulating configuration metadata:
 * - Field removal from objects (for cleaning metadata before storage)
 * - Metadata construction for set operations
 * - Metadata construction for create operations
 *
 * Extracted from: configService.ts (lines 189-203, 254-291)
 */

import { ConfigValueType, ConfigScope } from '@prisma/client';

import type { ConfigMetadata, ConfigServiceMetadata } from '../config-types';

/**
 * Recursively remove specified fields from objects and arrays
 *
 * @param obj - The object or array to process
 * @param fieldsToRemove - Array of field names to remove
 * @returns A new object/array with specified fields removed
 */
export function removeFieldsFromObject(obj: unknown, fieldsToRemove: string[]): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => removeFieldsFromObject(item, fieldsToRemove));
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!fieldsToRemove.includes(key)) {
      cleaned[key] = removeFieldsFromObject(value, fieldsToRemove);
    }
  }
  return cleaned;
}

/**
 * Build metadata for set operation
 * Merges existing metadata with new options
 *
 * @param key - Configuration key
 * @param valueType - Type of the configuration value
 * @param scope - Configuration scope
 * @param existing - Existing configuration metadata (optional)
 * @param optionsMetadata - New metadata options to merge (optional)
 * @returns Complete ConfigMetadata object
 */
export function buildSetMetadata(
  key: string,
  valueType: ConfigValueType,
  scope: ConfigScope,
  existing?: ConfigServiceMetadata<unknown>,
  optionsMetadata?: Partial<ConfigMetadata>
): ConfigMetadata {
  return {
    ...(existing?.metadata ?? {}),
    ...(optionsMetadata ?? {}),
    key,
    type: valueType,
    scope,
    label: optionsMetadata?.label ?? existing?.metadata.label ?? key,
    category: optionsMetadata?.category ?? existing?.metadata.category ?? 'Uncategorized'
  };
}

/**
 * Build metadata for create operation
 * Creates full metadata with defaults
 *
 * @param key - Configuration key
 * @param valueType - Type of the configuration value
 * @param scope - Configuration scope
 * @param inputMetadata - Partial metadata to use for creation (optional)
 * @returns Complete ConfigMetadata object with defaults applied
 */
export function buildCreateMetadata(
  key: string,
  valueType: ConfigValueType,
  scope: ConfigScope,
  inputMetadata?: Partial<ConfigMetadata>
): ConfigMetadata {
  return {
    key,
    label: inputMetadata?.label ?? key,
    ...(inputMetadata?.description !== undefined && { description: inputMetadata.description }),
    type: valueType,
    ...(inputMetadata?.defaultValue !== undefined && { defaultValue: inputMetadata.defaultValue }),
    scope,
    category: inputMetadata?.category ?? 'Uncategorized',
    ...(inputMetadata?.required !== undefined && { required: inputMetadata.required }),
    ...(inputMetadata?.options !== undefined && { options: inputMetadata.options }),
    ...(inputMetadata?.validation !== undefined && { validation: inputMetadata.validation }),
    ...(inputMetadata?.ui !== undefined && { ui: inputMetadata.ui })
  };
}
