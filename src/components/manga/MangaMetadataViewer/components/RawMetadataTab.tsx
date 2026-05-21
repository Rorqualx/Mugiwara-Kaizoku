/**
 * Raw metadata tab panel for debugging
 * @module components/manga/MangaMetadataViewer/components/RawMetadataTab
 */

import React from 'react';

import { Box, Text } from '@mantine/core';

interface RawMetadataTabProps {
  provider: string;
  metadata: unknown;
}

export function RawMetadataTab({ provider, metadata }: RawMetadataTabProps): React.ReactElement {
  return (
    <Box>
      <Text size="xs" c="dimmed" mb="xs">
        Raw metadata from {provider}
      </Text>
      <Box
        p="sm"
        style={{
          backgroundColor: 'var(--mantine-color-dark-7)',
          borderRadius: 'var(--mantine-radius-sm)',
          fontFamily: 'monospace',
          fontSize: '12px',
          overflowX: 'auto'
        }}
      >
        <pre>{JSON.stringify(metadata, null, 2)}</pre>
      </Box>
    </Box>
  );
}
