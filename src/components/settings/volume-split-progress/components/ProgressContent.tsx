/**
 * Progress Content Component
 *
 * Displays the progress details including bar, stats, and timeline.
 */
import React from 'react';

import { Text } from '@mantine/core';

import type { VolumeSplitProgress } from '@/hooks/useVolumeSplitProgress';

import { ProgressBar } from './ProgressBar';
import { StageTimeline } from './StageTimeline';

interface ProgressContentProps {
  progress: VolumeSplitProgress;
  isComplete: boolean;
}

/**
 * Displays progress bar, stats text, and stage timeline
 */
export function ProgressContent({
  progress,
  isComplete
}: ProgressContentProps): React.ReactElement {
  return (
    <>
      {/* Overall Progress Bar */}
      <ProgressBar
        percentComplete={progress.percentComplete}
        stage={progress.stage}
        isComplete={isComplete}
      />

      {/* Current Stage Info */}
      {progress.totalImages && (
        <Text size="sm" c="dimmed" ta="center">
          {progress.totalImages} images • {progress.chaptersCreated} /{' '}
          {progress.totalChapters ?? '?'} chapters created
        </Text>
      )}

      {/* Timeline of Stages */}
      <StageTimeline
        currentStage={progress.stage}
        totalImages={progress.totalImages}
        totalChapters={progress.totalChapters}
        currentChapter={progress.currentChapter}
        chaptersCreated={progress.chaptersCreated}
        isComplete={isComplete}
      />
    </>
  );
}
