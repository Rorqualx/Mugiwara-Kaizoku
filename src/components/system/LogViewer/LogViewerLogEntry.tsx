import React from 'react';

import { Paper, Group, Badge, Text, Tooltip, ActionIcon, Box, Code } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

import { getLogColor, formatDetails } from './utils';

import type { LogViewerLogEntryProps } from './types';

export function LogViewerLogEntry({
  log,
  index,
  isExpanded,
  onToggleExpansion
}: LogViewerLogEntryProps): JSX.Element {
  const context = log.metadata?.['context'];
  const details = log.metadata?.['details'];
  const hasDetails = !!(context ?? log.error ?? details);

  return (
    <Paper p="xs" withBorder>
      <Group justify="space-between" mb="xs">
        <Group>
          <Badge color={getLogColor(String(log.level))}>
            {String(log.level).toUpperCase()}
          </Badge>

          <Text size="sm" fw={500}>
            {String(log.message)}
          </Text>
        </Group>

        <Group gap="xs">
          <Text size="sm" c="dimmed">
            {new Date(log.timestamp).toLocaleString()}
          </Text>

          {hasDetails && (
            <Tooltip label={isExpanded ? 'Collapse' : 'Expand'}>
              <ActionIcon onClick={(): void => onToggleExpansion(index)} size="sm">
                {isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {isExpanded && hasDetails && (
        <Box mt="xs">
          {log.error && (
            <Code block color="red" mb="xs">
              Error: {log.error instanceof Error ? log.error.message : String(log.error)}
              {log.error instanceof Error && log.error.stack && `\n${log.error.stack}`}
            </Code>
          )}

          {context !== null && (
            <Code block mb="xs">
              {((): string => {
                const contextStr = formatDetails(
                  typeof context === 'object'
                    ? (context as Record<string, unknown>)
                    : { value: context }
                );
                return `Context: ${contextStr}`;
              })()}
            </Code>
          )}

          {details !== null && (
            <Code block>
              {`Details: ${formatDetails(details)}`}
            </Code>
          )}
        </Box>
      )}
    </Paper>
  );
}
