/**
 * Progress bar component showing overall progress
 */
import React from 'react';

import { Box, Group, Text, Badge, Progress } from '@mantine/core';

import type { SplitStage } from '@/hooks/useVolumeSplitProgress';

import { getStageColor } from '../utils/stage-utils';

interface ProgressBarProps {
  percentComplete: number;
  stage: SplitStage;
  isComplete: boolean;
}

/**
 * Overall progress bar display
 */
export function ProgressBar({ percentComplete, stage, isComplete }: ProgressBarProps): React.ReactElement {
  return (
    <Box>
      <Group justify="space-between" mb={4}>
        <Text size="sm" fw={500}>
          Overall Progress
        </Text>
        <Badge color={getStageColor(stage)} variant="filled">
          {percentComplete.toFixed(0)}%
        </Badge>
      </Group>
      <Progress
        value={percentComplete}
        color={getStageColor(stage)}
        size="lg"
        radius="sm"
        animated={!isComplete}
      />
    </Box>
  );
}
