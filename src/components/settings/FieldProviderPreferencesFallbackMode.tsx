/**
 * Field Provider Preferences Fallback Mode
 *
 * Toggle to select how fallback providers are selected when the
 * primary provider doesn't have data for a field:
 * - Priority Order: Use 2nd, 3rd, 4th priority in order
 * - Confidence Based: Use provider with highest match confidence
 */
import React, { JSX } from 'react';

import { Paper, Group, Stack, Text, SegmentedControl, Tooltip } from '@mantine/core';
import { IconArrowsSort, IconChartBar, IconInfoCircle } from '@tabler/icons-react';

import type { FallbackMode } from '@/types/search.types';

// Re-export for convenience
export type { FallbackMode };

interface FieldProviderPreferencesFallbackModeProps {
  mode: FallbackMode;
  onChange: (mode: FallbackMode) => void;
  disabled?: boolean;
}

export function FieldProviderPreferencesFallbackMode({
  mode,
  onChange,
  disabled = false
}: FieldProviderPreferencesFallbackModeProps): JSX.Element {
  return (
    <Paper p="md" withBorder bg="gray.0" style={{ borderColor: 'var(--mantine-color-gray-3)' }}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="xs">
              <IconArrowsSort size={20} color="var(--mantine-color-gray-6)" />
              <Text fw={600} size="sm">Fallback Provider Selection</Text>
              <Tooltip
                label="When your 1st priority provider doesn't have data for a field, this setting controls how the fallback provider is chosen."
                position="top"
                withArrow
                multiline
                w={300}
              >
                <IconInfoCircle size={16} color="var(--mantine-color-gray-5)" style={{ cursor: 'help' }} />
              </Tooltip>
            </Group>
            <Text size="xs" c="dimmed">
              How to select fallback when 1st priority has no data
            </Text>
          </Stack>
        </Group>

        <SegmentedControl
          value={mode}
          onChange={(value) => onChange(value as FallbackMode)}
          disabled={disabled}
          fullWidth
          data={[
            {
              value: 'priority',
              label: (
                <Group gap="xs" justify="center">
                  <IconArrowsSort size={16} />
                  <Text size="sm">Priority Order (2→3→4)</Text>
                </Group>
              )
            },
            {
              value: 'confidence',
              label: (
                <Group gap="xs" justify="center">
                  <IconChartBar size={16} />
                  <Text size="sm">Highest Confidence</Text>
                </Group>
              )
            }
          ]}
        />

        <Text size="xs" c="dimmed">
          {mode === 'priority'
            ? 'Fallback follows the priority order you set above (2nd, 3rd, 4th priority).'
            : 'Fallback uses whichever remaining provider has the highest match confidence score.'}
        </Text>
      </Stack>
    </Paper>
  );
}
