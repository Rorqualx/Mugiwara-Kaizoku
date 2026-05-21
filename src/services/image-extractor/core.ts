/**
 * Image Extractor Core Class
 *
 * Central class for image collection and deduplication.
 * Uses provider-specific extractors for actual extraction logic.
 *
 * Architecture:
 * - Maintains deduplicated image collection via Set
 * - Delegates extraction to specialized provider modules
 * - Provides filtering and categorization utilities
 * - Manages categorized images for UI display
 *
 * Extracted from: src/services/imageExtractor.ts (lines 29-462)
 */


import { extractAniListImages } from './extractors/anilist';
import { extractComicVineImages } from './extractors/comicvine';
import { extractFandomImages, extractFandomGallery } from './extractors/fandom';
import { extractSelectedProviderImages } from './extractors/selected';
import { extractWikipediaImages } from './extractors/wikipedia';
import { extractWizardImages } from './extractors/wizard';

import type {
  ImageOption,
  ImageCategory,
  WizardSelectedImages,
  FandomMetadata,
  ComicVineMetadata,
  AniListMetadata,
  WikipediaMetadata,
  SelectedProviderMetadata
} from './types';

/**
 * Image Extractor class with duplicate detection
 */
export class ImageExtractor {
  private seenUrls = new Set<string>();
  private images: ImageOption[] = [];

  /**
   * Add image if not already seen (duplicate detection)
   */
  public addUniqueImage(image: ImageOption): void {
    if (!this.seenUrls.has(image.url)) {
      this.seenUrls.add(image.url);
      this.images.push(image);
    }
  }

  /**
   * Extract wizard images using provider-specific extractor
   */
  public extractWizardImages(wizardData: WizardSelectedImages): void {
    extractWizardImages(wizardData, this.addUniqueImage.bind(this));
  }

  /**
   * Extract Fandom images using provider-specific extractor
   */
  public extractFandomImages(fandomData: FandomMetadata): void {
    extractFandomImages(fandomData, this.addUniqueImage.bind(this));
  }

  /**
   * Extract Fandom gallery using provider-specific extractor
   */
  public extractFandomGallery(galleryData: unknown): void {
    extractFandomGallery(galleryData, this.addUniqueImage.bind(this));
  }

  /**
   * Extract ComicVine images using provider-specific extractor
   */
  public extractComicVineImages(comicvineData: ComicVineMetadata): void {
    extractComicVineImages(comicvineData, this.addUniqueImage.bind(this));
  }

  /**
   * Extract AniList images using provider-specific extractor
   */
  public extractAniListImages(anilistData: AniListMetadata): void {
    extractAniListImages(anilistData, this.addUniqueImage.bind(this));
  }

  /**
   * Extract Wikipedia images using provider-specific extractor
   */
  public extractWikipediaImages(wikipediaData: WikipediaMetadata): void {
    extractWikipediaImages(wikipediaData, this.addUniqueImage.bind(this));
  }

  /**
   * Extract selected provider images using provider-specific extractor
   */
  public extractSelectedProviderImages(
    providerKey: string,
    providerData: SelectedProviderMetadata
  ): void {
    extractSelectedProviderImages(providerKey, providerData, this.addUniqueImage.bind(this));
  }

  /**
   * Get all extracted images
   */
  public getImages(): ImageOption[] {
    return this.images;
  }

  /**
   * Get images by type
   */
  public getImagesByType(type: 'cover' | 'banner' | 'gallery'): ImageOption[] {
    return this.images.filter(img => img.type === type);
  }

  /**
   * Get images by category
   */
  public getImagesByCategory(category: string): ImageOption[] {
    return this.images.filter(img => img.category === category);
  }

  /**
   * Get categorized images for UI display
   */
  public getCategorizedImages(): ImageCategory[] {
    const categories: ImageCategory[] = [];

    // Wizard selections
    const wizardImages = this.getImagesByCategory('wizard');
    if (wizardImages.length > 0) {
      categories.push({
        id: 'wizard',
        label: 'Wizard Selections',
        images: wizardImages,
        type: 'cover',
        count: wizardImages.length
      });
    }

    // Gallery images
    const galleryImages = this.getImagesByCategory('gallery');
    if (galleryImages.length > 0) {
      categories.push({
        id: 'gallery',
        label: 'Gallery & Promotional Art',
        images: galleryImages,
        type: 'gallery',
        count: galleryImages.length
      });
    }

    // Volume covers
    const volumeImages = this.getImagesByCategory('volume');
    if (volumeImages.length > 0) {
      // Sort by volume number
      volumeImages.sort((a, b) => {
        const aVol = a.volumeNumber ?? 0;
        const bVol = b.volumeNumber ?? 0;
        return aVol - bVol;
      });
      categories.push({
        id: 'volumes',
        label: 'Volume Covers',
        images: volumeImages,
        type: 'cover',
        count: volumeImages.length
      });
    }

    // Chapter covers
    const chapterImages = this.getImagesByCategory('chapter');
    if (chapterImages.length > 0) {
      // Sort by chapter number
      chapterImages.sort((a, b) => {
        const aChap = a.chapterNumber ?? 0;
        const bChap = b.chapterNumber ?? 0;
        return aChap - bChap;
      });
      categories.push({
        id: 'chapters',
        label: 'Chapter Covers',
        images: chapterImages,
        type: 'cover',
        count: chapterImages.length
      });
    }

    // Provider covers
    const providerImages = this.getImagesByCategory('provider');
    if (providerImages.length > 0) {
      categories.push({
        id: 'providers',
        label: 'Provider Images',
        images: providerImages,
        type: 'cover',
        count: providerImages.length
      });
    }

    // Metadata covers
    const metadataImages = this.getImagesByCategory('metadata');
    if (metadataImages.length > 0) {
      categories.push({
        id: 'metadata',
        label: 'Standard Sizes',
        images: metadataImages,
        type: 'cover',
        count: metadataImages.length
      });
    }

    return categories;
  }
}
