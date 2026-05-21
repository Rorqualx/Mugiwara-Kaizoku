/**
 * ProgressSlider Component
 *
 * Audio progress/seek slider with time display.
 * Supports buffered time indicator and remaining time display.
 *
 * @module components/audioPlayer/controls/ProgressSlider
 */

import { memo, useCallback, useState } from 'react';

import { Box, Group, Slider, Text } from '@mantine/core';

import type { ProgressSliderProps } from '@/types/audioPlayer';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';

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

function ProgressSliderComponent({
  currentTime,
  duration,
  bufferedTime,
  onSeek,
  showTimes = true,
  showRemaining = false,
  disabled = false,
}: ProgressSliderProps): JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 && bufferedTime ? (bufferedTime / duration) * 100 : 0;

  // Display value (drag value while dragging, otherwise current progress)
  const displayValue = isDragging ? dragValue : progress;

  // Handle slider change
  const handleChange = useCallback((value: number): void => {
    setDragValue(value);
  }, []);

  // Handle drag start
  const handleChangeEnd = useCallback(
    (value: number): void => {
      const seekTime = (value / 100) * duration;
      onSeek(seekTime);
      setIsDragging(false);
    },
    [duration, onSeek]
  );

  // Handle drag start (mouse)
  const handleMouseDown = useCallback((): void => {
    setIsDragging(true);
    setDragValue(progress);
  }, [progress]);

  // Handle drag start (touch) - for mobile support
  const handleTouchStart = useCallback((): void => {
    setIsDragging(true);
    setDragValue(progress);
  }, [progress]);

  // Calculate displayed time
  const displayTime = isDragging ? (dragValue / 100) * duration : currentTime;
  const remainingTime = duration - displayTime;

  return (
    <Box w="100%">
      {/* Progress Slider */}
      <Box
        pos="relative"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ touchAction: 'none' }} // Prevent page scrolling during slider interaction
      >
        {/* Buffered Progress Background */}
        {bufferedTime !== undefined && bufferedProgress > 0 && (
          <Box
            pos="absolute"
            top="50%"
            left={0}
            h={4}
            w={`${Math.min(bufferedProgress, 100)}%`}
            bg="gray.4"
            style={{
              transform: 'translateY(-50%)',
              borderRadius: 4,
              zIndex: 0,
            }}
          />
        )}

        <Slider
          value={displayValue}
          onChange={handleChange}
          onChangeEnd={handleChangeEnd}
          min={0}
          max={100}
          step={0.1}
          disabled={disabled || duration <= 0}
          label={null}
          size="sm"
          styles={{
            root: {
              // Increase touch target area on mobile
              padding: '8px 0',
            },
            track: {
              backgroundColor: 'var(--mantine-color-gray-3)',
              // Slightly thicker track for better visibility
              height: 6,
            },
            bar: {
              backgroundColor: 'var(--mantine-color-blue-6)',
            },
            thumb: {
              // Larger thumb for easier touch targeting on mobile
              width: 16,
              height: 16,
              backgroundColor: 'var(--mantine-color-blue-6)',
              border: 'none',
              // Add touch-friendly hit area
              '&::before': {
                content: '""',
                position: 'absolute',
                top: -8,
                left: -8,
                right: -8,
                bottom: -8,
              },
            },
          }}
        />
      </Box>

      {/* Time Display */}
      {showTimes && (
        <Group justify="space-between" mt={4}>
          <Text size="xs" c="dimmed">
            {formatTime(displayTime)}
          </Text>
          <Text size="xs" c="dimmed">
            {showRemaining ? `-${formatTime(remainingTime)}` : formatTime(duration)}
          </Text>
        </Group>
      )}
    </Box>
  );
}

export const ProgressSlider = memo(ProgressSliderComponent);
export default ProgressSlider;
