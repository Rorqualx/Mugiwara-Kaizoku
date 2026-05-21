/**
 * Metadata Cover Section
 *
 * Displays the cover image with optional banner button
 */

import React from 'react';

import { Box, Image, ActionIcon } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';

interface MetadataCoverSectionProps {
  coverUrl: string;
  title: string;
  hasBanner: boolean;
  onBannerClick: () => void;
}

export function MetadataCoverSection({
  coverUrl,
  title,
  hasBanner,
  onBannerClick
}: MetadataCoverSectionProps): React.ReactElement {
  return (
    <Box style={{ position: 'relative' }}>
      <Image
        src={coverUrl}
        alt={title}
        width={200}
        height={300}
        fit="cover"
        radius="md"
        fallbackSrc="/placeholder-cover.jpg"
      />
      {hasBanner && (
        <ActionIcon
          variant="filled"
          size="sm"
          radius="xl"
          style={{ position: 'absolute', top: 8, right: 8 }}
          onClick={onBannerClick}
        >
          <IconPhoto size={14} />
        </ActionIcon>
      )}
    </Box>
  );
}
