/**
 * Job History Page
 *
 * Displays ALL jobs across all statuses with bulk selection and deletion.
 *
 * @module pages/jobs/history
 */

import React, { useState, useEffect } from "react";
import type { ReactElement } from 'react';

import { Title, Stack, Container, Group, Text, Badge, Alert, Center, Pagination, Loader } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconCheck, IconX, IconClock, IconAlertCircle } from '@tabler/icons-react';

import { isRecord, useJobSelection, useBulkDelete, BulkActions, JobsTable, StatusSummary } from '@/components/jobs/history';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useRealTime } from '@/providers/RealTimeProvider';
import { trpc } from '@/utils/trpc-client';

const paginationStyles = {
  control: {
    backgroundColor: 'var(--mantine-color-dark-6)',
    border: '1px solid var(--mantine-color-dark-4)',
    color: 'var(--mantine-color-gray-3)',
    '&[data-active]': {
      backgroundColor: 'var(--mantine-color-blue-6)',
      borderColor: 'var(--mantine-color-blue-6)',
      color: 'var(--mantine-color-white)'
    },
    '&:hover:not([data-active])': {
      backgroundColor: 'var(--mantine-color-dark-5)'
    }
  }
};

function useJobMutations(refetch: () => Promise<unknown>): {
  cancelJob: ReturnType<typeof trpc.jobs.cancel.useMutation>;
  retryJob: ReturnType<typeof trpc.jobs.retry.useMutation>;
  deleteJob: ReturnType<typeof trpc.jobs.delete.useMutation>;
} {
  const utils = trpc.useUtils();

  const cancelJob = trpc.jobs.cancel.useMutation({
    onSuccess: async () => {
      showNotification({ title: 'Job Cancelled', message: 'Job has been cancelled', color: 'blue', icon: <IconCheck size={16} /> });
      await utils.jobs.getAll.invalidate();
      await refetch();
    },
    onError: (error) => {
      showNotification({ title: 'Error', message: error instanceof Error ? error.message : 'Failed', color: 'red', icon: <IconX size={16} /> });
    }
  });

  const retryJob = trpc.jobs.retry.useMutation({
    onSuccess: async () => {
      showNotification({ title: 'Job Retried', message: 'Job has been queued for retry', color: 'blue', icon: <IconCheck size={16} /> });
      await utils.jobs.getAll.invalidate();
      await refetch();
    },
    onError: (error) => {
      showNotification({ title: 'Error', message: error instanceof Error ? error.message : 'Failed', color: 'red', icon: <IconX size={16} /> });
    }
  });

  const deleteJob = trpc.jobs.delete.useMutation({
    onSuccess: async () => {
      showNotification({ title: 'Job Deleted', message: 'Job removed', color: 'green', icon: <IconCheck size={16} /> });
      await utils.jobs.getAll.invalidate();
      await utils.activity.query.invalidate();
      await refetch();
    },
    onError: (error) => {
      showNotification({ title: 'Error', message: error instanceof Error ? error.message : 'Failed', color: 'red', icon: <IconX size={16} /> });
    }
  });

  return { cancelJob, retryJob, deleteJob };
}

function JobHistoryContent(): React.ReactElement {
  const [currentPage, setCurrentPage] = useState(1);
  const { isConnected, subscribe } = useRealTime();

  const { data: jobsData, isPending, refetch } = trpc.jobs.getAll.useQuery({ page: currentPage, limit: 100 });

  const { selectedIds, allSelected, someSelected, handleSelectAll, handleSelectItem, clearSelection } = useJobSelection(jobsData);
  const { handleDeleteSelected, handleDeleteCompleted, handleDeleteFailed, isDeleting } = useBulkDelete(selectedIds, clearSelection, refetch);
  const { cancelJob, retryJob, deleteJob } = useJobMutations(refetch);

  useEffect(() => {
    if (!isConnected) return;
    // Subscribe to both job updates and download progress events
    const unsubJobs = subscribe('jobs:active', () => { void refetch(); });
    const unsubDownloads = subscribe('downloads:progress', () => { void refetch(); });
    return () => {
      unsubJobs();
      unsubDownloads();
    };
  }, [isConnected, subscribe, refetch]);

  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(() => { void refetch(); }, 5000);
    return () => clearInterval(interval);
  }, [isConnected, refetch]);

  if (isPending) {
    return (
      <Center h="calc(100vh - 200px)" style={{ backgroundColor: '#333333' }}>
        <Stack align="center">
          <Loader size="xl" color="blue" />
          <Text c="dimmed">Loading active tasks...</Text>
        </Stack>
      </Center>
    );
  }

  const tasks = jobsData?.jobs ?? [];
  const pagination = jobsData?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  const statusCounts = tasks.reduce((acc: Record<string, number>, task) => {
    if (isRecord(task)) {
      const status = String(task['status'] ?? 'UNKNOWN');
      return { ...acc, [status]: (acc[status] ?? 0) + 1 };
    }
    return acc;
  }, {});

  return (
    <Container size="xl" style={{ paddingTop: '80px', paddingBottom: '20px' }}>
      <Stack gap="xl">
        <Group justify="space-between">
          <Title order={2} style={{ color: '#ffffff' }}>
            <Group gap="xs">
              <IconClock size={28} style={{ color: '#7aa2f7' }} />
              Job History
            </Group>
          </Title>
          <Group gap="md">
            <BulkActions
              selectedCount={selectedIds.size}
              completedCount={statusCounts['completed'] ?? 0}
              failedCount={statusCounts['failed'] ?? 0}
              onDeleteSelected={handleDeleteSelected}
              onDeleteCompleted={handleDeleteCompleted}
              onDeleteFailed={handleDeleteFailed}
              isDeleting={isDeleting}
            />
            <Badge size="lg" color="blue" variant="filled">{pagination?.totalCount ?? 0} Total Jobs</Badge>
          </Group>
        </Group>

        <StatusSummary totalCount={pagination?.totalCount ?? 0} pageCount={tasks.length} statusCounts={statusCounts} />

        {tasks.length === 0 ? (
          <Alert icon={<IconAlertCircle />} color="blue" styles={{ root: { backgroundColor: '#424242', borderColor: '#7aa2f7' }, message: { color: '#e0e0e0' } }}>
            No jobs to display.
          </Alert>
        ) : (
          <JobsTable
            tasks={tasks}
            selectedIds={selectedIds}
            allSelected={allSelected}
            someSelected={someSelected}
            onSelectAll={handleSelectAll}
            onSelectItem={handleSelectItem}
            cancelJob={cancelJob}
            retryJob={retryJob}
            deleteJob={deleteJob}
          />
        )}

        {tasks.length > 0 && totalPages > 1 && (
          <Center>
            <Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} size="md" radius="md" styles={paginationStyles} />
          </Center>
        )}
      </Stack>
    </Container>
  );
}

export default function JobHistoryPage(): React.ReactElement {
  return <JobHistoryContent />;
}

JobHistoryPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <MainLayout>{page}</MainLayout>;
};
