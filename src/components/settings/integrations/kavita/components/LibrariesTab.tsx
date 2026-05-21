/**
 * Kavita Integration Libraries Tab Component
 *
 * Displays available Kavita libraries with sync controls.
 * Allows individual library synchronization.
 *
 * @module kavita/components/LibrariesTab
 */

import React from 'react';

import {
  Paper,
  Button,
  Group,
  Stack,
  Divider,
  Badge,
  Alert,
  Text
} from '@mantine/core';
import { IconRefresh, IconInfoCircle } from '@tabler/icons-react';

import type { KavitaTabComponentProps, KavitaLibrary } from '@/components/settings/integrations/kavita/types';

/**
 * Libraries management tab component
 *
 * @param props - Component props
 * @returns React element
 */
export function LibrariesTab(props: KavitaTabComponentProps): React.ReactElement {
  const { connectionStatus, queriesData, mutationHandlers } = props;

  return (
    <Paper p="lg" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={500}>Libraries</Text>
            <Text size="sm" c="dimmed">Select which libraries to sync</Text>
          </div>
          <Button
            variant="subtle"
            size="sm"
            leftSection={<IconRefresh />}
            onClick={() => { void queriesData.refetch.libraries(); }}
            loading={!queriesData.librariesData}
          >
            Refresh
          </Button>
        </Group>

        <Divider />

        {queriesData.librariesData?.libraries && queriesData.librariesData.libraries.length > 0 ? (
          <Stack gap="sm">
            {queriesData.librariesData.libraries.map((library: KavitaLibrary) => (
              <Paper key={library.id} p="md" withBorder>
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={500}>{library.name}</Text>
                    <Text size="sm" c="dimmed">
                      {library.folders?.join(', ') ?? 'No folders'}
                    </Text>
                    {library.lastScanned && (
                      <Text size="xs" c="dimmed">
                        Last scanned: {new Date(library.lastScanned).toLocaleString()}
                      </Text>
                    )}
                  </div>
                  <Group>
                    <Badge color={library.isSelected ? 'green' : 'gray'}>
                      {library.isSelected ? 'Selected' : 'Not Selected'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="subtle"
                      leftSection={<IconRefresh size={16} />}
                      onClick={() => {
                        void mutationHandlers.handleSyncAllLibraries([library.id]);
                      }}
                    >
                      Sync
                    </Button>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Alert icon={<IconInfoCircle />} color="gray">
            {connectionStatus === 'connected'
              ? 'No libraries found. Make sure you have libraries configured in Kavita.'
              : 'Connect to Kavita to view available libraries.'}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
