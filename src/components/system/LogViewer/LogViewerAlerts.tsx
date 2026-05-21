import React from 'react';

import { Alert, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';

import type { LogViewerAlertsProps } from './types';

export function LogViewerAlerts({
  hasError,
  errorMessage,
  showDebugInfo,
  isLoadingFiles,
  logFilesCount
}: LogViewerAlertsProps): JSX.Element {
  if (hasError && !showDebugInfo) {
    return (
      <Alert
        color="red"
        title="Error Loading Logs"
        mb="md"
        icon={<IconAlertCircle size={16} />}
      >
        <Stack gap="xs">
          <Text size="sm">
            There was a problem accessing the log files: {errorMessage}
          </Text>
          <Text size="sm">This could be due to:</Text>
          <Text size="sm">• Missing or incorrect logs directory path</Text>
          <Text size="sm">• Insufficient permissions to access the logs directory</Text>
          <Text size="sm">• No log files have been created yet</Text>
          <Text size="sm">
            Click the info icon in the top right to see debugging information.
          </Text>
        </Stack>
      </Alert>
    );
  }

  if (!hasError && !isLoadingFiles && logFilesCount === 0) {
    return (
      <Alert
        color="yellow"
        title="No Log Files Found"
        mb="md"
        icon={<IconInfoCircle size={16} />}
      >
        <Stack gap="xs">
          <Text size="sm">No log files were found in the logs directory.</Text>
          <Text size="sm">The system will create log files as events occur.</Text>
        </Stack>
      </Alert>
    );
  }

  return <></>;
}
