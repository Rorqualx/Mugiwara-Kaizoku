/**
 * SelectionToolbar Component
 *
 * Floating toolbar with selection tools for annotation.
 * Tools: Cursor, Brush, Rectangle, Block, Word, Column, Row
 */

import React from 'react';

import {
  ActionIcon,
  Group,
  Paper,
  Tooltip,
  Kbd,
  Text,
  Divider,
  Badge,
} from '@mantine/core';
import {
  // @ts-expect-error - IconHighlight exists at runtime but types are outdated
  IconHighlight,
  // @ts-expect-error - IconSquareDashed exists at runtime but types are outdated
  IconSquareDashed,
  IconLayoutGrid,
  IconFileText,
  IconLayoutList,
  IconTable,
  IconLink,
  // @ts-expect-error - IconPointer exists at runtime but types are outdated
  IconPointer,
} from '@tabler/icons-react';

import { TOOL_DEFINITIONS } from '../page-view/selection-tools-types';

import type { SelectionToolType } from '../page-view/selection-tools-types';

/**
 * Icon mapping for each tool
 */
const TOOL_ICONS: Record<string, React.ReactNode> = {
  pointer: <IconPointer size={18} />,
  palette: <IconHighlight size={18} />,
  photo: <IconSquareDashed size={18} />,
  layoutGrid: <IconLayoutGrid size={18} />,
  fileText: <IconFileText size={18} />,
  layoutList: <IconLayoutList size={18} />,
  table: <IconTable size={18} />,
  link: <IconLink size={18} />,
};

interface SelectionToolbarProps {
  /** Currently active selection tool */
  activeTool: SelectionToolType;
  /** Callback when tool is changed */
  onToolChange: (tool: SelectionToolType) => void;
  /** Whether toolbar is disabled */
  disabled?: boolean;
}

/**
 * SelectionToolbar provides tool buttons for different selection modes.
 * Each tool optimizes for different annotation scenarios.
 */
export function SelectionToolbar({
  activeTool,
  onToolChange,
  disabled = false,
}: SelectionToolbarProps): React.ReactElement {
  const handleToolClick = (toolId: SelectionToolType): void => {
    // Toggle tool off if clicking active tool
    onToolChange(activeTool === toolId ? null : toolId);
  };

  return (
    <Paper
      withBorder
      shadow="sm"
      p="xs"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      <Group gap="xs" justify="center">
        <Text size="xs" c="dimmed" fw={500}>
          Selection Tool:
        </Text>

        <Divider orientation="vertical" />

        {TOOL_DEFINITIONS.map((tool) => (
          <Tooltip
            key={tool.id}
            label={
              <Group gap={4}>
                <Text size="xs">{tool.description}</Text>
                <Kbd size="xs">{tool.shortcut}</Kbd>
              </Group>
            }
            position="bottom"
            withArrow
          >
            <ActionIcon
              variant={activeTool === tool.id ? 'filled' : 'subtle'}
              color={activeTool === tool.id ? 'blue' : 'gray'}
              onClick={() => handleToolClick(tool.id)}
              disabled={disabled}
              size="md"
            >
              {TOOL_ICONS[tool.icon]}
            </ActionIcon>
          </Tooltip>
        ))}

        <Divider orientation="vertical" />

        {/* Active tool indicator */}
        {activeTool && (
          <Badge size="sm" color="blue" variant="light">
            {TOOL_DEFINITIONS.find((t) => t.id === activeTool)?.label ?? activeTool}
          </Badge>
        )}

        {/* Escape hint */}
        <Text size="xs" c="dimmed">
          <Kbd size="xs">Esc</Kbd> to exit
        </Text>
      </Group>
    </Paper>
  );
}
