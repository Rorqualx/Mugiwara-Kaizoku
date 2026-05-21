/**
 * MangaInfoCard Component
 *
 * Displays manga information including title, chapter count,
 * and suggested import path.
 *
 * @module components/manga/manual-import/components/MangaInfoCard
 */

import React from 'react';

import { Alert, Badge, Card, Group, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface MangaInfoCardProps {
  mangaTitle: string;
  chapterCount: number;
  suggestedPath?: string | undefined;
}

export function MangaInfoCard({
  mangaTitle,
  chapterCount,
  suggestedPath
}: MangaInfoCardProps): React.ReactElement {
  return (
    <Card withBorder p="sm" style={{ backgroundColor: '#f8f9fa' }}>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" fw={500}>Manga:</Text>
          <Text size="sm">{mangaTitle}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" fw={500}>Chapters in database:</Text>
          <Badge size="sm">{chapterCount}</Badge>
        </Group>
        {suggestedPath && (
          <Alert icon={<IconAlertCircle size={16} />} color="blue" p="xs">
            <Text size="xs">
              <strong>Suggested path:</strong> {suggestedPath}
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
