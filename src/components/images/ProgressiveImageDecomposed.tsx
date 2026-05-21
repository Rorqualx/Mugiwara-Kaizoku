/**
 * Decomposed ProgressiveImage component
 * Uses extracted hooks and sub-components for better maintainability
 */

import React from 'react';

import { Image } from '@mantine/core';

import { useImageDisplay } from './hooks/useImageDisplay';
import { useImageLoading } from './hooks/useImageLoading';
import { ImageLoadingState, ImageErrorState } from './sub-components';

export interface ProgressiveImageDecomposedProps {
  /** High-quality image source */
  src: string;
  /** Alternative text */
  alt: string;
  /** Low-quality placeholder image */
  placeholder?: string;
  /** Responsive image sources */
  srcSet?: string;
  /** Sizes for responsive images */
  sizes?: string;
  /** Loading animation type */
  loadingType?: 'skeleton' | 'blur' | 'none';
  /** Aspect ratio (width/height) for maintaining space */
  aspectRatio?: number;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Whether to use native lazy loading */
  useNativeLazy?: boolean;
  /** Whether lazy loading is enabled */
  lazy?: boolean;
  /** Fallback image on error */
  fallbackSrc?: string;
  /** On load callback */
  onLoad?: () => void;
  /** On error callback */
  onError?: () => void;
  /** Custom style */
  style?: React.CSSProperties;
  /** Additional props */
  [key: string]: unknown;
}

export function ProgressiveImageDecomposed({
  src,
  alt,
  placeholder,
  srcSet,
  sizes,
  loadingType = 'blur',
  aspectRatio,
  loadingComponent,
  errorComponent,
  useNativeLazy = true,
  lazy = true,
  fallbackSrc,
  onLoad,
  onError,
  style,
  ...props
}: ProgressiveImageDecomposedProps): React.ReactElement {
  // Use image loading hook
  const {
    imageState,
    currentSrc,
    mergedRef
  } = useImageLoading({
    src,
    placeholder,
    lazy,
    fallbackSrc,
    onLoad,
    onError
  });

  // Use image display hook
  const {
    responsiveSizes,
    containerStyle,
    imageStyle
  } = useImageDisplay({
    sizes,
    imageState,
    loadingType,
    aspectRatio,
    loadingComponent,
    errorComponent,
    style
  });

  // Handle different image states
  if (imageState === 'loading') {
    return (
      <div ref={mergedRef} style={containerStyle}>
        <ImageLoadingState
          loadingType={loadingType}
          placeholder={placeholder}
          alt={alt}
          style={style}
          aspectRatio={aspectRatio}
          loadingComponent={loadingComponent}
        />
      </div>
    );
  }

  if (imageState === 'error') {
    return (
      <div style={containerStyle}>
        <ImageErrorState
          alt={alt}
          fallbackSrc={fallbackSrc}
          errorComponent={errorComponent}
          style={style}
          aspectRatio={aspectRatio}
        />
      </div>
    );
  }

  // Render loaded image
  return (
    <div style={containerStyle}>
      <Image
        src={currentSrc}
        alt={alt}
        srcSet={srcSet}
        sizes={responsiveSizes}
        loading={useNativeLazy && lazy ? 'lazy' : 'eager'}
        style={imageStyle}
        {...props}
      />
    </div>
  );
}