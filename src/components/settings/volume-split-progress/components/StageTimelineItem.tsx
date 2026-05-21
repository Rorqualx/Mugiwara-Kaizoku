/**
 * Timeline item component for a split stage
 */
import React from 'react';

import { Timeline, Text, ThemeIcon, Loader } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

import { getStageColor, getStageIcon } from '../utils/stage-utils';

import type { StageTimelineItemProps } from '../types';

/**
 * Individual timeline item for a stage
 */
export function StageTimelineItem({
  stage,
  label,
  isActive,
  isPast,
  details
}: StageTimelineItemProps): JSX.Element {
  const color = getStageColor(stage);
  const icon = getStageIcon(stage);

  return (
    <Timeline.Item
      bullet={
        isActive ? (
          <Loader size={16} />
        ) : isPast ? (
          <ThemeIcon color={color} size={20} radius="xl">
            <IconCheck size={12} />
          </ThemeIcon>
        ) : (
          icon
        )
      }
      title={
        <Text fw={isActive ? 600 : 400} c={isActive ? 'dark' : 'dimmed'}>
          {label}
        </Text>
      }
    >
      {details && (
        <Text size="xs" c="dimmed" mt={4}>
          {details}
        </Text>
      )}
    </Timeline.Item>
  );
}
