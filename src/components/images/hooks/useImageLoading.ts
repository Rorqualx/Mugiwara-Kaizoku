/**
 * Hook for progressive image loading logic
 * Handles image state management, lazy loading, and error handling
 */

import { useState, useEffect, useRef } from 'react';

import { useIntersection, useMergedRef } from '@mantine/hooks';

export interface UseImageLoadingOptions {
  /** High-quality image source */
  src: string;
  /** Low-quality placeholder image */
  placeholder?: string | undefined;
  /** Whether to lazy load */
  lazy?: boolean;
  /** Intersection observer margin */
  rootMargin?: string;
  /** Fallback image on error */
  fallbackSrc?: string | undefined;
  /** On load callback */
  onLoad?: (() => void) | undefined;
  /** On error callback */
  onError?: (() => void) | undefined;
}

export interface UseImageLoadingReturn {
  /** Current image state */
  imageState: 'loading' | 'loaded' | 'error';
  /** Current image source */
  currentSrc: string;
  /** Combined ref for intersection observer */
  mergedRef: React.RefCallback<HTMLDivElement>;
  /** Whether image should be loaded */
  shouldLoad: boolean;
}

export function useImageLoading({
  src,
  placeholder,
  lazy = true,
  rootMargin = '50px',
  fallbackSrc,
  onLoad,
  onError
}: UseImageLoadingOptions): UseImageLoadingReturn {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [currentSrc, setCurrentSrc] = useState(placeholder ?? '');
  const imageRef = useRef<HTMLDivElement>(null);

  // Use intersection observer for lazy loading
  const { ref: intersectionRef, entry } = useIntersection({
    root: null,
    rootMargin,
    threshold: 0
  });

  // Combine refs using useMergedRef
  const mergedRef = useMergedRef(imageRef, intersectionRef);

  // Determine if we should load the image
  const shouldLoad = !lazy || (entry?.isIntersecting ?? false);

  // Load high-quality image
  useEffect(() => {
    if (!shouldLoad || imageState === 'loaded') return;

    const img = new window.Image();

    const handleLoad = (): void => {
      setCurrentSrc(src);
      setImageState('loaded');
      onLoad?.();
    };

    const handleError = (): void => {
      if (fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      }
      setImageState('error');
      onError?.();
    };

    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);

    img.src = src;

    return () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
  }, [shouldLoad, src, fallbackSrc, onLoad, onError, imageState]);

  return {
    imageState,
    currentSrc,
    mergedRef,
    shouldLoad
  };
}