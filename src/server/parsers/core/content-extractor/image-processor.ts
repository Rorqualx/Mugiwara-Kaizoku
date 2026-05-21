/**
 * Image Processor
 *
 * Handles cover image processing and assignment for volumes.
 * Matches images to volumes using pattern recognition and context analysis.
 *
 * Extracted from: ContentExtractor.ts (lines 487-518)
 * Date: 2025-11-21
 */

import type { ExtractedImage } from '@/server/parsers/extractors/ImageExtractor';
import type { PatternLibrary } from '@/server/parsers/patterns/PatternLibrary';

import type { VolumeData } from './types';

/**
 * Add cover images to volumes
 *
 * Attempts to match cover images to volumes by:
 * 1. Checking image captions for volume number patterns
 * 2. Checking image context for volume identifiers
 *
 * Only assigns images if the volume doesn't already have a cover.
 *
 * @param volumes - Array of volume data to process
 * @param images - Array of extracted images from the page
 * @param patterns - Pattern library for volume number matching
 */
export function addCoverImages(
  volumes: VolumeData[],
  images: ExtractedImage[],
  patterns: PatternLibrary
): void {
  for (const volume of volumes) {
    if (!volume.coverImage) {
      // Try to find cover image for this volume
      const coverImage = images.find((img) => {
        if (img.type !== 'cover' && img.type !== 'gallery') return false;

        // Check if image caption mentions this volume
        if (img.caption) {
          const volumeMatch = patterns.match(img.caption, 'volume');
          if (volumeMatch && parseInt(volumeMatch.value.toString(), 10) === volume.volumeNumber) {
            return true;
          }
        }

        // Check context
        if (img.context?.includes(`volume-${volume.volumeNumber}`)) {
          return true;
        }

        return false;
      });

      if (coverImage) {
        volume.coverImage = coverImage.url;
      }
    }
  }
}
