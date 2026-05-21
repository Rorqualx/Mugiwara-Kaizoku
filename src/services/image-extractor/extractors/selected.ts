/**
 * Selected Provider Image Extractor
 *
 * Extracts images from selected provider metadata including:
 * - Cover images
 * - Banner images
 * - Metadata nested covers
 *
 * Handles providers with _selected suffix (e.g., anilist_selected, fandom_selected)
 *
 * Extracted from: src/services/imageExtractor.ts (lines 303-347)
 */

import { getProviderNameSafe } from '../types';

import type { SelectedProviderMetadata, ImageOption } from '../types';

export function extractSelectedProviderImages(
  providerKey: string,
  providerData: SelectedProviderMetadata,
  addImage: (image: ImageOption) => void
): void {
  const providerName = getProviderNameSafe(providerKey);

  if (providerData.cover) {
    addImage({
      url: providerData.cover,
      label: `${providerName} Selected Cover`,
      type: 'cover',
      category: 'provider',
      provider: providerName
    });
  }

  if (providerData.coverImage) {
    addImage({
      url: providerData.coverImage,
      label: `${providerName} Selected Image`,
      type: 'cover',
      category: 'provider',
      provider: providerName
    });
  }

  if (providerData.bannerImage) {
    addImage({
      url: providerData.bannerImage,
      label: `${providerName} Selected Banner`,
      type: 'banner',
      category: 'provider',
      provider: providerName
    });
  }

  if (providerData.metadata) {
    if (providerData.metadata.cover) {
      addImage({
        url: providerData.metadata.cover,
        label: `${providerName} Metadata Cover`,
        type: 'cover',
        category: 'provider',
        provider: providerName
      });
    }
  }
}
