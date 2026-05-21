/**
 * Image Option Component
 * Renders a single selectable image option with metadata badges
 */

import React from 'react';

import { ActionIcon, Badge, Box, Image, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

import type { ImageOption as ImageOptionType } from '@/types/provider-metadata.types';

interface ImageOptionProps {
  option: ImageOptionType;
  isSelected: boolean;
  isBanner: boolean;
  onSelect: (url: string) => void;
}

export const ImageOption = ({
  option,
  isSelected,
  isBanner,
  onSelect
}: ImageOptionProps): React.ReactElement => {
  return (
    <Box
      key={option.url}
      style={{
        border: isSelected
          ? '3px solid var(--mantine-color-blue-5)'
          : '1px solid var(--mantine-color-gray-7)',
        borderRadius: 'var(--mantine-radius-md)',
        padding: '8px',
        cursor: 'pointer',
        position: 'relative',
        background: isSelected ? 'var(--mantine-color-dark-7)' : 'transparent',
        transition: 'all 0.2s'
      }}
      onClick={() => onSelect(option.url)}
    >
      <Image
        src={option.url}
        alt={option.label}
        height={isBanner ? 150 : 200}
        fit="cover"
        radius="sm"
        fallbackSrc="/cover-not-found.jpg"
      />

      <Text size="xs" mt="xs" ta="center" lineClamp={2}>
        {option.label}
      </Text>

      {option.size && (
        <Badge
          size="xs"
          variant="light"
          style={{ position: 'absolute', top: 16, right: 16 }}
        >
          {option.size}
        </Badge>
      )}

      {option.provider && (
        <Badge
          size="xs"
          variant="dot"
          color="grape"
          style={{ position: 'absolute', bottom: 40, left: 16 }}
        >
          {option.provider}
        </Badge>
      )}

      {isSelected && (
        <ActionIcon
          color="blue"
          variant="filled"
          size="sm"
          style={{
            position: 'absolute',
            top: 16,
            left: 16
          }}
        >
          <IconCheck size={14} />
        </ActionIcon>
      )}
    </Box>
  );
};
