import React from 'react';

import {
  Group,
  Text,
  Badge
} from '@mantine/core';

import type { ProviderMetadataResponse } from '@/types/search.types';

interface TagsTabProps {
  metadata: ProviderMetadataResponse;
}

export function TagsTab({ metadata }: TagsTabProps): React.ReactElement {
  return (
    <>
      {metadata.genres && metadata.genres.length > 0 && (
        <div>
          <Text fw={500} mb="xs">Genres</Text>
          <Group gap="xs" mb="md">
            {metadata.genres.map((genre: string) => (
              <Badge key={genre} variant="outline">
                {genre}
              </Badge>
            ))}
          </Group>
        </div>
      )}

      {metadata.tags && metadata.tags.length > 0 && (
        <div>
          <Text fw={500} mb="xs">Tags</Text>
          <Group gap="xs">
            {metadata.tags.map((tag: string) => (
              <Badge key={tag} variant="light" size="sm">
                {tag}
              </Badge>
            ))}
          </Group>
        </div>
      )}

      {metadata.themes && metadata.themes.length > 0 && (
        <div>
          <Text fw={500} mb="xs" mt="md">Themes</Text>
          <Group gap="xs">
            {metadata.themes.map((theme: string) => (
              <Badge key={theme} color="grape" variant="light" size="sm">
                {theme}
              </Badge>
            ))}
          </Group>
        </div>
      )}
    </>
  );
}
