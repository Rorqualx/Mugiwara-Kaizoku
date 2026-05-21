/**
 * SpeedControl Component
 *
 * Playback speed selector with preset options.
 * Shows current speed as button text.
 *
 * @module components/audioPlayer/controls/SpeedControl
 */

import { memo, useCallback } from 'react';

import { Button, Menu, Text } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

import type { PlaybackSpeed, SpeedControlProps } from '@/types/audioPlayer';

// ============================================================================
// Constants
// ============================================================================

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

const SPEED_LABELS: Record<PlaybackSpeed, string> = {
  0.5: '0.5x',
  0.75: '0.75x',
  1: '1x',
  1.25: '1.25x',
  1.5: '1.5x',
  1.75: '1.75x',
  2: '2x',
  2.5: '2.5x',
  3: '3x',
};

// ============================================================================
// Component
// ============================================================================

function SpeedControlComponent({ speed, onSpeedChange }: SpeedControlProps): JSX.Element {
  // Handle speed selection
  const handleSpeedSelect = useCallback(
    (newSpeed: PlaybackSpeed) => (): void => {
      onSpeedChange(newSpeed);
    },
    [onSpeedChange]
  );

  return (
    <Menu position="top" withArrow shadow="md">
      <Menu.Target>
        <Button
          variant="subtle"
          color="gray"
          size="compact-sm"
          rightSection={<IconChevronDown size={14} />}
          aria-label="Playback speed"
        >
          <Text size="sm" fw={500}>
            {SPEED_LABELS[speed]}
          </Text>
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Playback Speed</Menu.Label>
        {SPEED_OPTIONS.map((option) => (
          <Menu.Item
            key={option}
            onClick={handleSpeedSelect(option)}
            fw={speed === option ? 600 : 400}
            {...(speed === option ? { c: 'blue' } : {})}
          >
            {SPEED_LABELS[option]}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export const SpeedControl = memo(SpeedControlComponent);
export default SpeedControl;
