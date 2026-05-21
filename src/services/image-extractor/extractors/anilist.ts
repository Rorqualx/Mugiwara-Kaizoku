/**
 * AniList Image Extractor
 *
 * Extracts images from AniList metadata including:
 * - Cover images (extraLarge, large, medium)
 * - Banner image
 *
 * Extracted from: src/services/imageExtractor.ts (lines 213-258)
 * Created: 2025-11-20
 */

import type { AniListMetadata, ImageOption } from '../types';

/**
 * Extract images from AniList metadata
 *
 * AniList provides multiple cover image sizes and banner images.
 * This function extracts all available sizes for flexibility in display.
 *
 * @param anilistData - AniList metadata object
 * @param addImage - Callback to add extracted images
 *
 * @example
 * ```typescript
 * extractAniListImages(anilistData, (image) => {
 *   images.push(image);
 * });
 * ```
 */
export function extractAniListImages(
  anilistData: AniListMetadata,
  addImage: (image: ImageOption) => void
): void {
  const coverImage = anilistData.coverImage;

  if (coverImage) {
    if (coverImage.extraLarge) {
      addImage({
        url: coverImage.extraLarge,
        label: 'AniList Cover (Extra Large)',
        type: 'cover',
        category: 'provider',
        provider: 'AniList',
        size: 'extraLarge'
      });
    }
    if (coverImage.large) {
      addImage({
        url: coverImage.large,
        label: 'AniList Cover (Large)',
        type: 'cover',
        category: 'provider',
        provider: 'AniList',
        size: 'large'
      });
    }
    if (coverImage.medium) {
      addImage({
        url: coverImage.medium,
        label: 'AniList Cover (Medium)',
        type: 'cover',
        category: 'provider',
        provider: 'AniList',
        size: 'medium'
      });
    }
  }

  if (anilistData.bannerImage) {
    addImage({
      url: anilistData.bannerImage,
      label: 'AniList Banner',
      type: 'banner',
      category: 'provider',
      provider: 'AniList'
    });
  }
}
