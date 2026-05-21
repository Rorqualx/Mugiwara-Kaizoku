/**
 * SkipControls Component
 *
 * Forward/backward skip buttons with configurable intervals.
 * Shows skip duration on button.
 *
 * @module components/audioPlayer/controls/SkipControls
 */

import { memo } from 'react';

import { ActionIcon, Box, Text } from '@mantine/core';
import { IconRewindBackward10, IconRewindForward30 } from '@tabler/icons-react';

// ============================================================================
// Types
// ============================================================================

export interface SkipControlsProps {
  /** Skip backward callback */
  onSkipBackward: () => void;
  /** Skip forward callback */
  onSkipForward: () => void;
  /** Backward skip seconds (for display) */
  skipBackwardSeconds?: number;
  /** Forward skip seconds (for display) */
  skipForwardSeconds?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show duration labels */
  showLabels?: boolean;
}

// ============================================================================
// Size Configuration
// ============================================================================

const SIZE_CONFIG = {
  sm: {
    button: 'lg' as const,
    icon: 18,
    labelSize: 'xs' as const,
  },
  md: {
    button: 'xl' as const,
    icon: 22,
    labelSize: 'xs' as const,
  },
  lg: {
    button: 48,
    icon: 28,
    labelSize: 'sm' as const,
  },
} as const;

// ============================================================================
// Component
// ============================================================================

function SkipControlsComponent({
  onSkipBackward,
  onSkipForward,
  skipBackwardSeconds = 10,
  skipForwardSeconds = 30,
  size = 'md',
  showLabels = false,
}: SkipControlsProps): JSX.Element {
  const config = SIZE_CONFIG[size];

  return (
    <>
      {/* Skip Backward */}
      <Box pos="relative" style={{ display: 'inline-flex' }}>
        <ActionIcon
          variant="subtle"
          color="gray"
          size={config.button}
          radius="xl"
          onClick={onSkipBackward}
          aria-label={`Skip back ${skipBackwardSeconds} seconds`}
        >
          <IconRewindBackward10 size={config.icon} />
        </ActionIcon>
        {showLabels && (
          <Text
            size={config.labelSize}
            c="dimmed"
            pos="absolute"
            bottom={-16}
            left="50%"
            style={{ transform: 'translateX(-50%)' }}
          >
            {skipBackwardSeconds}s
          </Text>
        )}
      </Box>

      {/* Skip Forward */}
      <Box pos="relative" style={{ display: 'inline-flex' }}>
        <ActionIcon
          variant="subtle"
          color="gray"
          size={config.button}
          radius="xl"
          onClick={onSkipForward}
          aria-label={`Skip forward ${skipForwardSeconds} seconds`}
        >
          <IconRewindForward30 size={config.icon} />
        </ActionIcon>
        {showLabels && (
          <Text
            size={config.labelSize}
            c="dimmed"
            pos="absolute"
            bottom={-16}
            left="50%"
            style={{ transform: 'translateX(-50%)' }}
          >
            {skipForwardSeconds}s
          </Text>
        )}
      </Box>
    </>
  );
}

export const SkipControls = memo(SkipControlsComponent);
export default SkipControls;
