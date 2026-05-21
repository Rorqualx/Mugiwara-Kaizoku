/**
 * Media Extractors
 *
 * Handles media extraction (covers, banners, gallery, volume covers)
 * from provider responses. Decomposed to reduce cyclomatic complexity.
 *
 * Extracted from: urlParsingService.ts (lines 274-454)
 */

import { logger } from '@/utils/logger';

import { safeGet, isRecord } from './utils';

// ============================================================================
// Media Container Type
// ============================================================================

export interface MediaContainer extends Record<string, string[]> {
  covers: string[];
  banners: string[];
  gallery: string[];
  volumeCovers: string[];
  chapterCovers: string[];
}

// ============================================================================
// Helper Extractors (reduce complexity)
// ============================================================================

/**
 * Extract volume covers and build filter set
 * Complexity: ~8
 */
function extractVolumeCovers(
  data: unknown,
  volumeCoverUrls: Set<string>
): string[] {
  const covers: string[] = [];

  if (!isRecord(data)) return covers;

  const volumeData = safeGet(data, 'volumeData');
  if (!Array.isArray(volumeData)) return covers;

  volumeData.forEach((volume: unknown) => {
    if (!isRecord(volume)) return;
    const coverUrl = safeGet(volume, 'coverUrl') ?? safeGet(volume, 'coverImage');
    if (typeof coverUrl === 'string') {
      covers.push(coverUrl);
      volumeCoverUrls.add(coverUrl);

      // Add variations
      if (coverUrl.includes('/revision/')) {
        const baseUrl = coverUrl.split('/revision/')[0];
        if (baseUrl) {
          volumeCoverUrls.add(baseUrl);
          volumeCoverUrls.add(baseUrl + '/revision/latest');
        }
      }
    }
  });

  logger.info(`[media-extractors] Found ${covers.length} volume covers`);
  return covers;
}

/**
 * Check if image URL is a volume cover
 * Complexity: ~5
 */
function isVolumeCover(imgUrl: string, volumeCoverUrls: Set<string>): boolean {
  // Direct match
  if (volumeCoverUrls.has(imgUrl)) {
    return true;
  }

  // Check base URL without revision
  if (imgUrl.includes('/revision/')) {
    const baseUrl = imgUrl.split('/revision/')[0];
    if (baseUrl && volumeCoverUrls.has(baseUrl)) {
      return true;
    }
  }

  // Pattern match
  const lowerUrl = imgUrl.toLowerCase();
  if (lowerUrl.includes('/volume_') ||
      lowerUrl.includes('/vol_') ||
      (lowerUrl.includes('volume') && lowerUrl.includes('cover'))) {
    return true;
  }

  return false;
}

/**
 * Extract and filter gallery images (remove volume covers)
 * Complexity: ~8
 */
function extractGalleryImages(
  data: unknown,
  volumeCoverUrls: Set<string>,
  volumeCovers: string[]
): string[] {
  const gallery: string[] = [];

  if (!isRecord(data)) return gallery;

  const galleryData = safeGet(data, 'gallery');
  if (!Array.isArray(galleryData)) return gallery;

  logger.info(`[media-extractors] Processing ${galleryData.length} gallery images`);

  const filtered = galleryData.filter((imgUrl: unknown) => {
    if (typeof imgUrl !== 'string') return false;

    const isVolume = isVolumeCover(imgUrl, volumeCoverUrls);

    if (isVolume) {
      logger.info(`[media-extractors] Filtering out volume cover: ${imgUrl}`);
      // Add to volume covers if not already there
      if (!volumeCoverUrls.has(imgUrl)) {
        volumeCovers.push(imgUrl);
      }
      return false;
    }

    return true;
  });

  logger.info(`[media-extractors] After filtering: ${filtered.length} gallery images`);
  return filtered as string[];
}

/**
 * Extract Fandom-specific media
 * Complexity: ~12
 */
function extractFandomMedia(data: unknown): MediaContainer {
  const media: MediaContainer = {
    covers: [],
    banners: [],
    gallery: [],
    volumeCovers: [],
    chapterCovers: []
  };

  if (!isRecord(data)) return media;

  const fandomData = safeGet(data, 'data');
  if (!isRecord(fandomData)) return media;

  logger.info('[media-extractors] Extracting media from Fandom nested data');

  // Extract covers
  const coverImage = safeGet(fandomData, 'coverImage');
  if (typeof coverImage === 'string') media.covers.push(coverImage);

  const coverUrl = safeGet(fandomData, 'coverUrl');
  if (typeof coverUrl === 'string') media.covers.push(coverUrl);

  // Extract volume covers FIRST
  const volumeCoverUrls = new Set<string>();
  media.volumeCovers = extractVolumeCovers(fandomData, volumeCoverUrls);

  // Extract gallery (filtered)
  media.gallery = extractGalleryImages(fandomData, volumeCoverUrls, media.volumeCovers);

  // Extract banner
  const bannerImage = safeGet(fandomData, 'bannerImage');
  if (typeof bannerImage === 'string') media.banners.push(bannerImage);

  return media;
}

/**
 * Extract cover images from data
 * Complexity: ~8
 */
