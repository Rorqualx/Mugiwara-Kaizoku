/**
 * TerminalPanel component for displaying command output
 *
 * Provides a terminal-like interface for viewing:
 * - Command execution output
 * - Error messages
 * - Debug information
 */
import React from 'react';

import { Paper, Group, Text, ActionIcon, Tooltip, ScrollArea, Code, Collapse } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

export interface TerminalPanelProps {
  /** Terminal output content */
  terminalOutput: string;
  /** Callback to clear terminal */
  onClear: () => void;
  /** Whether terminal is visible */
  isVisible: boolean;
  /** Ref for terminal scroll area */
  terminalRef?: React.RefObject<HTMLDivElement>;
}

/**
 * TerminalPanel component
 * Displays terminal output with scroll area and clear functionality
 */
export function TerminalPanel({
  terminalOutput,
  onClear,
  isVisible,
  terminalRef
}: TerminalPanelProps): React.ReactElement {
  return (
    <Collapse in={isVisible}>
      <Paper withBorder p="xs" mb="md" bg="dark.8">
        <Group justify="space-between" mb="xs">
          <Text c="gray.3" size="sm" fw={500}>
            Terminal Output
          </Text>
          <Tooltip label="Clear Terminal">
            <ActionIcon variant="subtle" color="gray" onClick={onClear} size="sm">
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <ScrollArea h={150} ref={terminalRef} type="auto">
          {terminalOutput ? (
            <Code
              block
              style={{
                whiteSpace: 'pre-wrap',
                background: 'transparent',
                color: '#c1c2c5'
              }}
            >
              {terminalOutput}
            </Code>
          ) : (
            <Text c="dimmed" ta="center" py="md" size="sm">
              Terminal output will appear here
            </Text>
          )}
        </ScrollArea>
      </Paper>
    </Collapse>
  );
}
