import { useState, useEffect } from 'react';

import type { MediaGallery, ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import { extractPrimaryProviderMedia } from '../services/modules/mediaExtractor';

/**
 * Manages media gallery extraction from selected provider sources
 *
 * Extracts media (covers, banners, gallery images, volume/chapter covers) from provider metadata
 * when the wizard advances to the media selection step (step 3).
 *
 * @param currentStep - The current wizard step (0-5)
 * @param selectedSources - Array of provider keys that have been explicitly selected
 * @param selectedSourcesMetadata - Metadata for all available providers
 * @returns Media gallery state and setter
 */
export function useMediaExtraction(
  currentStep: number,
  selectedSources: string[],
  selectedSourcesMetadata: Record<string, ProviderMetadata>
): {
  mediaGallery: MediaGallery;
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>;
} {
  // Media gallery state initialization
  const [mediaGallery, setMediaGallery] = useState<MediaGallery>({
    covers: [],
    coversWithProviders: [],
    banners: [],
    gallery: [],
    volumeCovers: [],
    chapterCovers: []
  });

  // Extract media when advancing to media selection step (step 3)
  useEffect(() => {
    if (currentStep === 3) {
      // DEBUG: Log what metadata we have for each provider
      logger.debug('[useMediaExtraction] Step 3 triggered - checking metadata', {
        selectedSources,
        availableMetadataProviders: Object.keys(selectedSourcesMetadata),
        metadataDetails: Object.fromEntries(
          Object.entries(selectedSourcesMetadata).map(([key, meta]) => [
            key,
            {
              hasGallery: !!meta.gallery,
              galleryLength: meta.gallery?.length ?? 0,
              galleryPreview: meta.gallery?.slice(0, 2) ?? 'N/A',
              hasImages: !!meta.images,
              imagesLength: meta.images?.length ?? 0
            }
          ])
        )
      });

      logger.info('[useMediaExtraction] Extracting media from selected sources only', {
        selectedSources,
        availableMetadataProviders: Object.keys(selectedSourcesMetadata)
      });

      // Reset media gallery to avoid stale data
      setMediaGallery({
        covers: [],
        coversWithProviders: [],
        banners: [],
        gallery: [],
        volumeCovers: [],
        chapterCovers: []
      });

      // Extract ONLY from explicitly selected sources
      selectedSources.forEach(providerKey => {
        const metadata = selectedSourcesMetadata[providerKey];
        if (metadata) {
          logger.debug(`[useMediaExtraction] Extracting for ${providerKey}`, {
            hasGallery: !!metadata.gallery,
            galleryLength: metadata.gallery?.length ?? 0
          });
          logger.info(`[useMediaExtraction] Extracting media for selected source: ${providerKey}`);
          extractPrimaryProviderMedia(providerKey, metadata, setMediaGallery);
        } else {
          logger.debug(`[useMediaExtraction] No metadata found for ${providerKey}`);
        }
      });
    }
  }, [currentStep, selectedSources, selectedSourcesMetadata]);

  return {
    mediaGallery,
    setMediaGallery
  };
}
