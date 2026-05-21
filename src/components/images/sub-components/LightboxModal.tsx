/**
 * Component for displaying the lightbox modal
 * Handles image navigation, zoom, and keyboard controls
 */

import React from 'react';

import { Modal, Group, ActionIcon, Image } from '@mantine/core';
import { IconX, IconChevronLeft, IconChevronRight, IconZoomIn, IconZoomOut, IconRefresh } from '@tabler/icons-react';

import { useGalleryNavigation } from '../hooks/useGalleryNavigation';
import { useGalleryZoom } from '../hooks/useGalleryZoom';

export interface LightboxModalProps {
  /** Array of image sources */
  images: string[];
  /** Currently selected image index */
  selectedIndex: number | null;
  /** On close handler */
  onClose: () => void;
  /** On image change handler */
  onImageChange: (index: number) => void;
  /** Alternative text prefix */
  altPrefix?: string;
  /** Whether modal is open */
  opened: boolean;
}

export function LightboxModal({
  images,
  selectedIndex,
  onClose,
  onImageChange,
  altPrefix = 'Image',
  opened
}: LightboxModalProps): React.ReactElement {
  // Prevent unused parameter warning
  void onImageChange;
  const { navigatePrevious, navigateNext } = useGalleryNavigation({
    imageCount: images.length
  });

  const { zoom, zoomIn, zoomOut, resetZoom } = useGalleryZoom();

  if (selectedIndex === null) {
    return <></>;
  }

  const currentImage = images[selectedIndex];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      centered
      withCloseButton={false}
      padding={0}
      radius="md"
    >
      {/* Header controls */}
      <Group
        justify="space-between"
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 1000
        }}
      >
        <Group>
          <ActionIcon
            variant="filled"
            color="dark"
            onClick={zoomIn}
            aria-label="Zoom in"
          >
            <IconZoomIn size={16} />
          </ActionIcon>
          <ActionIcon
            variant="filled"
            color="dark"
            onClick={zoomOut}
            aria-label="Zoom out"
          >
            <IconZoomOut size={16} />
          </ActionIcon>
          <ActionIcon
            variant="filled"
            color="dark"
            onClick={resetZoom}
            aria-label="Reset zoom"
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>

        <ActionIcon
          variant="filled"
          color="dark"
          onClick={onClose}
          aria-label="Close lightbox"
        >
          <IconX size={16} />
        </ActionIcon>
      </Group>

      {/* Navigation controls */}
      {images.length > 1 && (
        <>
          <ActionIcon
            variant="filled"
            color="dark"
            style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1000
            }}
            onClick={navigatePrevious}
            aria-label="Previous image"
          >
            <IconChevronLeft size={20} />
          </ActionIcon>

          <ActionIcon
            variant="filled"
            color="dark"
            style={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1000
            }}
            onClick={navigateNext}
            aria-label="Next image"
          >
            <IconChevronRight size={20} />
          </ActionIcon>
        </>
      )}

      {/* Image display */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '70vh',
          overflow: 'hidden',
          padding: 16
        }}
      >
        <Image
          src={currentImage}
          alt={`${altPrefix} ${selectedIndex + 1}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${zoom})`,
            transition: 'transform 0.2s ease-out'
          }}
        />
      </div>

      {/* Image counter */}
      {images.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 'var(--mantine-radius-md)',
            fontSize: 'var(--mantine-font-size-sm)'
          }}
        >
          {selectedIndex + 1} / {images.length}
        </div>
      )}
    </Modal>
  );
}