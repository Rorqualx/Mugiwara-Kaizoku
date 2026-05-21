/**
 * Action buttons for the data correction panel
 */
import React from 'react';

import { Button, Group } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

import type { ActionButtonsProps } from '../types';

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onSkip,
  onReset,
  onSubmit,
  isSubmitting,
  hasCorrections,
  hasErrors,
  teachingMode,
}): JSX.Element => {
  return (
    <Group justify="right" mt="xl">
      {onSkip && (
        <Button
          variant="subtle"
          onClick={() => {
            void onSkip();
          }}
          disabled={isSubmitting}
        >
          Skip
        </Button>
      )}
      <Button
        variant="light"
        color="red"
        onClick={onReset}
        disabled={isSubmitting || !hasCorrections}
      >
        Reset Changes
      </Button>
      <Button
        leftSection={<IconCheck />}
        loading={isSubmitting}
        disabled={!hasCorrections || hasErrors}
        onClick={() => {
          void onSubmit();
        }}
        color={teachingMode ? 'blue' : 'green'}
      >
        {teachingMode ? 'Submit & Teach AI' : 'Submit Corrections'}
      </Button>
    </Group>
  );
};
