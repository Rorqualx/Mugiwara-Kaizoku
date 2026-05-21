import React from 'react';

import { Alert, Stack, Text, Code } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import type { LogViewerDebugPanelProps } from './types';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error';
}

export function LogViewerDebugPanel({
  logFiles,
  selectedLogFile,
  logFilesError,
  logsError
}: LogViewerDebugPanelProps): JSX.Element {
  return (
    <Alert
      color="blue"
      title="Debug Information"
      mb="md"
      icon={<IconInfoCircle size={16} />}
    >
      <Stack gap="xs">
        <Text size="sm">This panel provides troubleshooting information for logs.</Text>

        <Text size="sm">
          <b>Log files found:</b> {logFiles.length}
        </Text>

        <Text size="sm">
          <b>Selected log file:</b> {selectedLogFile ?? 'Default log'}
        </Text>

        {!!logFilesError && (
          <Code color="red">Error loading log files: {getErrorMessage(logFilesError)}</Code>
        )}

        {!!logsError && (
          <Code color="red">Error loading logs: {getErrorMessage(logsError)}</Code>
        )}
      </Stack>
    </Alert>
  );
}
