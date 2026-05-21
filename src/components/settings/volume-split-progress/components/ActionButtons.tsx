/**
 * Action Buttons Component
 *
 * Displays the action buttons for the progress modal.
 */
import React from 'react';

import { Group, Button } from '@mantine/core';

interface ActionButtonsProps {
  isComplete: boolean;
  onClose: () => void;
}

/**
 * Renders the Done/Close button based on completion state
 */
export function ActionButtons({
  isComplete,
  onClose
}: ActionButtonsProps): React.ReactElement {
  return (
    <Group justify="flex-end" mt="md">
      <Button onClick={onClose} color={isComplete ? 'green' : 'red'}>
        {isComplete ? 'Done' : 'Close'}
      </Button>
    </Group>
  );
}
