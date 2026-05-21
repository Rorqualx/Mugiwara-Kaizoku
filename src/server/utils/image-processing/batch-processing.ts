/**
 * Batch Image Processing Module
 *
 * Functions for processing multiple images and extracting images from complex data structures.
 *
 * Extracted from: index.ts (lines 301-364)
 */

import { cleanImageUrl, isValidImageUrl, extractBestImage } from './index';

import type { ImageProcessingOptions } from './types';

// ============================================================================
// Batch Processing Functions
// ============================================================================

/**
 * Process multiple image URLs at once
 */
export function processImageUrls(
  urls: (string | undefined)[],
  options: ImageProcessingOptions = {}
): string[] {
  return urls
    .filter((url): url is string => !!url)
    .map(url => {
      let processedUrl = url;
      if (options.cleanUrl !== false) {
        processedUrl = cleanImageUrl(processedUrl, options.baseUrl);
      }

      if (options.validateUrl && !isValidImageUrl(processedUrl)) {
        return '';
      }

      return processedUrl;
    })
    .filter(Boolean);
}

/**
 * Extract all images from a complex data structure
 */
export function extractAllImages(data: unknown, baseUrl?: string): string[] {
  const images: string[] = [];

  function traverse(obj: unknown): void {
    if (!obj) return;

    if (typeof obj === 'string' && isValidImageUrl(obj)) {
      images.push(cleanImageUrl(obj, baseUrl));
    } else if (Array.isArray(obj)) {
      obj.forEach(traverse);
    } else if (typeof obj === 'object') {
      // Check for known image properties
      const imageProps = ['image', 'coverImage', 'thumbnail', 'poster', 'banner', 'avatar', 'logo'];

      for (const prop of imageProps) {
        if ((obj as Record<string, unknown>)[prop]) {
          const extracted = extractBestImage((obj as Record<string, unknown>)[prop]);
          if (extracted) {
            images.push(cleanImageUrl(extracted, baseUrl));
          }
        }
      }

      // Traverse nested objects
      Object.values(obj).forEach(traverse);
    }
  }

  traverse(data);

  // Remove duplicates
  return Array.from(new Set(images));
}
