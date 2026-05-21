/**
 * Volume Chapters Tab Component
 *
 * Displays the list of chapters in a volume with click handlers.
 */

import React from 'react';

import {
  Stack,
  Text,
  Paper,
  ScrollArea,
  List,
  ThemeIcon
} from '@mantine/core';
import { IconBookmark, IconList } from '@tabler/icons-react';

import type { VolumeData } from './volume-detail-modal-types';

export interface VolumeChaptersTabProps {
  volume: VolumeData;
  onChapterClick?: ((chapterIndex: number) => void) | undefined;
}

export function VolumeChaptersTab({
  volume,
  onChapterClick
}: VolumeChaptersTabProps): JSX.Element {
  return (
    <Stack gap="md">
      {volume.chapters && volume.chapters.length > 0 ? (
        <ScrollArea h={400}>
          <List spacing="xs">
            {volume.chapters.map((chapter, index) => (
              <List.Item
                key={index}
                icon={
                  <ThemeIcon color="blue" size={24} radius="xl">
                    <IconBookmark size={16} />
                  </ThemeIcon>
                }
              >
                <Text
                  size="sm"
                  style={{ cursor: onChapterClick ? 'pointer' : 'default' }}
                  {...(onChapterClick && { c: 'blue' })}
                  onClick={() => onChapterClick?.(chapter.index)}
                >
                  {chapter.number && `Chapter ${chapter.number}: `}
                  {chapter.title}
                </Text>
              </List.Item>
            ))}
          </List>
        </ScrollArea>
      ) : (
        <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
          <IconList size={48} color="var(--mantine-color-dimmed)" />
          <Text size="lg" c="dimmed" mt="md">
            No chapter information available
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            Chapter details will be shown here when available
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
