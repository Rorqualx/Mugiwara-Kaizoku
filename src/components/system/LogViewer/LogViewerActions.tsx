import React from 'react';

import { Group, Button, Tooltip, ActionIcon } from '@mantine/core';
import { IconRefresh, IconDownload, IconX, IconInfoCircle } from '@tabler/icons-react';

import type { LogViewerActionsProps } from './types';

export function LogViewerActions({
  isLoadingFiles,
  isLoadingLogs,
  selectedLogFile,
  showDebugInfo,
  clearLogPending,
  onRefresh,
  onToggleDebug,
  onDownload,
  onClear
}: LogViewerActionsProps): JSX.Element {
  return (
    <Group>
      <Button
        leftSection={<IconRefresh size={16} />}
        variant="light"
        onClick={onRefresh}
        loading={isLoadingFiles || isLoadingLogs}
      >
        Refresh
      </Button>

      <Tooltip label="Show debugging information" position="bottom">
        <ActionIcon
          variant="subtle"
          onClick={onToggleDebug}
          color={showDebugInfo ? 'blue' : 'gray'}
        >
          <IconInfoCircle size={20} />
        </ActionIcon>
      </Tooltip>

      {selectedLogFile && (
        <>
          <Button
            leftSection={<IconDownload size={16} />}
            variant="light"
            onClick={onDownload}
          >
            Download
          </Button>

          <Button
            leftSection={<IconX size={16} />}
            variant="light"
            color="red"
            onClick={onClear}
            loading={clearLogPending}
          >
            Clear
          </Button>
        </>
      )}
    </Group>
  );
}
