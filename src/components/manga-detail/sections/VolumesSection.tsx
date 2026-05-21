/**
 * Volumes Section Component
 *
 * Displays volume breakdown with chapter counts, statistics,
 * and enriched metadata (cover, ISBN, release date, description).
 */

import React from 'react';

import { Badge, Box, Group, Image, Stack, Text, Title } from '@mantine/core';

import { formatFileSize } from '../utils';

import type { VolumeEntry } from '../hooks/useVolumeData';

export interface VolumesSectionProps {
  volumes: VolumeEntry[];
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function VolumeBadges({ entry }: { entry: VolumeEntry }): React.ReactElement {
  const { chapters, metadata } = entry;
  const pageCount = chapters.reduce((sum, ch) => sum + (ch.pageCount ?? 0), 0);
  const size = chapters.reduce((sum, ch) => sum + ch.size, 0);

  return (
    <Group gap="xs" wrap="wrap">
      <Badge color="blue">{chapters.length} Chapters</Badge>
      {pageCount > 0 && <Badge color="teal">{pageCount} Pages</Badge>}
      <Badge color="grape">{formatFileSize(size)}</Badge>
      {metadata?.isbn && <Badge color="gray" variant="outline">{metadata.isbn}</Badge>}
    </Group>
  );
}

function VolumeCard({ entry }: { entry: VolumeEntry }): React.ReactElement {
  const { volumeNumber, chapters, metadata } = entry;
  const displayTitle = volumeNumber === -1 ? 'Unassigned' : `Volume ${volumeNumber}`;
  const releaseStr = formatDate(metadata?.releaseDate ?? null);

  return (
    <Box p="md" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
      <Group align="flex-start" gap="md">
        {metadata?.coverImage && (
          <Image src={metadata.coverImage} alt={displayTitle} w={60} h={90} radius="sm" fit="cover" fallbackSrc="/cover-not-found.jpg" />
        )}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" mb="xs">
            <Box>
              <Title order={5}>{displayTitle}</Title>
              {metadata?.title && <Text size="sm" c="dimmed">{metadata.title}</Text>}
            </Box>
            <VolumeBadges entry={entry} />
          </Group>
          {(metadata?.publisher ?? releaseStr) && (
            <Group gap="xs" mb="xs">
              {metadata?.publisher && <Text size="xs" c="dimmed">{metadata.publisher}</Text>}
              {releaseStr && <Text size="xs" c="dimmed">{releaseStr}</Text>}
            </Group>
          )}
          {metadata?.description && <Text size="xs" c="dimmed" lineClamp={2} mb="xs">{metadata.description}</Text>}
          <Text size="sm" c="dimmed">Chapters: {chapters.map(c => c.index).join(', ')}</Text>
        </Box>
      </Group>
    </Box>
  );
}

export function VolumesSection({ volumes }: VolumesSectionProps): React.ReactElement | null {
  if (volumes.length === 0) return null;

  return (
    <Box mt="xl">
      <Title order={4} mb="md">Volumes</Title>
      <Stack>
        {volumes.map((entry) => (
          <VolumeCard key={entry.volumeNumber} entry={entry} />
        ))}
      </Stack>
    </Box>
  );
}
