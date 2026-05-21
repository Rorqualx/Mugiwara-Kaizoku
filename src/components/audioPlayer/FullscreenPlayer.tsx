/**
 * FullscreenPlayer Component
 *
 * Expanded audio player with full cover art and controls.
 * Includes chapter navigation, bookmarks, and sleep timer access.
 *
 * @module components/audioPlayer/FullscreenPlayer
 */

import { memo, useCallback, useState } from 'react';

import {
  ActionIcon,
  BackgroundImage,
  Box,
  Center,
  Group,
  Image,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconBookmark,
  IconChevronDown,
  IconList,
  IconMoon,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
} from '@tabler/icons-react';

import { useBreakpoint, useSwipeGesture } from '@/hooks/mobile';
import type { PlaybackSpeed } from '@/types/audioPlayer';

import { useAudioPlayerContext } from './AudioPlayerProvider';
import { ProgressSlider } from './controls/ProgressSlider';
import { SkipControls } from './controls/SkipControls';
import { SpeedControl } from './controls/SpeedControl';
import { HorizontalVolumeControl } from './controls/VolumeControl';



// ============================================================================
// Types
// ============================================================================

export interface FullscreenPlayerProps {
  /** Whether the player is open */
  opened: boolean;
  /** Callback to close the player */
  onClose: () => void;
  /** Callback when chapters button is clicked */
  onOpenChapters?: () => void;
  /** Callback when bookmarks button is clicked */
  onOpenBookmarks?: () => void;
  /** Callback when sleep timer button is clicked */
  onOpenSleepTimer?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format time in seconds to MM:SS or HH:MM:SS format
 */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// Component
// ============================================================================

// eslint-disable-next-line max-lines-per-function, complexity -- Media player UI with integrated controls, gestures, and responsive layout
function FullscreenPlayerComponent({
  opened,
  onClose,
  onOpenChapters,
  onOpenBookmarks,
  onOpenSleepTimer,
}: FullscreenPlayerProps): JSX.Element {
  const { player, sleepTimer } = useAudioPlayerContext();
  const { isMobile } = useBreakpoint();

  // Swipe down to minimize on mobile
  const { handlers: swipeHandlers } = useSwipeGesture({
    onSwipeDown: onClose,
    threshold: 50,
    preventDefault: false,
  });

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackSpeed,
    play,
    pause,
    seek,
    skipForward,
    skipBackward,
    setVolume,
    toggleMute,
    setPlaybackSpeed,
    nextChapter,
    previousChapter,
    // goToChapter - available but not currently used
  } = player;

  const { isActive: sleepTimerActive, timeRemaining: sleepTimerRemaining } = sleepTimer;

  // Get chapters from current track
  const chapters = currentTrack?.chapters ?? [];
  // Calculate current chapter index based on currentTime
  const currentChapterIndex = chapters.findIndex((chapter, index) => {
    const nextChapter = chapters[index + 1];
    const chapterStart = chapter.startTime;
    const chapterEnd = nextChapter?.startTime ?? duration;
    return currentTime >= chapterStart && currentTime < chapterEnd;
  });

  // Local state for hover effects
  const [isHoveringArt, setIsHoveringArt] = useState(false);

  // Handle play/pause toggle
  const handlePlayPause = useCallback((): void => {
    if (isPlaying) {
      pause();
    } else {
      void play();
    }
  }, [isPlaying, play, pause]);

  // Handle seek
  const handleSeek = useCallback(
    (time: number): void => {
      seek(time);
    },
    [seek]
  );

  // Handle volume change
  const handleVolumeChange = useCallback(
    (newVolume: number): void => {
      setVolume(newVolume);
    },
    [setVolume]
  );

  // Handle speed change
  const handleSpeedChange = useCallback(
    (speed: PlaybackSpeed): void => {
      setPlaybackSpeed(speed);
    },
    [setPlaybackSpeed]
  );

  // Handle skip controls
  const handleSkipBackward = useCallback((): void => {
    skipBackward(10);
  }, [skipBackward]);

  const handleSkipForward = useCallback((): void => {
    skipForward(30);
  }, [skipForward]);

