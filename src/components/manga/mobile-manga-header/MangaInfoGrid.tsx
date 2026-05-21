/**
 * MangaInfoGrid Component
 *
 * Displays the manga metadata in a grid layout.
 *
 * Extracted from: MobileMangaHeader.tsx
 */

import React, { useMemo } from 'react';

import { SimpleGrid } from '@mantine/core';

import { InfoItem } from './InfoItem';
import { buildInfoItems } from './utils';

import type { MangaInfoGridProps } from './types';

/**
 * Grid of manga metadata info items
 */
export function MangaInfoGrid({
  manga
}: MangaInfoGridProps): React.ReactElement {
  const infoItems = useMemo(() => buildInfoItems(manga), [manga]);

  return (
    <SimpleGrid cols={2} spacing="sm">
      {infoItems.map((item) => (
        <InfoItem
          key={item.key}
          icon={item.icon}
          label={item.label}
          value={item.value}
        />
      ))}
    </SimpleGrid>
  );
}
