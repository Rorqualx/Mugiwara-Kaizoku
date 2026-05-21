/**
 * VolumeControl Component
 *
 * Volume slider with mute toggle.
 * Compact design with expandable slider on hover/focus.
 *
 * @module components/audioPlayer/controls/VolumeControl
 */

import { memo, useCallback, useState } from 'react';

import { ActionIcon, Box, Group, Popover, Slider, Stack, Text } from '@mantine/core';
import { IconVolume, IconVolumeOff } from '@tabler/icons-react';

import type { VolumeControlProps } from '@/types/audioPlayer';

// ============================================================================
// Component
// ============================================================================

function VolumeControlComponent({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}: VolumeControlProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  // Get appropriate volume icon based on level
  const getVolumeIcon = useCallback((): JSX.Element => {
    if (isMuted || volume === 0) {
      return <IconVolumeOff size={20} />;
    }
    // Use same icon for all volume levels since IconVolume2/3 don't exist
    return <IconVolume size={20} />;
  }, [volume, isMuted]);

  // Handle volume slider change
  const handleVolumeChange = useCallback(
    (value: number): void => {
      onVolumeChange(value / 100);
    },
    [onVolumeChange]
  );

  // Display volume percentage
  const displayVolume = isMuted ? 0 : Math.round(volume * 100);

  return (
    <Popover
      opened={isOpen}
      onChange={setIsOpen}
      position="top"
      withArrow
      shadow="md"
      trapFocus={false}
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          radius="xl"
          onClick={onToggleMute}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {getVolumeIcon()}
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown
        p="sm"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <Stack gap="xs" align="center" w={40}>
          <Text size="xs" c="dimmed" ta="center">
            {displayVolume}%
          </Text>
          {/* Use rotated horizontal slider for vertical appearance */}
          <Box
            h={100}
            w={40}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              style={{
                transform: 'rotate(-90deg)',
                width: 100,
              }}
            >
              <Slider
                value={displayVolume}
                onChange={handleVolumeChange}
                min={0}
                max={100}
                step={1}
                size="sm"
                label={null}
                styles={{
                  thumb: {
                    width: 12,
                    height: 12,
                  },
                }}
              />
            </Box>
          </Box>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/**
 * Horizontal volume control for fullscreen player
 */
function HorizontalVolumeControlComponent({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}: VolumeControlProps): JSX.Element {
  // Get appropriate volume icon based on level
  const getVolumeIcon = useCallback((): JSX.Element => {
    if (isMuted || volume === 0) {
      return <IconVolumeOff size={20} />;
    }
    return <IconVolume size={20} />;
  }, [volume, isMuted]);

  // Handle volume slider change
  const handleVolumeChange = useCallback(
    (value: number): void => {
      onVolumeChange(value / 100);
    },
    [onVolumeChange]
  );

  // Display volume percentage
  const displayVolume = isMuted ? 0 : Math.round(volume * 100);

  return (
    <Group gap="xs" wrap="nowrap">
      <ActionIcon
        variant="subtle"
        color="gray"
        size="md"
        radius="xl"
        onClick={onToggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {getVolumeIcon()}
      </ActionIcon>
      <Slider
        value={displayVolume}
        onChange={handleVolumeChange}
        min={0}
        max={100}
        step={1}
        w={100}
        size="sm"
        label={null}
        styles={{
          thumb: {
            width: 12,
            height: 12,
          },
        }}
      />
    </Group>
  );
}

export const VolumeControl = memo(VolumeControlComponent);
export const HorizontalVolumeControl = memo(HorizontalVolumeControlComponent);
export default VolumeControl;
