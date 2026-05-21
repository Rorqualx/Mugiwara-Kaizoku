/**
 * Source Selection Handler for Universal Import Wizard
 *
 * Handles selection of additional metadata sources during wizard flow.
 * Manages provider-specific metadata fetching and state updates.
 *
 * @module source-selection-handler
 * @provenance Extracted from UniversalImportWizard.tsx lines 451-474
 */

import type * as React from 'react';
import { useCallback } from 'react';

import type {
  ProviderMetadata,
  MediaGallery,
  VolumesData,
} from '@/types/universalImportWizard.types';

import type { SourceManagementService } from '../services/sourceManagementService';

/**
 * Parameters for the source selection handler hook
 */
export interface SourceSelectionHandlerParams {
  /** Source management service instance */
  services: {
    sourceManagementService: SourceManagementService;
  };
  /** State setters for wizard context */
  setSelectedSources: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedSourcesMetadata: React.Dispatch<React.SetStateAction<Record<string, ProviderMetadata>>>;
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>;
  setVolumesData: React.Dispatch<React.SetStateAction<VolumesData>>;
  /** Current state values */
  selectedSources: string[];
  selectedSourcesMetadata: Record<string, ProviderMetadata>;
  /** Optional callback for tracking pending async fetches (for Quick Add to wait) */
  registerPendingFetch?: (key: string, promise: Promise<void>) => void;
}

/**
 * Return type for the source selection handler hook
 */
export interface SourceSelectionHandlerReturn {
  /**
   * Handle selection of an additional metadata source
   *
   * @param provider - Provider name (e.g., 'anilist', 'comicvine', 'fandom', 'wikipedia')
   * @param result - Search result from the provider
   * @param forceUpdate - Force update even if provider is already selected
   */
  handleAdditionalSourceSelection: (
    provider: string,
    result: unknown,
    forceUpdate?: boolean
  ) => Promise<void>;
}

/**
 * Custom hook for handling source selection in the Universal Import Wizard
 *
 * Manages the selection and fetching of additional metadata sources during the wizard flow.
 * Orchestrates provider-specific metadata fetching and state updates across multiple sources.
 *
 * @param params - Configuration parameters including services and state setters
 * @returns Handler functions for source selection
 *
 * @example
 * ```typescript
 * const { handleAdditionalSourceSelection } = useSourceSelectionHandler({
 *   services: { sourceManagementService },
 *   setSelectedSources,
 *   setSelectedSourcesMetadata,
 *   setMediaGallery,
 *   setVolumesData,
 *   selectedSources,
 *   selectedSourcesMetadata
 * });
 *
 * // Handle user selecting a provider result
 * await handleAdditionalSourceSelection('anilist', searchResult);
 * ```
 */
export function useSourceSelectionHandler(
  params: SourceSelectionHandlerParams
): SourceSelectionHandlerReturn {
  const {
    services,
    setSelectedSources,
    setSelectedSourcesMetadata,
    setMediaGallery,
    setVolumesData,
    selectedSources,
    selectedSourcesMetadata,
    registerPendingFetch,
  } = params;

  /**
   * Handle selection of an additional metadata source
   *
   * Delegates to the source management service to:
   * 1. Fetch metadata from the selected provider
   * 2. Update selected sources list
   * 3. Update metadata store
   * 4. Update media gallery with provider images
   * 5. Update volumes/chapters data if applicable
   *
   * Note: State updates occur in the service callbacks, but the updated values
   * are not visible in this callback due to React closure capture behavior.
   */
  const handleAdditionalSourceSelection = useCallback(
    async (provider: string, result: unknown, forceUpdate?: boolean): Promise<void> => {
      await services.sourceManagementService.handleAdditionalSourceSelection(
        provider,
        result as Record<string, unknown>,
        {
          setSelectedSources,
          setSelectedSourcesMetadata,
          setMediaGallery,
          setVolumesData,
          selectedSources,
          selectedSourcesMetadata,
          ...(registerPendingFetch !== undefined && { registerPendingFetch }),
        },
        forceUpdate ?? false
      );

      // Note: We can't log the updated state here due to React closure - the state values
      // in this callback are captured when the callback is created
    },
    [
      services.sourceManagementService,
      selectedSources,
      selectedSourcesMetadata,
      setSelectedSources,
      setSelectedSourcesMetadata,
      setMediaGallery,
      setVolumesData,
      registerPendingFetch,
    ]
  );

  return {
    handleAdditionalSourceSelection,
  };
}
