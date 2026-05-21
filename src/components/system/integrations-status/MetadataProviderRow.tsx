/**
 * MetadataProviderRow Component
 *
 * Displays a single metadata provider row with status badges
 */
import React from 'react';

import { Group, Text, Badge } from '@mantine/core';

import { StatusBadge } from './StatusBadge';
import { getEnabledColor } from './utils';

import type { MetadataProviderInfo } from './types';

interface MetadataProviderRowProps {
  icon: React.ReactNode;
  name: string;
  provider: MetadataProviderInfo;
  showApiMissing?: boolean;
}

/**
 * Displays a metadata provider row with icon, name, and status badges
 */
export function MetadataProviderRow({
  icon,
  name,
  provider,
  showApiMissing = false
}: MetadataProviderRowProps): React.ReactElement {
  return (
    <Group justify="space-between">
      <Group gap="xs">
        {icon}
        <Text fw={500}>{name}:</Text>
      </Group>
      <Group gap="xs">
        <Badge color={getEnabledColor(provider.enabled)} size="lg">
          {provider.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
        {provider.enabled && <StatusBadge status={provider.status} />}
        {provider.enabled && provider.useForMetadata && (
          <Badge color="blue" size="lg">
            Metadata Source
          </Badge>
        )}
        {showApiMissing && provider.enabled && !provider.apiConfigured && (
          <Badge color="orange" size="lg">
            API Key Missing
          </Badge>
        )}
      </Group>
    </Group>
  );
}
