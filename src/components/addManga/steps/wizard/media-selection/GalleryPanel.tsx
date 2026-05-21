/**
 * Gallery Panel Component
 * Displays gallery images in a selectable grid with Select All functionality.
 * Extracted from: MediaSelectionStep.tsx (lines 673-785)
 */

import React from 'react';

import {
  Stack, Text, SimpleGrid, Badge, Group, Box, Checkbox, Image, Loader, Center
} from '@mantine/core';

import { proxyImageUrl } from '@/utils/image-proxy';

interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

interface MediaGallery {
  covers: string[];
  coversWithProviders?: Array<{ url: string; provider: string }>;
  banners: string[];
  gallery: string[];
  volumeCovers: string[];
  chapterCovers: string[];
}

interface GalleryPanelProps {
  mediaGallery: MediaGallery;
  selectedGalleryImages: string[];
  setSelectedGalleryImages: React.Dispatch<React.SetStateAction<string[]>>;
  loadingImages: Record<string, boolean>;
  setLoadingImages: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  logger: Logger;
}

export const GalleryPanel = ({
  mediaGallery,
  selectedGalleryImages,
  setSelectedGalleryImages,
  loadingImages,
  setLoadingImages,
  logger
}: GalleryPanelProps): JSX.Element => {
  const filteredGallery = mediaGallery.gallery.filter(
    (img: string) => !mediaGallery.volumeCovers.includes(img)
  );

  const handleSelectAll = (checked: boolean): void => {
    setSelectedGalleryImages(checked ? filteredGallery : []);
  };

  const handleToggleImage = (image: string): void => {
    setSelectedGalleryImages(prev =>
      prev.includes(image) ? prev.filter(img => img !== image) : [...prev, image]
    );
  };

  const allSelected = selectedGalleryImages.length > 0 &&
    selectedGalleryImages.length === filteredGallery.length;
  const indeterminate = selectedGalleryImages.length > 0 &&
    selectedGalleryImages.length < filteredGallery.length;

  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" fw={500}>Gallery Images</Text>
        <Badge size="sm" variant="light">{filteredGallery.length} images</Badge>
      </Group>

      {filteredGallery.length > 0 && (
        <Checkbox
          label="Select All Gallery Images"
          checked={allSelected}
          indeterminate={indeterminate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
            handleSelectAll(e.currentTarget.checked);
          }}
        />
      )}

      <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }}>
        {filteredGallery.map((image: string, index: number) => {
          const isSelected = selectedGalleryImages.includes(image);
          const loadingKey = `gallery-${index}`;

          return (
            <Box
              key={index}
              style={{ position: 'relative', cursor: 'pointer', opacity: isSelected ? 1 : 0.7 }}
              onClick={(): void => handleToggleImage(image)}
            >
              {loadingImages[loadingKey] && (
                <Center h={120}><Loader size="xs" /></Center>
              )}
              {!loadingImages[loadingKey] && (
                <Image
                  src={proxyImageUrl(image) ?? image}
                  height={120}
                  width="auto"
                  alt={`Gallery ${index + 1}`}
                  fit="contain"
                  radius="sm"
                  fallbackSrc="/image-not-found.jpg"
                  style={{ maxWidth: '100%', objectFit: 'contain' }}
                  onLoad={(): void => {
                    setLoadingImages(prev => ({ ...prev, [loadingKey]: false }));
                  }}
                  onError={(): void => {
                    setLoadingImages(prev => ({ ...prev, [loadingKey]: false }));
                    logger.warn(`Failed to load gallery image: ${image}`);
                  }}
                />
              )}
              {isSelected && (
                <Badge
                  size="xs"
                  color="green"
                  variant="filled"
                  style={{ position: 'absolute', top: 4, right: 4 }}
                >
                  Selected
                </Badge>
              )}
            </Box>
          );
        })}
      </SimpleGrid>

      {filteredGallery.length === 0 && (
        <Text c="dimmed">No gallery images available</Text>
      )}
    </Stack>
  );
};

export default GalleryPanel;
