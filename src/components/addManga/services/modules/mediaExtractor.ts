import type * as React from 'react';

import type { ProviderMetadata, MediaGallery } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import {
  extractFilenameFromUrl,
  isMagazineImage,
  isTooSmallByDimensions,
  isUnwantedImage,
  isVolumeLikeFilename
} from './media-extractor/image-filters';
import {
  cleanFandomImageUrl,
  createImageHash,
  fixDoubleEncodedUrl,
  normalizeImageUrl
} from './media-extractor/url-helpers';
import {
  collectVolumeCoverUrls,
  extractChapterCovers,
  extractVolumeCovers,
  updateGalleryWithChapterCovers,
  updateGalleryWithVolumeCovers
} from './media-extractor/volume-extraction';

/**
 * Extract all media (covers, banners, gallery) from primary provider metadata
 *
 * @param provider - Provider name
 * @param metadata - Provider metadata containing media
 * @param setMediaGallery - State setter for media gallery
 */
// eslint-disable-next-line complexity -- Complex media extraction from multiple sources with filtering logic
export function extractPrimaryProviderMedia(
  provider: string,
  metadata: ProviderMetadata,
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>
): void {
  logger.debug(`[extractPrimaryProviderMedia] ENTRY for ${provider}`, {
    hasGallery: !!metadata.gallery,
    galleryLength: metadata.gallery?.length ?? 0,
    hasImages: !!metadata.images,
    imagesLength: metadata.images?.length ?? 0
  });

  // Track volume cover URLs to filter them from gallery
  const volumeCoverUrls = collectVolumeCoverUrls(metadata.volumeData);

  // Helper function to filter out volume covers and unwanted images from gallery
  const filterVolumeCovers = (images: string[]): string[] => {
    const seenHashes = new Set<string>();
    const fixedUrls = new Set<string>();
    const filterStats = { unwanted: 0, small: 0, hashDupe: 0, urlDupe: 0, volumeCover: 0, volumeVariant: 0, volumePattern: 0, passed: 0 };

    const result = images
      .map(fixDoubleEncodedUrl)
      .filter((imgUrl: string) => {
        const unwantedPattern = isUnwantedImage(imgUrl);
        if (unwantedPattern) {
          filterStats.unwanted++;
          return false;
        }

        if (isTooSmallByDimensions(imgUrl)) {
          filterStats.small++;
          return false;
        }

        const normalized = normalizeImageUrl(imgUrl);
        const imageHash = createImageHash(normalized);
        if (seenHashes.has(imageHash)) {
          filterStats.hashDupe++;
          return false;
        }
        seenHashes.add(imageHash);

        if (fixedUrls.has(imgUrl)) {
          filterStats.urlDupe++;
          return false;
        }
        fixedUrls.add(imgUrl);

        if (volumeCoverUrls.has(imgUrl)) {
          filterStats.volumeCover++;
          return false;
        }

        if (imgUrl.includes('/revision/')) {
          const baseUrl = imgUrl.split('/revision/')[0];
          if (baseUrl && volumeCoverUrls.has(baseUrl)) {
            filterStats.volumeVariant++;
            return false;
          }
        }

        const filename = extractFilenameFromUrl(imgUrl);
        if (isMagazineImage(filename, imgUrl)) {
          filterStats.passed++;
          return true;
        }

        if (isVolumeLikeFilename(filename)) {
          filterStats.volumePattern++;
          setMediaGallery((prev) => ({
            ...prev,
            volumeCovers: [...new Set([...prev.volumeCovers, imgUrl])]
          }));
          return false;
        }

        filterStats.passed++;
        return true;
      });

    logger.debug('[Gallery Filter] STATS', filterStats);
    return result;
  };

  // Extract gallery images with filtering
  if (metadata.gallery && Array.isArray(metadata.gallery) && metadata.gallery.length > 0) {
    const filteredGallery = filterVolumeCovers(metadata.gallery);
    logger.info(`🖼️ [Primary Gallery] ${provider}: ${filteredGallery.length} gallery items after filtering`);
    setMediaGallery((prev) => ({
      ...prev,
      gallery: [...new Set([...prev.gallery, ...filteredGallery])]
    }));
  } else if (metadata.images && Array.isArray(metadata.images) && metadata.images.length > 0) {
    const filteredImages = filterVolumeCovers(metadata.images);
    logger.info(`🖼️ [Primary Gallery] ${provider}: ${filteredImages.length} images after filtering`);
    setMediaGallery((prev) => ({
      ...prev,
      gallery: [...new Set([...prev.gallery, ...filteredImages])]
    }));
  }

  // Extract volume and chapter covers
  const volumesArray = Array.isArray(metadata.volumes) ? metadata.volumes : undefined;
  const volumeCovers = extractVolumeCovers(metadata.volumeData, volumesArray);
  updateGalleryWithVolumeCovers(volumeCovers, provider, setMediaGallery);

  const chapterCovers = extractChapterCovers(metadata.volumeData);
  updateGalleryWithChapterCovers(chapterCovers, provider, setMediaGallery);

  // Extract cover image
  let coverUrl = metadata.coverImage ?? metadata.coverUrl ?? (metadata as Record<string, unknown>)["cover"];

  // Log cover extraction for debugging
  logger.debug(`[Media Extractor] Cover extraction for ${provider}:`, {
    metadataCoverImage: metadata.coverImage,
    metadataCoverUrl: metadata.coverUrl,
    metadataCover: (metadata as Record<string, unknown>)["cover"],
    resolvedCoverUrl: coverUrl,
  });

  // Special handling for Anilist's nested coverImage structure
  if (provider === 'anilist') {
    const anilistCover = (metadata as Record<string, unknown>)["cover"] ?? metadata.coverImage;
    if (anilistCover) {
      if (typeof anilistCover === 'object') {
        const coverObj = anilistCover as Record<string, unknown>;
        coverUrl = (coverObj["extraLarge"] ?? coverObj["large"] ?? coverObj["medium"]) as string | undefined;
      } else {
        coverUrl = anilistCover as string;
      }
    }
  }

  if (coverUrl && typeof coverUrl === 'string') {
    const cleanedCoverUrl = cleanFandomImageUrl(coverUrl);
    logger.info(`📸 [Primary Cover] Adding cover for ${provider}:`, cleanedCoverUrl);
    const normalizedProviderForCover = provider.toLowerCase();

    setMediaGallery((prev) => {
      const existingCover = (prev.coversWithProviders ?? []).find(
        (c) => c.url === cleanedCoverUrl && c.provider.toLowerCase() === normalizedProviderForCover
      );

      const newCoversWithProviders = existingCover
        ? prev.coversWithProviders
        : [...(prev.coversWithProviders ?? []), { url: cleanedCoverUrl, provider: normalizedProviderForCover }];

      return {
        ...prev,
        covers: [...new Set([...prev.covers, cleanedCoverUrl])],
        coversWithProviders: newCoversWithProviders
      } as MediaGallery;
    });
  }

  // Extract banner image
  if (metadata.bannerImage && typeof metadata.bannerImage === 'string') {
    logger.info(`🎨 [Primary Banner] Adding banner for ${provider}:`, metadata.bannerImage);
    setMediaGallery((prev) => ({
      ...prev,
      banners: [...new Set([...prev.banners, metadata.bannerImage as string])]
    }));
  }
}

