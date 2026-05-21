/**
 * Details tab panel for metadata display
 * @module components/manga/MangaMetadataViewer/components/DetailsTab
 */

import React from 'react';

import { SimpleGrid, Stack, Group, Box, Text, ActionIcon } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';

import { formatDate } from '../utils';

import type { ExtractedMetadata } from '../utils';

interface DetailsTabProps {
  metadata: ExtractedMetadata;
}

export function DetailsTab({ metadata }: DetailsTabProps): React.ReactElement {
  return (
    <SimpleGrid cols={2}>
      {/* Authors */}
      {metadata.authors.length > 0 && (
        <Box>
          <Text size="sm" fw={500} mb="xs">
            Authors
          </Text>
          <Stack gap="xs">
            {metadata.authors.map((author: string) => (
              <Text key={author} size="sm">
                {author}
              </Text>
            ))}
          </Stack>
        </Box>
      )}

      {/* Artists */}
      {metadata.artists.length > 0 && (
        <Box>
          <Text size="sm" fw={500} mb="xs">
            Artists
          </Text>
          <Stack gap="xs">
            {metadata.artists.map((artist: string) => (
              <Text key={artist} size="sm">
                {artist}
              </Text>
            ))}
          </Stack>
        </Box>
      )}

      {/* Dates */}
      <Box>
        <Text size="sm" fw={500} mb="xs">
          Publication Dates
        </Text>
        <Stack gap="xs">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Start:
            </Text>
            <Text size="sm">{formatDate(metadata.startDate)}</Text>
          </Group>
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              End:
            </Text>
            <Text size="sm">{formatDate(metadata.endDate)}</Text>
          </Group>
        </Stack>
      </Box>

      {/* External Links */}
      {Object.keys(metadata.externalLinks).length > 0 && (
        <Box>
          <Text size="sm" fw={500} mb="xs">
            External Links
          </Text>
          <Stack gap="xs">
            {Object.entries(metadata.externalLinks).map(([site, url]) => (
              <Group key={site} gap="xs">
                <ActionIcon
                  component="a"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  variant="light"
                >
                  <IconExternalLink size={14} />
                </ActionIcon>
                <Text size="sm">{site}</Text>
              </Group>
            ))}
          </Stack>
        </Box>
      )}
    </SimpleGrid>
  );
}
