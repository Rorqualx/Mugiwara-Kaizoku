/**
 * Timeline component showing all split stages
 */
import React from 'react';

import { Timeline, Text, ThemeIcon } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

import type { SplitStage } from '@/hooks/useVolumeSplitProgress';

import { getStageOrder } from '../utils/stage-utils';

import { StageTimelineItem } from './StageTimelineItem';

import type { StageConfig } from '../types';

interface StageTimelineProps {
  currentStage: SplitStage;
  totalImages: number | undefined;
  totalChapters: number | undefined;
  currentChapter: number | undefined;
  chaptersCreated: number;
  isComplete: boolean;
}

/**
 * Get stage details for display
 */
function getStageDetails(
  stage: StageConfig,
  totalImages: number | undefined,
  totalChapters: number | undefined,
  currentChapter: number | undefined
): string | undefined {
  if (stage.key === 'extracting_images' && totalImages) {
    return `${totalImages} images extracted`;
  }
  if (stage.key === 'detecting_chapters' && totalChapters) {
    return `${totalChapters} chapters detected`;
  }
  if (stage.key === 'creating_chapters' && currentChapter && totalChapters) {
    return `Chapter ${currentChapter} of ${totalChapters}`;
  }
  return undefined;
}

/**
 * Timeline showing all stages
 */
export function StageTimeline({
  currentStage,
  totalImages,
  totalChapters,
  currentChapter,
  chaptersCreated,
  isComplete
}: StageTimelineProps): React.ReactElement {
  const stages: StageConfig[] = [
    { key: 'initializing', label: 'Initializing' },
    { key: 'extracting_images', label: 'Extracting Images' },
    { key: 'detecting_chapters', label: 'Detecting Chapters' },
    { key: 'calculating_confidence', label: 'Analyzing Confidence' },
    { key: 'creating_chapters', label: 'Creating Chapter Files' }
  ];

  const stageOrder = getStageOrder();
  const currentStageIndex = stageOrder.indexOf(currentStage);

  return (
    <Timeline active={currentStageIndex} bulletSize={24} lineWidth={2}>
      {stages.map((stage, idx) => {
        const isActive = currentStage === stage.key;
        const isPast = currentStageIndex > idx;
        const details = getStageDetails(stage, totalImages, totalChapters, currentChapter);

        return (
          <StageTimelineItem
            key={stage.key}
            stage={stage.key}
            label={stage.label}
            isActive={isActive}
            isPast={isPast}
            details={details}
          />
        );
      })}

      {/* Completion State */}
      {isComplete && (
        <Timeline.Item
          bullet={
            <ThemeIcon color="green" size={20} radius="xl">
              <IconCheck size={12} />
            </ThemeIcon>
          }
          title={
            <Text fw={600} c="green">
              Complete!
            </Text>
          }
        >
          <Text size="xs" c="dimmed" mt={4}>
            {chaptersCreated} chapter files created
          </Text>
        </Timeline.Item>
      )}
    </Timeline>
  );
}