/**
 * Extract and set gallery images from primary provider metadata
 * This is called when the primary provider is initially loaded
 *
 * @param provider - Provider name
 * @param metadata - Provider metadata containing gallery
 * @param setMediaGallery - State setter for media gallery
 */
 
export function extractPrimaryProviderGallery(
  provider: string,
  metadata: ProviderMetadata,
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>
): void {
  logger.info(`[Primary Provider Gallery] Extracting gallery for ${provider}:`, {
    hasGallery: !!metadata.gallery,
    galleryLength: metadata.gallery?.length ?? 0,
    hasImages: !!metadata.images,
    imagesLength: metadata.images?.length ?? 0,
    hasVolumeData: !!metadata.volumeData,
    volumeDataLength: metadata.volumeData?.length ?? 0
  });

  // Collect volume cover URLs to filter from gallery
  const volumeCoverUrls = collectVolumeCoverUrls(metadata.volumeData);

  // Helper function to filter out volume covers from gallery
  const filterVolumeCovers = (images: string[]): string[] => {
    const seenHashes = new Set<string>();

    return images.map(fixDoubleEncodedUrl).filter((imgUrl: string) => {
      const normalized = normalizeImageUrl(imgUrl);
      const imageHash = createImageHash(normalized);

      if (seenHashes.has(imageHash)) {
        return false;
      }
      seenHashes.add(imageHash);

      if (volumeCoverUrls.has(imgUrl)) {
        return false;
      }

      if (imgUrl.includes('/revision/')) {
        const parts = imgUrl.split('/revision/');
        if (parts[0] && volumeCoverUrls.has(parts[0])) {
          return false;
        }
      }

      // Filter volume-like patterns
      const volumePattern = /\/volume(?:_|\s|%20)*\d+/i;
      const fireForceVolumePattern = /fire[_\s]*force[_\s]*\d+\.(?:png|jpg)/i;

      if (volumePattern.test(imgUrl) || fireForceVolumePattern.test(imgUrl)) {
        setMediaGallery((prev) => ({
          ...prev,
          volumeCovers: [...new Set([...prev.volumeCovers, imgUrl])]
        }));
        return false;
      }

      // Keep magazine covers
      const lowerUrl = imgUrl.toLowerCase();
      if (lowerUrl.includes('issue') || lowerUrl.includes('wsm')) {
        return true;
      }

      return true;
    });
  };

  // Extract gallery images with filtering
  if (metadata.gallery && Array.isArray(metadata.gallery) && metadata.gallery.length > 0) {
    const filteredGallery = filterVolumeCovers(metadata.gallery);
    logger.info(`🖼️ [Primary Gallery] ${provider}: ${filteredGallery.length} gallery items after filtering`);
    setMediaGallery((prev) => ({
      ...prev,
      gallery: [...new Set([...prev.gallery, ...filteredGallery])]
    }));
  } else if (metadata.images && Array.isArray(metadata.images) && metadata.images.length > 0) {
    const filteredImages = filterVolumeCovers(metadata.images);
    logger.info(`🖼️ [Primary Gallery] ${provider}: ${filteredImages.length} images after filtering`);
    setMediaGallery((prev) => ({
      ...prev,
      gallery: [...new Set([...prev.gallery, ...filteredImages])]
    }));
  }

  // Extract volume covers
  const volumesArray = Array.isArray(metadata.volumes) ? metadata.volumes : undefined;
  const volumeCovers = extractVolumeCovers(metadata.volumeData, volumesArray);
  updateGalleryWithVolumeCovers(volumeCovers, provider, setMediaGallery);

  // Extract cover image
  const coverUrl = metadata.coverImage ?? metadata.coverUrl;
  if (coverUrl && typeof coverUrl === 'string') {
    const cleanedCoverUrl = cleanFandomImageUrl(coverUrl);
    logger.info(`📸 [Primary Cover] Adding cover for ${provider}:`, cleanedCoverUrl);
    setMediaGallery((prev) => ({
      ...prev,
      covers: [...new Set([...prev.covers, cleanedCoverUrl])]
    }));
  }

  // Extract banner image
  if (metadata.bannerImage && typeof metadata.bannerImage === 'string') {
    logger.info(`🎨 [Primary Banner] Adding banner for ${provider}:`, metadata.bannerImage);
    setMediaGallery((prev) => ({
      ...prev,
      banners: [...new Set([...prev.banners, metadata.bannerImage as string])]
    }));
  }
}
