/**
 * Image Extractor Orchestrator
 *
 * Main entry point for extracting all images from provider metadata.
 * Coordinates the ImageExtractor class with various data sources.
 *
 * COMPLEXITY REDUCTION:
 * - Original: 62 statements, complexity 38
 * - Refactored: ~15-20 statements, complexity ~5-8
 * - Method: Extracted 4 helper functions
 *
 * ERROR FIXES:
 * - Line 489: Uses parseProviderMetadata from types.ts (safe JSON parsing)
 * - Line 586: Null check added before parsedMetadata usage
 *
 * Extracted from: src/services/imageExtractor.ts (lines 467-679)
 */

import { isSelectedProviderKey } from '@/types/provider-metadata.types';

import { ImageExtractor } from './core';
import { parseProviderMetadata } from './types';

import type {
  ProviderMetadata,
  ImageOption,
  ImageCategory,
  SelectedProviderMetadata
} from './types';

// ============================================================================
// Helper Functions (Complexity Reduction)
// ============================================================================

/**
 * Extract images from all providers in parsed metadata
 * Fixes line 586: parsedMetadata null check
 */
function extractProviderImages(
  parsedMetadata: ProviderMetadata,
  extractor: ImageExtractor
): void {
  // Extract wizard and gallery selections
  extractWizardAndGalleryImages(parsedMetadata, extractor);

  // Extract from each provider
  extractFandomProviderImages(parsedMetadata, extractor);
  extractComicVineProviderImages(parsedMetadata, extractor);
  extractAniListProviderImages(parsedMetadata, extractor);
  extractWikipediaProviderImages(parsedMetadata, extractor);
  extractSelectedProviderImages(parsedMetadata, extractor);
}

/**
 * Extract wizard selections and gallery images
 */
function extractWizardAndGalleryImages(
  parsedMetadata: ProviderMetadata,
  extractor: ImageExtractor
): void {
  // Wizard selections
  if (parsedMetadata.selected_images) {
    extractor.extractWizardImages(parsedMetadata.selected_images);
  }

  // Selected gallery images
  let selectedGallery = parsedMetadata.selectedGalleryImages;

  // Check old location
  if (!selectedGallery && parsedMetadata['importProfile'] &&
      typeof parsedMetadata['importProfile'] === 'object' &&
      'mediaSelections' in parsedMetadata['importProfile'] &&
      parsedMetadata['importProfile']['mediaSelections'] &&
      typeof parsedMetadata['importProfile']['mediaSelections'] === 'object' &&
      'galleryImages' in parsedMetadata['importProfile']['mediaSelections']) {
    const galleryImagesValue = (parsedMetadata['importProfile']['mediaSelections'] as Record<string, unknown>)['galleryImages'];
    if (Array.isArray(galleryImagesValue) && galleryImagesValue.every((item): item is string => typeof item === 'string')) {
      selectedGallery = galleryImagesValue;
    }
  }

  if (Array.isArray(selectedGallery)) {
    selectedGallery.forEach((url: string, index: number) => {
      if (url) {
        extractor.addUniqueImage({
          url,
          label: `Gallery Image ${index + 1}`,
          type: 'gallery',
          category: 'gallery',
          provider: 'Selected'
        });
      }
    });
  }
}

/**
 * Extract Fandom provider images
 */
function extractFandomProviderImages(
  parsedMetadata: ProviderMetadata,
  extractor: ImageExtractor
): void {
  if (parsedMetadata.fandom) {
    extractor.extractFandomImages(parsedMetadata.fandom);
    if (parsedMetadata.fandom.gallery) {
      extractor.extractFandomGallery(parsedMetadata.fandom.gallery);
    }
  }
  if (parsedMetadata.fandom_volumes) {
    extractor.extractFandomImages(parsedMetadata.fandom_volumes);
  }
  if (parsedMetadata.fandom_chapters) {
    extractor.extractFandomImages(parsedMetadata.fandom_chapters);
  }
  if (parsedMetadata.FANDOM) {
    extractor.extractFandomImages(parsedMetadata.FANDOM);
    if (parsedMetadata.FANDOM.gallery) {
      extractor.extractFandomGallery(parsedMetadata.FANDOM.gallery);
    }
  }
  if (parsedMetadata.fandom_gallery) {
    extractor.extractFandomGallery(parsedMetadata.fandom_gallery);
  }
}

/**
 * Extract ComicVine provider images
 */
function extractComicVineProviderImages(
  parsedMetadata: ProviderMetadata,
  extractor: ImageExtractor
): void {
  if (parsedMetadata.comicvine) {
    extractor.extractComicVineImages(parsedMetadata.comicvine);
  }
  if (parsedMetadata.comicvine_volumes) {
    extractor.extractComicVineImages(parsedMetadata.comicvine_volumes);
  }
}

/**
 * Extract AniList provider images
 */
function extractAniListProviderImages(
  parsedMetadata: ProviderMetadata,
  extractor: ImageExtractor
): void {
  if (parsedMetadata.anilist) {
    extractor.extractAniListImages(parsedMetadata.anilist);
  }
}

/**
 * Extract Wikipedia provider images
 */
