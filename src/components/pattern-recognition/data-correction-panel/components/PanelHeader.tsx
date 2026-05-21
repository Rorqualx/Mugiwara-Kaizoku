/**
 * Panel header component with title and ML confidence indicator
 */
import React from 'react';

import { Group, Text, ThemeIcon, Divider } from '@mantine/core';
// @ts-ignore - TypeScript has issues resolving IconBrain
import { IconBrain } from '@tabler/icons-react';

import { getConfidenceColor } from '../utils';

interface PanelHeaderProps {
  mlConfidence: number;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  mlConfidence,
}): JSX.Element => {
  return (
    <>
      <Group justify="apart" mb="md">
        <div>
          <Text size="xl" fw={700}>
            Correct Extracted Data
          </Text>
          <Text size="sm" color="dimmed">
            Help improve the AI by correcting any mistakes
          </Text>
        </div>
        <Group>
          <ThemeIcon
            color={getConfidenceColor(mlConfidence)}
            size="lg"
            radius="xl"
            variant="light"
          >
            <IconBrain size={20} />
          </ThemeIcon>
          <div>
            <Text size="xs" color="dimmed">
              ML Confidence
            </Text>
            <Text fw={500}>{(mlConfidence * 100).toFixed(1)}%</Text>
          </div>
        </Group>
      </Group>
      <Divider mb="md" />
    </>
  );
};
