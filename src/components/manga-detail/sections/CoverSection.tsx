/**
 * Cover Section Component
 *
 * Displays manga cover image with hover animation effects.
 *
 * Extracted from: mangaDetail.tsx (lines 268-289)
 */

import React from 'react';

import { Box } from '@mantine/core';

import { LivingCover } from '@/components/manga/MangaCover';
import { useCoverLayerManifest } from '@/hooks/useCoverLayerManifest';

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
  const manifest = useCoverLayerManifest(manga.id);

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
      <LivingCover
        src={manga.metadata.cover ?? '/cover-not-found.jpg'}
        alt={manga.title}
        radius="md"
        seed={manga.id}
        manifest={manifest}
        layerBaseUrl={`/api/cover-layers/${manga.id}`}
        style={{
          boxShadow: 'var(--mantine-shadow-xl)'
        }}
      />
    </Box>
  );
}
