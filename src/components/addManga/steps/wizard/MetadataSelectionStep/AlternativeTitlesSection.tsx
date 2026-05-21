/**
 * AlternativeTitlesSection Component
 *
 * Renders alternative titles selection with TagsInput and Select All button.
 * Handles extraction and cleaning of alternative titles from metadata options.
 */

import React from 'react';

import { Stack, Title, Paper, Group, Button, TagsInput } from '@mantine/core';

import type { AlternativeTitlesSectionProps } from './types';

export const AlternativeTitlesSection: React.FC<AlternativeTitlesSectionProps> = ({
  selectedMetadata,
  setSelectedMetadata,
  getFieldOptions,
  logger,
}): JSX.Element => {
  /**
   * Cleans a title by removing provider badges and suffixes
   */
  const cleanTitle = (title: string): string => {
    let cleaned = title;
    // Remove provider badge if present (e.g., "[Provider] Title")
    if (cleaned.startsWith('[') && cleaned.includes('] ')) {
      cleaned = cleaned.substring(cleaned.indexOf('] ') + 2);
    }
    // Remove provider suffix if present (e.g., "Title::Provider")
    if (cleaned.includes('::')) {
      cleaned = cleaned.split('::')[0] ?? '';
    }
    return cleaned;
  };

  /**
   * Handles the Select All button click
   */
  const handleSelectAll = (): void => {
    const allTitles = getFieldOptions('alternativeTitles')
      .map(opt => cleanTitle(opt.label))
      .filter((v): v is string => v !== '');
    setSelectedMetadata(prev => ({
      ...prev,
      alternativeTitles: allTitles,
    }));
  };

  /**
   * Handles changes to the TagsInput
   */
  const handleTagsInputChange = (value: string[]): void => {
    logger.info(
      '[MetadataSelectionStep] Alternative titles dropdown options:',
      getFieldOptions('alternativeTitles'),
    );

    const cleanedTitles = value
      .map(v => cleanTitle(v))
      .filter((v): v is string => v !== '');

    setSelectedMetadata(prev => ({
      ...prev,
      alternativeTitles: cleanedTitles,
    }));
  };

  return (
    <Paper p="md">
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={5}>Alternative Titles</Title>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={handleSelectAll}
          >
            Select All
          </Button>
        </Group>
        <TagsInput
          value={selectedMetadata['alternativeTitles'] ?? []}
          onChange={handleTagsInputChange}
          placeholder="Add alternative titles..."
          data={[...new Set(getFieldOptions('alternativeTitles').map(opt => opt.label))]}
          clearable
        />
      </Stack>
    </Paper>
  );
};
