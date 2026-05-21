/**
 * ImagePreview Component
 *
 * Renders an image preview from a URL with validation and fallback.
 */

'use client';

import React from 'react';

import { Image } from '@mantine/core';

import { logger } from '@/utils/logger';

interface ImagePreviewProps {
  url: unknown;
  alt?: string;
  height?: number;
}

export function ImagePreview({
  url,
  alt = 'Cover preview',
  height = 100
}: ImagePreviewProps): React.ReactNode {
  // Type guard to ensure url is a valid string
  if (url === null) return null;

  const imageUrl = typeof url === 'string' ? url : String(url);

  // Only render if we have a meaningful URL
  if (!imageUrl || imageUrl === 'undefined' || imageUrl === 'null') return null;

  // Validate URL format
  try {
    new URL(imageUrl);
    return (
      <Image
        src={imageUrl}
        alt={alt}
        h={height}
        fit="contain"
        fallbackSrc="/cover-not-found.jpg"
      />
    );
  } catch (_e: unknown) {
    logger.warn('Invalid image URL:', imageUrl);
    return null;
  }
}

// Helper to use as render function
export function renderImagePreview(url: unknown): React.ReactNode {
  return <ImagePreview url={url} />;
}

export default ImagePreview;
