/**
 * Chapter Badge List Component
 *
 * Displays a list of chapter numbers as badges with overflow handling
 *
 * @module components/manga/SyncStatusCard/ChapterBadgeList
 */

import React from 'react';

import { Group, Text, Badge } from '@mantine/core';

import type { ChapterBadgeListProps } from './types';

const MAX_VISIBLE_BADGES = 10;

export function ChapterBadgeList({
  chapters,
  label,
  color,
}: ChapterBadgeListProps): React.ReactElement | null {
  if (chapters.length === 0) {
    return null;
  }

  const visibleChapters = chapters.slice(0, MAX_VISIBLE_BADGES);
  const overflowCount = chapters.length - MAX_VISIBLE_BADGES;

  return (
    <div>
      <Text size="sm" fw={500} mb="xs">
        {label} ({chapters.length}):
      </Text>
      <Group gap="xs">
        {visibleChapters.map((chapter: number) => (
          <Badge key={chapter} size="sm" variant="light" color={color}>
            Chapter {chapter}
          </Badge>
        ))}
        {overflowCount > 0 && (
          <Text size="xs" c="dimmed">
            +{overflowCount} more
          </Text>
        )}
      </Group>
    </div>
  );
}
