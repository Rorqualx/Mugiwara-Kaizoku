/**
 * Image Grid Component
 * Renders a grid of image options or an empty state
 */

import React from 'react';

import { Alert, SimpleGrid, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import type { ImageOption as ImageOptionType } from '@/types/provider-metadata.types';

import { ImageOption } from './ImageOption';

interface ImageGridProps {
  images: ImageOptionType[];
  emptyMessage: string;
  selectedUrl: string;
  isBanner: boolean;
  onSelect: (url: string) => void;
}

export const ImageGrid = ({
  images,
  emptyMessage,
  selectedUrl,
  isBanner,
  onSelect
}: ImageGridProps): React.ReactElement => {
  if (images.length === 0) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        <Text size="sm">{emptyMessage}</Text>
      </Alert>
    );
  }

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
      {images.map((option) => (
        <ImageOption
          key={option.url}
          option={option}
          isSelected={selectedUrl === option.url}
          isBanner={isBanner}
          onSelect={onSelect}
        />
      ))}
    </SimpleGrid>
  );
};
