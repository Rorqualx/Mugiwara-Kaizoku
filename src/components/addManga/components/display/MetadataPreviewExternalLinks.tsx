/**
 * MetadataPreviewExternalLinks Component
 *
 * Renders external link buttons for AniList and MyAnimeList
 * if IDs are available in metadata.
 */

import React, { memo } from 'react';

import {
  Box,
  Group,
  Text,
  Button
} from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';

interface MetadataPreviewExternalLinksProps {
  /** Manga metadata with external IDs */
  metadata: {
    anilistId?: number;
    myAnimeListId?: number;
  };
}

/**
 * External links section with buttons to third-party services
 *
 * @returns JSX.Element
 */
export const MetadataPreviewExternalLinks = memo(function MetadataPreviewExternalLinks({
  metadata
}: MetadataPreviewExternalLinksProps): JSX.Element {
  return (
    <Box>
      <Text size="sm" fw={500} mb="xs">
        External Links
      </Text>
      <Group gap="xs">
        {metadata.anilistId && (
          <Button
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconExternalLink size={14} />}
            component="a"
            href={`https://anilist.co/manga/${metadata.anilistId}`}
            target="_blank"
          >
            AniList
          </Button>
        )}
        {metadata.myAnimeListId && (
          <Button
            size="xs"
            variant="light"
            color="indigo"
            leftSection={<IconExternalLink size={14} />}
            component="a"
            href={`https://myanimelist.net/manga/${metadata.myAnimeListId}`}
            target="_blank"
          >
            MyAnimeList
          </Button>
        )}
      </Group>
    </Box>
  );
});
