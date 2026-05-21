/**
 * Hook for image display logic
 * Handles responsive sizing, loading states, and error states
 */

import { useMemo } from 'react';

import { useBreakpoint } from '@/hooks/mobile';

export interface UseImageDisplayOptions {
  /** Image source */
  src?: string;
  /** Alternative text */
  alt?: string;
  /** Responsive image sources */
  srcSet?: string | undefined;
  /** Sizes for responsive images */
  sizes?: string | undefined;
  /** Image state */
  imageState: 'loading' | 'loaded' | 'error';
  /** Loading animation type */
  loadingType?: 'skeleton' | 'blur' | 'none';
  /** Aspect ratio (width/height) for maintaining space */
  aspectRatio?: number | undefined;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom error component */
  errorComponent?: React.ReactNode;
  /** Whether to use native lazy loading */
  useNativeLazy?: boolean;
  /** Whether lazy loading is enabled */
  lazy?: boolean;
  /** Placeholder image */
  placeholder?: string | undefined;
  /** Custom style */
  style?: React.CSSProperties | undefined;
}

export interface UseImageDisplayReturn {
  /** Responsive sizes for the image */
  responsiveSizes: string | undefined;
  /** Loading display component */
  loadingDisplay: React.ReactNode;
  /** Error display component */
  errorDisplay: React.ReactNode;
  /** Container style with aspect ratio */
  containerStyle: React.CSSProperties;
  /** Image style with transitions */
  imageStyle: React.CSSProperties;
}

export function useImageDisplay({
  sizes,
  imageState,
  loadingType = 'blur',
  aspectRatio,
  loadingComponent,
  errorComponent,
  style
}: UseImageDisplayOptions): UseImageDisplayReturn {
  const { isMobile } = useBreakpoint();

  // Calculate responsive sizes if not provided
  const responsiveSizes = useMemo(() => {
    if (sizes) return sizes;
    if (!isMobile) return undefined;

    // Default responsive sizes for mobile
    return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
  }, [sizes, isMobile]);

  // Loading component
  const loadingDisplay = useMemo(() => {
    if (loadingComponent) return loadingComponent;

    // Note: Skeleton component import would be handled by the parent component
    // This hook only returns the configuration for loading display
    return null;
  }, [loadingComponent]);

  // Error component
  const errorDisplay = useMemo(() => {
    if (errorComponent) return errorComponent;
    return null;
  }, [errorComponent]);

  // Container style with aspect ratio
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    ...(style ? (style as React.CSSProperties) : {})
  };

  if (aspectRatio) {
    containerStyle.paddingBottom = `${1 / aspectRatio * 100}%`;
    containerStyle.height = 0;
  }

  const imageStyle: React.CSSProperties = {
    transition: imageState === 'loaded' ? 'filter 0.3s ease-out' : 'none',
    filter: imageState === 'loading' && loadingType === 'blur' ? 'blur(20px)' : 'none'
  };

  if (aspectRatio) {
    imageStyle.position = 'absolute';
    imageStyle.top = 0;
    imageStyle.left = 0;
    imageStyle.width = '100%';
    imageStyle.height = '100%';
    imageStyle.objectFit = 'cover';
  }

  return {
    responsiveSizes,
    loadingDisplay,
    errorDisplay,
    containerStyle,
    imageStyle
  };
}