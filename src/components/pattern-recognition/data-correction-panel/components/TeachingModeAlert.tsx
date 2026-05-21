/**
 * Teaching mode toggle alert component
 */
import React from 'react';

import { Alert, Group, Text, Switch } from '@mantine/core';
// @ts-ignore - TypeScript has issues resolving IconBrain
import { IconBrain } from '@tabler/icons-react';

interface TeachingModeAlertProps {
  teachingMode: boolean;
  onTeachingModeChange: (checked: boolean) => void;
}

export const TeachingModeAlert: React.FC<TeachingModeAlertProps> = ({
  teachingMode,
  onTeachingModeChange,
}): JSX.Element => {
  return (
    <Alert mb="md" icon={<IconBrain />} color={teachingMode ? 'blue' : 'gray'}>
      <Group justify="apart">
        <div>
          <Text fw={500}>Teaching Mode</Text>
          <Text size="xs" color="dimmed">
            {teachingMode
              ? 'Your corrections will help train the AI'
              : 'Corrections will only update this data'}
          </Text>
        </div>
        <Switch
          checked={teachingMode}
          onChange={(e) => onTeachingModeChange(e.currentTarget.checked)}
          label={teachingMode ? 'On' : 'Off'}
        />
      </Group>
    </Alert>
  );
};
