/**
 * FlareSolverr Request Details
 *
 * Table showing individual request/health check entries with filtering
 *
 * @module components/flaresolverr/metrics/FlareSolverrRequestDetails
 */

import React, { useState, useMemo } from 'react';

import {
  Table,
  Badge,
  Text,
  Group,
  Select,
  Skeleton,
  Stack,
  Card,
  ScrollArea,
  Tooltip,
  ActionIcon,
  Pagination,
  Center,
} from '@mantine/core';
import { IconCheck, IconX, IconInfoCircle } from '@tabler/icons-react';

import type { FlareSolverrMetricsEntry } from '@/server/services/flaresolverr/types';

// ============================================================================
// Types
// ============================================================================

interface FlareSolverrRequestDetailsProps {
  metrics: FlareSolverrMetricsEntry[] | undefined;
  isLoading: boolean;
}

type RequestTypeFilter = 'all' | 'HEALTH_CHECK' | 'FETCH_REQUEST' | 'SESSION_CREATE' | 'SESSION_DESTROY';
type StatusFilter = 'all' | 'success' | 'failed';

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getRequestTypeBadge(type: string): React.ReactElement {
  const colors: Record<string, string> = {
    HEALTH_CHECK: 'blue',
    FETCH_REQUEST: 'grape',
    SESSION_CREATE: 'teal',
    SESSION_DESTROY: 'orange',
    SESSION_LIST: 'gray',
  };

  const labels: Record<string, string> = {
    HEALTH_CHECK: 'Health Check',
    FETCH_REQUEST: 'Fetch',
    SESSION_CREATE: 'Session Create',
    SESSION_DESTROY: 'Session Destroy',
    SESSION_LIST: 'Session List',
  };

  return (
    <Badge size="sm" variant="light" color={colors[type] ?? 'gray'}>
      {labels[type] ?? type}
    </Badge>
  );
}

function formatResponseTime(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ============================================================================
// Main Component
// ============================================================================

export function FlareSolverrRequestDetails({
  metrics,
  isLoading,
}: FlareSolverrRequestDetailsProps): React.ReactElement {
  const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Filter and sort metrics
  const filteredMetrics = useMemo(() => {
    if (!metrics) return [];

    return metrics
      .filter((m) => {
        if (typeFilter !== 'all' && m.requestType !== typeFilter) return false;
        if (statusFilter === 'success' && !m.success) return false;
        if (statusFilter === 'failed' && m.success) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [metrics, typeFilter, statusFilter]);

  // Paginate
  const totalPages = Math.ceil(filteredMetrics.length / pageSize);
  const paginatedMetrics = filteredMetrics.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [typeFilter, statusFilter]);

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} />
        <Skeleton height={300} />
      </Stack>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <Card withBorder p="xl">
        <Center>
          <Text c="dimmed">No request data available</Text>
        </Center>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      {/* Filters */}
      <Group gap="md">
        <Select
          label="Request Type"
          size="xs"
          value={typeFilter}
          onChange={(v) => setTypeFilter((v ?? 'all') as RequestTypeFilter)}
          data={[
            { value: 'all', label: 'All Types' },
            { value: 'HEALTH_CHECK', label: 'Health Check' },
            { value: 'FETCH_REQUEST', label: 'Fetch Request' },
            { value: 'SESSION_CREATE', label: 'Session Create' },
            { value: 'SESSION_DESTROY', label: 'Session Destroy' },
          ]}
          w={160}
        />
        <Select
          label="Status"
          size="xs"
          value={statusFilter}
          onChange={(v) => setStatusFilter((v ?? 'all') as StatusFilter)}
          data={[
            { value: 'all', label: 'All Status' },
            { value: 'success', label: 'Success' },
            { value: 'failed', label: 'Failed' },
          ]}
          w={120}
        />
        <Text size="xs" c="dimmed" style={{ alignSelf: 'flex-end', paddingBottom: 4 }}>
          {filteredMetrics.length} requests
        </Text>
      </Group>

      {/* Table */}
      <Card withBorder p={0}>
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Timestamp</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Response Time</Table.Th>
                <Table.Th>Sessions</Table.Th>
                <Table.Th>Details</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedMetrics.map((metric) => (
                <Table.Tr key={metric.id}>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {formatTimestamp(metric.timestamp)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{getRequestTypeBadge(metric.requestType)}</Table.Td>
                  <Table.Td>
                    {metric.success ? (
                      <Badge color="green" size="sm" leftSection={<IconCheck size={12} />}>
                        Success
                      </Badge>
                    ) : (
                      <Badge color="red" size="sm" leftSection={<IconX size={12} />}>
                        Failed
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {formatResponseTime(metric.responseTimeMs)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{metric.sessionCount}</Text>
                  </Table.Td>
                  <Table.Td>
                    {metric.errorMessage ? (
                      <Tooltip label={metric.errorMessage} multiline w={300}>
                        <ActionIcon variant="subtle" color="red" size="sm">
                          <IconInfoCircle size={16} />
                        </ActionIcon>
                      </Tooltip>
                    ) : metric.version ? (
                      <Text size="xs" c="dimmed">
                        v{metric.version}
                      </Text>
                    ) : (
                      <Text size="xs" c="dimmed">
                        -
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Center>
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Center>
      )}
    </Stack>
  );
}

export default FlareSolverrRequestDetails;
