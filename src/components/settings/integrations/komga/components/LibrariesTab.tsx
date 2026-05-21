import React from 'react';

import { Paper, Button, Group, Stack, Divider, Badge, Alert, Text } from '@mantine/core';
import { IconInfoCircle, IconRefresh } from '@tabler/icons-react';

export interface KomgaLibrary {
  id: string;
  name: string;
  root: string;
  type: string;
  unavailableDate?: string;
  isSelected: boolean;
  [key: string]: unknown;
}

export interface LibrariesTabProps {
  libraries?: KomgaLibrary[] | undefined;
  connectionStatus: string;
  isSyncing: boolean;
  onRefresh: () => void;
  onSyncLibrary: (libraryId: string, deep: boolean) => void;
}

export function LibrariesTab({
  libraries,
  connectionStatus,
  isSyncing,
  onRefresh,
  onSyncLibrary
}: LibrariesTabProps): React.ReactElement {
  return (
    <Paper p="lg" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={500}>Libraries</Text>
            <Text size="sm" c="dimmed">View and manage Komga libraries</Text>
          </div>
          <Button
            variant="subtle"
            size="sm"
            leftSection={<IconRefresh />}
            onClick={() => void onRefresh()}
            loading={!libraries}
          >
            Refresh
          </Button>
        </Group>

        <Divider />

        {libraries && libraries.length > 0 ? (
          <Stack gap="sm">
            {libraries.map((library: KomgaLibrary) => (
              <Paper key={library.id} p="md" withBorder>
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={500}>{library.name}</Text>
                    <Text size="sm" c="dimmed">
                      Root: {library.root}
                    </Text>
                    {library.unavailableDate && (
                      <Text size="xs" c="red">
                        Unavailable since: {new Date(library.unavailableDate).toLocaleString()}
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
                      onClick={() => void onSyncLibrary(library.id, false)}
                      loading={isSyncing}
                    >
                      Scan
                    </Button>
                    <Button
                      size="sm"
                      variant="subtle"
                      color="orange"
                      leftSection={<IconRefresh size={16} />}
                      onClick={() => void onSyncLibrary(library.id, true)}
                      loading={isSyncing}
                    >
                      Deep Scan
                    </Button>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Alert icon={<IconInfoCircle />} color="gray">
            {connectionStatus === 'connected'
              ? 'No libraries found. Make sure you have libraries configured in Komga.'
              : 'Connect to Komga to view available libraries.'}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
