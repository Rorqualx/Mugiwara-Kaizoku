/**
 * MonitoringToggle Component
 *
 * Displays the monitoring toggle switch.
 *
 * Extracted from: MobileMangaHeader.tsx
 */

import React from 'react';

import { Group, Text, Paper, Switch } from '@mantine/core';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

import type { MonitoringToggleProps } from './types';

/**
 * Monitoring toggle switch component
 */
export function MonitoringToggle({
  isMonitoring,
  onToggleMonitoring
}: MonitoringToggleProps): React.ReactElement {
  return (
    <Paper p="md" withBorder>
      <Group justify="space-between">
        <Group gap="xs">
          {isMonitoring ? (
            <IconEye size={20} color="var(--mantine-color-green-6)" />
          ) : (
            <IconEyeOff size={20} color="var(--mantine-color-gray-6)" />
          )}
          <Text fw={500}>Monitoring</Text>
        </Group>
        <Switch
          checked={isMonitoring}
          onChange={(e) => onToggleMonitoring(e.currentTarget.checked)}
          size="lg"
        />
      </Group>
    </Paper>
  );
}
