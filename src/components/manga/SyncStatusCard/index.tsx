/**
 * Sync Status Card Component
 *
 * Displays chapter sync status and provides sync management options
 *
 * @module components/manga/SyncStatusCard
 */

import React from 'react';

import {
  Card,
  Group,
  Text,
  Stack,
  Loader,
  Alert,
  Title,
  ThemeIcon,
  ActionIcon,
  Tooltip,
  Center,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconRefresh,
  IconInfoCircle,
} from '@tabler/icons-react';

import { SyncIssuesContent } from './SyncIssuesContent';
import { useSyncStatus } from './useSyncStatus';

import type { SyncStatusCardProps } from './types';

export function SyncStatusCard({
  mangaId,
  mangaTitle,
  onSyncFixed,
}: SyncStatusCardProps): React.ReactElement {
  const {
    lastChecked,
    syncData,
    isOutOfSync,
    isLoading,
    isFixing,
    missingChapters,
    extraChapters,
    handleCheckSync,
    handleFixSync,
  } = useSyncStatus({ mangaId, onSyncFixed });

  return (
    <Card shadow="sm" p="lg" radius="md" withBorder>
      <Stack>
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon
              size="lg"
              radius="xl"
              color={isOutOfSync ? 'yellow' : 'green'}
              variant="light"
            >
              {isOutOfSync ? (
                <IconAlertTriangle size={20} />
              ) : (
                <IconCheck size={20} />
              )}
            </ThemeIcon>
            <div>
              <Title order={5}>Chapter Sync Status</Title>
              {lastChecked && (
                <Text size="xs" c="dimmed">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </Text>
              )}
            </div>
          </Group>

          <Group>
            <Tooltip label="Re-check sync status">
              <ActionIcon
                variant="light"
                onClick={() => {
                  void handleCheckSync();
                }}
                loading={isLoading}
                disabled={isFixing}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {isLoading && !syncData ? (
          <Center p="md">
            <Loader size="sm" />
          </Center>
        ) : (
          <>
            {isOutOfSync && syncData ? (
              <SyncIssuesContent
                syncData={syncData}
                missingChapters={missingChapters}
                extraChapters={extraChapters}
                isFixing={isFixing}
                onFixSync={() => {
                  void handleFixSync();
                }}
              />
            ) : (
              <Alert
                icon={<IconCheck size={16} />}
                color="green"
                variant="light"
              >
                <Text size="sm" fw={500}>
                  All Chapters in Sync
                </Text>
                <Text size="xs" mt="xs">
                  No synchronization issues detected for {mangaTitle}
                </Text>
              </Alert>
            )}
          </>
        )}

        {!isOutOfSync && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="blue"
            variant="subtle"
          >
            <Text size="xs">
              This manga's chapters are automatically checked for sync issues.
              Use the refresh button to manually check for updates.
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}

export type { SyncStatusCardProps } from './types';
