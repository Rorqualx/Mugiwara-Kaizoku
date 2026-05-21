/**
 * Prowlarr Configuration Section Component
 *
 * Renders the Prowlarr configuration form with connection testing and save functionality.
 *
 * @module components/settings/indexers/ProwlarrConfigSection
 */

import React from 'react';

import { Text, Paper, TextInput, Button, Group, Alert } from '@mantine/core';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import type { ProwlarrConfigSectionProps } from '@/components/settings/indexers/types';
import { SettingsSwitch } from '@/components/settings/SettingsSwitch';


/**
 * Prowlarr Configuration Section Component
 *
 * @param props - Component props
 * @returns React element
 */
export function ProwlarrConfigSection(props: ProwlarrConfigSectionProps): React.ReactElement {
  const {
    prowlarrSettings,
    formState,
    onToggleProwlarr,
    onSubmit,
    onTest,
    onBaseURLChange,
    onApiKeyChange
  } = props;

  const { baseURL, apiKey, testSuccess, testMessage, isTesting } = formState;

  return (
    <Paper shadow="xs" p="xl" withBorder mb="xl">
      <Group justify="space-between" mb="md">
        <Text fw={700} size="xl" c="blue">
          Prowlarr Configuration
        </Text>
        <SettingsSwitch
          label="Enabled"
          description="Enable Prowlarr integration"
          checked={prowlarrSettings.enabled}
          onChange={(event) => {
            void onToggleProwlarr(event.currentTarget.checked);
          }}
        />
      </Group>

      {testSuccess === true && (
        <Alert icon={<IconCheck size={16} />} title="Success" color="green" mb="md">
          {testMessage}
        </Alert>
      )}

      {testSuccess === false && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
          {testMessage}
        </Alert>
      )}

      {prowlarrSettings.enabled && (
        <div>
          {/* Using div instead of form to avoid accidental submissions */}
          <TextInput
            label="Prowlarr URL"
            description="The base URL of your Prowlarr instance"
            placeholder="http://localhost:9696"
            value={baseURL}
            onChange={(e) => onBaseURLChange(e.target.value)}
            required
            mb="md"
            size="md"
            autoComplete="off"
          />

          <TextInput
            label="API Key"
            description="Found in Settings > General in your Prowlarr instance"
            placeholder="Your Prowlarr API key"
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            required
            mb="md"
            size="md"
            autoComplete="off"
          />

          <Group justify="space-between">
            <Button
              variant="outline"
              onClick={() => {
                void onTest();
              }}
              disabled={!baseURL || !apiKey || isTesting}
              loading={isTesting}
              size="md"
            >
              Test Connection
            </Button>

            <Button
              onClick={(e) => {
                void onSubmit(e);
              }}
              disabled={!baseURL || !apiKey}
              size="md"
            >
              Save Configuration
            </Button>
          </Group>
        </div>
      )}
    </Paper>
  );
}
