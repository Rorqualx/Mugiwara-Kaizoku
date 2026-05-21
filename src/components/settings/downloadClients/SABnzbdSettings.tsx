/**
 * SABnzbd Client Settings Component
 *
 * Provides a form for configuring the SABnzbd download client
 * with connection testing and validation.
 *
 * @module components/settings/downloadClients/SABnzbdSettings
 */
import type { ChangeEvent } from 'react';
import React, { useState } from 'react';

import { TextInput, PasswordInput, Button, Group, Box, Title, Alert, Divider } from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useSabnzbdConfig } from '@/hooks/useSABnzbdConfig';
import { trpc } from '@/utils/trpc-client/index';

import { SettingsSwitch } from '../SettingsSwitch';

import { getTestConnectionDisplay } from './connection-test-result';
import { parseBaseURL } from './parse-base-url';

import type { SabnzbdConfig } from './types';

/**
 * SABnzbd client settings component
 *
 * @returns {JSX.Element} The SABnzbd settings component
 *
 * @example
 * ```tsx
 * <SABnzbdSettings />
 * ```
 */
export const SABnzbdSettings: React.FC = (): JSX.Element => {
  const { config, saving, error: _error, updateSetting, updateConfig, isLoading } = useSabnzbdConfig();
  // Local state for form inputs
  const [baseURL, setBaseURL] = useState(config.baseURL);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [category, setCategory] = useState(config.category);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState<string>('');
  const [testing, setTesting] = useState(false);

  // Update local state when config changes
  React.useEffect(() => {
    setBaseURL(config.baseURL);
    setApiKey(config.apiKey);
    setCategory(config.category);
  }, [config.baseURL, config.apiKey, config.category]);

  const handleToggleEnabled = async (checked: boolean): Promise<void> => {
    try {
      await updateSetting('enabled', checked);
    } catch {
      // Hook already showed an error notification.
    }
  };

  const handleSaveSettings = async (): Promise<void> => {
    try {
      const updateData: Partial<SabnzbdConfig> = {
        baseURL,
        apiKey
      };
      if (category !== undefined) {
        updateData.category = category;
      }
      await updateConfig(updateData);
    } catch {
      // Hook already showed an error notification.
    }
  };

  const testSabnzbdMutation = trpc.downloadClients.testSabnzbd.useMutation();

  const handleTestConnection = async (): Promise<void> => {
    setTesting(true);
    setTestSuccess(null);
    setTestMessage('Testing connection...');
    try {
      const { host, port, ssl } = parseBaseURL(baseURL);
      const result = await testSabnzbdMutation.mutateAsync({
        host,
        port,
        apiKey,
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
        <Title order={4}>SABnzbd</Title>
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
          label="SABnzbd URL"
          placeholder="http://localhost:8080"
          description="URL to your SABnzbd server"
          value={baseURL}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setBaseURL(e.target.value)}
          mb="md"
          disabled={isLoading}
        />

        <PasswordInput
          label="API Key"
          placeholder="Enter API key"
          value={apiKey}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
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
            disabled={isLoading || !!saving || (baseURL === config.baseURL && apiKey === config.apiKey && category === config.category)}
            loading={!!saving}
          >
            Save Settings
          </Button>
        </Group>
      </Box>
    </Box>
  );
};
