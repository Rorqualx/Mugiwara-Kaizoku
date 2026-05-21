/**
 * Thin download-progress strip rendered under each library poster card.
 *
 * Shows `downloaded / total ch` (or `vol`) with a gradient color
 * (red -> yellow -> green) mapped to the completion ratio. Clicking the
 * strip toggles between chapter and volume counts. Hidden when the manga
 * has zero chapters; click is a no-op when the manga has zero volumes.
 */

import React, { useState } from 'react';

import { Box, Progress, Text } from '@mantine/core';

type ProgressMode = 'chapters' | 'volumes';

interface MangaProgressBarProps {
  /** Number of chapters with downloadStatus === 'COMPLETED' */
  downloadedChapters: number;
  /** Total chapters known for the manga */
  totalChapters: number;
  /** Number of volumes whose chapters are all COMPLETED */
  downloadedVolumes: number;
  /** Total volumes known for the manga */
  totalVolumes: number;
  /** Card width in pixels, used to constrain the bar */
  width: number;
}

function pctColor(pct: number): string {
  if (pct >= 0.85) return 'green';
  if (pct >= 0.5) return 'lime';
  if (pct >= 0.25) return 'yellow';
  if (pct > 0) return 'orange';
  return 'red';
}

export function MangaProgressBar({
  downloadedChapters,
  totalChapters,
  downloadedVolumes,
  totalVolumes,
  width,
}: MangaProgressBarProps): React.ReactElement | null {
  const [mode, setMode] = useState<ProgressMode>('chapters');

  if (totalChapters === 0) return null;

  const canToggle = totalVolumes > 0;
  const showVolumes = mode === 'volumes' && canToggle;

  const downloaded = showVolumes ? downloadedVolumes : downloadedChapters;
  const total = showVolumes ? totalVolumes : totalChapters;
  const unit = showVolumes ? 'vol' : 'ch';

  const pct = total === 0 ? 0 : downloaded / total;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
    if (!canToggle) return;
    setMode((m) => (m === 'chapters' ? 'volumes' : 'chapters'));
  };

  return (
    <Box
      onClick={handleClick}
      style={{
        maxWidth: width,
        width: '100%',
        cursor: canToggle ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      mt={4}
      title={canToggle ? 'Click to switch chapters / volumes' : undefined}
    >
      <Progress value={pct * 100} color={pctColor(pct)} size="sm" radius="xs" />
      <Text size="xs" fw={500} ta="center" mt={2}>
        {downloaded} / {total} {unit}
      </Text>
    </Box>
  );
}
