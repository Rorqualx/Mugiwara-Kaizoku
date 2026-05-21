/**
 * GenresTagsThemesSection Component
 *
 * Renders Genres, Tags, and Themes selection with TagsInput and Select All functionality.
 * Extracts actual values from provider-suffixed format (e.g., "value::provider" -> "value").
 */

import React from 'react';

import {
  Stack,
  Title,
  Paper,
  Grid,
  Group,
  Text,
  Button,
  TagsInput,
} from '@mantine/core';

import { cleanValueArray } from './utils';

import type { GenresTagsThemesSectionProps } from './types';

export const GenresTagsThemesSection: React.FC<GenresTagsThemesSectionProps> = ({
  selectedMetadata,
  setSelectedMetadata,
  getFieldOptions,
}): JSX.Element => {
  /**
   * Handle selecting all genres
   */
  const handleSelectAllGenres = (): void => {
    const allGenres = getFieldOptions('genres')
      .map(opt => {
        if (opt.label.includes('::')) {
          return opt.label.split('::')[0] ?? '';
        }
        return opt.label;
      })
      .filter((v): v is string => v !== '');
    setSelectedMetadata(prev => ({
      ...prev,
      genres: allGenres,
    }));
  };

  /**
   * Handle selecting all tags
   */
  const handleSelectAllTags = (): void => {
    const allTags = getFieldOptions('tags')
      .map(opt => {
        if (opt.label.includes('::')) {
          return opt.label.split('::')[0] ?? '';
        }
        return opt.label;
      })
      .filter((v): v is string => v !== '');
    setSelectedMetadata(prev => ({
      ...prev,
      tags: allTags,
    }));
  };

  /**
   * Handle selecting all themes
   */
  const handleSelectAllThemes = (): void => {
    const allThemes = getFieldOptions('themes')
      .map(opt => {
        if (opt.label.includes('::')) {
          return opt.label.split('::')[0] ?? '';
        }
        return opt.label;
      })
      .filter((v): v is string => v !== '');
    setSelectedMetadata(prev => ({
      ...prev,
      themes: allThemes,
    }));
  };

  return (
    <Paper p="md">
      <Stack>
        <Title order={5}>Genres, Tags & Themes</Title>
        <Grid>
          {/* Genres Column */}
          <Grid.Col span={4}>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={500}>
                  Genres
                </Text>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={handleSelectAllGenres}
                >
                  Select All
                </Button>
              </Group>
              <TagsInput
                value={selectedMetadata['genres'] ?? []}
                onChange={value => {
                  // Extract actual genre values without provider suffix
                  const cleanedGenres = cleanValueArray(value);
                  setSelectedMetadata(prev => ({
                    ...prev,
                    genres: cleanedGenres,
                  }));
                }}
                placeholder="Add genres..."
                data={[...new Set(getFieldOptions('genres').map(opt => opt.label))]}
                clearable
              />
            </Stack>
          </Grid.Col>

          {/* Tags Column */}
          <Grid.Col span={4}>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={500}>
                  Tags
                </Text>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={handleSelectAllTags}
                >
                  Select All
                </Button>
              </Group>
              <TagsInput
                value={selectedMetadata.tags ?? []}
                onChange={value => {
                  // Extract actual tag values without provider suffix
                  // Use same logic as genres and themes for consistency
                  const cleanedTags = cleanValueArray(value);
                  setSelectedMetadata(prev => ({
                    ...prev,
                    tags: cleanedTags,
                  }));
                }}
                placeholder="Add tags..."
                data={[...new Set(getFieldOptions('tags').map(opt => opt.label))]}
                clearable
              />
            </Stack>
          </Grid.Col>

          {/* Themes Column */}
          <Grid.Col span={4}>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={500}>
                  Themes
                </Text>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  onClick={handleSelectAllThemes}
                >
                  Select All
                </Button>
              </Group>
              <TagsInput
                value={selectedMetadata.themes ?? []}
                onChange={value => {
                  // Extract actual theme values without provider prefix
                  const cleanedThemes = cleanValueArray(value);
                  setSelectedMetadata(prev => ({
                    ...prev,
                    themes: cleanedThemes,
                  }));
                }}
                placeholder="Add themes..."
                data={[...new Set(getFieldOptions('themes').map(opt => opt.label))]}
                clearable
              />
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Paper>
  );
};
