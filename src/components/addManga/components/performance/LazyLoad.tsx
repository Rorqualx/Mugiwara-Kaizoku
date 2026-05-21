/**
 * LazyLoad Components
 *
 * Components for lazy loading and code splitting
 */
import type { ComponentType, ReactNode} from 'react';
import React, { lazy, Suspense, useState, useEffect, useRef, memo, useCallback } from 'react';

import { Center, Loader, Skeleton, Stack, Group, Text } from '@mantine/core';
import { useIntersection } from '@mantine/hooks';

import { ErrorBoundary } from '@/components/common/UnifiedErrorBoundary';
import { logger } from '@/utils/logger';
/**
 * Props for lazy loaded components
 */
interface LazyLoadProps {
  /** Fallback component while loading */
  fallback?: ReactNode;
  /** Error fallback component */
  errorFallback?: ReactNode;
  /** Delay before showing loading state (ms) */
  delay?: number;
  /** Minimum loading time (ms) to prevent flashing */
  minLoadTime?: number;
  /** Enable intersection observer loading */
  loadOnView?: boolean;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection observer */
  threshold?: number;
}
/**
 * Enhanced lazy function with loading states
 */
export function lazyWithPreload<T extends ComponentType<unknown>>(factory: () => Promise<{
  default: T;
}>): React.LazyExoticComponent<T> & { preload: () => Promise<{ default: T }> } {
  let componentPromise: Promise<{
    default: T;
  }> | null = null;
  const LazyComponent = lazy(() => {
    componentPromise ??= factory();
    return componentPromise;
  });
  // Add preload method
  const LazyComponentWithPreload = LazyComponent as typeof LazyComponent & {
    preload: () => Promise<{ default: T }>;
  };
  LazyComponentWithPreload.preload = () => {
    componentPromise ??= factory();
    return componentPromise;
  };
  return LazyComponentWithPreload;
}
/**
 * Loading fallback with delay
 */
const DelayedLoader = memo(function DelayedLoader({ delay = 200

}: {delay?: number;}): React.ReactElement | null {
  const [showLoader, setShowLoader] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  if (!showLoader)
  return null;
  return <Center h="100%">
      <Loader size="lg" />
    </Center>;
});
/**
 * Wrapper for lazy loaded components
 */
export function LazyLoad({ children, fallback, errorFallback, delay = 200, minLoadTime = 0, loadOnView = false, rootMargin = '50px', threshold = 0.1

}: LazyLoadProps & {children: ReactNode;}): React.ReactElement {
  const [shouldLoad, setShouldLoad] = useState(!loadOnView);
  const [isMinTimeElapsed, setIsMinTimeElapsed] = useState(minLoadTime === 0);
  const loadStartTime = useRef<number | undefined>(undefined);
  // Intersection observer for viewport-based loading
  const { ref, entry } = useIntersection({
    root: null,
    rootMargin,
    threshold
  });
  // Handle intersection
  useEffect(() => {
    if (loadOnView && entry?.isIntersecting && !shouldLoad) {
      loadStartTime.current = Date.now();
      setShouldLoad(true);
      if (minLoadTime > 0) {
        setTimeout(() => {
          setIsMinTimeElapsed(true);
        }, minLoadTime);
      }
    }
  }, [entry?.isIntersecting, loadOnView, shouldLoad, minLoadTime]);
  // Component hasn't entered viewport yet
  if (!shouldLoad) {
    return <div ref={ref}>
        {fallback ?? <Skeleton height={200} />}
      </div>;
  }
  // Component is loading
  if (!isMinTimeElapsed) {
    return <>{fallback ?? <DelayedLoader delay={delay} />}</>;
  }
  return <ErrorBoundary fallback={() => errorFallback}>
      <Suspense fallback={fallback ?? <DelayedLoader delay={delay} />}>
        {children}
      </Suspense>
    </ErrorBoundary>;
}
/**
 * Provider result card skeleton
 */
export const ProviderResultSkeleton = memo(function ProviderResultSkeleton(): React.ReactElement {
  return <Stack gap="xs">
      <Group gap="xs">
        <Skeleton height={8} width={80} radius="xl" />
        <Skeleton height={8} width={60} radius="xl" />
      </Group>
      <Group gap="md" align="flex-start">
        <Skeleton height={120} width={80} radius="md" />
        <Stack gap="xs" style={{ flex: 1 }}>
          <Skeleton height={12} width="70%" />
          <Skeleton height={8} width="40%" />
          <Skeleton height={60} />
          <Group gap="xs">
            <Skeleton height={20} width={60} radius="xl" />
            <Skeleton height={20} width={60} radius="xl" />
            <Skeleton height={20} width={60} radius="xl" />
          </Group>
        </Stack>
      </Group>
    </Stack>;
});
/**
 * Metadata field skeleton
 */
