/**
 * Status Field Component
 *
 * Displays manga publication status with provenance badge
 */

import React from 'react';

import { Group, Text } from '@mantine/core';

import { ProviderBadge } from '@/components/metadata/ProviderBadge';

import type { MetadataFieldProps } from './types';

/**
 * Extract provider source from provenance field
 */
function getProvenanceSource(field: unknown): string | undefined {
  if (field && typeof field === 'object' && 'source' in field) {
    return String(field.source);
  }
  return undefined;
}

export function StatusField({ metadata, provenance }: MetadataFieldProps): React.ReactElement | null {
  if (!metadata?.status) {
    return null;
  }

  const statusProviderId = getProvenanceSource(provenance?.["status"]);

  return (
    <Group gap={4} align="center">
      <Text size="sm" c="dimmed">
        Status: {metadata.status}
      </Text>
      {statusProviderId !== undefined && (
        <ProviderBadge
          providerId={statusProviderId}
          size="xs"
          style={{ marginLeft: 4 }}
        />
      )}
    </Group>
  );
}
