/**
 * Instance Control card — start/stop/restart buttons + auto-start switch.
 *
 * @module components/flaresolverr/settings/InstanceControlCard
 */

import React from 'react';

import { Card, Title, Group, Badge, Button, Switch } from '@mantine/core';
import {
  IconServer,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
} from '@tabler/icons-react';

import type { FlareSolverrSettingsValues } from './helpers';
import type { UseFormReturnType } from '@mantine/form';

interface InstanceControlCardProps {
  isRunning: boolean;
  canRestart: boolean;
  startPending: boolean;
  stopPending: boolean;
  restartPending: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  form: UseFormReturnType<FlareSolverrSettingsValues>;
  /** Persist autoStart immediately on toggle (no Save-Settings button required). */
  onAutoStartChange: (autoStart: boolean) => void;
}

export function InstanceControlCard({
  isRunning,
  canRestart,
  startPending,
  stopPending,
  restartPending,
  onStart,
  onStop,
  onRestart,
  form,
  onAutoStartChange,
}: InstanceControlCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>Instance Control</Title>
        <Badge
          size="sm"
          color={isRunning ? 'green' : 'gray'}
          leftSection={<IconServer size={12} />}
        >
          {isRunning ? 'Running' : 'Stopped'}
        </Badge>
      </Group>

      <Group gap="md" mt="sm">
        <Button
          variant="filled"
          color="green"
          size="xs"
          leftSection={<IconPlayerPlay size={14} />}
          onClick={onStart}
          loading={startPending}
          disabled={isRunning}
        >
          Start
        </Button>
        <Button
          variant="filled"
          color="red"
          size="xs"
          leftSection={<IconPlayerStop size={14} />}
          onClick={onStop}
          loading={stopPending}
          disabled={!isRunning}
        >
          Stop
        </Button>
        <Button
          variant="light"
          color="orange"
          size="xs"
          leftSection={<IconRefresh size={14} />}
          onClick={onRestart}
          loading={restartPending}
          disabled={!canRestart}
        >
          Restart
        </Button>
      </Group>

      <Switch
        mt="sm"
        size="sm"
        label="Auto-start on app launch"
        checked={form.values.autoStart}
        onChange={(event): void => {
          const next = event.currentTarget.checked;
          form.setFieldValue('autoStart', next);
          // Auto-save: this is a one-off "set and forget" preference;
          // requiring the user to scroll to Save Settings at the bottom
          // of the page means toggling the switch alone has no effect
          // across container restarts.
          onAutoStartChange(next);
        }}
      />
    </Card>
  );
}
