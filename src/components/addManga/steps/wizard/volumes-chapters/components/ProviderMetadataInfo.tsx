/**
 * ProviderMetadataInfo Component
 *
 * Displays available metadata from providers with volume/chapter counts.
 */

import React from 'react';

import { Paper, Stack, Text, Group, Badge } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

import { isRecord, hasProperty } from '../index';

interface ProviderMetadataInfoProps {
  selectedSourcesMetadata: Record<string, unknown>;
}

export const ProviderMetadataInfo: React.FC<ProviderMetadataInfoProps> = React.memo(
  ({ selectedSourcesMetadata }): JSX.Element | null => {
    if (Object.keys(selectedSourcesMetadata).length === 0) return null;

    return (
      <Paper p="md" bg="dark.8" mb="md">
        <Stack gap="sm">
          <Text size="xs" fw={500}>Available Metadata from Providers:</Text>
          <Group>
            {Object.entries(selectedSourcesMetadata).map(([providerName, metadata]) => {
              if (!isRecord(metadata)) return null;

              const volumes = hasProperty(metadata, 'volumes') ? metadata['volumes'] : undefined;
              const chapters = hasProperty(metadata, 'chapters') ? metadata['chapters'] : undefined;

              return (
                <Badge
                  key={providerName}
                  size="sm"
                  variant="light"
                  leftSection={
                    volumes !== undefined || chapters !== undefined ? (
                      <IconCheck size={14} />
                    ) : null
                  }
                >
                  {providerName}:
                  {volumes !== null && ` ${String(volumes)}v`}
                  {chapters !== null && ` ${String(chapters)}ch`}
                  {volumes === undefined && chapters === undefined && ' No count data'}
                </Badge>
              );
            })}
          </Group>
        </Stack>
      </Paper>
    );
  }
);

ProviderMetadataInfo.displayName = 'ProviderMetadataInfo';
