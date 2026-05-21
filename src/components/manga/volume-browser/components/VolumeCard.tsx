/**
 * Volume Card Component
 *
 * Displays individual volume with cover image, metadata, and expandable chapter list.
 *
 * @module volume-browser/components/VolumeCard
 */

import React from 'react';

import {
  Paper,
  Group,
  Image,
  Stack,
  Text,
  ActionIcon,
  Badge,
  Collapse,
  Tooltip
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconBook,
  IconCalendar,
  IconId
} from '@tabler/icons-react';

import { VolumeChapterRow } from './VolumeChapterRow';

import type { VolumeCardProps } from '../types';

/**
 * Displays a single volume card with expandable chapters
 */
export function VolumeCard({
  volume,
  isExpanded,
  onToggle,
  onChapterClick
}: VolumeCardProps): React.ReactElement {
  const formattedDate = volume.releaseDate
    ? new Date(volume.releaseDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : null;

  return (
    <Paper shadow="xs" p="md" withBorder>
      <Group gap="md" align="flex-start" wrap="nowrap">
        {/* Volume Cover */}
        {volume.coverImage ? (
          <Image
            src={volume.coverImage}
            alt={volume.title ?? `Volume ${volume.number}`}
            w={80}
            h={120}
            fit="cover"
            radius="sm"
            fallbackSrc="/images/no-cover.png"
          />
        ) : (
          <Paper
            w={80}
            h={120}
            bg="gray.2"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <IconBook size={32} color="gray" />
          </Paper>
        )}

        {/* Volume Info */}
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group gap="sm" justify="space-between">
            <Group gap="xs">
              <Text fw={600}>Volume {volume.number}</Text>
              {volume.title && (
                <Text c="dimmed" size="sm">
                  - {volume.title}
                </Text>
              )}
            </Group>
            <ActionIcon
              variant="subtle"
              onClick={onToggle}
              aria-label={isExpanded ? 'Collapse chapters' : 'Expand chapters'}
            >
              {isExpanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
            </ActionIcon>
          </Group>

          {/* Volume Metadata */}
          <Group gap="xs" wrap="wrap">
            {formattedDate && (
              <Tooltip label="Release Date">
                <Badge
                  leftSection={<IconCalendar size={12} />}
                  variant="light"
                  size="sm"
                >
                  {formattedDate}
                </Badge>
              </Tooltip>
            )}
            {volume.isbn && (
              <Tooltip label="ISBN">
                <Badge
                  leftSection={<IconId size={12} />}
                  variant="light"
                  size="sm"
                  color="gray"
                >
                  {volume.isbn}
                </Badge>
              </Tooltip>
            )}
            {volume.totalChapters && (
              <Badge variant="light" size="sm" color="blue">
                {volume.totalChapters} chapters
              </Badge>
            )}
            {volume.enrichmentTier && (
              <Badge variant="outline" size="xs" color="green">
                Tier {volume.enrichmentTier}
              </Badge>
            )}
          </Group>

          {/* Description */}
          {volume.description && (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {volume.description}
            </Text>
          )}

          {/* Themes */}
          {volume.themes && volume.themes.length > 0 && (
            <Group gap={4}>
              {volume.themes.slice(0, 5).map((theme) => (
                <Badge key={theme} size="xs" variant="dot" color="violet">
                  {theme}
                </Badge>
              ))}
              {volume.themes.length > 5 && (
                <Text size="xs" c="dimmed">
                  +{volume.themes.length - 5} more
                </Text>
              )}
            </Group>
          )}
        </Stack>
      </Group>

      {/* Expandable Chapters List */}
      <Collapse in={isExpanded}>
        <Stack gap="xs" mt="md" pl="md">
          <Text fw={500} size="sm" c="dimmed">
            Chapters in this Volume
          </Text>
          {volume.chapters && volume.chapters.length > 0 ? (
            <Stack gap={4}>
              {volume.chapters.map((chapter) => (
                <VolumeChapterRow
                  key={chapter.number}
                  chapter={chapter}
                  onClick={() => onChapterClick?.(chapter)}
                />
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed" fs="italic">
              No chapter data available
            </Text>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}
