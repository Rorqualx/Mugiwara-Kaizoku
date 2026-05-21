/**
 * Cover Section Component
 *
 * Displays manga cover image with hover animation effects.
 *
 * Extracted from: mangaDetail.tsx (lines 268-289)
 */

import React from 'react';

import { Box, Image } from '@mantine/core';

import type { MangaWithMetadataAndChapters } from '../types';

export interface CoverSectionProps {
  manga: MangaWithMetadataAndChapters;
}

/**
 * Cover image section with hover effects
 *
 * @param props - Component properties
 * @returns Cover section component
 */
export function CoverSection({ manga }: CoverSectionProps): React.ReactElement {
  return (
    <Box
      pos="relative"
      w={240}
      mx="auto"
      style={{
        transition: 'transform 150ms ease-in-out',
        '&:hover': {
          transform: 'scale(1.02)'
        }
      }}
    >
      <Image
        src={manga.metadata.cover ?? '/cover-not-found.jpg'}
        alt={manga.title}
        radius="md"
        style={{
          boxShadow: 'var(--mantine-shadow-xl)'
        }}
      />
    </Box>
  );
}
