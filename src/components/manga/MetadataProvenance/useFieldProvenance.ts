/**
 * useFieldProvenance Hook
 *
 * Hook to get provenance for a specific field.
 *
 * @module components/manga/MetadataProvenance/useFieldProvenance
 */

import type { MetadataProvenance as MetadataProvenanceType } from '@/types/search.types';

import { getProviderData } from './utils';

/**
 * Hook to get provenance for a specific field
 */
export function useFieldProvenance(
  provenance?: MetadataProvenanceType | null,
  field?: string
): string | undefined {
  if (!provenance || !field) return undefined;
  const providerData = getProviderData(provenance, field);
  return providerData?.source;
}
