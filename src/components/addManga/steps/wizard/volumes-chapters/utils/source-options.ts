/**
 * Source Options Utilities
 *
 * Functions for building source dropdown options.
 *
 * @module components/addManga/steps/wizard/volumes-chapters/utils/source-options
 */

import type { SourceOption } from '../types';

/**
 * Build source dropdown options from provider and metadata
 * Only includes sources that are in the user's selectedSources array
 */
export function getSourceOptions(
  provider: string,
  selectedSourcesMetadata: Record<string, unknown>,
  selectedSources: string[]
): SourceOption[] {
  const options: SourceOption[] = [
    {
      value: 'primary',
      label: provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Primary',
    },
  ];

  // Use a Set to track already added sources (normalized to lowercase) to avoid duplicates
  const addedSources = new Set<string>();

  // Track if the provider is already represented by the primary option
  const providerLowercase = provider ? provider.toLowerCase() : '';
  if (providerLowercase) {
    addedSources.add(providerLowercase);
  }

  // Normalize metadata keys to lowercase for lookup
  const metadataKeysNormalized = new Set(
    Object.keys(selectedSourcesMetadata).map(k => k.toLowerCase())
  );

  // Iterate over selectedSources (user's explicit selections) instead of metadata keys
  // This ensures sources appear in dropdown even if metadata hasn't loaded yet
  selectedSources.forEach((source) => {
    const normalizedKey = source.toLowerCase();

    // Skip if already added (e.g., primary provider)
    if (addedSources.has(normalizedKey)) {
      return;
    }

    const hasMetadata = metadataKeysNormalized.has(normalizedKey);
    const displayLabel =
      normalizedKey === 'fandom'
        ? 'Fandom'
        : normalizedKey.charAt(0).toUpperCase() + normalizedKey.slice(1);

    // Add the source option (even if metadata hasn't loaded yet)
    options.push({
      value: normalizedKey,
      label: hasMetadata ? displayLabel : `${displayLabel} (loading...)`,
    });

    addedSources.add(normalizedKey);
  });

  return options;
}
