/**
 * Kavita Integration Sync Settings Tab Component
 *
 * Renders sync configuration panel including auto-sync, intervals, and direction.
 * Provides manual sync trigger for all libraries.
 *
 * @module kavita/components/SyncTab
 */

import React from 'react';

import {
  Paper,
  Button,
  Group,
  Stack,
  Switch,
  Divider,
  NumberInput,
  Select,
  Text
} from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

import type { KavitaTabComponentProps, KavitaLibrary } from '@/components/settings/integrations/kavita/types';

/**
 * Sync settings tab component
 *
 * @param props - Component props
 * @returns React element
 */
export function SyncTab(props: KavitaTabComponentProps): React.ReactElement {
  const { form, connectionStatus, mutationHandlers, queriesData } = props;

  const handleSyncAll = (): void => {
    const libraryIds = queriesData.librariesData?.libraries?.map((lib: KavitaLibrary) => lib.id) ?? [];
    void mutationHandlers.handleSyncAllLibraries(libraryIds);
  };

  return (
    <Paper p="lg" withBorder>
      <form onSubmit={form.onSubmit(mutationHandlers.handleSubmit)}>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={500}>Sync Settings</Text>
              <Text size="sm" c="dimmed">Configure how libraries are synchronized</Text>
            </div>
          </Group>

          <Divider />

          <Switch
            label="Enable Automatic Sync"
            description="Automatically sync libraries at regular intervals"
            disabled={!form.values.enabled}
            checked={form.values.autoSync}
            onChange={(event) => form.setFieldValue('autoSync', event.currentTarget.checked)}
          />

          <NumberInput
            label="Sync Interval (minutes)"
            description="How often to sync with Kavita"
            min={5}
            max={1440}
            step={5}
            disabled={!form.values.enabled || !form.values.autoSync}
            value={form.values.syncInterval}
            onChange={(value) => form.setFieldValue('syncInterval', typeof value === 'number' ? value : 60)}
          />

          <Select
            label="Sync Direction"
            description="How to sync data between servers"
            disabled={!form.values.enabled}
            data={[
              { value: 'toKavita', label: 'To Kavita Only' },
              { value: 'fromKavita', label: 'From Kavita Only' },
              { value: 'bidirectional', label: 'Bidirectional' }
            ]}
            value={form.values.syncDirection}
            onChange={(value) => form.setFieldValue('syncDirection', value as 'toKavita' | 'fromKavita' | 'bidirectional')}
          />

          <Group justify="space-between" mt="lg">
            <Button
              variant="subtle"
              leftSection={<IconRefresh />}
              onClick={() => { void handleSyncAll(); }}
              disabled={!form.values.enabled || connectionStatus !== 'connected'}
            >
              Sync All Libraries Now
            </Button>

          <Button
            type="submit"
            disabled={!form.isDirty()}
          >
            Save Sync Settings
          </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
