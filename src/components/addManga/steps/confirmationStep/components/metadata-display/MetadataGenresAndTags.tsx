/**
 * Metadata Genres and Tags
 *
 * Displays genres and tags as badge groups
 */

import React from 'react';

import { Box, Text, Group, Badge } from '@mantine/core';

interface MetadataGenresAndTagsProps {
  genres?: string[] | undefined;
  tags?: string[] | undefined;
}

export function MetadataGenresAndTags({
  genres,
  tags
}: MetadataGenresAndTagsProps): React.ReactElement | null {
  const hasGenres = genres && genres.length > 0;
  const hasTags = tags && tags.length > 0;

  if (!hasGenres && !hasTags) return null;

  return (
    <>
      {hasGenres && (
        <Box>
          <Text size="sm" fw={600} c="dimmed" mb={4}>
            Genres
          </Text>
          <Group gap="xs">
            {genres.map((genre) => (
              <Badge key={genre} size="sm" variant="light">
                {genre}
              </Badge>
            ))}
          </Group>
        </Box>
      )}

      {hasTags && (
        <Box>
          <Text size="sm" fw={600} c="dimmed" mb={4}>
            Tags
          </Text>
          <Group gap="xs">
            {tags.slice(0, 10).map((tag) => (
              <Badge key={tag} size="xs" variant="outline">
                {tag}
              </Badge>
            ))}
            {tags.length > 10 && (
              <Badge size="xs" variant="outline">
                +{tags.length - 10} more
              </Badge>
            )}
          </Group>
        </Box>
      )}
    </>
  );
}
