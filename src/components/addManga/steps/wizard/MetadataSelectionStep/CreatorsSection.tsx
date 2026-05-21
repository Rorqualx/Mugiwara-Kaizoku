/**
 * CreatorsSection Component
 *
 * Renders Authors and Artists selection fields using TagsInput components.
 * Handles cleaning of provider badges/suffixes from creator names.
 */

import React from 'react';

import { Stack, Title, Paper, Grid, TagsInput } from '@mantine/core';

import type { CreatorsSectionProps } from './types';

export const CreatorsSection: React.FC<CreatorsSectionProps> = ({
  selectedMetadata,
  setSelectedMetadata,
  getFieldOptions,
  logger
}): JSX.Element => {
  return (
    <Paper p="md">
      <Stack>
        <Title order={5}>Creators</Title>
        <Grid>
          <Grid.Col span={6}>
            <TagsInput
              label="Authors"
              value={selectedMetadata["authors"] ?? []}
              onChange={value => {
                logger.info('[MetadataSelectionStep] Authors dropdown options:', getFieldOptions('authors'));
                // Extract actual author names without provider prefix
                const cleanedAuthors = value.map(v => {
                  // Remove provider badge if present
                  if (v.startsWith('[') && v.includes('] ')) {
                    return v.substring(v.indexOf('] ') + 2);
                  }
                  return v;
                });
                setSelectedMetadata(prev => ({
                  ...prev,
                  authors: cleanedAuthors
                }));
              }}
              placeholder="Add authors..."
              data={[...new Set(getFieldOptions('authors').map(opt => opt.label))]}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TagsInput
              label="Artists"
              value={selectedMetadata.artists ?? []}
              onChange={value => {
                // Extract actual artist names without provider prefix
                const cleanedArtists = value.map(v => {
                  // Remove provider badge if present
                  if (v.startsWith('[') && v.includes('] ')) {
                    return v.substring(v.indexOf('] ') + 2);
                  }
                  return v;
                });
                setSelectedMetadata(prev => ({
                  ...prev,
                  artists: cleanedArtists
                }));
              }}
              placeholder="Add artists..."
              data={[...new Set(getFieldOptions('artists').map(opt => opt.label))]}
              clearable
            />
          </Grid.Col>
        </Grid>
      </Stack>
    </Paper>
  );
};
