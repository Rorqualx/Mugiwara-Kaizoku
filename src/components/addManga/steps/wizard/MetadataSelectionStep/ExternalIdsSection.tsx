/**
 * ExternalIdsSection Component
 *
 * Renders external ID selections with links to external sites.
 * Displays fields for AniList ID, MyAnimeList ID, and ComicVine ID.
 */

import React from 'react';

import { Stack, Title, Paper, Grid, Select, ActionIcon } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';

import type { ExternalIdsSectionProps } from './types';

export const ExternalIdsSection: React.FC<ExternalIdsSectionProps> = ({
  externalIds,
  setExternalIds,
  getExternalIdOptions
}): JSX.Element => {
  const handleExternalIdChange = (idType: string, value: string | null): void => {
    setExternalIds(prev => ({
      ...prev,
      [idType]: value ?? ''
    }));
  };

  const renderExternalLink = (id: string | undefined, baseUrl: string): JSX.Element | null => {
    if (!id) return null;
    return (
      <ActionIcon
        component="a"
        href={`${baseUrl}${id}`}
        target="_blank"
        size="sm"
      >
        <IconExternalLink size={16} />
      </ActionIcon>
    );
  };

  return (
    <Paper p="md">
      <Stack>
        <Title order={5}>External IDs</Title>
        <Grid>
          <Grid.Col span={4}>
            <Select
              label="AniList ID"
              value={externalIds["anilistId"] ?? ''}
              onChange={(value) => handleExternalIdChange('anilistId', value)}
              placeholder="Select AniList ID from available sources"
              data={getExternalIdOptions('anilistId')}
              searchable
              clearable
              allowDeselect
              rightSection={renderExternalLink(
                externalIds["anilistId"],
                'https://anilist.co/manga/'
              )}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select
              label="MyAnimeList ID"
              value={externalIds["malId"] ?? ''}
              onChange={(value) => handleExternalIdChange('malId', value)}
              placeholder="Select MAL ID from available sources"
              data={getExternalIdOptions('malId')}
              searchable
              clearable
              allowDeselect
              rightSection={renderExternalLink(
                externalIds["malId"],
                'https://myanimelist.net/manga/'
              )}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select
              label="ComicVine ID"
              value={externalIds["comicVineId"] ?? ''}
              onChange={(value) => handleExternalIdChange('comicVineId', value)}
              placeholder="Select ComicVine ID from available sources"
              data={getExternalIdOptions('comicVineId')}
              searchable
              clearable
              allowDeselect
            />
          </Grid.Col>
        </Grid>
      </Stack>
    </Paper>
  );
};
