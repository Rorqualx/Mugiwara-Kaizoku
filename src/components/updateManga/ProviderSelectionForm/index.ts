/**
 * ProviderSelectionForm Module
 *
 * Exports the main component and all types for the ProviderSelectionForm.
 * This module has been decomposed from a 1553-line file into focused submodules.
 */

export { ProviderSelectionForm } from './ProviderSelectionForm';
export type {
  ProviderSelectionFormProps,
  TRPCMangaResult,
  Manga,
  FieldData,
  ProviderMetadataInfo,
  ProviderMetadataItem,
  AniListStaff,
  AniListCharacter,
} from './types';

// Re-export components for direct use
export { FieldListView } from './components/FieldListView';
export { ComparisonView } from './components/ComparisonView';
export { ProviderBadge, renderProviderBadge } from './components/ProviderBadge';
export { ImagePreview, renderImagePreview } from './components/ImagePreview';

// Re-export hooks for testing or custom implementations
export { useFetchProviderData } from './hooks/useFetchProviderData';
export { useProviderMutations } from './hooks/useProviderMutations';

// Default export for convenience
export { default } from './ProviderSelectionForm';