  // Don't render content if no track
  if (!currentTrack) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        fullScreen
        withCloseButton={false}
        padding={0}
        styles={{
          body: { height: '100%' },
          content: { height: '100%' },
        }}
      >
        <Center h="100%">
          <Text c="dimmed">No track loaded</Text>
        </Center>
      </Modal>
    );
  }

  // Get current chapter info if available
  const currentChapter = chapters[currentChapterIndex];
  const hasChapters = chapters.length > 0;

  // Calculate progress percentage for the circle indicator
  const _progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      withCloseButton={false}
      padding={0}
      styles={{
        body: { height: '100%', display: 'flex', flexDirection: 'column' },
        content: { height: '100%' },
      }}
    >
      {/* Background with blurred cover art */}
      <BackgroundImage
        src={currentTrack.coverUrl ?? '/images/default-cover.png'}
        h="100%"
        style={{
          filter: 'blur(20px) brightness(0.3)',
          position: 'absolute',
          inset: 0,
          transform: 'scale(1.1)',
        }}
      />

      {/* Main content */}
      <Box
        pos="relative"
        h="100%"
        style={{
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        {...(isMobile && swipeHandlers)}
      >
        {/* Header with minimize button */}
        <Group justify="space-between" p="md">
          <ActionIcon
            variant="subtle"
            color="white"
            size="lg"
            radius="xl"
            onClick={onClose}
            aria-label="Minimize player"
          >
            <IconChevronDown size={24} />
          </ActionIcon>

          {/* Sleep timer indicator */}
          {sleepTimerActive && (
            <Paper px="sm" py={4} radius="xl" bg="rgba(255,255,255,0.2)">
              <Group gap={6}>
                <IconMoon size={14} />
                <Text size="xs" c="white">
                  {formatTime(sleepTimerRemaining ?? 0)}
                </Text>
              </Group>
            </Paper>
          )}

          <Box w={40} /> {/* Spacer for alignment */}
        </Group>

        {/* Cover art section */}
        <Center flex={1} p="xl">
          <Box
            pos="relative"
            onMouseEnter={() => setIsHoveringArt(true)}
            onMouseLeave={() => setIsHoveringArt(false)}
            style={{ cursor: 'pointer' }}
            onClick={handlePlayPause}
          >
            <Image
              src={currentTrack.coverUrl ?? '/images/default-cover.png'}
              alt={currentTrack.title}
              w={280}
              h={280}
              radius="lg"
              fit="cover"
              style={{
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                transition: 'transform 0.2s ease',
                transform: isHoveringArt ? 'scale(1.02)' : 'scale(1)',
              }}
            />

            {/* Play/pause overlay on hover */}
            {isHoveringArt && (
              <Center
                pos="absolute"
                inset={0}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: 'var(--mantine-radius-lg)',
                }}
              >
                <ActionIcon variant="filled" color="white" size={60} radius="xl">
                  {isPlaying ? <IconPlayerPause size={32} /> : <IconPlayerPlay size={32} />}
                </ActionIcon>
              </Center>
            )}
          </Box>
        </Center>

        {/* Track info */}
        <Stack gap="xs" px="xl" align="center">
          <Title order={4} c="white" ta="center" lineClamp={1}>
            {currentTrack.title}
          </Title>
          {currentTrack.artist && (
            <Text size="sm" c="dimmed" ta="center" lineClamp={1}>
              {currentTrack.artist}
            </Text>
          )}
          {currentChapter && (
            <Text size="xs" c="dimmed" ta="center">
              Chapter {currentChapterIndex + 1}: {currentChapter.title}
            </Text>
          )}
        </Stack>

        {/* Progress slider */}
        <Box px="xl" py="md">
          <ProgressSlider
            currentTime={currentTime}
            duration={duration}
            bufferedTime={0}
            onSeek={handleSeek}
            showTimes
          />
        </Box>

        {/* Main controls */}
        <Group justify="center" gap="lg" py="md">
          {/* Previous chapter (if available) */}
          <ActionIcon
            variant="subtle"
            color="white"
            size="xl"
            radius="xl"
            onClick={previousChapter}
            disabled={!hasChapters || currentChapterIndex === 0}
            aria-label="Previous chapter"
          >
            <IconPlayerTrackPrev size={24} />
          </ActionIcon>

          {/* Skip backward */}
          <SkipControls
            onSkipBackward={handleSkipBackward}
            onSkipForward={handleSkipForward}
            skipBackwardSeconds={10}
            skipForwardSeconds={30}
            size="lg"
          />

          {/* Play/Pause button */}
          <ActionIcon
            variant="filled"
            color="blue"
            size={64}
            radius="xl"
            onClick={handlePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <IconPlayerPause size={32} /> : <IconPlayerPlay size={32} />}
          </ActionIcon>

          {/* Next chapter (if available) */}
          <ActionIcon
            variant="subtle"
            color="white"
            size="xl"
            radius="xl"
            onClick={nextChapter}
            disabled={!hasChapters || currentChapterIndex >= chapters.length - 1}
            aria-label="Next chapter"
          >
            <IconPlayerTrackNext size={24} />
          </ActionIcon>
        </Group>

        {/* Secondary controls */}
        <Group justify="center" gap="md" pb="md">
          {/* Hide volume on mobile - use device volume instead */}
          {!isMobile && (
            <HorizontalVolumeControl
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
            />
          )}
          <SpeedControl speed={playbackSpeed as PlaybackSpeed} onSpeedChange={handleSpeedChange} />
        </Group>

        {/* Feature buttons */}
        <Group justify="center" gap="lg" pb="xl" px="md">
          {/* Sleep Timer */}
          {onOpenSleepTimer && (
            <ActionIcon
              variant="subtle"
              color={sleepTimerActive ? 'blue' : 'gray'}
              size="lg"
              radius="xl"
              onClick={onOpenSleepTimer}
              aria-label="Sleep timer"
            >
              <IconMoon size={20} />
            </ActionIcon>
          )}

          {/* Chapters */}
          {onOpenChapters && hasChapters && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              radius="xl"
              onClick={onOpenChapters}
              aria-label="Chapters"
            >
              <IconList size={20} />
            </ActionIcon>
          )}

          {/* Bookmarks */}
          {onOpenBookmarks && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              radius="xl"
              onClick={onOpenBookmarks}
              aria-label="Bookmarks"
            >
              <IconBookmark size={20} />
            </ActionIcon>
          )}
        </Group>
      </Box>
    </Modal>
  );
}

export const FullscreenPlayer = memo(FullscreenPlayerComponent);
export default FullscreenPlayer;
