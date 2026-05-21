/**
 * Metadata Section Component
 *
 * Displays manga summary and key metadata with icons.
 *
 * Extracted from: mangaDetail.tsx (lines 292-332)
 */

import React from 'react';

import { Anchor, Box, Group, SimpleGrid, Text } from '@mantine/core';
import { IconBooks, IconCalendar, IconCalendarOff, IconFileText, IconUser } from '@tabler/icons-react';
import Link from 'next/link';

import { formatDate } from '../utils';

import type { MangaWithMetadataAndChapters } from '../types';

export interface MetadataSectionProps {
  manga: MangaWithMetadataAndChapters;
}

/**
 * Metadata section with summary and key information
 */
export function MetadataSection({ manga }: MetadataSectionProps): React.ReactElement {
  return (
    <>
      {/* Summary */}
      {manga.metadata.summary && (
        <Box mb="lg">
          <Text size="md" style={{ whiteSpace: 'pre-line' }}>
            {manga.metadata.summary}
          </Text>
        </Box>
      )}

      {/* Key Metadata */}
      <SimpleGrid cols={{ base: 2, sm: 3 }} mb="md">
        {manga.metadata.pageCount && (
          <Group gap="xs">
            <IconFileText size={18} />
            <Text fw={500}>Pages: {manga.metadata.pageCount}</Text>
          </Group>
        )}

        {manga.metadata.startDate && (
          <Group gap="xs">
            <IconCalendar size={18} />
            <Text fw={500}>Published: {formatDate(manga.metadata.startDate)}</Text>
          </Group>
        )}

        {manga.metadata.authors && manga.metadata.authors.length > 0 && (
          <Group gap="xs">
            <IconUser size={18} />
            <Text fw={500}>Author:{' '}
              <Anchor component={Link} href={`/author/${encodeURIComponent(manga.metadata.authors[0] ?? '')}`} size="md">
                {manga.metadata.authors[0]}
              </Anchor>
            </Text>
          </Group>
        )}

        {manga.metadata.endDate && (
          <Group gap="xs">
            <IconCalendarOff size={18} />
            <Text fw={500}>Completed: {formatDate(manga.metadata.endDate)}</Text>
          </Group>
        )}

        {manga.metadata.publisher && (
          <Group gap="xs">
            <IconBooks size={18} />
            <Text fw={500}>Publisher:{' '}
              <Anchor component={Link} href={`/publisher/${encodeURIComponent(manga.metadata.publisher)}`} size="md">
                {manga.metadata.publisher}
              </Anchor>
            </Text>
          </Group>
        )}
      </SimpleGrid>
    </>
  );
}
