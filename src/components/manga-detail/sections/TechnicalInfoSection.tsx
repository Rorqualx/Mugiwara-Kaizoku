/**
 * Technical Information Section Component
 *
 * Displays technical details in card format with icons.
 *
 * Extracted from: mangaDetail.tsx (lines 382-489)
 */

import React from 'react';

import { Box, Group, SimpleGrid, Text, Title, Tooltip } from '@mantine/core';
import {
  IconFolder,
  IconDatabase,
  IconAspectRatio,
  IconClock,
  IconFlag,
  IconLanguage,
  IconRuler,
  IconSearch,
} from '@tabler/icons-react';

import { formatFileSize, getLanguageName, getPathDisplayName } from '../utils';

import type { MangaWithMetadataAndChapters } from '../types';

export interface TechnicalInfoSectionProps {
  manga: MangaWithMetadataAndChapters;
  totalSize: number;
}

/**
 * Technical information section with info cards
 */
export function TechnicalInfoSection({ manga, totalSize }: TechnicalInfoSectionProps): React.ReactElement {
  return (
    <Box mt="xl">
      <Title order={4} mb="md">Technical Information</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {manga.libraryPath && (
          <Box p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
            <Group gap="xs" align="center">
              <IconFolder size={18} color="gray" />
              <Box>
                <Text size="xs" c="dimmed">File Path</Text>
                <Tooltip label={manga.libraryPath}>
                  <Text size="sm" truncate>{getPathDisplayName(manga.libraryPath)}</Text>
                </Tooltip>
              </Box>
            </Group>
          </Box>
        )}

        {totalSize > 0 && (
          <Box p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
            <Group gap="xs" align="center">
              <IconDatabase size={18} color="gray" />
              <Box>
                <Text size="xs" c="dimmed">File Size</Text>
                <Text size="sm">{formatFileSize(totalSize)}</Text>
              </Box>
            </Group>
          </Box>
        )}

        {manga.metadata.averageResolution && (
          <Box p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
            <Group gap="xs" align="center">
              <IconAspectRatio size={18} color="gray" />
              <Box>
                <Text size="xs" c="dimmed">Resolution</Text>
                <Text size="sm">{manga.metadata.averageResolution}</Text>
              </Box>
            </Group>
          </Box>
        )}

        <Box p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
          <Group gap="xs" align="center">
            <IconClock size={18} color="gray" />
            <Box>
              <Text size="xs" c="dimmed">Tracking</Text>
              <Text size="sm">{manga.interval}</Text>
            </Box>
          </Group>
        </Box>

        <Box p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
          <Group gap="xs" align="center">
            <IconFlag size={18} color="gray" />
            <Box>
              <Text size="xs" c="dimmed">Status</Text>
              <Text size="sm">{manga.metadata.status}</Text>
            </Box>
          </Group>
        </Box>

        {manga.metadata.language && (
          <Box p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
            <Group gap="xs" align="center">
              <IconLanguage size={18} color="gray" />
              <Box>
                <Text size="xs" c="dimmed">Language</Text>
                <Text size="sm">{getLanguageName(manga.metadata.language)}</Text>
              </Box>
            </Group>
          </Box>
        )}

        {manga.metadata.qualityProfile && (
          <Box p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
            <Group gap="xs" align="center">
              <IconRuler size={18} color="gray" />
              <Box>
                <Text size="xs" c="dimmed">Quality</Text>
                <Text size="sm">{manga.metadata.qualityProfile}</Text>
              </Box>
            </Group>
          </Box>
        )}

        {manga.metadata.languages && manga.metadata.languages.length > 0 && (
          <Box p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
            <Group gap="xs" align="center">
              <IconLanguage size={18} color="gray" />
              <Box>
                <Text size="xs" c="dimmed">Languages</Text>
                <Text size="sm">{manga.metadata.languages.map(getLanguageName).join(', ')}</Text>
              </Box>
            </Group>
          </Box>
        )}

        <Box p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
          <Group gap="xs" align="center">
            <IconSearch size={18} color="gray" />
            <Box>
              <Text size="xs" c="dimmed">Metadata Provider</Text>
              <Text size="sm">{manga.source}</Text>
            </Box>
          </Group>
        </Box>
      </SimpleGrid>
    </Box>
  );
}
