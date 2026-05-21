/**
 * Sub-components for LazyImageGallery
 * Extracted to reduce complexity of the main component
 */

import React, { useState } from 'react';

import {
  Box,
  Modal,
  ActionIcon,
  Group,
  Text
} from '@mantine/core';
import {
  IconX,
  IconZoomIn,
  IconZoomOut,
  IconArrowLeft,
  IconArrowRight,
  IconZoomIn as IconArrowsMaximize,
  IconZoomOut as IconArrowsMinimize
} from '@tabler/icons-react';

import { ProgressiveImage } from '../ProgressiveImage';

import type { ImageItem } from '../LazyImageGallery';

// ============================================================================
// GalleryThumbnail Component
// ============================================================================

interface GalleryThumbnailProps {
  image: ImageItem;
  thumbnailHeight: number;
  showTitles: boolean;
  loadingComponent?: React.ReactNode;
  onClick: () => void;
}

export function GalleryThumbnail({
  image,
  thumbnailHeight,
  showTitles,
  loadingComponent,
  onClick
}: GalleryThumbnailProps): React.ReactElement {
  return (
    <Box
      style={{
        position: 'relative',
        cursor: 'pointer',
        overflow: 'hidden',
        borderRadius: 'var(--mantine-radius-sm)'
      }}
      onClick={onClick}
    >
      <ProgressiveImage
        src={image.thumbnail ?? image.src}
        alt={image.alt}
        style={{
          width: '100%',
          height: thumbnailHeight,
          objectFit: 'cover'
        }}
        loadingComponent={loadingComponent}
        aspectRatio={image.width && image.height ? image.width / image.height : 16 / 9}
      />

      {showTitles && image.title && (
        <Box
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '8px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
            color: 'white'
          }}
        >
          <Text size="xs" lineClamp={1}>
            {image.title}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// GalleryLightbox Component
// ============================================================================

interface GalleryLightboxProps {
  isOpen: boolean;
  selectedImage: ImageItem | null;
  selectedIndex: number;
  totalImages: number;
  zoom: number;
  isMobile: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export function GalleryLightbox({
  isOpen,
  selectedImage,
  selectedIndex,
  totalImages,
  zoom,
  isMobile,
  onClose,
  onPrevious,
  onNext,
  onZoomIn,
  onZoomOut,
  onResetZoom
}: GalleryLightboxProps): React.ReactElement {
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!selectedImage) {
    return <></>;
  }

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      fullScreen={isMobile || isFullscreen}
      size={isFullscreen ? '100%' : 'xl'}
      padding={0}
      withCloseButton={false}
      styles={{
        content: { backgroundColor: 'black' },
        body: { padding: 0 }
      }}
    >
      <Box style={{ position: 'relative', height: '100vh' }}>
        {/* Header */}
        <LightboxHeader
          selectedIndex={selectedIndex}
          totalImages={totalImages}
          zoom={zoom}
          isMobile={isMobile}
          isFullscreen={isFullscreen}
          onClose={onClose}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onResetZoom={onResetZoom}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />

        {/* Navigation arrows */}
        {!isMobile && (
          <LightboxNavigation
            onPrevious={onPrevious}
            onNext={onNext}
          />
        )}

        {/* Image */}
        <LightboxImage
          selectedImage={selectedImage}
          zoom={zoom}
          isMobile={isMobile}
          onClose={onClose}
        />

        {/* Mobile swipe hint */}
        {isMobile && selectedIndex === 0 && (
          <Text
            size="xs"
            c="white"
            ta="center"
            style={{
              position: 'absolute',
              bottom: 'md',
              left: 0,
              right: 0,
              opacity: 0.7
            }}
          >
            Swipe to navigate • Pinch to zoom
          </Text>
        )}
      </Box>
    </Modal>
  );
}

// ============================================================================
// Lightbox Sub-components
// ============================================================================

interface LightboxHeaderProps {
  selectedIndex: number;
  totalImages: number;
  zoom: number;
  isMobile: boolean;
  isFullscreen: boolean;
  onClose: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleFullscreen: () => void;
}

function LightboxHeader({
  selectedIndex,
  totalImages,
  zoom,
  isMobile,
  isFullscreen,
  onClose,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleFullscreen
}: LightboxHeaderProps): React.ReactElement {
  return (
    <Group
      justify="space-between"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: 'md',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
        zIndex: 10
      }}
    >
      <Text c="white" size="sm">
        {selectedIndex + 1} / {totalImages}
      </Text>

      <Group gap="xs">
        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onResetZoom}
          disabled={zoom === 1}
        >
          <Text size="xs" c="white">{Math.round(zoom * 100)}%</Text>
        </ActionIcon>

        <ActionIcon variant="subtle" color="gray" onClick={onZoomOut}>
          <IconZoomOut size={20} />
        </ActionIcon>

        <ActionIcon variant="subtle" color="gray" onClick={onZoomIn}>
          <IconZoomIn size={20} />
        </ActionIcon>

        {!isMobile && (
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <IconArrowsMinimize size={20} /> : <IconArrowsMaximize size={20} />}
          </ActionIcon>
        )}

        <ActionIcon
          variant="subtle"
          color="gray"
          onClick={onClose}
        >
          <IconX size={20} />
        </ActionIcon>
      </Group>
    </Group>
  );
}

interface LightboxNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
}

function LightboxNavigation({
  onPrevious,
  onNext
}: LightboxNavigationProps): React.ReactElement {
  return (
    <>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="xl"
        onClick={onPrevious}
        style={{
          position: 'absolute',
          left: 'md',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10
        }}
      >
        <IconArrowLeft size={24} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        color="gray"
        size="xl"
        onClick={onNext}
        style={{
          position: 'absolute',
          right: 'md',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10
        }}
      >
        <IconArrowRight size={24} />
      </ActionIcon>
    </>
  );
}

interface LightboxImageProps {
  selectedImage: ImageItem;
  zoom: number;
  isMobile: boolean;
  onClose: () => void;
}

function LightboxImage({
  selectedImage,
  zoom,
  isMobile,
  onClose
}: LightboxImageProps): React.ReactElement {
  return (
    <Box
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
      onClick={isMobile ? undefined : onClose}
    >
      <Box
        style={{
          transform: `scale(${zoom})`,
          transition: 'transform 0.2s ease',
          maxWidth: '100%',
          maxHeight: '100%'
        }}
      >
        <ProgressiveImage
          src={selectedImage.src}
          alt={selectedImage.alt}
          {...(selectedImage.thumbnail ? { placeholder: selectedImage.thumbnail } : {})}
          style={{
            maxWidth: '100vw',
            maxHeight: '100vh',
            objectFit: 'contain'
          }}
        />
      </Box>
    </Box>
  );
}
