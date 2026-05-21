/**
 * Image URL Extractors
 *
 * Extracts cover images, banner images, and gallery images from various sources.
 * Handles multiple fallback chains for image selection.
 *
 * @module components/addManga/form/confirmation-data-builder/image-url-extractors
 */

import type {
  MangaWithDynamicMetadata,
  RawDataObject,
  MetadataObject,
} from './types';

/**
 * Extracts cover image URL from manga sources
 * Priority: selectedCover > cover > coverImage
 *
 * @param manga - Main manga object
 * @param rawData - Raw data from wizard/Fandom
 * @param metadata - Metadata object
 * @returns Cover image URL
 */
export function extractCoverImage(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): string | undefined {
  const selectedCover = (manga['selectedCover'] as string | undefined) ?? rawData?.selectedCover;
  if (selectedCover) return selectedCover;

  const cover = manga['cover'] ?? rawData?.cover ?? (metadata?.['cover'] as string | undefined);
  if (cover && typeof cover === 'string') return cover;

  const coverImage = manga['coverImage'] ?? rawData?.coverImage ?? (metadata?.['coverImage'] as string | undefined);
  return typeof coverImage === 'string' ? coverImage : undefined;
}

/**
 * Extracts banner image URL from manga sources
 * Priority: selectedBanner > banner > bannerImage
 *
 * @param manga - Main manga object
 * @param rawData - Raw data from wizard/Fandom
 * @param metadata - Metadata object
 * @returns Banner image URL
 */
export function extractBannerImage(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): string | undefined {
  const selectedBanner = (manga['selectedBanner'] as string | undefined) ?? rawData?.selectedBanner;
  if (selectedBanner) return selectedBanner;

  const banner = (manga['banner'] as string | undefined) ?? rawData?.banner ?? (metadata?.['banner'] as string | undefined);
  if (banner) return banner;

  const bannerImage = manga.bannerImage ?? rawData?.bannerImage ?? (metadata?.['bannerImage'] as string | undefined);
  return bannerImage;
}

/**
 * Extracts gallery images from manga sources
 *
 * @param manga - Main manga object
 * @param rawData - Raw data from wizard/Fandom
 * @param metadata - Metadata object
 * @returns Array of gallery image URLs
 */
export function extractGalleryImages(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): string[] | undefined {
  const galleryImages = (manga['galleryImages'] as string[] | undefined) ?? (rawData?.['galleryImages'] as string[] | undefined) ?? (metadata?.['galleryImages'] as string[] | undefined);
  return Array.isArray(galleryImages) ? galleryImages : undefined;
}
