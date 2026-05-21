/**
 * ActionButtons Component
 *
 * Displays the action buttons for monitoring and refresh.
 *
 * Extracted from: MobileMangaHeader.tsx
 */

import React from 'react';

import { Group, Button } from '@mantine/core';
import {
  IconBookmark,
  IconBookmarkOff,
  IconRefresh
} from '@tabler/icons-react';

import type { ActionButtonsProps } from './types';

/**
 * Action buttons for monitoring and refresh
 */
export function ActionButtons({
  isMonitoring,
  onToggleMonitoring,
  onRefresh,
  isUpdating
}: ActionButtonsProps): React.ReactElement {
  return (
    <Group>
      <Button
        leftSection={
          isMonitoring ? <IconBookmarkOff size={18} /> : <IconBookmark size={18} />
        }
        variant={isMonitoring ? 'filled' : 'light'}
        onClick={() => onToggleMonitoring(!isMonitoring)}
        fullWidth
      >
        {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
      </Button>
      <Button
        leftSection={<IconRefresh size={18} />}
        variant="light"
        onClick={onRefresh}
        loading={isUpdating}
        fullWidth
      >
        Refresh Metadata
      </Button>
    </Group>
  );
}
