/**
 * Quick action buttons for the data correction panel
 */
import React from 'react';

import { Button, Group } from '@mantine/core';
import { IconRefresh, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
// @ts-ignore - TypeScript has issues resolving IconSparkles
import { IconSparkles } from '@tabler/icons-react';

import type { QuickActionsProps } from '../types';

export const QuickActions: React.FC<QuickActionsProps> = ({
  onAutoSuggest,
  onReset,
  showDetails,
  onToggleDetails,
}): JSX.Element => {
  return (
    <Group mb="md">
      <Button
        leftSection={<IconSparkles />}
        variant="light"
        onClick={() => {
          void onAutoSuggest();
        }}
      >
        AI Suggestions
      </Button>
      <Button leftSection={<IconRefresh />} variant="subtle" onClick={onReset}>
        Reset
      </Button>
      <Button
        leftSection={showDetails ? <IconChevronUp /> : <IconChevronDown />}
        variant="subtle"
        onClick={onToggleDetails}
      >
        {showDetails ? 'Hide' : 'Show'} All Fields
      </Button>
    </Group>
  );
};
