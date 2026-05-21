/**
 * Action buttons component for VolumeChapterTable
 * Handles select all and clear selection actions
 */

import React from 'react';

import { Group, Button } from '@mantine/core';


interface TableActionsProps {
  hasData: boolean;
  hasSelection: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export const TableActions = React.memo(function TableActions({
  hasData,
  hasSelection,
  onSelectAll,
  onClearSelection,
}: TableActionsProps): React.ReactElement | null {
  if (!hasData) {
    return null;
  }

  return (
    <Group justify="flex-end">
      <Button
        variant="subtle"
        size="xs"
        onClick={onClearSelection}
        disabled={!hasSelection}
      >
        Clear Selection
      </Button>
      <Button
        variant="subtle"
        size="xs"
        onClick={onSelectAll}
      >
        Select All
      </Button>
    </Group>
  );
});
