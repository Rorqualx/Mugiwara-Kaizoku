/**
 * MiniPlayer Component
 *
 * Persistent bottom bar audio player.
 * Shows current track, progress, and basic controls.
 * Tap anywhere to expand to fullscreen.
 * Swipe up on mobile to expand.
 *
 * @module components/audioPlayer/MiniPlayer
 */

import { memo, useCallback } from 'react';

import { ActionIcon, Box, Group, Image, Paper, Progress, Stack, Text } from '@mantine/core';
import { IconPlayerPause, IconPlayerPlay, IconX } from '@tabler/icons-react';

import { useBreakpoint, useSwipeGesture } from '@/hooks/mobile';

import { useAudioPlayerContext } from './AudioPlayerProvider';

// ============================================================================
// Types
// ============================================================================

export interface MiniPlayerProps {
  /** Callback when player is tapped/clicked to expand */
  onExpand?: () => void;
  /** Z-index for positioning */
  zIndex?: number;
}

// ============================================================================
// Component
// ============================================================================

function MiniPlayerComponent({ onExpand, zIndex = 100 }: MiniPlayerProps): JSX.Element | null {
  const { player } = useAudioPlayerContext();
  const { isMobile } = useBreakpoint();

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    stop,
  } = player;

  // Swipe up gesture to expand player on mobile
  // Only configure swipe if onExpand is provided
  const { handlers: swipeHandlers } = useSwipeGesture(
    onExpand
      ? {
          onSwipeUp: onExpand,
          threshold: 30,
          preventDefault: false,
        }
      : {
          threshold: 30,
          preventDefault: false,
        }
  );

  // Handle play/pause toggle - defined before early return to satisfy rules-of-hooks
  const handlePlayPause = useCallback(
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      if (isPlaying) {
        pause();
      } else {
        void play();
      }
    },
    [isPlaying, play, pause]
  );

  // Handle stop/close - defined before early return to satisfy rules-of-hooks
  const handleClose = useCallback(
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      stop();
    },
    [stop]
  );

  // Don't render if no track is loaded
  if (!currentTrack) {
    return null;
  }

  // Calculate bottom offset for mobile navigation (56px + safe area)
  const bottomOffset = isMobile ? 'calc(56px + env(safe-area-inset-bottom, 0px))' : '0px';

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Paper
      pos="fixed"
      bottom={bottomOffset}
      left={0}
      right={0}
      shadow="md"
      style={{
        zIndex,
        paddingBottom: 'env(safe-area-inset-bottom)',
        cursor: 'pointer',
        touchAction: 'pan-x', // Allow horizontal scroll, capture vertical for swipe
      }}
      onClick={onExpand}
      {...(isMobile && swipeHandlers)}
    >
      {/* Progress bar at top of mini player */}
      <Progress
        value={progress}
        size={3}
        radius={0}
        color="blue"
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      />

      <Box p="xs" pt="sm">
        <Group justify="space-between" wrap="nowrap">
          {/* Track Info */}
          <Group gap="sm" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
            {/* Cover Art */}
            {currentTrack.coverUrl && (
              <Image
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                w={40}
                h={40}
                radius="sm"
                fit="cover"
              />
            )}

            {/* Title & Artist */}
            <Stack gap={2} style={{ flex: 1, overflow: 'hidden' }}>
              <Text size="sm" fw={500} truncate>
                {currentTrack.title}
              </Text>
              {currentTrack.artist && (
                <Text size="xs" c="dimmed" truncate>
                  {currentTrack.artist}
                </Text>
              )}
            </Stack>
          </Group>

          {/* Controls */}
          <Group gap="xs" wrap="nowrap">
            {/* Play/Pause Button */}
            <ActionIcon
              variant="filled"
              color="blue"
              size="lg"
              radius="xl"
              onClick={handlePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}
            </ActionIcon>

            {/* Close Button */}
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              radius="xl"
              onClick={handleClose}
              aria-label="Close player"
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>
    </Paper>
  );
}

export const MiniPlayer = memo(MiniPlayerComponent);
export default MiniPlayer;
