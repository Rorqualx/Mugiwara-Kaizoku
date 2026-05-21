/**
 * Image Gallery Component
 * 
 * Displays a gallery of images with multi-selection capability
 */
import React from 'react';

import { 
  Image, 
  SimpleGrid, 
  Card, 
  Text, 
  Checkbox,
  ScrollArea} from '@mantine/core';

interface ImageGalleryProps {
  images: string[];
  selectedImages: string[];
  onToggleImage: (url: string) => void;
  height?: number;
  columns?: number;
}

export function ImageGallery({
  images,
  selectedImages,
  onToggleImage,
  height = 400,
  columns = 3
}: ImageGalleryProps): React.ReactElement {
  if (images.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No images available
      </Text>
    );
  }
  
  return (
    <ScrollArea h={height}>
      <SimpleGrid cols={columns} spacing="md">
        {images.map((url, index) => {
          const isSelected = selectedImages.includes(url);
          
          return (
            <Card 
              key={index}
              p="xs"
              withBorder
              style={{ 
                borderColor: isSelected ? '#228BE6' : undefined,
                borderWidth: isSelected ? 2 : 1,
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => onToggleImage(url)}
                style={{ 
                  position: 'absolute', 
                  top: 8, 
                  right: 8, 
                  zIndex: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: 4,
                  padding: 2
                }}
              />
              <Image
                src={url}
                alt={`Image ${index + 1}`}
                height={200}
                fit="cover"
                radius="sm"
                style={{ cursor: 'pointer' }}
                onClick={() => onToggleImage(url)}
              />
            </Card>
          );
        })}
      </SimpleGrid>
    </ScrollArea>
  );
}