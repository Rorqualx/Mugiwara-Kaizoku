/**
 * Manga Gallery Component
 *
 * Displays a grid of gallery images selected during the wizard import process.
 * Provides click-to-expand functionality for viewing full-size images.
 */

import React, { useState } from 'react';

import {
  SimpleGrid,
  Image,
  Modal,
  Box,
  ActionIcon,
  Text,
  Paper
} from '@mantine/core';
import { IconX, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

export interface MangaGalleryProps {
  /** Array of image URLs to display */
  images: string[];
  /** Optional title for the gallery section */
  title?: string;
}

/**
 * MangaGallery Component
 *
 * Displays gallery images in a responsive grid layout.
 * Click on an image to view it in full size with navigation.
 */
export function MangaGallery({ images, title: _title }: MangaGalleryProps): React.ReactElement | null {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return null;
  }

  const handlePrevious = (): void => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const handleNext = (): void => {
    if (selectedImageIndex !== null && selectedImageIndex < images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowLeft') {
      handlePrevious();
    } else if (event.key === 'ArrowRight') {
      handleNext();
    } else if (event.key === 'Escape') {
      setSelectedImageIndex(null);
    }
  };

  return (
    <>
      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
        {images.map((imageUrl, index) => (
          <Paper
            key={index}
            withBorder
            style={{
              cursor: 'pointer',
              overflow: 'hidden',
              borderRadius: 'var(--mantine-radius-md)',
              transition: 'transform 150ms ease-in-out',
              '&:hover': {
                transform: 'scale(1.05)'
              }
            }}
            onClick={() => setSelectedImageIndex(index)}
          >
            <Image
              src={imageUrl}
              alt={`Gallery image ${index + 1}`}
              height={200}
              fit="cover"
              fallbackSrc="/cover-not-found.jpg"
            />
          </Paper>
        ))}
      </SimpleGrid>

      {/* Full-size image modal */}
      <Modal
        opened={selectedImageIndex !== null}
        onClose={() => setSelectedImageIndex(null)}
        size="xl"
        padding={0}
        withCloseButton={false}
        centered
        onKeyDown={handleKeyDown}
      >
        <Box pos="relative">
          {/* Close button */}
          <ActionIcon
            pos="absolute"
            top={10}
            right={10}
            size="lg"
            variant="filled"
            color="dark"
            style={{ zIndex: 100 }}
            onClick={() => setSelectedImageIndex(null)}
          >
            <IconX size={18} />
          </ActionIcon>

          {/* Image counter */}
          {selectedImageIndex !== null && (
            <Box
              pos="absolute"
              top={10}
              left={10}
              style={{ zIndex: 100 }}
            >
              <Paper p="xs" bg="dark" opacity={0.8}>
                <Text size="sm" c="white" fw={500}>
                  {selectedImageIndex + 1} / {images.length}
                </Text>
              </Paper>
            </Box>
          )}

          {/* Navigation buttons */}
          {selectedImageIndex !== null && selectedImageIndex > 0 && (
            <ActionIcon
              pos="absolute"
              left={10}
              top="50%"
              size="xl"
              variant="filled"
              color="dark"
              style={{ transform: 'translateY(-50%)', zIndex: 100 }}
              onClick={handlePrevious}
            >
              <IconChevronLeft size={24} />
            </ActionIcon>
          )}

          {selectedImageIndex !== null && selectedImageIndex < images.length - 1 && (
            <ActionIcon
              pos="absolute"
              right={10}
              top="50%"
              size="xl"
              variant="filled"
              color="dark"
              style={{ transform: 'translateY(-50%)', zIndex: 100 }}
              onClick={handleNext}
            >
              <IconChevronRight size={24} />
            </ActionIcon>
          )}

          {/* Full-size image */}
          {selectedImageIndex !== null && (
            <Image
              src={images[selectedImageIndex]}
              alt={`Gallery image ${selectedImageIndex + 1}`}
              fit="contain"
              style={{ maxHeight: '80vh' }}
              fallbackSrc="/cover-not-found.jpg"
            />
          )}
        </Box>
      </Modal>
    </>
  );
}
