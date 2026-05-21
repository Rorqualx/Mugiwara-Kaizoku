/**
 * Media Extractor Module
 *
 * Exports media extraction utilities for processing provider metadata.
 */

export {
  cleanFandomImageUrl,
  cleanRawFandomUrl,
  extractFandomFilename,
  normalizeImageUrl,
  createImageHash,
  fixDoubleEncodedUrl
} from './url-helpers';

export {
  UNWANTED_IMAGE_PATTERNS,
  MAGAZINE_PATTERNS,
  isUnwantedImage,
  isTooSmallByDimensions,
  extractFilenameFromUrl,
  isMagazineImage,
  isVolumeLikeFilename
} from './image-filters';

export {
  collectVolumeCoverUrls,
  extractVolumeCovers,
  updateGalleryWithVolumeCovers,
  extractChapterCovers,
  updateGalleryWithChapterCovers
} from './volume-extraction';
