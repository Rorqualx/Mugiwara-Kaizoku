/**
 * Internal Logs card — tail-view of the FlareSolverr Go binary log file.
 *
 * @module components/flaresolverr/settings/InternalLogsCard
 */

import React from 'react';

import {
  Card,
  Title,
  Group,
  Badge,
  Tooltip,
  ActionIcon,
  Button,
  Alert,
  ScrollArea,
  Code,
  Text,
} from '@mantine/core';
import {
  IconTerminal,
  IconRefresh,
  IconTrash,
  IconAlertCircle,
} from '@tabler/icons-react';

interface LogsData {
  exists: boolean;
  totalLines: number;
  logs: string[];
  logPath?: string;
}

interface InternalLogsCardProps {
  logsData: LogsData | undefined;
  logsLoading: boolean;
  clearPending: boolean;
  onRefresh: () => void;
  onClear: () => void;
}

export function InternalLogsCard({
  logsData,
  logsLoading,
  clearPending,
  onRefresh,
  onClear,
}: InternalLogsCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconTerminal size={20} />
          <Title order={4}>Internal Logs</Title>
        </Group>
        <Group gap="xs">
          <Badge size="lg" variant="light">{logsData?.totalLines ?? 0} lines</Badge>
          <Tooltip label="Refresh logs">
            <ActionIcon variant="light" onClick={onRefresh} loading={logsLoading}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          <Button
            variant="light"
            color="red"
            size="xs"
            leftSection={<IconTrash size={14} />}
            onClick={onClear}
            loading={clearPending}
            disabled={!logsData?.exists || logsData.totalLines === 0}
          >
            Clear
          </Button>
        </Group>
      </Group>

      {!logsData?.exists ? (
        <Alert icon={<IconAlertCircle />} color="gray" variant="light">
          <Text size="sm">
            No log file found. Logs will appear here when FlareSolverr is started.
          </Text>
        </Alert>
      ) : logsData.logs.length === 0 ? (
        <Alert icon={<IconAlertCircle />} color="gray" variant="light">
          <Text size="sm">Log file is empty.</Text>
        </Alert>
      ) : (
        <ScrollArea h={300} type="auto" offsetScrollbars>
          <Code block style={{ fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {logsData.logs.join('\n')}
          </Code>
        </ScrollArea>
      )}

      <Text size="xs" c="dimmed" mt="md">
        Logs are stored at: <Code>{logsData?.logPath ?? 'N/A'}</Code>
      </Text>
    </Card>
  );
}
