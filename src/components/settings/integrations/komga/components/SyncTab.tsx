import React from 'react';

import { Paper, Button, Group, Stack, Switch, Divider, NumberInput, Select, Text } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

import type { KomgaFormValues } from '@/components/settings/integrations/komga/hooks';

import type { UseFormReturnType } from '@mantine/form';

export interface SyncTabProps {
  form: UseFormReturnType<KomgaFormValues>;
  connectionStatus: string;
  isSyncing: boolean;
  isUpdating: boolean;
  onSyncAll: () => void;
  onSubmit: (values: KomgaFormValues) => void;
}

export function SyncTab({
  form,
  connectionStatus,
  isSyncing,
  isUpdating,
  onSyncAll,
  onSubmit
}: SyncTabProps): React.ReactElement {
  return (
    <Paper p="lg" withBorder>
      <form onSubmit={form.onSubmit(onSubmit)}>
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
            {...form.getInputProps('autoSync', { type: 'checkbox' })}
          />

          <NumberInput
            label="Sync Interval (minutes)"
            description="How often to sync with Komga"
            min={5}
            max={1440}
            step={5}
            disabled={!form.values.enabled || !form.values.autoSync}
            {...form.getInputProps('syncInterval')}
          />

          <Select
            label="Sync Direction"
            description="How to sync data between servers"
            disabled={!form.values.enabled}
            data={[
              { value: 'toKomga', label: 'To Komga Only' },
              { value: 'fromKomga', label: 'From Komga Only' },
              { value: 'bidirectional', label: 'Bidirectional' }
            ]}
            {...form.getInputProps('syncDirection')}
          />

          <Group justify="space-between" mt="lg">
            <Button
              variant="subtle"
              leftSection={<IconRefresh />}
              onClick={() => { void onSyncAll(); }}
              disabled={!form.values.enabled || connectionStatus !== 'connected'}
              loading={isSyncing}
            >
              Scan All Libraries Now
            </Button>
            <Button
              type="submit"
              loading={isUpdating}
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
