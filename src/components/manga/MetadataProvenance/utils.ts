/**
 * Utility functions for MetadataProvenance components
 *
 * @module components/manga/MetadataProvenance/utils
 */

import type { MetadataProvenance as MetadataProvenanceType } from '@/types/search.types';

import type { ParsedProviders, ProviderData } from './types';

/**
 * Provider color mapping
 */
export const PROVIDER_COLORS: Record<string, string> = {
  anilist: 'blue',
  fandom: 'green',
  comicvine: 'red',
  default: 'gray'
};

/**
 * Provider display label mapping
 */
export const PROVIDER_LABELS: Record<string, string> = {
  anilist: 'AniList',
  fandom: 'Fandom',
  comicvine: 'ComicVine'
};

/**
 * Get color for a provider with fallback
 */
export function getProviderColor(provider: string | undefined): string {
  if (!provider) {
    return PROVIDER_COLORS['default'] ?? 'gray';
  }
  return PROVIDER_COLORS[provider] ?? PROVIDER_COLORS['default'] ?? 'gray';
}

/**
 * Get display label for a provider with fallback
 */
export function getProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/**
 * Parse comma-separated provider string into structured data
 */
export function parseProviders(providerString: string | undefined): ParsedProviders {
  if (!providerString) {
    return {
      primaryProvider: undefined,
      additionalProviders: [],
      allProviders: []
    };
  }

  const allProviders = providerString.split(',').map((p: string) => p.trim());
  const primaryProvider = allProviders[0];
  const additionalProviders = allProviders.slice(1);

  return {
    primaryProvider,
    additionalProviders,
    allProviders
  };
}

/**
 * Get provider data from provenance for a specific field
 */
export function getProviderData(
  provenance: MetadataProvenanceType | null | undefined,
  field: string
): ProviderData | undefined {
  if (!provenance) return undefined;
  return provenance[field] as ProviderData | undefined;
}

/**
 * Get confidence color based on score
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'green';
  if (confidence >= 60) return 'blue';
  if (confidence >= 40) return 'yellow';
  return 'red';
}

/**
 * Get confidence label based on score
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'Excellent';
  if (confidence >= 60) return 'Good';
  if (confidence >= 40) return 'Fair';
  return 'Poor';
}

/**
 * Format tooltip label for inline provenance
 */
export function formatInlineTooltipLabel(parsed: ParsedProviders, confidence?: number): string {
  const { primaryProvider, additionalProviders } = parsed;

  let tooltip = '';

  if (additionalProviders.length > 0) {
    const primaryLabel = primaryProvider
      ? getProviderLabel(primaryProvider)
      : 'Unknown';
    const additionalLabels = additionalProviders
      .map((p: string) => getProviderLabel(p))
      .join(', ');
    tooltip = `Primary: ${primaryLabel}, Also from: ${additionalLabels}`;
  } else {
    const label = primaryProvider
      ? getProviderLabel(primaryProvider)
      : 'Unknown';
    tooltip = `Source: ${label}`;
  }

  // Add confidence information if available
  if (confidence !== undefined) {
    const confidenceLabel = getConfidenceLabel(confidence);
    tooltip += `\nConfidence: ${confidence}% (${confidenceLabel})`;
  }

  return tooltip;
}

/**
 * Format tooltip label for block provenance
 */
export function formatBlockTooltipLabel(parsed: ParsedProviders, confidence?: number): string {
  const { primaryProvider, additionalProviders, allProviders } = parsed;

  let tooltip = '';

  if (additionalProviders.length > 0) {
    const labels = allProviders
      .map((p: string) => getProviderLabel(p))
      .join(', ');
    tooltip = `Sources: ${labels}`;
  } else {
    const label = primaryProvider
      ? getProviderLabel(primaryProvider)
      : 'Unknown';
    tooltip = `Source: ${label}`;
  }

  // Add confidence information if available
  if (confidence !== undefined) {
    const confidenceLabel = getConfidenceLabel(confidence);
    tooltip += `\nConfidence: ${confidence}% (${confidenceLabel})`;
  }

  return tooltip;
}
