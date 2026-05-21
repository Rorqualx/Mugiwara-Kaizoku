/**
 * NZBGet Client Settings Component
 *
 * Provides a form for configuring the NZBGet download client
 * with connection testing and validation.
 *
 * @module components/settings/downloadClients/NZBGetSettings
 */
import type { ChangeEvent } from 'react';
import React, { useState } from 'react';

import { TextInput, PasswordInput, Button, Group, Box, Title, Alert, Divider } from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useNzbgetConfig } from '@/hooks/useNZBGetConfig';
import { trpc } from '@/utils/trpc-client/index';

import { SettingsSwitch } from '../SettingsSwitch';

import { getTestConnectionDisplay } from './connection-test-result';
import { parseBaseURL } from './parse-base-url';

import type { NzbgetConfig } from './types';

/**
 * NZBGet client settings component
 *
 * @returns {JSX.Element} The NZBGet settings component
 *
 * @example
 * ```tsx
 * <NZBGetSettings />
 * ```
 */
export const NZBGetSettings: React.FC = (): JSX.Element => {
  const { config, saving, error: _error, updateSetting, updateConfig, isLoading } = useNzbgetConfig();
  // Local state for form inputs
  const [baseURL, setBaseURL] = useState(config.baseURL);
  const [username, setUsername] = useState(config.username);
  const [password, setPassword] = useState(config.password);
  const [category, setCategory] = useState(config.category);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState<string>('');
  const [testing, setTesting] = useState(false);

  // Update local state when config changes
  React.useEffect(() => {
    setBaseURL(config.baseURL);
    setUsername(config.username);
    setPassword(config.password);
    setCategory(config.category);
  }, [config.baseURL, config.username, config.password, config.category]);

  const handleToggleEnabled = async (checked: boolean): Promise<void> => {
    try {
      await updateSetting('enabled', checked);
    } catch {
      // Hook already showed an error notification.
    }
  };

  const handleSaveSettings = async (): Promise<void> => {
    try {
      const updateData: Partial<NzbgetConfig> = {
        baseURL,
        username,
        password
      };
      if (category !== undefined) {
        updateData.category = category;
      }
      await updateConfig(updateData);
    } catch {
      // Hook already showed an error notification.
    }
  };

  const testNzbgetMutation = trpc.downloadClients.testNzbget.useMutation();

  const handleTestConnection = async (): Promise<void> => {
    setTesting(true);
    setTestSuccess(null);
    setTestMessage('Testing connection...');
    try {
      const { host, port, ssl } = parseBaseURL(baseURL);
      const result = await testNzbgetMutation.mutateAsync({
        host,
        port,
        username: username,
        password: password,
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
        <Title order={4}>NZBGet</Title>
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
          label="NZBGet URL"
          placeholder="http://localhost:6789"
          description="URL to your NZBGet server"
          value={baseURL}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setBaseURL(e.target.value)}
          mb="md"
          disabled={isLoading}
        />

        <TextInput
          label="Username"
          placeholder="nzbget"
          value={username}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
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
          label="Category"
          placeholder="manga"
          description="Category to assign to downloaded files"
          value={category}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
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
            disabled={isLoading || !!saving || (baseURL === config.baseURL && username === config.username && password === config.password && category === config.category)}
            loading={!!saving}
          >
            Save Settings
          </Button>
        </Group>
      </Box>
    </Box>
  );
};
