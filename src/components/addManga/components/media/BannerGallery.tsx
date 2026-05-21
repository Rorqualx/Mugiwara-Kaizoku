/**
 * Banner Gallery Component
 * 
 * Displays a gallery of banner images with selection capability
 */
import React from 'react';

import { 
  Image, 
  SimpleGrid, 
  Card, 
  Text, 
  Badge, 
  ScrollArea 
} from '@mantine/core';

interface BannerGalleryProps {
  banners: string[];
  selectedBanner: string | null;
  onSelectBanner: (url: string) => void;
  height?: number;
}

export function BannerGallery({
  banners,
  selectedBanner,
  onSelectBanner,
  height = 400
}: BannerGalleryProps): React.ReactElement {
  if (banners.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No banner images available
      </Text>
    );
  }
  
  return (
    <ScrollArea h={height}>
      <SimpleGrid cols={2} spacing="md">
        {banners.map((url, index) => (
          <Card 
            key={index}
            p="xs"
            withBorder
            style={{ 
              borderColor: selectedBanner === url ? '#228BE6' : undefined,
              borderWidth: selectedBanner === url ? 2 : 1,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => onSelectBanner(url)}
          >
            <Image
              src={url}
              alt={`Banner ${index + 1}`}
              height={150}
              fit="cover"
              radius="sm"
            />
            {selectedBanner === url && (
              <Badge color="blue" size="sm" mt="xs" fullWidth>
                Selected
              </Badge>
            )}
          </Card>
        ))}
      </SimpleGrid>
    </ScrollArea>
  );
}