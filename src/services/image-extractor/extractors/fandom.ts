/**
 * Fandom Image Extractor
 *
 * Extracts images from Fandom metadata including:
 * - Volume covers
 * - Chapter covers
 * - Gallery images
 *
 * TYPE SAFETY FIXES:
 * - Lines 146, 150: Uses isGalleryArray type guard for safe assignments
 *
 * Extracted from: src/services/imageExtractor.ts (lines 96-173)
 */

import { isGalleryArray } from '../types';

import type {
  FandomMetadata,
  FandomVolume,
  FandomChapter,
  ImageOption
} from '../types';

/**
 * Extract images from Fandom metadata
 *
 * Processes volume and chapter data to extract cover images
 *
 * @param fandomData - Fandom metadata containing volumes and chapters
 * @param addImage - Callback to add discovered images
 */
export function extractFandomImages(
  fandomData: FandomMetadata,
  addImage: (image: ImageOption) => void
): void {
  const volumeData = fandomData.volumeData ?? fandomData.volumeDetails;

  if (Array.isArray(volumeData)) {
    volumeData.forEach((volume: FandomVolume) => {
      // Volume covers
      const coverUrl = volume.coverImage ?? volume.coverImageUrl ?? volume.cover;
      if (coverUrl) {
        const volumeNum = volume.volumeNumber ?? volume.number;
        addImage({
          url: coverUrl,
          label: `Fandom Volume ${volumeNum} Cover`,
          type: 'cover',
          category: 'volume',
          provider: 'Fandom',
          // Only include volumeNumber if it's actually a number (exactOptionalPropertyTypes compliance)
          ...(typeof volumeNum === 'number' && { volumeNumber: volumeNum })
        });
      }

      // Chapter covers from this volume
      if (volume.chapters && Array.isArray(volume.chapters)) {
        volume.chapters.forEach((chapter: FandomChapter) => {
          const chapterCoverUrl = chapter.coverImageUrl ?? chapter.coverImage;
          if (chapterCoverUrl) {
            const chapterNum = chapter.chapterNumber ?? chapter.number;
            const chapterTitle = chapter.title;
            addImage({
              url: chapterCoverUrl,
              label: `Fandom Chapter ${chapterNum}${chapterTitle ? ` - ${chapterTitle}` : ''}`,
              type: 'cover',
              category: 'chapter',
              provider: 'Fandom',
              // Only include chapterNumber if it's actually a number (exactOptionalPropertyTypes compliance)
              ...(typeof chapterNum === 'number' && { chapterNumber: chapterNum })
            });
          }
        });
      }
    });
  }
}

/**
 * Extract images from Fandom gallery
 *
 * Processes gallery data which can be:
 * - Array of strings (image URLs)
 * - Array of objects with url and optional caption
 * - Object containing gallery property with one of the above
 *
 * TYPE SAFETY: Uses isGalleryArray type guard to safely narrow unknown types
 *
 * @param galleryData - Gallery data in various formats
 * @param addImage - Callback to add discovered images
 */
export function extractFandomGallery(
  galleryData: unknown,
  addImage: (image: ImageOption) => void
): void {
  let gallery: Array<string | { url: string; caption?: string }> = [];

  // TYPE SAFETY FIX (line 146 in original): Use type guard for safe assignment
  if (isGalleryArray(galleryData)) {
    gallery = galleryData;
  } else if (galleryData && typeof galleryData === 'object' && 'gallery' in galleryData) {
    const g = (galleryData as { gallery?: unknown }).gallery;
    // TYPE SAFETY FIX (line 150 in original): Use type guard for safe assignment
    if (isGalleryArray(g)) {
      gallery = g;
    }
  }

  gallery.forEach((item, index) => {
    if (typeof item === 'string' && item) {
      addImage({
        url: item,
        label: `Fandom Gallery ${index + 1}`,
        type: 'gallery',
        category: 'gallery',
        provider: 'Fandom'
      });
    } else if (item && typeof item === 'object' && 'url' in item && item.url) {
      addImage({
        url: item.url,
        label: item.caption ?? `Fandom Gallery ${index + 1}`,
        type: 'gallery',
        category: 'gallery',
        provider: 'Fandom'
      });
    }
  });
}
