/**
 * Overview tab panel for metadata display
 * @module components/manga/MangaMetadataViewer/components/OverviewTab
 */

import React from 'react';

import {
  Grid,
  Stack,
  Group,
  Box,
  Text,
  Badge,
  Image,
  SimpleGrid,
  ActionIcon,
  Collapse
} from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

import type { ExtractedMetadata } from '../utils';

interface OverviewTabProps {
  metadata: ExtractedMetadata;
  expandedSections: Record<string, boolean>;
  onToggleSection: (section: string) => void;
}

export function OverviewTab({
  metadata,
  expandedSections,
  onToggleSection
}: OverviewTabProps): React.ReactElement {
  return (
    <Grid gutter="md">
      {metadata.cover && (
        <Grid.Col span={4}>
          <Image src={metadata.cover} alt={metadata.title} fit="contain" />
        </Grid.Col>
      )}

      <Grid.Col span={metadata.cover ? 8 : 12}>
        <Stack>
          {/* Alternative Titles */}
          {metadata.alternativeTitles.length > 0 && (
            <Box>
              <Group gap="xs" mb="xs">
                <Text size="sm" fw={500}>
                  Alternative Titles
                </Text>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={(): void => {
                    onToggleSection('altTitles');
                  }}
                >
                  {expandedSections['altTitles'] ? <IconChevronUp /> : <IconChevronDown />}
                </ActionIcon>
              </Group>
              <Collapse in={expandedSections['altTitles'] ?? false}>
                <Text size="sm" c="dimmed">
                  {metadata.alternativeTitles.join(', ')}
                </Text>
              </Collapse>
            </Box>
          )}

          {/* Description */}
          {metadata.description && (
            <Box>
              <Group gap="xs" mb="xs">
                <Text size="sm" fw={500}>
                  Description
                </Text>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={(): void => {
                    onToggleSection('description');
                  }}
                >
                  {expandedSections['description'] ? <IconChevronUp /> : <IconChevronDown />}
                </ActionIcon>
              </Group>
              <Collapse in={expandedSections['description'] ?? false}>
                <Text size="sm">{metadata.description}</Text>
              </Collapse>
            </Box>
          )}

          {/* Quick Stats */}
          <SimpleGrid cols={2}>
            <Box>
              <Text size="xs" c="dimmed">
                Type
              </Text>
              <Text size="sm">{metadata.format}</Text>
            </Box>
            {metadata.score && (
              <Box>
                <Text size="xs" c="dimmed">
                  Score
                </Text>
                <Text size="sm">★ {metadata.score}</Text>
              </Box>
            )}
            {metadata.chapters && (
              <Box>
                <Text size="xs" c="dimmed">
                  Chapters
                </Text>
                <Text size="sm">{metadata.chapters}</Text>
              </Box>
            )}
            {metadata.volumes && (
              <Box>
                <Text size="xs" c="dimmed">
                  Volumes
                </Text>
                <Text size="sm">{metadata.volumes}</Text>
              </Box>
            )}
          </SimpleGrid>

          {/* Genres */}
          {metadata.genres.length > 0 && (
            <Box>
              <Text size="sm" fw={500} mb="xs">
                Genres
              </Text>
              <Group gap="xs">
                {metadata.genres.map((genre: string) => (
                  <a key={genre} href={`/browse/${encodeURIComponent(genre)}`} style={{ textDecoration: 'none' }}>
                    <Badge size="sm" variant="light" style={{ cursor: 'pointer' }}>
                      {genre}
                    </Badge>
                  </a>
                ))}
              </Group>
            </Box>
          )}
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
