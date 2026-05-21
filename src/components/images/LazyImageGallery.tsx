/**
 * Lazy Image Gallery Component
 *
 * Optimized gallery for displaying multiple images with:
 * - Virtual scrolling for performance
 * - Progressive loading
 * - Pinch-to-zoom on mobile
 * - Swipe navigation
 * - Fullscreen mode
 */

import React, { useMemo, useCallback } from 'react';

import { Box } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';

import { useBreakpoint } from '@/hooks/mobile';

import { SwipeableItem, type SwipeAction } from '../responsive/SwipeableItem';

import { useGalleryNavigation } from './hooks/useGalleryNavigation';
import { useGalleryZoom } from './hooks/useGalleryZoom';
import { useVirtualScrolling } from './hooks/useVirtualScrolling';
import {
  GalleryThumbnail,
  GalleryLightbox
} from './sub-components/LazyImageGalleryParts';

export interface ImageItem {
  /** Unique identifier */
  id: string;
  /** Image source URL */
  src: string;
  /** Thumbnail URL */
  thumbnail?: string;
  /** Alternative text */
  alt: string;
  /** Image title */
  title?: string;
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
}

interface LazyImageGalleryProps {
  /** Array of images */
  images: ImageItem[];
  /** Number of columns on desktop */
  columns?: number;
  /** Gap between images */
  gap?: string | number;
  /** Whether to show image titles */
  showTitles?: boolean;
  /** Custom thumbnail height */
  thumbnailHeight?: number;
  /** On image click handler */
  onImageClick?: (image: ImageItem, index: number) => void;
  /** Enable virtual scrolling for large galleries */
  virtualScroll?: boolean;
  /** Virtual scroll buffer */
  scrollBuffer?: number;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Enable swipe actions on mobile */
  enableSwipeActions?: boolean;
  /** Swipe actions for images */
  swipeActions?: SwipeAction[];
}

export function LazyImageGallery({
  images,
  columns = 3,
  gap = 'md',
  showTitles = true,
  thumbnailHeight = 200,
  onImageClick,
  virtualScroll = true,
  scrollBuffer = 3,
  loadingComponent,
  enableSwipeActions = false,
  swipeActions = []
}: LazyImageGalleryProps): React.ReactElement {
  const { isMobile, isTablet } = useBreakpoint();

  // Responsive columns
  const responsiveColumns = useMemo(() => {
    if (isMobile) return 2;
    if (isTablet) return Math.min(columns, 3);
    return columns;
  }, [isMobile, isTablet, columns]);

  // Use decomposed hooks for state management
  const {
    selectedIndex,
    setSelectedIndex,
    navigatePrevious,
    navigateNext,
    closeGallery
  } = useGalleryNavigation({ imageCount: images.length });

  const { zoom, zoomIn, zoomOut, resetZoom } = useGalleryZoom();

  const { startIndex, endIndex, galleryRef } = useVirtualScrolling({
    totalItems: images.length,
    columns: responsiveColumns,
    thumbnailHeight,
    enabled: virtualScroll,
    scrollBuffer
  });

  // Handle image selection
  const handleImageClick = useCallback((index: number) => {
    setSelectedIndex(index);
    const image = images[index];
    if (image) {
      onImageClick?.(image, index);
    }
  }, [images, onImageClick, setSelectedIndex]);

  // Keyboard navigation
  useHotkeys([
    ['ArrowLeft', navigatePrevious],
    ['ArrowRight', navigateNext],
    ['Escape', closeGallery],
    ['+', zoomIn],
    ['-', zoomOut],
    ['0', resetZoom]
  ]);

  // Generate thumbnail items
  const thumbnailItems = useMemo(() => {
    const visibleImages = virtualScroll
      ? images.slice(startIndex, endIndex)
      : images;

    return visibleImages.map((image, index) => {
      const actualIndex = virtualScroll ? startIndex + index : index;

      const imageComponent = (
        <GalleryThumbnail
          key={image.id}
          image={image}
          thumbnailHeight={thumbnailHeight}
          showTitles={showTitles}
          loadingComponent={loadingComponent}
          onClick={() => handleImageClick(actualIndex)}
        />
      );

      // Wrap in swipeable if enabled on mobile
      if (isMobile && enableSwipeActions && swipeActions.length > 0) {
        return (
          <SwipeableItem
            key={image.id}
            leftActions={swipeActions}
            threshold={50}
          >
            {imageComponent}
          </SwipeableItem>
        );
      }

      return imageComponent;
    });
  }, [
    images,
    startIndex,
    endIndex,
    virtualScroll,
    thumbnailHeight,
    showTitles,
    loadingComponent,
    isMobile,
    enableSwipeActions,
    swipeActions,
    handleImageClick
  ]);

  // Selected image for lightbox
  const selectedImage = selectedIndex !== null ? (images[selectedIndex] ?? null) : null;

  return (
    <>
      <Box
        ref={galleryRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${responsiveColumns}, 1fr)`,
          gap: gap,
          width: '100%'
        }}
      >
        {virtualScroll && startIndex > 0 && (
          <Box
            style={{
              gridColumn: `1 / -1`,
              height: `${(startIndex / responsiveColumns) * (thumbnailHeight + 32)}px`
            }}
          />
        )}

        {thumbnailItems}

        {virtualScroll && endIndex < images.length && (
          <Box
            style={{
              gridColumn: `1 / -1`,
              height: `${((images.length - endIndex) / responsiveColumns) * (thumbnailHeight + 32)}px`
            }}
          />
        )}
      </Box>

      {/* Lightbox Modal */}
      <GalleryLightbox
        isOpen={selectedIndex !== null}
        selectedImage={selectedImage}
        selectedIndex={selectedIndex ?? 0}
        totalImages={images.length}
        zoom={zoom}
        isMobile={isMobile}
        onClose={closeGallery}
        onPrevious={navigatePrevious}
        onNext={navigateNext}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
      />
    </>
  );
}
