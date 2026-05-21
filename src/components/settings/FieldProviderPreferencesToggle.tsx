/**
 * Field Provider Preferences Toggle
 *
 * Toggle switch to enable/disable provider preferences.
 */
import React, { JSX } from 'react';

import { Paper, Group, Stack, Text, Switch } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';

interface FieldProviderPreferencesToggleProps {
  isEnabled: boolean;
  onToggle: (checked: boolean) => void;
}

export function FieldProviderPreferencesToggle({
  isEnabled,
  onToggle
}: FieldProviderPreferencesToggleProps): JSX.Element {
  return (
    <Paper p="md" withBorder bg="blue.0" style={{ borderColor: 'var(--mantine-color-blue-3)' }}>
      <Group justify="space-between">
        <Stack gap={4}>
          <Group gap="xs">
            <IconSettings size={20} color="var(--mantine-color-blue-6)" />
            <Text fw={600} size="sm">Use Predefined Provider Preferences</Text>
          </Group>
          <Text size="xs" c="dimmed">
            When enabled, Quick Add will automatically use your preferred providers.
          </Text>
        </Stack>
        <Switch
          size="lg"
          checked={isEnabled}
          onChange={(event) => onToggle(event.currentTarget.checked)}
          label={isEnabled ? "Enabled" : "Disabled"}
          color="blue"
          styles={{
            label: { fontWeight: 600 }
          }}
        />
      </Group>
    </Paper>
  );
}
