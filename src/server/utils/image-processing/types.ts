/**
 * Image Processing Type Definitions
 *
 * Shared type definitions used across all image processing modules.
 *
 * Extracted from: index.ts (lines 14-36)
 */

/**
 * Represents information about an image, including its URL and optional metadata.
 */
export interface ImageInfo {
  url: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
}

/**
 * Options for configuring image processing operations.
 */
export interface ImageProcessingOptions {
  cleanUrl?: boolean;
  resolveRelative?: boolean;
  baseUrl?: string;
  validateUrl?: boolean;
  extractDimensions?: boolean;
  preferredSize?: 'small' | 'medium' | 'large' | 'original';
}

/**
 * Represents a set of image URLs at different sizes.
 */
export interface ImageSet {
  small?: string;
  medium?: string;
  large?: string;
  original?: string;
}
