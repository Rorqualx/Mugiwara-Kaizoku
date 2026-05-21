/**
 * AlternativeTitlesSection Component
 *
 * Displays alternative titles in a collapsible section with provider information.
 *
 * Extracted from: MangaDetailBanner.tsx (lines 305-354)
 *
 * @module components/manga/manga-detail-banner/AlternativeTitlesSection
 */

import * as React from 'react';

import { Box, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

import { getFirstProvenance } from '@/components/manga/mangaDetailUtils';
import { ProviderBadge } from '@/components/metadata/ProviderBadge';
import { ProviderStrengthIndicator } from '@/components/metadata/ProviderStrengthIndicator';
import { getMetadataStringArray } from '@/utils/entityMetadataUtils';


import type { CollapsibleSectionProps } from './types';

/**
 * AlternativeTitlesSection Component
 *
 * Renders alternative titles with expand/collapse functionality.
 */
export function AlternativeTitlesSection({
  manga,
  isExpanded,
  setIsExpanded
}: CollapsibleSectionProps): React.ReactElement | null {
  const altTitles = getMetadataStringArray(manga, 'alternativeTitles');

  if (altTitles.length === 0) {
    return null;
  }

  return (
    <Box mb="md">
      <Group gap="xs" mb="xs">
        <Text fw={500} c="white">
          Alternative Titles
        </Text>
        {getFirstProvenance(manga, 'alternativeTitles') && (
          <>
            <ProviderBadge
              providerId={getFirstProvenance(manga, 'alternativeTitles') ?? ''}
              size="xs"
            />
            <ProviderStrengthIndicator
              providerId={getFirstProvenance(manga, 'alternativeTitles') ?? ''}
              fieldName="alternativeTitles"
              mode="minimal"
              size="xs"
            />
          </>
        )}
        <Button
          variant="subtle"
          size="xs"
          onClick={() => setIsExpanded(!isExpanded)}
          rightSection={isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}>
          {isExpanded ? 'Hide' : 'Show'} ({altTitles.length})
        </Button>
      </Group>

      {isExpanded && (
        <Paper p="sm" withBorder>
          <Stack gap="xs">
            {altTitles.map((title, index) => (
              <Text key={index} size="sm">
                {title}
              </Text>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
