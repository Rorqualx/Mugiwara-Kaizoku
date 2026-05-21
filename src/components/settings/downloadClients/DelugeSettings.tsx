/**
 * Deluge Client Settings Component
 *
 * Provides a form for configuring the Deluge torrent client
 * with connection testing and validation.
 *
 * @module components/settings/downloadClients/DelugeSettings
 */
import type { ChangeEvent } from 'react';
import React, { useState } from 'react';

import { TextInput, PasswordInput, Button, Group, Box, Title, Alert, Divider } from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useDelugeConfig } from '@/hooks/useDelugeConfig';
import { trpc } from '@/utils/trpc-client/index';

import { SettingsSwitch } from '../SettingsSwitch';

import { getTestConnectionDisplay } from './connection-test-result';
import { parseBaseURL } from './parse-base-url';

import type { DelugeConfig } from './types';

/**
 * Deluge torrent client settings component
 *
 * @returns {JSX.Element} The Deluge settings component
 *
 * @example
 * ```tsx
 * <DelugeSettings />
 * ```
 */
export const DelugeSettings: React.FC = (): JSX.Element => {
  const { config, saving, error: _error, updateSetting, updateConfig, isLoading } = useDelugeConfig();
  // Local state for form inputs
  const [baseURL, setBaseURL] = useState(config.baseURL);
  const [password, setPassword] = useState(config.password);
  const [label, setLabel] = useState(config.label ?? '');
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState<string>('');
  const [testing, setTesting] = useState(false);

  // Update local state when config changes
  React.useEffect(() => {
    setBaseURL(config.baseURL);
    setPassword(config.password);
    setLabel(config.label ?? '');
  }, [config.baseURL, config.password, config.label]);

  const handleToggleEnabled = async (checked: boolean): Promise<void> => {
    try {
      await updateSetting('enabled', checked);
    } catch {
      // Hook already showed an error notification.
    }
  };

  const handleSaveSettings = async (): Promise<void> => {
    try {
      const updateData: Partial<DelugeConfig> = {
        baseURL,
        password,
        label
      };
      await updateConfig(updateData);
    } catch {
      // Hook already showed an error notification.
    }
  };

  const testDelugeMutation = trpc.downloadClients.testDeluge.useMutation();

  const handleTestConnection = async (): Promise<void> => {
    setTesting(true);
    setTestSuccess(null);
    setTestMessage('Testing connection...');
    try {
      const { host, port, ssl } = parseBaseURL(baseURL);
      const result = await testDelugeMutation.mutateAsync({
        host,
        port,
        password,
        ssl
      });
      const display = getTestConnectionDisplay(result);
      setTestSuccess(display.success);
      setTestMessage(display.message);
    } catch (_error: unknown) {
      setTestSuccess(false);
      setTestMessage(_error instanceof Error ? _error.message : 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box>
      <Group justify="space-between" mb="md">
        <Title order={4}>Deluge</Title>
        <SettingsSwitch
          checked={config.enabled}
          onChange={(event) => { void handleToggleEnabled(event.currentTarget.checked); }}
          label="Enabled"
          disabled={isLoading || !!saving}
        />
      </Group>

      <Divider mb="md" />

      <Box>
        <TextInput
          label="Deluge Web UI URL"
          placeholder="http://localhost:8112"
          description="URL to your Deluge Web UI"
          value={baseURL}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setBaseURL(e.target.value)}
          mb="md"
          disabled={isLoading}
        />

        <PasswordInput
          label="Password"
          placeholder="Enter password"
          value={password}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          mb="md"
          disabled={isLoading}
        />

        <TextInput
          label="Label"
          placeholder="manga"
          description="Label assigned to torrents in Deluge"
          value={label}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
          mb="md"
          disabled={isLoading}
        />

        {testSuccess !== null && (
          <Alert
            color={testSuccess ? 'green' : 'red'}
            icon={testSuccess ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
            mb="md"
          >
            {testMessage}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button
            variant="outline"
            onClick={() => { void handleTestConnection(); }}
            disabled={isLoading || testing}
            loading={testing}
          >
            Test Connection
          </Button>
          <Button
            onClick={() => { void handleSaveSettings(); }}
            disabled={isLoading || !!saving || (baseURL === config.baseURL && password === config.password && label === (config.label ?? ''))}
            loading={!!saving}
          >
            Save Settings
          </Button>
        </Group>
      </Box>
    </Box>
  );
};

// Export with original name for backwards compatibility
export { DelugeSettings as DelugeTorrentSettings };
