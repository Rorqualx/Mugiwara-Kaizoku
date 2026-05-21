/**
 * Volume Chapter Row Component
 *
 * Displays a simple chapter row within the volume browser.
 * RENAMED from ChapterRow to avoid collision with ChapterRow.tsx (227 lines).
 *
 * @module volume-browser/components/VolumeChapterRow
 */

import React from 'react';

import { Paper, Group, Text, Badge } from '@mantine/core';

import type { VolumeChapterRowProps } from '../types';

/**
 * Displays a chapter row within a volume card
 *
 * This is a simplified version for the volume browser context,
 * distinct from the full-featured ChapterRow component.
 */
export function VolumeChapterRow({
  chapter,
  onClick
}: VolumeChapterRowProps): React.ReactElement {
  return (
    <Paper
      p="xs"
      withBorder
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <Group gap="sm" justify="space-between">
        <Group gap="xs">
          <Text size="sm" fw={500}>
            Ch. {chapter.number}
          </Text>
          {chapter.title && (
            <Text size="sm" c="dimmed">
              {chapter.title}
            </Text>
          )}
        </Group>
        <Group gap={4}>
          {chapter.pages && (
            <Badge size="xs" variant="light">
              {chapter.pages}p
            </Badge>
          )}
          {chapter.releaseDate && (
            <Text size="xs" c="dimmed">
              {new Date(chapter.releaseDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short'
              })}
            </Text>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
