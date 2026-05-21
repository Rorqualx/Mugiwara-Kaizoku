import type { ProviderMetadata, UnifiedFieldSelections } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

/**
 * Merge metadata from multiple sources
 */
export function mergeMetadata(
  sources: Record<string, ProviderMetadata>,
  primaryProvider: string
): Partial<ProviderMetadata> {
  let merged: Partial<ProviderMetadata> = {};
  const primary = sources[primaryProvider];

  if (primary) {
    merged = { ...merged, ...primary };
  }

  // Merge additional sources, prioritizing non-empty values
  Object.entries(sources).forEach(([provider, metadata]) => {
    if (provider !== primaryProvider) {
      Object.entries(metadata).forEach(([key, value]) => {
        const mergedRecord = merged as Record<string, unknown>;
        if (value && !mergedRecord[key]) {
          mergedRecord[key] = value;
        }
      });
    }
  });

  return merged;
}

/**
 * Merge metadata with explicit user field selections
 *
 * This function prioritizes explicit user selections over automatic merging,
 * then fills in remaining fields using confidence-based selection.
 *
 * @param sources - Metadata from all selected providers
 * @param fieldSelections - User's explicit field selections
 * @param primaryProvider - Primary provider (fallback for non-selected fields)
 * @returns Merged metadata with user selections applied
 */
export function mergeMetadataWithSelections(
  sources: Record<string, ProviderMetadata>,
  fieldSelections: UnifiedFieldSelections,
  primaryProvider: string
): Partial<ProviderMetadata> {
  const merged: Record<string, unknown> = {};

  logger.info('[metadataMerger] Merging metadata with selections', {
    providers: Object.keys(sources),
    explicitSelections: Object.keys(fieldSelections).filter(k => fieldSelections[k]?.isExplicit).length,
    primaryProvider
  });

  // Step 1: Apply explicit user selections first (highest priority)
  Object.entries(fieldSelections).forEach(([field, selection]) => {
    if (selection.isExplicit) {
      merged[field] = selection.value;
      logger.debug('[metadataMerger] Applied explicit selection', {
        field,
        provider: selection.selectedProvider,
        confidence: selection.confidence
      });
    }
  });

  // Step 2: For array fields, support union mode
  Object.entries(fieldSelections).forEach(([field, selection]) => {
    if (selection.arrayMergeMode === 'union' && Array.isArray(selection.value)) {
      // Collect items from all providers and deduplicate
      const allItems = new Set<string>();

      selection.value.forEach(item => {
        if (typeof item === 'string') allItems.add(item);
      });

      // Add items from mergedFrom providers
      selection.mergedFrom?.forEach(({ items }) => {
        if (Array.isArray(items)) {
          items.forEach(item => {
            if (typeof item === 'string') allItems.add(item);
          });
        }
      });

      merged[field] = Array.from(allItems);
      logger.debug('[metadataMerger] Applied array union merge', {
        field,
        itemCount: allItems.size
      });
    }
  });

  // Step 3: Fill remaining fields with confidence-based auto-selection
  // Priority: primaryProvider > other providers by confidence
  const allFields = new Set<string>();
  Object.values(sources).forEach(metadata => {
    Object.keys(metadata).forEach(field => allFields.add(field));
  });

  allFields.forEach(field => {
    // Skip if already set by explicit selection
    if (field in merged) return;

    // Try primary provider first
    const primaryMetadata = sources[primaryProvider];
    if (primaryMetadata && field in primaryMetadata) {
      const value = primaryMetadata[field as keyof ProviderMetadata];
      if (value !== null && value !== undefined && value !== '') {
        merged[field] = value;
        return;
      }
    }

    // Fallback to other providers (first non-empty value)
    for (const [provider, metadata] of Object.entries(sources)) {
      if (provider === primaryProvider) continue;

      if (field in metadata) {
        const value = metadata[field as keyof ProviderMetadata];
        if (value !== null && value !== undefined && value !== '') {
          merged[field] = value;
          logger.debug('[metadataMerger] Auto-filled field from fallback provider', {
            field,
            provider
          });
          return;
        }
      }
    }
  });

  logger.info('[metadataMerger] Merge complete', {
    totalFields: Object.keys(merged).length,
    explicitFields: Object.keys(fieldSelections).filter(k => fieldSelections[k]?.isExplicit).length
  });

  return merged as Partial<ProviderMetadata>;
}
