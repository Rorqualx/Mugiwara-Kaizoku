/**
 * ProviderSelectionForm Utility Functions
 *
 * Helper functions extracted from buildProviderMetadata to reduce cyclomatic complexity.
 * These functions handle validation, array processing, and object extraction for provider metadata.
 */

import type { ProviderMetadataItem, ProviderMetadataInfo } from './types';

/**
 * Type guard for validating ProviderMetadataItem structure
 *
 * Validates that an unknown item has the required structure:
 * - item exists and is an object
 * - has 'providerId' as a string
 * - has 'metadata' as a non-null object
 */
export function isValidProviderMetadataItem(
  item: unknown
): item is { providerId: string; externalId?: string | number; metadata: Record<string, unknown> } {
  return (
    item !== null &&
    typeof item === 'object' &&
    'providerId' in item &&
    typeof (item as Record<string, unknown>)['providerId'] === 'string' &&
    'metadata' in item &&
    (item as Record<string, unknown>)['metadata'] !== null &&
    typeof (item as Record<string, unknown>)['metadata'] === 'object'
  );
}

/**
 * Processes provider metadata array into validated items
 *
 * Iterates through an array of unknown items, validates each using
 * isValidProviderMetadataItem, and builds a properly typed array
 * with correct externalId handling.
 */
export function processProviderMetadataArray(
  items: unknown[]
): ProviderMetadataItem[] {
  const validProviders: ProviderMetadataItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (isValidProviderMetadataItem(item)) {
      validProviders.push({
        providerId: item.providerId,
        ...(typeof item.externalId === 'string' || typeof item.externalId === 'number'
          ? { externalId: item.externalId }
          : {}),
        metadata: item.metadata as Record<string, unknown>,
      });
    }
  }

  return validProviders;
}

/**
 * Extracts metadataProvenance and preferences from provider metadata object
 *
 * Handles the extraction and validation of metadataProvenance and preferences
 * fields from a provider metadata object, returning a properly typed ProviderMetadataInfo.
 */
export function extractProviderMetadataInfo(
  providerMetadata: Record<string, unknown>
): ProviderMetadataInfo {
  return {
    metadataProvenance:
      'metadataProvenance' in providerMetadata &&
      typeof providerMetadata['metadataProvenance'] === 'object' &&
      providerMetadata['metadataProvenance'] !== null
        ? (providerMetadata['metadataProvenance'] as Record<string, string>)
        : {},
    preferences:
      'preferences' in providerMetadata &&
      typeof providerMetadata['preferences'] === 'object' &&
      providerMetadata['preferences'] !== null
        ? (providerMetadata['preferences'] as Record<string, { provider: string; value: unknown }>)
        : {},
  };
}
