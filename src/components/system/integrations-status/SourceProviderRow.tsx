/**
 * SourceProviderRow Component
 *
 * Displays a single source provider row with status badges
 */
import React from 'react';

import { Group, Text, Badge } from '@mantine/core';

import { StatusBadge } from './StatusBadge';
import { getEnabledColor } from './utils';

import type { SourceProviderInfo } from './types';

interface SourceProviderRowProps {
  icon: React.ReactNode;
  name: string;
  provider: SourceProviderInfo;
}

/**
 * Displays a source provider row with icon, name, and status badges
 */
export function SourceProviderRow({
  icon,
  name,
  provider
}: SourceProviderRowProps): React.ReactElement {
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
        {provider.enabled && (
          <Badge color="blue" size="lg">
            {provider.sourceCount} Sources
          </Badge>
        )}
      </Group>
    </Group>
  );
}
