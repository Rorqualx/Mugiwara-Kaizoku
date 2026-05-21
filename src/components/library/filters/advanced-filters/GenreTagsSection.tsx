import React from 'react';

import { Box, Divider, Group, MultiSelect, Paper, Stack, Text } from '@mantine/core';
import { IconTags } from '@tabler/icons-react';

type GenreTagsKey = 'genres' | 'tags' | 'excludeGenres' | 'excludeTags';

interface GenreTagsSectionProps {
  genres: string[];
  tags: string[];
  excludeGenres: string[];
  excludeTags: string[];
  availableGenres: string[];
  availableTags: string[];
  onUpdateFilter: (key: GenreTagsKey, value: string[]) => void;
}

export function GenreTagsSection({
  genres,
  tags,
  excludeGenres,
  excludeTags,
  availableGenres,
  availableTags,
  onUpdateFilter
}: GenreTagsSectionProps): React.ReactElement {
  return (
    <Box>
      <Group gap="xs" mb="xs">
        <IconTags size={16} />
        <Text size="sm" fw={500}>Genres & Tags</Text>
      </Group>
      <Paper p="sm" withBorder>
        <Stack gap="sm">
          <MultiSelect
            label="Include Genres"
            placeholder="Select genres to include"
            data={availableGenres}
            value={genres}
            onChange={(value) => onUpdateFilter('genres', value)}
            searchable
            clearable
            size="sm"
          />
          <MultiSelect
            label="Include Tags"
            placeholder="Select tags to include"
            data={availableTags}
            value={tags}
            onChange={(value) => onUpdateFilter('tags', value)}
            searchable
            clearable
            size="sm"
          />
          <Divider />
          <MultiSelect
            label="Exclude Genres"
            placeholder="Select genres to exclude"
            data={availableGenres}
            value={excludeGenres}
            onChange={(value) => onUpdateFilter('excludeGenres', value)}
            searchable
            clearable
            size="sm"
          />
          <MultiSelect
            label="Exclude Tags"
            placeholder="Select tags to exclude"
            data={availableTags}
            value={excludeTags}
            onChange={(value) => onUpdateFilter('excludeTags', value)}
            searchable
            clearable
            size="sm"
          />
        </Stack>
      </Paper>
    </Box>
  );
}
