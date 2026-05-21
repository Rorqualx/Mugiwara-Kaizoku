/**
 * Image Metadata Extraction Module
 *
 * Functions for extracting metadata from image URLs and elements.
 *
 * Extracted from: index.ts (lines 366-417, 616-668)
 */

import { detectImageType } from './type-detection';
import { cleanImageUrl } from './url-processing';
import { getImageFormat } from './validation';

import type { ImageInfo, ImageProcessingOptions } from './types';

// ============================================================================
// Dimension Extraction Functions
// ============================================================================

/**
 * Extract image dimensions from URL (if encoded in URL)
 */
export function extractDimensionsFromUrl(url: string): { width?: number; height?: number } {
  // Common patterns for dimensions in URLs
  const patterns = [
    /(\d+)x(\d+)/,           // 800x600
    /w=(\d+)&h=(\d+)/,       // w=800&h=600
    /width=(\d+).*height=(\d+)/, // width=800...height=600
    /_(\d+)x(\d+)\./         // image_800x600.jpg
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1] && match[2]) {
      return {
        width: parseInt(match[1], 10),
        height: parseInt(match[2], 10)
      };
    }
  }

  return {};
}

/**
 * Build image info object
 */
export function buildImageInfo(url: string, options: ImageProcessingOptions = {}): ImageInfo {
  const cleaned = options.cleanUrl !== false ? cleanImageUrl(url, options.baseUrl) : url;

  const info: ImageInfo = {
    url: cleaned
  };

  if (options.extractDimensions) {
    const dimensions = extractDimensionsFromUrl(url);
    if (dimensions.width) info.width = dimensions.width;
    if (dimensions.height) info.height = dimensions.height;
  }

  const format = getImageFormat(cleaned);
  if (format) {
    info.format = format;
  }

  return info;
}

// ============================================================================
// Image Element Metadata Extraction
// ============================================================================

/**
 * Extract image metadata from URL and context
 */
export function extractImageMetadata(img: {
  url: string;
  alt?: string;
  title?: string;
  width?: string | number;
  height?: string | number;
  srcset?: string;
  'data-src'?: string;
  'data-original'?: string;
  class?: string;
}): ImageInfo & { type?: string; srcset?: string[] } {
  const url = img['data-original'] ?? img['data-src'] ?? img.url;
  const cleanedUrl = cleanImageUrl(url);

  // Parse dimensions
  const width = typeof img.width === 'string' ? parseInt(img.width, 10) : img.width;
  const height = typeof img.height === 'string' ? parseInt(img.height, 10) : img.height;

  // Parse srcset
  let srcsetArray: string[] = [];
  if (img.srcset) {
    srcsetArray = img.srcset.split(',').map(s => s.trim());
  }

  // Detect type
  const typeInput: Record<string, unknown> = {
    url: cleanedUrl
  };
  if (img.alt !== undefined) typeInput["alt"] = img.alt;
  if (img["title"] !== undefined) typeInput["title"] = img["title"];
  if (img.class !== undefined) typeInput["parentClass"] = img.class;

  const type = detectImageType(typeInput as { url: string; alt?: string; title?: string; parentClass?: string; position?: number });

  const result: ImageInfo & { type?: string; srcset?: string[] } = {
    url: cleanedUrl
  };
  if (width !== undefined) result.width = width;
  if (height !== undefined) result.height = height;
  const format = getImageFormat(cleanedUrl);
  if (format !== undefined) result.format = format;
  result.type = type;
  if (srcsetArray.length > 0) result.srcset = srcsetArray;

  return result;
}
