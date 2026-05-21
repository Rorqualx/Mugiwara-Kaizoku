/**
 * Decomposed LazyImageGallery component
 * Uses extracted hooks and sub-components for better maintainability
 */

import React, { useState } from 'react';

import { useGalleryNavigation } from './hooks/useGalleryNavigation';
import { ProgressiveImageDecomposed } from './ProgressiveImageDecomposed';
import { GalleryGrid, LightboxModal } from './sub-components';

export interface LazyImageGalleryDecomposedProps {
  /** Array of image sources */
  images: string[];
  /** Number of columns in the grid */
  columns?: number;
  /** Height of each thumbnail */
  thumbnailHeight?: number;
  /** Whether virtual scrolling is enabled */
  virtualScrolling?: boolean;
  /** Alternative text prefix */
  altPrefix?: string;
  /** Custom style */
  style?: React.CSSProperties;
  /** On image click handler */
  onImageClick?: (index: number) => void;
  /** Whether to show lightbox */
  showLightbox?: boolean;
}

export function LazyImageGalleryDecomposed({
  images,
  columns = 4,
  thumbnailHeight = 200,
  virtualScrolling = true,
  altPrefix = 'Gallery image',
  style,
  onImageClick,
  showLightbox = true
}: LazyImageGalleryDecomposedProps): React.ReactElement {
  const [lightboxOpened, setLightboxOpened] = useState(false);

  // Use gallery navigation hook
  const {
    selectedIndex,
    setSelectedIndex,
    closeGallery
  } = useGalleryNavigation({
    imageCount: images.length
  });

  // Handle image click
  const handleImageClick = (index: number): void => {
    setSelectedIndex(index);
    setLightboxOpened(true);
    onImageClick?.(index);
  };

  // Handle lightbox close
  const handleLightboxClose = (): void => {
    setLightboxOpened(false);
    closeGallery();
  };

  // Handle image change in lightbox
  const handleImageChange = (index: number): void => {
    setSelectedIndex(index);
  };

  // Render function for individual gallery images
  const renderImage = (src: string, index: number): React.ReactElement => (
    <ProgressiveImageDecomposed
      src={src}
      alt={`${altPrefix} ${index + 1}`}
      loadingType="blur"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover'
      }}
    />
  );

  return (
    <div style={style}>
      {/* Gallery grid */}
      <GalleryGrid
        images={images}
        columns={columns}
        thumbnailHeight={thumbnailHeight}
        onImageClick={handleImageClick}
        virtualScrolling={virtualScrolling}
        renderImage={renderImage}
      />

      {/* Lightbox modal */}
      {showLightbox && (
        <LightboxModal
          images={images}
          selectedIndex={selectedIndex}
          onClose={handleLightboxClose}
          onImageChange={handleImageChange}
          altPrefix={altPrefix}
          opened={lightboxOpened}
        />
      )}
    </div>
  );
}