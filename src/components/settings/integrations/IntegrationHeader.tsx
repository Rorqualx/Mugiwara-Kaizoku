import type { ReactElement } from 'react';

import { Group, Text, Switch } from '@mantine/core';

interface IntegrationHeaderProps {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

/**
 * Standard header for integration settings pages
 */
export function IntegrationHeader({
  title,
  description,
  enabled,
  onEnabledChange
}: IntegrationHeaderProps): ReactElement {
  return (
    <Group justify="space-between" align="center">
      <div>
        <Text fw={500}>{title}</Text>
        <Text size="sm" c="dimmed">{description}</Text>
      </div>
      <Switch
        checked={enabled}
        onChange={(event) => onEnabledChange(event.currentTarget.checked)}
        label={enabled ? 'Enabled' : 'Disabled'}
        color="green"
        size="md"
      />
    </Group>
  );
}
