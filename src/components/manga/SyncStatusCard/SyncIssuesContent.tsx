/**
 * Sync Issues Content Component
 *
 * Displays sync issues alert with missing/extra chapters and fix button
 *
 * @module components/manga/SyncStatusCard/SyncIssuesContent
 */

import React from 'react';

import { Stack, Alert, Text, Button } from '@mantine/core';
import { IconAlertTriangle, IconTools } from '@tabler/icons-react';

import { ChapterBadgeList } from './ChapterBadgeList';

import type { SyncIssuesContentProps } from './types';

export function SyncIssuesContent({
  syncData,
  missingChapters,
  extraChapters,
  isFixing,
  onFixSync,
}: SyncIssuesContentProps): React.ReactElement {
  return (
    <Stack gap="sm">
      <Alert
        icon={<IconAlertTriangle size={16} />}
        color="yellow"
        variant="light"
      >
        <Text size="sm" fw={500}>
          Sync Issues Detected
        </Text>
        {syncData.message && (
          <Text size="xs" mt="xs">
            {syncData.message}
          </Text>
        )}
        {syncData.outOfSyncCount > 0 && (
          <Text size="xs" mt="xs">
            {syncData.outOfSyncCount} chapters out of sync
          </Text>
        )}
      </Alert>

      <ChapterBadgeList
        chapters={missingChapters}
        label="Missing Chapters"
        color="red"
      />

      <ChapterBadgeList
        chapters={extraChapters}
        label="Extra Chapters"
        color="orange"
      />

      <Button
        leftSection={<IconTools size={16} />}
        onClick={onFixSync}
        loading={isFixing}
        color="yellow"
        variant="filled"
        fullWidth
      >
        Fix Sync Issues
      </Button>
    </Stack>
  );
}
