/**
 * User confidence slider component
 */
import React from 'react';

import { Paper, Text, Progress, Group, Button } from '@mantine/core';

import { CONFIDENCE_PRESETS } from '../utils';

import type { ConfidenceSliderProps } from '../types';

export const ConfidenceSlider: React.FC<ConfidenceSliderProps> = ({
  userConfidence,
  onConfidenceChange,
  getConfidenceColor,
}): JSX.Element => {
  return (
    <Paper p="md" mt="md" withBorder>
      <Text size="sm" fw={500} mb="xs">
        How confident are you in these corrections?
      </Text>
      <Progress
        value={userConfidence * 100}
        size="xl"
        radius="xl"
        color={getConfidenceColor(userConfidence)}
      />
      <Group mt="xs">
        {CONFIDENCE_PRESETS.map((val) => (
          <Button
            key={val}
            size="xs"
            variant={userConfidence === val ? 'filled' : 'subtle'}
            onClick={() => onConfidenceChange(val)}
          >
            {(val * 100).toFixed(0)}%
          </Button>
        ))}
      </Group>
    </Paper>
  );
};
