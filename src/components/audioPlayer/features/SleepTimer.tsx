/**
 * SleepTimer Component
 *
 * Modal for setting sleep timer with preset options.
 * Includes volume fade before pause.
 *
 * @module components/audioPlayer/features/SleepTimer
 */

import { memo, useCallback } from 'react';

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconMoon, IconX } from '@tabler/icons-react';

import { useAudioPlayerContext } from '../AudioPlayerProvider';

// ============================================================================
// Types
// ============================================================================

export interface SleepTimerProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback to close the modal */
  onClose: () => void;
}

// ============================================================================
// Types
// ============================================================================

interface SleepTimerOption {
  label: string;
  minutes: number;
}

// ============================================================================
// Constants
// ============================================================================

const SLEEP_TIMER_OPTIONS: SleepTimerOption[] = [
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
  { label: '90 min', minutes: 90 },
  { label: '2 hours', minutes: 120 },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format remaining time in MM:SS or HH:MM:SS format
 */
function formatTimeRemaining(seconds: number): string {
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

function SleepTimerComponent({ opened, onClose }: SleepTimerProps): JSX.Element {
  const { sleepTimer, player } = useAudioPlayerContext();
  const { isActive, timeRemaining, setSleepTimer, cancelSleepTimer } = sleepTimer;
  const { currentTrack } = player;

  // Check if current track has chapters (for "End of chapter" option)
  const hasChapters = (currentTrack?.chapters?.length ?? 0) > 0; // eslint-disable-line @typescript-eslint/no-unnecessary-condition

  // Handle setting timer
  const handleSetTimer = useCallback(
    (minutes: number): void => {
      setSleepTimer(minutes);
      onClose();
    },
    [setSleepTimer, onClose]
  );

  // Handle setting timer to end of chapter
  const handleSetEndOfChapter = useCallback((): void => {
    setSleepTimer('chapter');
    onClose();
  }, [setSleepTimer, onClose]);

  // Handle canceling timer
  const handleCancelTimer = useCallback((): void => {
    cancelSleepTimer();
  }, [cancelSleepTimer]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconMoon size={20} />
          <Title order={4}>Sleep Timer</Title>
        </Group>
      }
      centered
      size="sm"
    >
      <Stack gap="md">
        {/* Active timer display */}
        {isActive && (
          <Group
            justify="space-between"
            p="md"
            style={{
              backgroundColor: 'var(--mantine-color-blue-light)',
              borderRadius: 'var(--mantine-radius-md)',
            }}
          >
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                Timer active
              </Text>
              <Text size="xl" fw={600}>
                {formatTimeRemaining(timeRemaining ?? 0)}
              </Text>
            </Stack>
            <ActionIcon
              variant="subtle"
              color="red"
              size="lg"
              onClick={handleCancelTimer}
              aria-label="Cancel timer"
            >
              <IconX size={20} />
            </ActionIcon>
          </Group>
        )}

        {/* Timer options grid */}
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Set timer duration
          </Text>
          <SimpleGrid cols={4} spacing="xs">
            {SLEEP_TIMER_OPTIONS.map((option) => (
              <Button
                key={option.minutes}
                variant="light"
                size="sm"
                onClick={() => handleSetTimer(option.minutes)}
              >
                {option.label}
              </Button>
            ))}
          </SimpleGrid>
        </Stack>

        {/* End of chapter option */}
        {hasChapters && (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Or stop at
            </Text>
            <Button
              variant="outline"
              leftSection={<Badge size="xs">Chapter</Badge>}
              onClick={handleSetEndOfChapter}
            >
              End of current chapter
            </Button>
          </Stack>
        )}

        {/* Info text */}
        <Text size="xs" c="dimmed" ta="center">
          Volume will fade out before pausing
        </Text>
      </Stack>
    </Modal>
  );
}

export const SleepTimer = memo(SleepTimerComponent);
export default SleepTimer;
