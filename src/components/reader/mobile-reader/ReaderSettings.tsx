/**
 * Reader Settings Modal Component
 *
 * Modal for configuring reading mode, direction, and zoom settings.
 *
 * Extracted from: MobileReader.tsx
 */

import React from 'react';

import { Modal, Stack, Box, Text, Button, Group, Slider } from '@mantine/core';
import { IconChevronDown, IconDeviceMobile, IconBook } from '@tabler/icons-react';

import type { ReaderSettingsProps } from './types';

/**
 * Settings modal for the mobile reader
 *
 * Provides controls for:
 * - Reading mode (vertical scroll, single page, double page)
 * - Reading direction (left-to-right, right-to-left)
 * - Default zoom level
 */
export function ReaderSettings({
  opened,
  onClose,
  mode,
  direction,
  zoom,
  onModeChange,
  onDirectionChange,
  onZoomChange
}: ReaderSettingsProps): React.ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Reader Settings"
      centered>

      <Stack gap="md">
        {/* Reading mode selection */}
        <Box>
          <Text size="sm" fw={500} mb="xs">Reading Mode</Text>
          <Stack gap="xs">
            <Button
              variant={mode === 'vertical' ? 'filled' : 'light'}
              onClick={() => { onModeChange('vertical'); }}
              leftSection={<IconChevronDown size={16} />}>

              Vertical Scroll
            </Button>
            <Button
              variant={mode === 'single' ? 'filled' : 'light'}
              onClick={() => { onModeChange('single'); }}
              leftSection={<IconDeviceMobile size={16} />}>

              Single Page
            </Button>
            <Button
              variant={mode === 'double' ? 'filled' : 'light'}
              onClick={() => { onModeChange('double'); }}
              leftSection={<IconBook size={16} />}>

              Double Page
            </Button>
          </Stack>
        </Box>

        {/* Reading direction */}
        <Box>
          <Text size="sm" fw={500} mb="xs">Reading Direction</Text>
          <Group>
            <Button
              variant={direction === 'ltr' ? 'filled' : 'light'}
              onClick={() => { onDirectionChange('ltr'); }}>

              Left to Right
            </Button>
            <Button
              variant={direction === 'rtl' ? 'filled' : 'light'}
              onClick={() => { onDirectionChange('rtl'); }}>

              Right to Left
            </Button>
          </Group>
        </Box>

        {/* Zoom control */}
        <Box>
          <Text size="sm" fw={500} mb="xs">Default Zoom</Text>
          <Slider
            value={zoom}
            onChange={onZoomChange}
            min={0.5}
            max={3}
            step={0.25}
            marks={[
              { value: 0.5, label: '50%' },
              { value: 1, label: '100%' },
              { value: 2, label: '200%' },
              { value: 3, label: '300%' }
            ]} />

        </Box>
      </Stack>
    </Modal>
  );
}
