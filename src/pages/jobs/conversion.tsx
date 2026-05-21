/**
 * Conversion Jobs Monitor Page
 *
 * Displays active and historical file format conversion jobs.
 * Shows real-time progress, status, and allows job management.
 */

import React from 'react';
import type { ReactElement } from 'react';

import {
  Container,
  Title,
  Card,
  Stack,
  Group,
  Button,
  Text,
  Badge,
  Table,
  ActionIcon,
  Tooltip,
  SimpleGrid,
  Alert,
  Select
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  IconArrowRight,
  IconCheck,
  IconX,
  IconClock,
  IconRefresh,
  IconAlertCircle,
  IconPlayerPlay} from '@tabler/icons-react';

import { MainLayout } from '@/components/layouts/MainLayout';
import { useRealTime } from '@/providers/RealTimeProvider';
import { trpc } from '@/utils/trpc-client/index';

type ConversionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Interface for future conversion job UI
interface ConversionJob {
  id: string;
  mangaId: number;
  chapterId: number;
  sourceFilePath: string;
  targetFilePath: string | null;
  sourceFormat: string;
  targetFormat: string;
  status: ConversionStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

function ConversionJobsPage(): React.ReactElement {
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Fetch pending jobs
  const { data: pendingJobs, refetch: refetchPending } = trpc.conversion.getPendingJobs.useQuery(
    { limit: 50 },
    { refetchInterval: isConnected ? false : 3000 } // Only poll when WebSocket disconnected
  );

  // Fetch statistics
  const { data: stats, refetch: refetchStats } = trpc.conversion.getStatistics.useQuery(
    undefined,
    { refetchInterval: isConnected ? false : 5000 } // Only poll when WebSocket disconnected
  );

  // Subscribe to WebSocket conversion events for real-time updates
  React.useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('jobs:conversion', () => {
      void refetchPending();
      void refetchStats();
    });

    return unsubscribe;
  }, [isConnected, subscribe, refetchPending, refetchStats]);

  // Execute job mutation
  const executeJobMutation = trpc.conversion.executeJob.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Job Started',
        message: 'Conversion job is now processing',
        color: 'blue',
        icon: <IconPlayerPlay />
      });
      void refetchPending();
      void refetchStats();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: error.message || 'Failed to start conversion job',
        color: 'red',
        icon: <IconAlertCircle />
      });
    }
  });

  // Cancel job mutation
  const cancelJobMutation = trpc.conversion.cancelJob.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Job Cancelled',
        message: 'Conversion job has been cancelled',
        color: 'orange',
        icon: <IconX />
      });
      void refetchPending();
      void refetchStats();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: error.message || 'Failed to cancel conversion job',
        color: 'red',
        icon: <IconAlertCircle />
      });
    }
  });

  const getStatusBadge = (status: ConversionStatus): JSX.Element => {
    const config = {
      PENDING: { color: 'gray', label: 'Pending', icon: <IconClock size={14} /> },
      PROCESSING: { color: 'blue', label: 'Processing', icon: <IconPlayerPlay size={14} /> },
      COMPLETED: { color: 'green', label: 'Completed', icon: <IconCheck size={14} /> },
      FAILED: { color: 'red', label: 'Failed', icon: <IconX size={14} /> },
      CANCELLED: { color: 'orange', label: 'Cancelled', icon: <IconX size={14} /> }
    };

    const statusConfig = config[status] || config.PENDING;

    return (
      <Badge color={statusConfig.color} leftSection={statusConfig.icon} variant="light">
        {statusConfig.label}
      </Badge>
    );
  };

  const _handleExecuteJob = async (jobId: string): Promise<void> => {
    await executeJobMutation.mutateAsync({ jobId });
  };

  const handleCancelJob = async (jobId: string): Promise<void> => {
    await cancelJobMutation.mutateAsync({ jobId });
  };

  const filteredJobs = pendingJobs?.jobIds ?? [];

  return (
    <Container size="xl" style={{ paddingTop: '80px', paddingBottom: '20px' }}>
      <Group justify="space-between" mb="lg">
        <Title order={2}>
          <Group gap="xs">
            <IconArrowRight size={28} />
            <Text>Conversion Jobs</Text>
          </Group>
        </Title>

        <Group gap="xs">
          <Select
            placeholder="Filter by status"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || 'all')}
            data={[
              { value: 'all', label: 'All Jobs' },
              { value: 'pending', label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'completed', label: 'Completed' },
              { value: 'failed', label: 'Failed' }
            ]}
            style={{ width: 150 }}
          />
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => {
              void refetchPending();
              void refetchStats();
            }}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      <Stack gap="lg">
        {/* Statistics Cards */}
        {stats && (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <Card shadow="sm" p="md">
              <Stack gap="xs">
                <Text size="xs" c="dimmed">Total Pending</Text>
                <Text size="xl" fw={700}>{pendingJobs?.count ?? 0}</Text>
              </Stack>
            </Card>
            <Card shadow="sm" p="md">
              <Stack gap="xs">
                <Text size="xs" c="dimmed">Completed</Text>
                <Text size="xl" fw={700} c="green">{stats.service?.completed ?? 0}</Text>
              </Stack>
            </Card>
            <Card shadow="sm" p="md">
              <Stack gap="xs">
                <Text size="xs" c="dimmed">Failed</Text>
                <Text size="xl" fw={700} c="red">{stats.service?.failed ?? 0}</Text>
              </Stack>
            </Card>
            <Card shadow="sm" p="md">
              <Stack gap="xs">
                <Text size="xs" c="dimmed">Active Converters</Text>
                <Text size="xl" fw={700}>{stats.factory?.totalConverters ?? 0}</Text>
              </Stack>
            </Card>
          </SimpleGrid>
        )}

        {/* Jobs Table */}
        <Card shadow="sm" p="lg">
          <Title order={4} mb="md">Conversion Queue</Title>

          {filteredJobs.length === 0 ? (
            <Alert icon={<IconAlertCircle />} color="blue" variant="light">
              <Text size="sm">No conversion jobs in the queue</Text>
            </Alert>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Job ID</Table.Th>
                    <Table.Th>Source Format</Table.Th>
                    <Table.Th>Target Format</Table.Th>
                    <Table.Th>Priority</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredJobs.map((jobId: string) => (
                    <Table.Tr key={jobId}>
                      <Table.Td>
                        <Text size="xs" style={{ fontFamily: 'monospace' }}>
                          {jobId.substring(0, 8)}...
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="outline">FORMAT</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="outline">FORMAT</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">-</Text>
                      </Table.Td>
                      <Table.Td>
                        {getStatusBadge('PENDING')}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Tooltip label="Cancel Job">
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="sm"
                              onClick={() => { void handleCancelJob(jobId); }}
                              loading={cancelJobMutation.isPending}
                            >
                              <IconX size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </Card>

        {/* Info Alert */}
        <Alert icon={<IconAlertCircle />} color="blue" variant="light">
          <Text size="sm">
            <strong>Note:</strong> Conversion jobs are processed automatically in the background.
            Completed jobs are removed from this list after 24 hours.
          </Text>
        </Alert>
      </Stack>
    </Container>
  );
}

export default ConversionJobsPage;

ConversionJobsPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <MainLayout>{page}</MainLayout>;
};
