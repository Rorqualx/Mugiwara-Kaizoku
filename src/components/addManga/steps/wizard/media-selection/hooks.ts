/**
 * Media Selection Step - Custom Hooks
 *
 * Custom hooks for volume initialization and cover auto-selection.
 *
 * Extracted from: MediaSelectionStep.tsx (lines 136-208)
 */

import { useEffect, useRef } from 'react';

import type { Logger, MediaGallery } from './utils';

interface UseVolumeInitializationParams {
  selectedVolumes: (number | string)[];
  setSelectedVolumes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  volumeDisplaySource: string;
  provider: string;
  isInitialized: boolean;
  setIsInitialized: (value: boolean) => void;
  mediaGallery: MediaGallery;
  logger: Logger;
}

/**
 * Initializes volume selection by converting simple numbers to provider-scoped IDs.
 *
 * When selectedVolumes contains simple numbers (from VolumesChaptersStep),
 * this hook converts them to provider-scoped IDs (e.g., "anilist-1").
 *
 * Also handles provider changes by resetting initialization state.
 */
export function useVolumeInitialization({
  selectedVolumes,
  setSelectedVolumes,
  volumeDisplaySource,
  provider,
  isInitialized,
  setIsInitialized,
  mediaGallery,
  logger
}: UseVolumeInitializationParams): void {
  // Track previous volumeDisplaySource to detect provider changes
  const prevVolumeDisplaySourceRef = useRef<string>(volumeDisplaySource);

  // Effect to detect provider changes and reset initialization
  useEffect(() => {
    const prevSource = prevVolumeDisplaySourceRef.current;
    if (prevSource && prevSource !== volumeDisplaySource && isInitialized) {
      logger.info('[MediaSelectionStep] Provider changed, resetting volume initialization:', {
        previousProvider: prevSource,
        newProvider: volumeDisplaySource
      });

      // Clear volume selections when provider changes
      setSelectedVolumes([]);
      setIsInitialized(false);
    }
    prevVolumeDisplaySourceRef.current = volumeDisplaySource;
  }, [volumeDisplaySource, isInitialized, setSelectedVolumes, setIsInitialized, logger]);

  useEffect(() => {
    if (!isInitialized && selectedVolumes.length > 0) {
      // Check if selectedVolumes contains simple numbers (from VolumesChaptersStep)
      const firstItem = selectedVolumes[0];
      if (typeof firstItem === 'number' || !String(firstItem).includes('-')) {
        // Convert simple numbers to provider-scoped IDs for the selected provider ONLY
        const convertedVolumes: unknown[] = [];

        // Find which provider the user selected volumes from in the previous step
        // Use volumeDisplaySource as the primary source
        const selectedProvider = volumeDisplaySource || provider;

        selectedVolumes.forEach((volumeNum: unknown) => {
          // Convert to provider-scoped ID for the selected provider only
          const scopedId = `${selectedProvider}-${volumeNum}`;
          convertedVolumes.push(scopedId);
        });

        logger.info('[MediaSelectionStep] Converting volume selection to provider-scoped IDs:', {
          original: selectedVolumes,
          converted: convertedVolumes,
          provider: selectedProvider
        });

        // Update with provider-scoped IDs
        setSelectedVolumes(convertedVolumes as (number | string)[]);
      }
      setIsInitialized(true);
    }

    // Debug logging for media gallery
    logger.info('[MediaSelectionStep] Media Gallery Debug:', {
      galleryCount: mediaGallery.gallery.length,
      volumeCoversCount: mediaGallery.volumeCovers.length,
      chapterCoversCount: mediaGallery.chapterCovers.length,
      coversCount: mediaGallery.covers.length,
      bannersCount: mediaGallery.banners.length
    });
  }, [
    selectedVolumes,
    isInitialized,
    volumeDisplaySource,
    provider,
    setSelectedVolumes,
    setIsInitialized,
    mediaGallery,
    logger
  ]);
}

interface UseAutoSelectCoverParams {
  selectedCover: string;
  setSelectedCover: (cover: string) => void;
  mediaGallery: MediaGallery;
  provider: string;
  volumeDisplaySource?: string;
  logger: Logger;
}

/**
 * Auto-selects provider's cover on mount and when provider changes.
 *
 * Prioritizes covers from the volumeDisplaySource (user-selected display source),
 * falls back to primary provider, then to first available cover.
 *
 * When volumeDisplaySource changes, clears selection and re-selects from new provider.
 */
export function useAutoSelectCover({
  selectedCover,
  setSelectedCover,
  mediaGallery,
  provider,
  volumeDisplaySource,
  logger
}: UseAutoSelectCoverParams): void {
  // Track previous provider to detect changes
  const prevProviderRef = useRef<string>(volumeDisplaySource ?? provider);

  // Effect to detect provider changes and re-select cover
  useEffect(() => {
    const currentSource = volumeDisplaySource ?? provider;
    const prevSource = prevProviderRef.current;

    if (prevSource && prevSource !== currentSource) {
      logger.info('[MediaSelectionStep] Provider changed, re-selecting cover:', {
        previousProvider: prevSource,
        newProvider: currentSource
      });

      // Clear current selection to trigger re-selection
      setSelectedCover('');
    }
    prevProviderRef.current = currentSource;
  }, [volumeDisplaySource, provider, setSelectedCover, logger]);

  useEffect(() => {
    // Only auto-select if no cover is selected yet and we have covers available
    if (!selectedCover && mediaGallery.coversWithProviders && mediaGallery.coversWithProviders.length > 0) {
      // Use volumeDisplaySource (user's selected display source) or fallback to primary provider
      const targetProvider = volumeDisplaySource ?? provider;

      // Find the cover from the target provider
      const targetProviderCover = mediaGallery.coversWithProviders.find(
        (coverData: { url: string; provider: string }) =>
          coverData.provider.toLowerCase() === targetProvider.toLowerCase()
      );

      if (targetProviderCover) {
        logger.info('[MediaSelectionStep] Auto-selecting cover from target provider:', {
          targetProvider,
          coverUrl: targetProviderCover.url
        });
        setSelectedCover(targetProviderCover.url);
      } else if (mediaGallery.coversWithProviders.length > 0) {
        // Fallback: select the first available cover if target provider cover not found
        logger.info('[MediaSelectionStep] Target provider cover not found, selecting first available cover');
        const firstCover = mediaGallery.coversWithProviders[0];
        if (firstCover?.url) {
          setSelectedCover(firstCover.url);
        }
      }
    } else if (!selectedCover && mediaGallery.covers.length > 0) {
      // Fallback for covers without provider info
      logger.info('[MediaSelectionStep] Auto-selecting first cover (no provider info available)');
      const firstCover = mediaGallery.covers[0];
      if (firstCover) {
        setSelectedCover(firstCover);
      }
    }
  }, [
    mediaGallery.covers,
    mediaGallery.coversWithProviders,
    provider,
    volumeDisplaySource,
    selectedCover,
    setSelectedCover,
    logger
  ]);
}
