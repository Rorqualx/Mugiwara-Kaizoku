/**
 * Footer Controls Component
 *
 * Displays reader footer with page navigation, slider, and zoom controls.
 * Auto-hides with main reader controls.
 */

import React from 'react';

import { Box, Stack, Group, Text, ActionIcon, Slider } from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconZoomIn,
  IconZoomOut
} from '@tabler/icons-react';

export interface FooterControlsProps {
  currentPage: number;
  totalPages: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  zoom: number;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onPageChange: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  customFooter?: React.ReactNode;
}

export function FooterControls({
  currentPage,
  totalPages,
  canGoPrev,
  canGoNext,
  zoom,
  onNavigatePrev,
  onNavigateNext,
  onPageChange,
  onZoomIn,
  onZoomOut,
  customFooter
}: FooterControlsProps): React.ReactElement {
  return (
    <Box
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
        padding: 'md',
        zIndex: 10
      }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}>

      {customFooter ??
        <Stack gap="sm">
          <Group justify="space-between">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={onNavigatePrev}
              disabled={!canGoPrev}>
              <IconArrowLeft size={24} />
            </ActionIcon>

            <Text c="white" size="sm">
              {currentPage + 1} / {totalPages}
            </Text>

            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={onNavigateNext}
              disabled={!canGoNext}>
              <IconArrowRight size={24} />
            </ActionIcon>
          </Group>

          <Slider
            value={currentPage}
            onChange={onPageChange}
            min={0}
            max={totalPages - 1}
            step={1}
            marks={[
              { value: 0 },
              { value: Math.floor(totalPages / 2) },
              { value: totalPages - 1 }
            ]}
            styles={{
              track: { backgroundColor: 'rgba(255,255,255,0.2)' },
              bar: { backgroundColor: 'white' },
              thumb: { backgroundColor: 'white', borderColor: 'white' }
            }} />

          <Group justify="center" gap="xs">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onZoomOut}
              disabled={zoom <= 0.5}>
              <IconZoomOut size={20} />
            </ActionIcon>

            <Text c="white" size="xs" style={{ minWidth: 50, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </Text>

            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onZoomIn}
              disabled={zoom >= 3}>
              <IconZoomIn size={20} />
            </ActionIcon>
          </Group>
        </Stack>
      }
    </Box>
  );
}
