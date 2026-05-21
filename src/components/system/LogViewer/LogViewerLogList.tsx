import React from 'react';

import { ScrollArea, Stack, Pagination, Text, Group } from '@mantine/core';

import { LogViewerLogEntry } from './LogViewerLogEntry';

import type { LogViewerLogListProps } from './types';

export function LogViewerLogList({
  logs,
  expandedLogs,
  onToggleExpansion,
  totalLogs,
  page,
  totalPages,
  onPageChange
}: LogViewerLogListProps): JSX.Element {
  return (
    <>
      <ScrollArea h={400} scrollbarSize={8}>
        <Stack gap="xs">
          {logs.map((log, index) => (
            <LogViewerLogEntry
              key={index}
              log={log}
              index={index}
              isExpanded={expandedLogs.has(index)}
              onToggleExpansion={onToggleExpansion}
            />
          ))}
        </Stack>
      </ScrollArea>

      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination
            total={totalPages}
            value={page}
            onChange={onPageChange}
            withEdges
          />
        </Group>
      )}

      <Text size="xs" c="dimmed" ta="center" mt="sm">
        Showing {logs.length} of {totalLogs} logs
      </Text>
    </>
  );
}
