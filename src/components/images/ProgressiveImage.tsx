/**
 * Progressive Image Component
 *
 * Provides progressive image loading with:
 * - Low-quality placeholder
 * - Lazy loading with intersection observer
 * - Blur-up effect
 * - Error handling with fallback
 * - Loading states
 * - Responsive image sources
 *
 * Refactored to use extracted hooks and sub-components for maintainability.
 */

import type { JSX } from 'react';
import React from 'react';

import { Box, Image } from '@mantine/core';


import { useImageDisplay } from './hooks/useImageDisplay';
import { useImageLoading } from './hooks/useImageLoading';
import { ImageErrorState, ImageLoadingState } from './sub-components';

import type { ImageProps } from '@mantine/core';

export interface ProgressiveImageProps extends Omit<ImageProps, 'src'> {
  /** High-quality image source */
  src: string;
  /** Low-quality placeholder image (base64 or small URL) */
  placeholder?: string;
  /** Alternative text for accessibility */
  alt: string;
  /** Responsive image sources */
  srcSet?: string;
  /** Sizes for responsive images */
  sizes?: string;
  /** Fallback image on error */
  fallbackSrc?: string;
  /** Whether to lazy load */
  lazy?: boolean;
  /** Loading animation type */
  loadingType?: 'skeleton' | 'blur' | 'none';
  /** Aspect ratio (width/height) for maintaining space */
  aspectRatio?: number;
  /** On load callback */
  onLoad?: () => void;
  /** On error callback */
  onError?: () => void;
  /** Intersection observer margin */
  rootMargin?: string;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Whether to use native lazy loading */
  useNativeLazy?: boolean;
}

export function ProgressiveImage({
  src,
  placeholder,
  alt,
  srcSet,
  sizes,
  fallbackSrc,
  lazy = true,
  loadingType = 'blur',
  aspectRatio,
  onLoad,
  onError,
  rootMargin = '50px',
  loadingComponent,
  errorComponent,
  useNativeLazy = true,
  style,
  ...imageProps
}: ProgressiveImageProps): JSX.Element {
  // Use image loading hook for state management
  const { imageState, currentSrc, mergedRef } = useImageLoading({
    src,
    placeholder,
    lazy,
    rootMargin,
    fallbackSrc,
    onLoad,
    onError
  });

  // Use image display hook for styling
  const { responsiveSizes, containerStyle, imageStyle } = useImageDisplay({
    sizes,
    imageState,
    loadingType,
    aspectRatio,
    style: style as React.CSSProperties | undefined
  });

  // Render loading state
  if (imageState === 'loading') {
    return (
      <Box ref={mergedRef} style={containerStyle}>
        <ImageLoadingState
          loadingType={loadingType}
          placeholder={placeholder}
          alt={alt}
          style={style as React.CSSProperties | undefined}
          aspectRatio={aspectRatio}
          loadingComponent={loadingComponent}
        />
      </Box>
    );
  }

  // Render error state (without fallback)
  if (imageState === 'error' && !fallbackSrc) {
    return (
      <Box style={containerStyle}>
        <ImageErrorState
          alt={alt}
          fallbackSrc={fallbackSrc}
          errorComponent={errorComponent}
          style={style as React.CSSProperties | undefined}
          aspectRatio={aspectRatio}
        />
      </Box>
    );
  }

  // Render loaded image or error with fallback
  return (
    <Box ref={mergedRef} style={containerStyle}>
      <Image
        src={currentSrc}
        srcSet={srcSet}
        sizes={responsiveSizes}
        alt={alt}
        loading={useNativeLazy && lazy ? 'lazy' : undefined}
        style={imageStyle}
        {...imageProps}
      />
    </Box>
  );
}

// Preload image utility
export function preloadImage(src: string, srcSet?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();

    img.addEventListener('load', () => resolve());
    img.addEventListener('error', () =>
      reject(new Error(`Failed to preload image: ${src}`))
    );

    if (srcSet) {
      img.srcset = srcSet;
    }

    img.src = src;
  });
}

// Generate placeholder from image URL (requires server-side support)
export function getPlaceholderUrl(src: string, width = 20): string {
  // This is a placeholder implementation
  // In production, this would call your image processing service
  return `${src}?w=${width}&blur=20`;
}

// Generate srcSet for responsive images
export function generateSrcSet(
  src: string,
  widths: number[] = [320, 640, 768, 1024, 1280, 1920]
): string {
  return widths.map((width) => `${src}?w=${width} ${width}w`).join(', ');
}
