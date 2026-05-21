/**
 * Actions Component for File Browser
 *
 * Displays modal action buttons (Cancel and Select)
 */

import React from 'react';

import { Group, Button } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

import { ActionsProps } from './types';

/**
 * Actions Component
 */
export function Actions({
  onClose,
  onSelectCurrent,
  isSelectDisabled
}: ActionsProps): React.ReactElement {
  return (
    <Group justify="space-between" mt="auto">
      <Button variant="default" onClick={onClose}>
        Cancel
      </Button>
      <Button
        onClick={onSelectCurrent}
        disabled={isSelectDisabled}
        leftSection={<IconCheck />}
      >
        Select Current Path
      </Button>
    </Group>
  );
}