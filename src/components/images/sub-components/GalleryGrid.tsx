/**
 * Component for displaying the gallery grid with virtual scrolling
 * Handles responsive grid layout and image rendering
 */

import React from 'react';

import { SimpleGrid } from '@mantine/core';

import { useVirtualScrolling } from '../hooks/useVirtualScrolling';

export interface GalleryGridProps {
  /** Array of image sources */
  images: string[];
  /** Number of columns in the grid */
  columns: number;
  /** Height of each thumbnail */
  thumbnailHeight: number;
  /** On image click handler */
  onImageClick: (index: number) => void;
  /** Whether virtual scrolling is enabled */
  virtualScrolling?: boolean;
  /** Render function for individual images */
  renderImage: (src: string, index: number) => React.ReactElement;
  /** Custom style */
  style?: React.CSSProperties;
}

export function GalleryGrid({
  images,
  columns,
  thumbnailHeight,
  onImageClick,
  virtualScrolling = true,
  renderImage,
  style
}: GalleryGridProps): React.ReactElement {
  const { startIndex, endIndex, galleryRef } = useVirtualScrolling({
    totalItems: images.length,
    columns,
    thumbnailHeight,
    enabled: virtualScrolling
  });

  // Get visible images for virtual scrolling
  const visibleImages = virtualScrolling
    ? images.slice(startIndex, endIndex)
    : images;

  return (
    <div ref={galleryRef} style={style}>
      <SimpleGrid
        cols={columns}
        spacing="md"
        verticalSpacing="md"
      >
        {visibleImages.map((src, index) => {
          const actualIndex = virtualScrolling ? startIndex + index : index;
          return (
            <div
              key={`${src}-${actualIndex}`}
              onClick={() => onImageClick(actualIndex)}
              style={{
                cursor: 'pointer',
                height: thumbnailHeight,
                overflow: 'hidden',
                borderRadius: 'var(--mantine-radius-md)'
              }}
            >
              {renderImage(src, actualIndex)}
            </div>
          );
        })}
      </SimpleGrid>
    </div>
  );
}