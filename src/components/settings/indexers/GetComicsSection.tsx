/**
 * GetComics Settings Section Component
 *
 * Provides configuration UI for GetComics indexer integration.
 * Allows users to enable/disable, configure rate limits, and set host preferences.
 *
 * @module components/settings/indexers/GetComicsSection
 */

import React from 'react';

import {
  Paper,
  Title,
  Text,
  Stack,
  Switch,
  NumberInput,
  Divider,
  Group,
  Badge,
  Loader,
  Alert,
} from '@mantine/core';
import { IconAlertCircle, IconBooks } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

import { GetComicsHostPreferences } from './GetComicsHostPreferences';

/**
 * GetComics Section Component
 */
// eslint-disable-next-line complexity -- Settings component managing multiple configuration options with validation and mutation state
export function GetComicsSection(): React.ReactElement {
  const utils = trpc.useUtils();

  // Fetch current settings
  const { data: settings, isLoading, error } = trpc.getcomics.getSettings.useQuery();

  // Update mutation
  const updateMutation = trpc.getcomics.updateSettings.useMutation({
    onSuccess: () => {
      void utils.getcomics.getSettings.invalidate();
    },
  });

  const handleEnabledChange = (checked: boolean): void => {
    updateMutation.mutate({ enabled: checked });
  };

  const handleRateLimitChange = (value: string | number): void => {
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
      updateMutation.mutate({ rateLimit: numValue });
    }
  };

  const handleTimeoutChange = (value: string | number): void => {
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(numValue) && numValue >= 5000 && numValue <= 120000) {
      updateMutation.mutate({ timeout: numValue });
    }
  };

  const handleFlareSolverrChange = (checked: boolean): void => {
    updateMutation.mutate({ useFlareSolverr: checked });
  };

  const handleHostsChange = (hosts: string[]): void => {
    updateMutation.mutate({ preferredHosts: hosts });
  };

  if (isLoading) {
    return (
      <Paper shadow="xs" p="xl" withBorder mt="xl">
        <Group justify="center" p="xl">
          <Loader size="md" />
          <Text>Loading GetComics settings...</Text>
        </Group>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper shadow="xs" p="xl" withBorder mt="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
          Failed to load GetComics settings: {error.message}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper shadow="xs" p="xl" withBorder mt="xl">
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <IconBooks size={24} />
          <Title order={3}>GetComics Integration</Title>
          <Badge color={settings?.enabled ? 'green' : 'gray'} variant="light">
            {settings?.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </Group>
        <Switch
          checked={settings?.enabled ?? false}
          onChange={(e) => { handleEnabledChange(e.currentTarget.checked); }}
          disabled={updateMutation.isPending}
        />
      </Group>

      <Text size="sm" c="dimmed" mb="lg">
        GetComics provides comic book downloads from various file hosting services.
        Configure your preferred hosts and download settings below.
      </Text>

      <Divider my="md" />

      <Stack gap="lg">
        <NumberInput
          label="Rate Limit (requests per second)"
          description="Limit requests to avoid being blocked. Lower is safer."
          value={settings?.rateLimit ?? 1}
          onChange={handleRateLimitChange}
          min={1}
          max={10}
          disabled={!settings?.enabled || updateMutation.isPending}
        />

        <NumberInput
          label="Timeout (milliseconds)"
          description="Maximum time to wait for a response from GetComics."
          value={settings?.timeout ?? 30000}
          onChange={handleTimeoutChange}
          min={5000}
          max={120000}
          step={1000}
          disabled={!settings?.enabled || updateMutation.isPending}
        />

        <Switch
          label="Use FlareSolverr"
          description="Enable FlareSolverr to bypass Cloudflare protection. Requires FlareSolverr to be configured."
          checked={settings?.useFlareSolverr ?? true}
          onChange={(e) => { handleFlareSolverrChange(e.currentTarget.checked); }}
          disabled={!settings?.enabled || updateMutation.isPending}
        />

        <Divider />

        <div>
          <Text fw={500} mb="xs">Preferred Download Hosts</Text>
          <Text size="sm" c="dimmed" mb="md">
            Order hosts by preference. The first available host will be used for downloads.
          </Text>
          <GetComicsHostPreferences
            hosts={settings?.preferredHosts ?? []}
            onChange={handleHostsChange}
            disabled={!settings?.enabled || updateMutation.isPending}
          />
        </div>
      </Stack>
    </Paper>
  );
}
