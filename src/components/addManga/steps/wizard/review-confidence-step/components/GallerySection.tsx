/**
 * GallerySection Component
 *
 * Renders selected gallery images for the review step.
 */

import React from 'react';

import {
  Stack,
  Paper,
  Group,
  Text,
  Image,
  Badge,
  ScrollArea,
  Box,
} from '@mantine/core';

interface GallerySectionProps {
  selectedGalleryImages: string[];
}

export const GallerySection: React.FC<GallerySectionProps> = ({
  selectedGalleryImages,
}): JSX.Element | null => {
  if (selectedGalleryImages.length === 0) {
    return null;
  }

  return (
    <Paper p="sm">
      <Stack gap="sm">
        <Group>
          <Text size="sm" fw={500}>Gallery Images</Text>
          <Badge size="sm" variant="light" color="teal">
            {selectedGalleryImages.length} images
          </Badge>
        </Group>
        <ScrollArea h={180} type="hover">
          <Group gap="md">
            {selectedGalleryImages.map((imageUrl: string, index: number) => (
              <Box key={index} style={{ position: 'relative' }}>
                <Image
                  src={imageUrl}
                  alt={`Gallery image ${index + 1}`}
                  width={120}
                  height={160}
                  radius="sm"
                  fit="cover"
                  fallbackSrc="/cover-not-found.jpg"
                />
              </Box>
            ))}
          </Group>
        </ScrollArea>
      </Stack>
    </Paper>
  );
};

GallerySection.displayName = 'GallerySection';
