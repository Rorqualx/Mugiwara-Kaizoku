/**
 * Related-works carousel (Phase 4 v2-B).
 *
 * Renders a horizontal scroller of `MangaRelation` entries for a manga.
 * Hides itself when no relations exist.
 */

'use client';

import { Box, Group, ScrollArea, Text } from '@mantine/core';
import { IconLink } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client/index';

import { RelatedWorkCard } from './RelatedWorkCard';

interface RelatedWorksCarouselProps {
  mangaId: number;
}

export function RelatedWorksCarousel({ mangaId }: RelatedWorksCarouselProps): React.ReactNode {
  const { data: entries } = trpc.manga.getRelations.useQuery({ mangaId });

  if (!entries || entries.length === 0) {
    return null;
  }

  return (
    <Box mb="lg" style={{ width: 0, minWidth: '100%', maxWidth: '100%', overflowX: 'clip' }}>
      <Group mb="xs" gap="xs">
        <IconLink size={18} color="cyan" />
        <Text size="sm" fw={600} c="gray.3">
          Related Works ({entries.length})
        </Text>
      </Group>
      <ScrollArea type="hover" scrollbarSize={6} offsetScrollbars w="100%" style={{ maxWidth: '100%' }}>
        <Group gap="sm" wrap="nowrap" align="flex-start" pb="xs">
          {entries.map((entry) => (
            <RelatedWorkCard key={entry.id} entry={entry} />
          ))}
        </Group>
      </ScrollArea>
    </Box>
  );
}
