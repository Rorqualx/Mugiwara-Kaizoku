/**
 * ChapterList Component
 *
 * Modal displaying chapter navigation for audiobooks.
 * Allows jumping to specific chapters with duration info.
 *
 * @module components/audioPlayer/features/ChapterList
 */

import { memo, useCallback, useRef, useEffect } from 'react';

import {
  ActionIcon,
  Box,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconList, IconPlayerPlay } from '@tabler/icons-react';

import type { AudioTrackChapter } from '@/types/audioPlayer';

import { useAudioPlayerContext } from '../AudioPlayerProvider';


// ============================================================================
// Types
// ============================================================================

export interface ChapterListProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback to close the modal */
  onClose: () => void;
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

/**
 * Calculate chapter duration from start times
 */
function getChapterDuration(
  chapter: AudioTrackChapter,
  nextChapter: AudioTrackChapter | undefined,
  totalDuration: number
): number {
  const endTime = nextChapter?.startTime ?? totalDuration;
  return endTime - chapter.startTime;
}

// ============================================================================
// Chapter Item Component
// ============================================================================

interface ChapterItemProps {
  chapter: AudioTrackChapter;
  index: number;
  isActive: boolean;
  duration: number;
  onSelect: (index: number) => void;
}

function ChapterItem({
  chapter,
  index,
  isActive,
  duration,
  onSelect,
}: ChapterItemProps): JSX.Element {
  const itemRef = useRef<HTMLButtonElement>(null);

  // Scroll active chapter into view
  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive]);

  return (
    <UnstyledButton
      ref={itemRef}
      onClick={() => onSelect(index)}
      p="sm"
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        backgroundColor: isActive
          ? 'var(--mantine-color-blue-light)'
          : 'transparent',
        transition: 'background-color 0.2s ease',
      }}
      w="100%"
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
          {/* Chapter number */}
          <Box
            w={28}
            h={28}
            style={{
              borderRadius: '50%',
              backgroundColor: isActive
                ? 'var(--mantine-color-blue-filled)'
                : 'var(--mantine-color-gray-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isActive ? (
              <IconPlayerPlay size={14} color="white" />
            ) : (
              <Text size="xs" fw={500}>
                {index + 1}
              </Text>
            )}
          </Box>

          {/* Chapter title */}
          <Stack gap={2} style={{ flex: 1, overflow: 'hidden' }}>
            <Text size="sm" fw={isActive ? 600 : 400} truncate>
              {chapter.title}
            </Text>
            <Text size="xs" c="dimmed">
              {formatTime(chapter.startTime)} • {formatTime(duration)}
            </Text>
          </Stack>
        </Group>

        {/* Play indicator for active chapter */}
        {isActive && (
          <ActionIcon variant="transparent" color="blue" size="sm">
            <IconPlayerPlay size={16} />
          </ActionIcon>
        )}
      </Group>
    </UnstyledButton>
  );
}

// ============================================================================
// Component
// ============================================================================

function ChapterListComponent({ opened, onClose }: ChapterListProps): JSX.Element {
  const { player } = useAudioPlayerContext();
  const { currentTrack, currentTime, duration, goToChapter } = player;

  // Get chapters from current track
  const chapters = currentTrack?.chapters ?? [];

  // Calculate current chapter index
  const currentChapterIndex = chapters.findIndex((chapter, index) => {
    const nextChapter = chapters[index + 1];
    const chapterStart = chapter.startTime;
    const chapterEnd = nextChapter?.startTime ?? duration;
    return currentTime >= chapterStart && currentTime < chapterEnd;
  });

  // Handle chapter selection
  const handleSelectChapter = useCallback(
    (index: number): void => {
      goToChapter(index);
      onClose();
    },
    [goToChapter, onClose]
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconList size={20} />
          <Title order={4}>Chapters</Title>
        </Group>
      }
      centered
      size="md"
    >
      {chapters.length === 0 ? (
        <Stack align="center" py="xl">
          <IconList size={48} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed">No chapters available</Text>
        </Stack>
      ) : (
        <ScrollArea.Autosize mah={400} offsetScrollbars>
          <Stack gap="xs">
            {chapters.map((chapter, index) => (
              <ChapterItem
                key={chapter.index}
                chapter={chapter}
                index={index}
                isActive={index === currentChapterIndex}
                duration={getChapterDuration(chapter, chapters[index + 1], duration)}
                onSelect={handleSelectChapter}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}

      {/* Chapter count footer */}
      {chapters.length > 0 && (
        <Text size="xs" c="dimmed" ta="center" mt="md">
          {chapters.length} chapters • Total: {formatTime(duration)}
        </Text>
      )}
    </Modal>
  );
}

export const ChapterList = memo(ChapterListComponent);
export default ChapterList;
