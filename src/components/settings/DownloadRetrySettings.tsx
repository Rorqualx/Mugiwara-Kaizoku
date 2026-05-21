/**
 * Download Retry Settings Component
 *
 * This component provides controls for configuring automatic download retry behavior,
 * including failure detection thresholds and blocklist integration.
 *
 * Features:
 * - Enable/disable automatic retry
 * - Maximum retry attempts
 * - Stall detection timeout
 * - Minimum seeder threshold (for torrents)
 * - Auto-blocklist failed releases
 * - Blocklist expiry configuration
 * - Delay between retries
 */
import * as React from 'react';

import {
  Text,
  Title,
  Paper,
  Stack,
  Divider,
  NumberInput,
  Group,
  Badge,
  Tooltip,
} from '@mantine/core';
import { IconRefresh, IconLock, IconClock, IconUsers } from '@tabler/icons-react';

import { useDownloadRetryConfig } from '@/hooks/useDownloadRetryConfig';

import { SettingsSwitch } from './SettingsSwitch';

/**
 * Download retry settings component with proper state management
 */
export const DownloadRetrySettings: React.FC = () => {
  const { config, isLoading, saving, updateSetting } = useDownloadRetryConfig();

  /**
   * Handles toggling automatic retry
   */
  const handleEnabledToggle = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    await updateSetting('enabled', event.currentTarget.checked);
  };

  /**
   * Handles toggling auto-blocklist
   */
  const handleAutoBlockToggle = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    await updateSetting('autoBlockFailed', event.currentTarget.checked);
  };

  return (
    <Paper shadow="xs" p="xl" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3}>Download Retry Settings</Title>
        <Badge
          color={config.enabled ? 'green' : 'gray'}
          variant="light"
          leftSection={<IconRefresh size={12} />}
        >
          {config.enabled ? 'Active' : 'Disabled'}
        </Badge>
      </Group>

      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Configure automatic retry behavior for failed downloads. When enabled, failed
          downloads will be removed, blocklisted, and replaced with alternative releases
          from Prowlarr.
        </Text>

        <Divider />

        {/* Enable automatic retry */}
        <SettingsSwitch
          label="Enable Automatic Retry"
          description="Automatically retry failed downloads using alternative sources"
          checked={config.enabled}
          onChange={(event) => {
            void handleEnabledToggle(event);
          }}
          disabled={isLoading || !!saving}
        />

        {/* Max retry attempts */}
        <Tooltip
          label="Number of alternative releases to try before giving up"
          position="right"
        >
          <NumberInput
            label="Maximum Retry Attempts"
            description="How many times to retry before marking as failed"
            leftSection={<IconRefresh size={16} />}
            min={1}
            max={10}
            value={config.maxAttempts}
            onChange={(value) => {
              if (typeof value === 'number') {
                void updateSetting('maxAttempts', value);
              }
            }}
            disabled={!config.enabled || isLoading || !!saving}
            style={{ maxWidth: '300px' }}
          />
        </Tooltip>

        <Divider label="Failure Detection" labelPosition="center" />

        {/* Stall timeout */}
        <Tooltip
          label="Time without progress before a download is considered stalled"
          position="right"
        >
          <NumberInput
            label="Stall Timeout (minutes)"
            description="Minutes without progress before considering a download stalled"
            leftSection={<IconClock size={16} />}
            min={5}
            max={120}
            value={config.stallTimeoutMinutes}
            onChange={(value) => {
              if (typeof value === 'number') {
                void updateSetting('stallTimeoutMinutes', value);
              }
            }}
            disabled={!config.enabled || isLoading || !!saving}
            style={{ maxWidth: '300px' }}
          />
        </Tooltip>

        {/* Minimum seeders */}
        <Tooltip
          label="Torrents with fewer seeders will trigger retry (0 = disabled)"
          position="right"
        >
          <NumberInput
            label="Minimum Seeders"
            description="Minimum seeder count required for torrents (below triggers retry)"
            leftSection={<IconUsers size={16} />}
            min={0}
            max={10}
            value={config.minSeeders}
            onChange={(value) => {
              if (typeof value === 'number') {
                void updateSetting('minSeeders', value);
              }
            }}
            disabled={!config.enabled || isLoading || !!saving}
            style={{ maxWidth: '300px' }}
          />
        </Tooltip>

        <Divider label="Blocklist Integration" labelPosition="center" />

        {/* Auto-block failed releases */}
        <SettingsSwitch
          label="Auto-Block Failed Releases"
          description="Automatically add failed releases to blocklist to prevent re-downloading"
          checked={config.autoBlockFailed}
          onChange={(event) => {
            void handleAutoBlockToggle(event);
          }}
          disabled={!config.enabled || isLoading || !!saving}
        />

        {/* Block expiry days */}
        <Tooltip
          label="How long to keep failed releases blocked before allowing retry"
          position="right"
        >
          <NumberInput
            label="Block Expiry (days)"
            description="Days until auto-blocked releases can be tried again"
            leftSection={<IconLock size={16} />}
            min={1}
            max={365}
            value={config.blockExpiryDays}
            onChange={(value) => {
              if (typeof value === 'number') {
                void updateSetting('blockExpiryDays', value);
              }
            }}
            disabled={
              !config.enabled ||
              !config.autoBlockFailed ||
              isLoading ||
              !!saving
            }
            style={{ maxWidth: '300px' }}
          />
        </Tooltip>

        <Divider label="Timing" labelPosition="center" />

        {/* Delay between retries */}
        <Tooltip
          label="Wait time between removing a failed download and starting the alternative"
          position="right"
        >
          <NumberInput
            label="Retry Delay (seconds)"
            description="Delay between retry attempts"
            leftSection={<IconClock size={16} />}
            min={10}
            max={600}
            step={10}
            value={config.delayBetweenRetriesSeconds}
            onChange={(value) => {
              if (typeof value === 'number') {
                void updateSetting('delayBetweenRetriesSeconds', value);
              }
            }}
            disabled={!config.enabled || isLoading || !!saving}
            style={{ maxWidth: '300px' }}
          />
        </Tooltip>
      </Stack>
    </Paper>
  );
};
