/**
 * Wikipedia Image Extractor
 *
 * Extracts images from Wikipedia metadata including:
 * - Thumbnail
 * - Main image
 * - Additional images array
 *
 * Extracted from: src/services/imageExtractor.ts (lines 263-298)
 */

import type { WikipediaMetadata, ImageOption } from '../types';

export function extractWikipediaImages(
  wikipediaData: WikipediaMetadata,
  addImage: (image: ImageOption) => void
): void {
  if (wikipediaData.thumbnail) {
    addImage({
      url: wikipediaData.thumbnail,
      label: 'Wikipedia Thumbnail',
      type: 'cover',
      category: 'provider',
      provider: 'Wikipedia',
      size: 'small'
    });
  }

  if (wikipediaData.image) {
    addImage({
      url: wikipediaData.image,
      label: 'Wikipedia Image',
      type: 'cover',
      category: 'provider',
      provider: 'Wikipedia'
    });
  }

  if (wikipediaData.images && Array.isArray(wikipediaData.images)) {
    wikipediaData.images.forEach((url, index) => {
      if (url) {
        addImage({
          url,
          label: `Wikipedia Image ${index + 1}`,
          type: 'cover',
          category: 'provider',
          provider: 'Wikipedia'
        });
      }
    });
  }
}
