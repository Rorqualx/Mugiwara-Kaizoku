/**
 * PlaybackControls Component
 *
 * Core playback controls including play/pause, previous/next.
 * Supports multiple sizes for different contexts.
 *
 * @module components/audioPlayer/controls/PlaybackControls
 */

import { memo, useCallback } from 'react';

import { ActionIcon, Group, Loader, rem } from '@mantine/core';
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
} from '@tabler/icons-react';

import type { PlaybackControlsProps } from '@/types/audioPlayer';

// ============================================================================
// Size Configuration
// ============================================================================

const SIZE_CONFIG = {
  sm: {
    button: rem(36),
    mainButton: rem(40),
    icon: rem(16),
    mainIcon: rem(20),
    gap: 'xs' as const,
  },
  md: {
    button: rem(44),
    mainButton: rem(56),
    icon: rem(20),
    mainIcon: rem(28),
    gap: 'sm' as const,
  },
  lg: {
    button: rem(52),
    mainButton: rem(72),
    icon: rem(24),
    mainIcon: rem(36),
    gap: 'md' as const,
  },
} as const;

// ============================================================================
// Component
// ============================================================================

function PlaybackControlsComponent({
  isPlaying,
  isLoading = false,
  onPlay,
  onPause,
  onSkipForward,
  onSkipBackward,
  onPrevious,
  onNext,
  size = 'md',
}: PlaybackControlsProps): JSX.Element {
  const config = SIZE_CONFIG[size];

  // Handle play/pause toggle
  const handlePlayPause = useCallback((): void => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }, [isPlaying, onPlay, onPause]);

  return (
    <Group gap={config.gap} justify="center" wrap="nowrap">
      {/* Previous / Skip Back */}
      {onPrevious ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          size={config.button}
          radius="xl"
          onClick={onPrevious}
          aria-label="Previous track"
        >
          <IconPlayerSkipBack size={config.icon} />
        </ActionIcon>
      ) : onSkipBackward ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          size={config.button}
          radius="xl"
          onClick={onSkipBackward}
          aria-label="Skip backward"
        >
          <IconPlayerSkipBack size={config.icon} />
        </ActionIcon>
      ) : null}

      {/* Play/Pause Button */}
      <ActionIcon
        variant="filled"
        color="blue"
        size={config.mainButton}
        radius="xl"
        onClick={handlePlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader size={config.mainIcon} color="white" />
        ) : isPlaying ? (
          <IconPlayerPause size={config.mainIcon} fill="currentColor" />
        ) : (
          <IconPlayerPlay size={config.mainIcon} fill="currentColor" />
        )}
      </ActionIcon>

      {/* Next / Skip Forward */}
      {onNext ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          size={config.button}
          radius="xl"
          onClick={onNext}
          aria-label="Next track"
        >
          <IconPlayerSkipForward size={config.icon} />
        </ActionIcon>
      ) : onSkipForward ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          size={config.button}
          radius="xl"
          onClick={onSkipForward}
          aria-label="Skip forward"
        >
          <IconPlayerSkipForward size={config.icon} />
        </ActionIcon>
      ) : null}
    </Group>
  );
}

export const PlaybackControls = memo(PlaybackControlsComponent);
export default PlaybackControls;
