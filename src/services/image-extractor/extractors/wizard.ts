/**
 * Wizard Image Extractor
 *
 * Extracts images from wizard selections including:
 * - All selected images
 * - Gallery images
 * - Volume covers
 *
 * Extracted from: src/services/imageExtractor.ts (lines 46-91)
 * Created: 2025-11-20
 */

import type { WizardSelectedImages, ImageOption } from '../types';

/**
 * Extract wizard selection images
 *
 * Processes wizard-selected images from three sources:
 * 1. allImages - General selected images
 * 2. galleryImages - Gallery selections
 * 3. volumeCovers - Volume cover selections
 *
 * @param wizardData - Wizard selected images data
 * @param addImage - Callback to add image with deduplication
 *
 * @example
 * ```typescript
 * const wizardData: WizardSelectedImages = {
 *   allImages: ['url1.jpg', 'url2.jpg'],
 *   galleryImages: ['gallery1.jpg'],
 *   volumeCovers: ['vol1.jpg', 'vol2.jpg']
 * };
 *
 * extractWizardImages(wizardData, (image) => {
 *   console.log('Adding:', image.label, image.url);
 * });
 * ```
 */
export function extractWizardImages(
  wizardData: WizardSelectedImages,
  addImage: (image: ImageOption) => void
): void {
  // All selected images
  if (wizardData.allImages && Array.isArray(wizardData.allImages)) {
    wizardData.allImages.forEach((url, index) => {
      if (url) {
        addImage({
          url,
          label: `Selected Image ${index + 1}`,
          type: 'cover',
          category: 'wizard',
          provider: 'Wizard'
        });
      }
    });
  }

  // Gallery images
  if (wizardData.galleryImages && Array.isArray(wizardData.galleryImages)) {
    wizardData.galleryImages.forEach((url, index) => {
      if (url) {
        addImage({
          url,
          label: `Gallery Selection ${index + 1}`,
          type: 'gallery',
          category: 'gallery',
          provider: 'Wizard'
        });
      }
    });
  }

  // Volume covers
  if (wizardData.volumeCovers && Array.isArray(wizardData.volumeCovers)) {
    wizardData.volumeCovers.forEach((url, index) => {
      if (url) {
        addImage({
          url,
          label: `Volume Cover ${index + 1}`,
          type: 'cover',
          category: 'volume',
          provider: 'Wizard'
        });
      }
    });
  }
}