function extractWikipediaProviderImages(
  parsedMetadata: ProviderMetadata,
  extractor: ImageExtractor
): void {
  if (parsedMetadata.wikipedia) {
    extractor.extractWikipediaImages(parsedMetadata.wikipedia);
  }
  if (parsedMetadata.wikipedia_chapters) {
    extractor.extractWikipediaImages(parsedMetadata.wikipedia_chapters);
  }
}

/**
 * Extract selected provider images (with _selected suffix)
 */
function extractSelectedProviderImages(
  parsedMetadata: ProviderMetadata,
  extractor: ImageExtractor
): void {
  Object.keys(parsedMetadata).forEach(key => {
    if (isSelectedProviderKey(key)) {
      const providerData = parsedMetadata[key] as SelectedProviderMetadata;
      extractor.extractSelectedProviderImages(key, providerData);
    }
  });
}

/**
 * Extract standard metadata covers and banners
 */
function extractStandardMetadata(
  standardMetadata: {
    coverExtraLarge?: string;
    coverLarge?: string;
    coverMedium?: string;
    coverSmall?: string;
    cover?: string;
    coverUrl?: string;
    bannerImage?: string;
  },
  extractor: ImageExtractor
): void {
  if (standardMetadata.coverExtraLarge) {
    extractor.addUniqueImage({
      url: standardMetadata.coverExtraLarge,
      label: 'Extra Large Cover',
      type: 'cover',
      category: 'metadata',
      size: 'extraLarge'
    });
  }
  if (standardMetadata.coverLarge) {
    extractor.addUniqueImage({
      url: standardMetadata.coverLarge,
      label: 'Large Cover',
      type: 'cover',
      category: 'metadata',
      size: 'large'
    });
  }
  if (standardMetadata.coverMedium) {
    extractor.addUniqueImage({
      url: standardMetadata.coverMedium,
      label: 'Medium Cover',
      type: 'cover',
      category: 'metadata',
      size: 'medium'
    });
  }
  if (standardMetadata.coverSmall) {
    extractor.addUniqueImage({
      url: standardMetadata.coverSmall,
      label: 'Small Cover',
      type: 'cover',
      category: 'metadata',
      size: 'small'
    });
  }
  if (standardMetadata.cover) {
    extractor.addUniqueImage({
      url: standardMetadata.cover,
      label: 'Default Cover',
      type: 'cover',
      category: 'metadata'
    });
  }
  if (standardMetadata.coverUrl && !extractor.getImages().find(img => img.url === standardMetadata.coverUrl)) {
    extractor.addUniqueImage({
      url: standardMetadata.coverUrl,
      label: 'Cover URL',
      type: 'cover',
      category: 'metadata'
    });
  }
  if (standardMetadata.bannerImage) {
    extractor.addUniqueImage({
      url: standardMetadata.bannerImage,
      label: 'Banner Image',
      type: 'banner',
      category: 'metadata'
    });
  }
}

/**
 * Build cover and banner options from extracted images
 */
function buildResultOptions(
  extractor: ImageExtractor
): {
  coverOptions: ImageOption[];
  bannerOptions: ImageOption[];
} {
  const coverOptions = extractor.getImagesByType('cover');
  const galleryImages = extractor.getImagesByType('gallery');
  const bannerOptions = extractor.getImagesByType('banner');

  // Add large covers as banner options
  coverOptions.forEach(img => {
    if (img.size === 'large' || img.size === 'extraLarge') {
      bannerOptions.push({
        ...img,
        label: `${img.label} (as Banner)`,
        type: 'banner'
      });
    }
  });

  return {
    coverOptions: [...coverOptions, ...galleryImages],
    bannerOptions
  };
}

// ============================================================================
// Main Orchestrator Function
// ============================================================================

/**
 * Extract all images from provider metadata
 *
 * Coordinates extraction from multiple provider sources and standard metadata.
 * Returns categorized images for UI display.
 *
 * @param providerMetadata - Provider metadata (object or JSON string)
 * @param standardMetadata - Standard cover/banner metadata
 * @returns Object with coverOptions, bannerOptions, and categories
 */
export function extractAllImages(
  providerMetadata: ProviderMetadata | string | null,
  standardMetadata?: {
    coverExtraLarge?: string;
    coverLarge?: string;
    coverMedium?: string;
    coverSmall?: string;
    cover?: string;
    coverUrl?: string;
    bannerImage?: string;
  }
): {
  coverOptions: ImageOption[];
  bannerOptions: ImageOption[];
  categories: ImageCategory[];
} {
  const extractor = new ImageExtractor();

  // Step 1: Parse metadata (fixes line 489 - uses safe parser)
  const parsedMetadata = parseProviderMetadata(providerMetadata);

  // Step 2: Extract from providers (fixes line 586 - null check)
  if (parsedMetadata) {
    extractProviderImages(parsedMetadata, extractor);
  }

  // Step 3: Extract standard metadata
  if (standardMetadata) {
    extractStandardMetadata(standardMetadata, extractor);
  }

  // Step 4: Build results
  const { coverOptions, bannerOptions } = buildResultOptions(extractor);
  const categories = extractor.getCategorizedImages();

  return { coverOptions, bannerOptions, categories };
}