export const MetadataFieldSkeleton = memo(function MetadataFieldSkeleton(): React.ReactElement {
  return <Stack gap="xs">
      <Skeleton height={10} width={100} />
      <Skeleton height={36} />
    </Stack>;
});
/**
 * Volume table skeleton
 */
export const VolumeTableSkeleton = memo(function VolumeTableSkeleton(): React.ReactElement {
  return <Stack gap="xs">
      <Skeleton height={40} />
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={50} />)}
    </Stack>;
});
/**
 * Lazy load provider results
 */
export const LazyProviderResults = lazyWithPreload(() =>
  import('../display/ProviderResults').then((m) => ({ default: m.default as ComponentType<unknown> }))
);
/**
 * Lazy load volume chapter table
 */
export const LazyVolumeChapterTable = lazyWithPreload(() =>
  import('../display/VolumeChapterTable').then((m) => ({ default: m.VolumeChapterTable as ComponentType<unknown> }))
);
/**
 * Lazy load metadata preview
 */
export const LazyMetadataPreview = lazyWithPreload(() =>
  import('../display/MetadataPreview').then((m) => ({ default: m.MetadataPreview as ComponentType<unknown> }))
);
/**
 * Hook for preloading components
 */
export function usePreloadComponents(): {
  preload: (componentName: string) => Promise<void>;
  preloadAll: () => Promise<void>;
  isPreloaded: (componentName: string) => boolean;
} {
  const preloadedRef = useRef<Set<string>>(new Set());
  const preload = useCallback(async (componentName: string) => {
    if (preloadedRef.current.has(componentName)) {
      return;
    }
    try {
      switch (componentName) {
        case 'ProviderResults': {
          const component = LazyProviderResults as typeof LazyProviderResults & {
            preload: () => Promise<unknown>;
          };
          await component.preload();
          break;
        }
        case 'VolumeChapterTable': {
          const component = LazyVolumeChapterTable as typeof LazyVolumeChapterTable & {
            preload: () => Promise<unknown>;
          };
          await component.preload();
          break;
        }
        case 'MetadataPreview': {
          const component = LazyMetadataPreview as typeof LazyMetadataPreview & {
            preload: () => Promise<unknown>;
          };
          await component.preload();
          break;
        }
        default:
          logger.warn(`Unknown component name for preload: ${componentName}`);
          return;
      }
      preloadedRef.current.add(componentName);
    }
    catch (error: unknown) {
      logger.error(`Failed to preload ${componentName}:`, error);
    }
  }, []);
  const preloadAll = useCallback(async () => {
    const components = ['ProviderResults', 'VolumeChapterTable', 'MetadataPreview'];
    await Promise.all(components.map(preload));
  }, [preload]);
  return {
    preload,
    preloadAll,
    isPreloaded: (componentName: string) => preloadedRef.current.has(componentName)
  };
}
/**
 * Progressive image component
 */
interface ProgressiveImageProps {
  src: string;
  placeholder?: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}
export const ProgressiveImage = memo(function ProgressiveImage({ src, placeholder, alt, width, height, className, onLoad, onError }: ProgressiveImageProps): React.ReactElement {
  const [imageSrc, setImageSrc] = useState(placeholder ?? '');
  const [_imageRef, setImageRef] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!src)
    return;
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      setError(true);
      setIsLoading(false);
      return;
    }
    const ImageConstructor = window.Image as unknown as { new (): HTMLImageElement };
    const img = new ImageConstructor();
    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
      setError(false);
      onLoad?.();
    };
    img.onerror = () => {
      setError(true);
      setIsLoading(false);
      onError?.();
    };
    img.src = src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onLoad, onError]);
  if (error) {
    return <Center style={{
      width,
      height,
      background: 'var(--mantine-color-gray-1)',
      borderRadius: 'var(--mantine-radius-md)'
    }}>

        <Text size="xs" c="dimmed">Failed to load image</Text>
      </Center>;
  }
  return <div style={{ position: 'relative', width, height }} className={className}>
      {isLoading && placeholder &&
    <img src={placeholder} alt={alt} style={{
      position: 'absolute',
      width: '100%',
      height: '100%',
      filter: 'blur(10px)',
      transform: 'scale(1.1)'
    }} />}
      {isLoading && !placeholder &&
    <Skeleton width={width} height={height} style={{ position: 'absolute' }} />}
      <img ref={setImageRef} src={imageSrc} alt={alt} style={{
      width: '100%',
      height: '100%',
      opacity: isLoading ? 0 : 1,
      transition: 'opacity 0.3s ease-in-out'
    }} />

    </div>;
});