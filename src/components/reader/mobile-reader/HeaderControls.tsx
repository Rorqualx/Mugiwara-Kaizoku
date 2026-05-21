/**
 * Header Controls Component
 *
 * Displays reader header with chapter info and control buttons.
 * Auto-hides with main reader controls.
 */

import React from 'react';

import { Box, Group, Text, ActionIcon } from '@mantine/core';
import {
  IconBook,
  IconAdjustments,
  IconArrowsExchange
} from '@tabler/icons-react';

export interface HeaderControlsProps {
  chapterTitle: string;
  onShowPageList: () => void;
  onShowSettings: () => void;
  onToggleFullscreen: () => void;
  customHeader?: React.ReactNode;
}

export function HeaderControls({
  chapterTitle,
  onShowPageList,
  onShowSettings,
  onToggleFullscreen,
  customHeader
}: HeaderControlsProps): React.ReactElement {
  return (
    <Box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
        padding: 'md',
        zIndex: 10
      }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}>

      {customHeader ??
        <Group justify="space-between">
          <Group>
            <Text c="white" size="sm" fw={500}>
              {chapterTitle}
            </Text>
          </Group>

          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onShowPageList}>
              <IconBook size={20} />
            </ActionIcon>

            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onShowSettings}>
              <IconAdjustments size={20} />
            </ActionIcon>

            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onToggleFullscreen}>
              <IconArrowsExchange size={20} />
            </ActionIcon>
          </Group>
        </Group>
      }
    </Box>
  );
}
