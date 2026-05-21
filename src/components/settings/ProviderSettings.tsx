/**
 * Provider Settings Component
 * 
 * Provides a comprehensive UI for managing metadata provider settings.
 * Allows users to configure which providers are enabled, their relative
 * strength in metadata merging, and their search priority.
 * 
 * Features:
 * - Provider enabling/disabling
 * - Default provider selection
 * - Provider strength configuration
 * - Provider priority ordering
 * - Rich UI with proper loading and error states
 */

import React from "react";
import { useState } from 'react';

import {
  LoadingOverlay,
  Stack,
  Alert,
  Text,
  Group,
  Select,
  Slider,
  Card,
  Button,
  ActionIcon,
  NumberInput,
  Badge } from
'@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconCheck } from '@tabler/icons-react';
import { IconAlertCircle } from '@tabler/icons-react';
import { IconDatabase } from '@tabler/icons-react';
import { IconRefresh } from '@tabler/icons-react';
import { IconArrowUp } from '@tabler/icons-react';
import { IconArrowDown } from '@tabler/icons-react';
import { IconCrown } from '@tabler/icons-react';

import { useProviderConfig } from '@/hooks/useProviderConfig';

import { SettingsSwitch } from './SettingsSwitch';

/**
 * Provider Settings Component
 * 
 * @returns {JSX.Element} A form for configuring provider settings
 */
export function ProviderSettings(): React.ReactElement {
  // Use the provider configuration hook
  const {
    config,
    isLoading,
    saving,
    error,
    updateProviderSetting,
    setDefaultProvider,
    refresh,
    getProvidersByPriority
  } = useProviderConfig();

  // Local state for priority ordering display
  const [priorityList, setPriorityList] = useState<string[]>([]);

  // Update priority list when config changes
  // NOTE: This pattern (setState during render) should be refactored to useEffect
  if (priorityList.length === 0) {
    setPriorityList(getProvidersByPriority());
  }

  // Move a provider up in priority
  const moveProviderUp = (providerName: string): void => {
    const index = priorityList.indexOf(providerName);
    if (index > 0) {
      const currentProvider = config.providers[providerName];
      const aboveName = priorityList[index - 1];

      if (!currentProvider || !aboveName) return;

      const aboveProvider = config.providers[aboveName];
      if (!aboveProvider) return;

      // Swap priorities
      void updateProviderSetting(providerName, 'priority', aboveProvider.priority);
      void updateProviderSetting(aboveName, 'priority', currentProvider.priority);

      // Update local priority list
      const newList = [...priorityList];
      newList[index] = aboveName;
      newList[index - 1] = providerName;
      setPriorityList(newList);
    }
  };

  // Move a provider down in priority
  const moveProviderDown = (providerName: string): void => {
    const index = priorityList.indexOf(providerName);
    if (index < priorityList.length - 1) {
      const currentProvider = config.providers[providerName];
      const belowName = priorityList[index + 1];

      if (!currentProvider || !belowName) return;

      const belowProvider = config.providers[belowName];
      if (!belowProvider) return;

      // Swap priorities
      void updateProviderSetting(providerName, 'priority', belowProvider.priority);
      void updateProviderSetting(belowName, 'priority', currentProvider.priority);

      // Update local priority list
      const newList = [...priorityList];
      newList[index] = belowName;
      newList[index + 1] = providerName;
      setPriorityList(newList);
    }
  };

  // Format provider name for display
  const formatProviderName = (name: string): string => {
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <Stack gap="md" style={{ position: 'relative' }}>
      <LoadingOverlay visible={isLoading} overlayProps={{ radius: 'sm', blur: 2 }} />
      
      <Alert
        color="blue"
        title="Metadata Provider Settings"
        role="status"
        icon={<IconDatabase size={16} />}>

        Configure which metadata providers are enabled and how they are prioritized.
        The default provider is used when no specific provider is requested.
      </Alert>
      
      {error &&
      <Alert
        color="red"
        title="Configuration Error"
        role="alert"
        icon={<IconAlertCircle size={16} />}>

          {typeof error === 'string' ? error : 'An error occurred while updating settings'}
        </Alert>
      }
      
      <Select
        label="Default Metadata Provider"
        description="Primary provider used for metadata searches"
        value={config.defaultProvider}
        onChange={(value) => { if (value) { void setDefaultProvider(value); } }}
        data={Object.keys(config.providers).map((name) => ({
          value: name,
          label: formatProviderName(name)
        }))}
        leftSection={<IconCrown size={16} />} />

      
      <Text size="lg" fw={600} mt="md">Provider Configuration</Text>
      
      {priorityList.map((providerName) => {
        const provider = config.providers[providerName];

        if (!provider) return null;

        return (
          <Card key={providerName} withBorder shadow="sm" padding="md" radius="md">
            <Group justify="space-between">
              <Group>
                <Text fw={600}>{formatProviderName(providerName)}</Text>
                {providerName === config.defaultProvider &&
                <Badge color="yellow">Default</Badge>
                }
                {provider.enabled ?
                <Badge color="green">Enabled</Badge> :

                <Badge color="red">Disabled</Badge>
                }
              </Group>

              <Group>
                <ActionIcon
                  onClick={() => { void moveProviderUp(providerName); }}
                  disabled={priorityList.indexOf(providerName) === 0}
                  title="Move up in priority">

                  <IconArrowUp size={16} />
                </ActionIcon>
                <ActionIcon
                  onClick={() => { void moveProviderDown(providerName); }}
                  disabled={priorityList.indexOf(providerName) === priorityList.length - 1}
                  title="Move down in priority">

                  <IconArrowDown size={16} />
                </ActionIcon>
              </Group>
            </Group>

            <Text size="sm" c="dimmed" mb="md">{provider["description"]}</Text>

            <Stack>
              <SettingsSwitch
                label={`Enable ${formatProviderName(providerName)}`}
                description="Include this provider in metadata searches"
                checked={provider.enabled}
                onChange={(event) => { void updateProviderSetting(providerName, 'enabled', event.currentTarget.checked); }} />

              <Text size="sm" fw={500}>Metadata Strength</Text>
              <Slider
                min={0}
                max={100}
                step={5}
                value={provider.strength}
                onChange={(value) => { void updateProviderSetting(providerName, 'strength', value); }}
                label={(value) => `${value}%`}
                disabled={!provider.enabled}
                marks={[
                { value: 0, label: '0%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' }]
                }
                styles={(theme) => ({
                  markLabel: {
                    fontSize: theme.fontSizes.xs
                  }
                })} />

              <Text size="xs" c="dimmed">
                Relative strength of metadata from this provider when merging with other sources
              </Text>

              <Text size="sm" fw={500} mt="xs">Search Priority</Text>
              <Group>
                <NumberInput
                  value={provider.priority}
                  onChange={(value) => { void updateProviderSetting(providerName, 'priority', Number(value)); }}
                  min={1}
                  max={100}
                  disabled={!provider.enabled}
                  style={{ width: '80px' }} />

                <Text size="xs" c="dimmed">
                  Order in which providers are searched (lower values = higher priority)
                </Text>
              </Group>
            </Stack>
          </Card>);

      })}
      
      <Group justify="flex-end" mt="md">
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="outline"
          onClick={() => { void refresh(); }}
          loading={isLoading}>

          Refresh Settings
        </Button>
        
        <Button
          leftSection={<IconCheck size={16} />}
          color="green"
          onClick={() => { void refresh(); }}
          loading={saving}>

          Save Changes
        </Button>
      </Group>
    </Stack>);

}