function extractCoverImages(data: unknown): string[] {
  const covers: string[] = [];

  if (!isRecord(data)) return covers;

  const coverImage = safeGet(data, 'coverImage');
  if (typeof coverImage === 'string') covers.push(coverImage);

  const coverUrl = safeGet(data, 'coverUrl');
  if (typeof coverUrl === 'string') covers.push(coverUrl);

  const coverArt = safeGet(data, 'coverArt');
  if (isRecord(coverArt)) {
    const primary = safeGet(coverArt, 'primary');
    if (typeof primary === 'string') covers.push(primary);

    const gallery = safeGet(coverArt, 'gallery');
    if (Array.isArray(gallery)) {
      covers.push(...gallery.filter((img): img is string => typeof img === 'string'));
    }
  }

  return covers;
}

/**
 * Extract banner images from data
 * Complexity: ~4
 */
function extractBannerImages(data: unknown): string[] {
  const banners: string[] = [];

  if (!isRecord(data)) return banners;

  const bannerImage = safeGet(data, 'bannerImage');
  if (typeof bannerImage === 'string') banners.push(bannerImage);

  const mediaObj = safeGet(data, 'Media');
  if (isRecord(mediaObj)) {
    const mediaBanner = safeGet(mediaObj, 'bannerImage');
    if (typeof mediaBanner === 'string') banners.push(mediaBanner);
  }

  return banners;
}

/**
 * Extract general gallery/images from data
 * Complexity: ~5
 */
function extractGeneralGallery(data: unknown): string[] {
  const gallery: string[] = [];

  if (!isRecord(data)) return gallery;

  const dataGallery = safeGet(data, 'gallery');
  if (Array.isArray(dataGallery)) {
    logger.info(`[media-extractors] Found ${dataGallery.length} gallery images in data`);
    gallery.push(...dataGallery.filter((img): img is string => typeof img === 'string'));
  }

  const images = safeGet(data, 'images');
  if (Array.isArray(images)) {
    logger.info(`[media-extractors] Found ${images.length} images in data`);
    gallery.push(...images.filter((img): img is string => typeof img === 'string'));
  }

  return gallery;
}

/**
 * Extract volume covers from volumes array
 * Complexity: ~5
 */
function extractVolumeCoversFromVolumes(data: unknown): string[] {
  const volumeCovers: string[] = [];

  if (!isRecord(data)) return volumeCovers;

  const volumes = safeGet(data, 'volumes');
  if (Array.isArray(volumes)) {
    volumes.forEach((volume: unknown) => {
      if (!isRecord(volume)) return;
      const volumeCover = safeGet(volume, 'coverImage') ?? safeGet(volume, 'coverUrl');
      if (typeof volumeCover === 'string') {
        volumeCovers.push(volumeCover);
      }
    });
  }

  return volumeCovers;
}

/**
 * Extract additional volume covers from volumeData
 * Complexity: ~5
 */
function extractAdditionalVolumeCovers(data: unknown, existing: string[]): string[] {
  const additional: string[] = [];

  if (!isRecord(data)) return additional;

  const volumeData = safeGet(data, 'volumeData');
  if (Array.isArray(volumeData)) {
    volumeData.forEach((volume: unknown) => {
      if (!isRecord(volume)) return;
      const coverUrl = safeGet(volume, 'coverUrl') ??
                       safeGet(volume, 'coverImage') ??
                       safeGet(volume, 'coverImageUrl');
      if (typeof coverUrl === 'string' && !existing.includes(coverUrl)) {
        additional.push(coverUrl);
      }
    });
  }

  return additional;
}

/**
 * Remove duplicates from media container
 * Complexity: ~3
 */
function deduplicateMedia(media: MediaContainer): MediaContainer {
  return {
    covers: [...new Set(media.covers)],
    banners: [...new Set(media.banners)],
    gallery: [...new Set(media.gallery)],
    volumeCovers: [...new Set(media.volumeCovers)],
    chapterCovers: [...new Set(media.chapterCovers)]
  };
}

// ============================================================================
// Main Extractor (orchestrates helpers)
// ============================================================================

/**
 * Extract media from parse result
 * Complexity reduced from 26 to ~8 by delegating to helpers
 */
export function extractMediaFromResult(
  data: unknown,
  provider: string
): Record<string, string[]> {
  let media: MediaContainer;

  // Handle Fandom's nested structure
  if (provider === 'fandom' && isRecord(data) && safeGet(data, 'data')) {
    media = extractFandomMedia(data);
  } else {
    media = {
      covers: extractCoverImages(data),
      banners: extractBannerImages(data),
      gallery: [],
      volumeCovers: [],
      chapterCovers: []
    };

    // Extract gallery (only if not from Fandom)
    if (isRecord(data)) {
      media.gallery = extractGeneralGallery(data);
      media.volumeCovers = extractVolumeCoversFromVolumes(data);

      // Add additional volume covers from volumeData
      const additional = extractAdditionalVolumeCovers(data, media.volumeCovers);
      media.volumeCovers.push(...additional);
    }
  }

  // Deduplicate
  media = deduplicateMedia(media);

  logger.info(`[media-extractors] Final media for ${provider}:`, {
    covers: media.covers.length,
    banners: media.banners.length,
    gallery: media.gallery.length,
    volumeCovers: media.volumeCovers.length,
    chapterCovers: media.chapterCovers.length
  });

  return media as Record<string, string[]>;
}
