/**
 * LogViewer Content Component
 *
 * Renders the main content area of the LogViewer with conditional states
 * (loading, error, empty, data).
 */

import React from 'react';

import { Group, Loader, Text } from '@mantine/core';

import { LogViewerLogList } from './LogViewerLogList';

import type { LogEntry } from './types';

interface LogViewerContentProps {
  isLoading: boolean;
  error: { message: string } | null;
  logs: LogEntry[] | undefined;
  total: number;
  expandedLogs: Set<number>;
  onToggleExpansion: (logId: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function LogViewerContent({
  isLoading,
  error,
  logs,
  total,
  expandedLogs,
  onToggleExpansion,
  page,
  totalPages,
  onPageChange
}: LogViewerContentProps): JSX.Element {
  if (isLoading) {
    return (
      <Group justify="center" p="xl">
        <Loader size="md" />
        <Text>Loading logs...</Text>
      </Group>
    );
  }

  if (error) {
    return (
      <Text c="red" p="md">
        Error loading logs: {error.message}
      </Text>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Text c="dimmed" p="md" ta="center">
        No logs found matching the selected criteria.
      </Text>
    );
  }

  return (
    <LogViewerLogList
      logs={logs}
      expandedLogs={expandedLogs}
      onToggleExpansion={onToggleExpansion}
      totalLogs={total}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );
}
