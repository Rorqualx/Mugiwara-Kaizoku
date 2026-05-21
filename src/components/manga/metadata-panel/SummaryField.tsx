/**
 * Summary Field Component
 *
 * Displays manga summary/description with provenance badge
 */

import React from 'react';

import { Group, Text } from '@mantine/core';

import { ProviderBadge } from '@/components/metadata/ProviderBadge';

import type { MetadataFieldProps } from './types';

export function SummaryField({ metadata, provenance }: MetadataFieldProps): React.ReactElement | null {
  if (!metadata?.summary) {
    return null;
  }

  return (
    <Group gap={4} align="flex-start" mb={4} wrap="nowrap">
      <Text size="sm">{metadata.summary}</Text>
      {provenance?.["summary"] && (
        <ProviderBadge
          providerId={provenance["summary"].source}
          size="xs"
          style={{ marginTop: 2, flexShrink: 0 }}
        />
      )}
    </Group>
  );
}
