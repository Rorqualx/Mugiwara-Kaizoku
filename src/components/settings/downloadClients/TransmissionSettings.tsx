/**
 * Transmission Settings Component
 *
 * Component for configuring Transmission download client settings with
 * real configuration persistence using the central configuration system.
 */
import React, { useState, useCallback } from 'react';

import { Box, Group, Title, Divider, TextInput, Button, Alert } from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useTransmissionConfig } from '@/hooks/useTransmissionConfig';
import { trpc } from '@/utils/trpc-client/index';

import { SettingsSwitch } from '../SettingsSwitch';

import { getTestConnectionDisplay } from './connection-test-result';
import { parseBaseURL } from './parse-base-url';
/**
 * Transmission Settings Component with proper state management
 */
export function TransmissionSettings(): JSX.Element {
    const { config, saving, error, updateSetting, updateConfig, isLoading } = useTransmissionConfig();
    // Local state for form inputs
    const [baseURL, setBaseURL] = useState(config.baseURL);
    const [label, setLabel] = useState(config.label ?? '');
    const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
    const [testMessage, setTestMessage] = useState<string>('');
    const [testing, setTesting] = useState(false);
    // Update local state when config changes
    React.useEffect(() => {
        setBaseURL(config.baseURL);
        setLabel(config.label ?? '');
    }, [config.baseURL, config.label]);
    /**
     * Handle toggle enable/disable
     */
    const handleToggleEnabled = useCallback(async (checked: boolean): Promise<void> => {
        try {
            await updateSetting('enabled', checked);
        } catch {
            // Hook already showed an error notification.
        }
    }, [updateSetting]);
    /**
     * Save settings to configuration
     */
    const handleSaveSettings = useCallback(async (): Promise<void> => {
        try {
            await updateConfig({ baseURL, label });
        } catch {
            // Hook already showed an error notification.
        }
    }, [baseURL, label, updateConfig]);
    /**
     * Test connection to Transmission
     */
    // Use tRPC mutation for testing connection
    const testConnectionMutation = trpc.downloadClients.testTransmission.useMutation();
    const handleTestConnection = useCallback(async (): Promise<void> => {
        setTesting(true);
        setTestSuccess(null);
        setTestMessage('Testing connection...');
        try {
            const { host, port, ssl } = parseBaseURL(baseURL);
            const result = await testConnectionMutation.mutateAsync({ host, port, ssl });
            const display = getTestConnectionDisplay(result);
            setTestSuccess(display.success);
            setTestMessage(display.message);
        }
        catch (error: unknown) {
            setTestSuccess(false);
            setTestMessage(error instanceof Error ? error.message : 'Connection failed');
        }
        finally {
            setTesting(false);
        }
    }, [baseURL, testConnectionMutation]);
    return (<Box>
      <Group justify="space-between" mb="md">
        <Title order={4}>Transmission</Title>
        <SettingsSwitch checked={config.enabled} onChange={(event) => { void handleToggleEnabled(event.currentTarget.checked); }} disabled={isLoading || !!saving}/>

      </Group>
      
      <Divider mb="md"/>
      
      {error &&
            <Alert icon={<IconAlertCircle size={16}/>} title="Error" color="red" mb="md">

          {(error instanceof Error ? error.message : String(error))}
        </Alert>}
      
      <Box>
        <TextInput label="Transmission URL" placeholder="http://localhost:9091" description="Base URL to your Transmission server (e.g., http://localhost:9091). The /transmission/rpc path is added automatically." value={baseURL} onChange={(e) => setBaseURL(e.target.value)} mb="md" disabled={isLoading}/>

        <TextInput label="Label" placeholder="manga" description="Label assigned to torrents in Transmission" value={label} onChange={(e) => setLabel(e.target.value)} mb="md" disabled={isLoading}/>

        {testSuccess !== null &&
            <Alert icon={testSuccess ? <IconCheck size={16}/> : <IconAlertCircle size={16}/>} color={testSuccess ? 'green' : 'red'} mb="md">

            {testMessage}
          </Alert>}
        
        <Group>
          <Button onClick={() => { void handleTestConnection(); }} disabled={isLoading || testing} loading={testing} variant="outline">

            Test Connection
          </Button>

          <Button onClick={() => { void handleSaveSettings(); }} disabled={isLoading || !!saving || (baseURL === config.baseURL && label === (config.label ?? ''))} loading={!!saving}>

            Save Settings
          </Button>
        </Group>
      </Box>
    </Box>);
}
