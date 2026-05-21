/**
 * Jobs Table Component for Job History Page
 */
import React from 'react';

import { Card, Table, Checkbox, Text, Badge, Group, ActionIcon, Tooltip, Anchor } from '@mantine/core';
import { IconX, IconRefresh, IconTrash, IconInfoCircle } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

import { JobType } from '@/utils/job-validation';

import { DownloadProgressCell } from './DownloadProgressCell';
import { isRecord, getTaskTypeLabel, getStatusBadge, getStatusBadgeBgColor, getStatusBadgeTextColor } from './helpers';

interface JobMutation {
  mutateAsync: (input: { id: string }) => Promise<unknown>;
  isPending: boolean;
}

interface JobsTableProps {
  tasks: unknown[];
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  onSelectItem: (id: string) => void;
  cancelJob: JobMutation;
  retryJob: JobMutation;
  deleteJob: JobMutation;
}

const tableStyles = {
  table: { backgroundColor: 'var(--mantine-color-dark-7)', color: 'var(--mantine-color-gray-3)' },
  thead: { backgroundColor: 'var(--mantine-color-dark-6)', color: 'var(--mantine-color-white)' },
  th: { color: 'var(--mantine-color-white)', fontWeight: 600, borderBottom: '2px solid var(--mantine-color-dark-4)', padding: '12px' },
  tr: { '&:nth-of-type(odd)': { backgroundColor: 'var(--mantine-color-dark-6)' }, '&:hover': { backgroundColor: 'var(--mantine-color-dark-5)' } },
  td: { borderBottom: '1px solid var(--mantine-color-dark-4)', color: 'var(--mantine-color-gray-3)', padding: '12px' }
};

function ViewDetailsButton({ taskId }: { taskId: string }): React.ReactElement {
  return (
    <Tooltip label="View affected chapters / manual import">
      <ActionIcon component={Link} href={`/jobs/${taskId}`} color="gray" variant="light" size="sm" aria-label="View job details">
        <IconInfoCircle size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

function JobActions({ taskId, status, cancelJob, retryJob, deleteJob }: {
  taskId: string;
  status: string;
  cancelJob: JobMutation;
  retryJob: JobMutation;
  deleteJob: JobMutation;
}): React.ReactElement {
  if (status === 'pending' || status === 'active' || status === 'retrying') {
    return (
      <>
        <ViewDetailsButton taskId={taskId} />
        <Tooltip label="Cancel job">
          <ActionIcon color="red" variant="light" onClick={() => { void cancelJob.mutateAsync({ id: taskId }); }} loading={cancelJob.isPending} size="sm">
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </>
    );
  }

  if (status === 'failed') {
    return (
      <>
        <ViewDetailsButton taskId={taskId} />
        <Tooltip label="Retry job">
          <ActionIcon color="blue" variant="light" onClick={() => { void retryJob.mutateAsync({ id: taskId }); }} loading={retryJob.isPending} size="sm">
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Delete job">
          <ActionIcon color="red" variant="light" onClick={() => { void deleteJob.mutateAsync({ id: taskId }); }} loading={deleteJob.isPending} size="sm">
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </>
    );
  }

  if (status === 'completed') {
    return (
      <>
        <ViewDetailsButton taskId={taskId} />
        <Tooltip label="Delete job">
          <ActionIcon color="gray" variant="light" onClick={() => { void deleteJob.mutateAsync({ id: taskId }); }} loading={deleteJob.isPending} size="sm">
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </>
    );
  }

  return <ViewDetailsButton taskId={taskId} />;
}

function JobRow({ task, isSelected, onSelect, cancelJob, retryJob, deleteJob }: {
  task: Record<string, unknown>;
  isSelected: boolean;
  onSelect: () => void;
  cancelJob: JobMutation;
  retryJob: JobMutation;
  deleteJob: JobMutation;
}): React.ReactElement {
  const taskId = String(task['id']);
  const taskType = task['job_type'];
  const taskStatus = task['status'];
  const taskManga = task['manga'] && isRecord(task['manga']) ? task['manga'] : null;
  const taskName = taskManga?.['title'] ?? 'System Task';
  const taskStartedAt = task['started_at'];
  const taskProgress = task['progress'];
  const taskMetadata = task['metadata'] && isRecord(task['metadata']) ? task['metadata'] : null;
  const statusBadge = getStatusBadge(typeof taskStatus === 'string' ? taskStatus : 'UNKNOWN');
  const status = typeof taskStatus === 'string' ? taskStatus : String(taskStatus);
  const progress = typeof taskProgress === 'number' ? taskProgress : null;
  const speed = taskMetadata?.['speed'];

  return (
    <tr>
      <td>
        <Checkbox checked={isSelected} onChange={onSelect} styles={{ input: { cursor: 'pointer' } }} />
      </td>
      <td>
        <Anchor component={Link} href={`/jobs/${taskId}`} size="sm" c="blue.4" underline="hover">#{taskId}</Anchor>
      </td>
      <td>
        <Badge size="sm" variant="dot" color="blue" styles={{ root: { backgroundColor: 'var(--mantine-color-dark-6)', color: 'var(--mantine-color-gray-3)' } }}>
          {typeof taskType === 'string' ? getTaskTypeLabel(taskType as JobType) : 'Unknown'}
        </Badge>
      </td>
      <td><Text size="sm" lineClamp={1} c="gray.3">{String(taskName)}</Text></td>
      <td>
        <Group gap="xs">
          {statusBadge.icon}
          <Badge size="sm" color={statusBadge.color} variant="light" styles={{
            root: { backgroundColor: getStatusBadgeBgColor(statusBadge.color), color: getStatusBadgeTextColor(statusBadge.color) }
          }}>
            {statusBadge.label}
          </Badge>
        </Group>
      </td>
      <td>
        <DownloadProgressCell
          progress={progress}
          status={status}
          speed={typeof speed === 'number' ? speed : undefined}
        />
      </td>
      <td>
        <Text size="sm" c="dimmed">
          {taskStartedAt && (typeof taskStartedAt === 'string' || typeof taskStartedAt === 'number' || taskStartedAt instanceof Date)
            ? formatDistanceToNow(new Date(taskStartedAt as string | number | Date), { addSuffix: true })
            : '-'}
        </Text>
      </td>
      <td>
        <Group gap="xs">
          <JobActions taskId={taskId} status={status} cancelJob={cancelJob} retryJob={retryJob} deleteJob={deleteJob} />
        </Group>
      </td>
    </tr>
  );
}

export function JobsTable({
  tasks,
  selectedIds,
  allSelected,
  someSelected,
  onSelectAll,
  onSelectItem,
  cancelJob,
  retryJob,
  deleteJob
}: JobsTableProps): React.ReactElement {
  return (
    <Card style={{ backgroundColor: 'var(--mantine-color-dark-6)', border: '1px solid var(--mantine-color-dark-4)', padding: 0 }}>
      <Table striped highlightOnHover styles={tableStyles}>
        <thead>
          <tr>
            <th style={{ width: 40 }}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onChange={onSelectAll}
                styles={{ input: { cursor: 'pointer' } }}
              />
            </th>
            <th>ID</th>
            <th>Type</th>
            <th>Name</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Started</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.filter(isRecord).map((task) => (
            <JobRow
              key={String(task['id'])}
              task={task}
              isSelected={selectedIds.has(String(task['id']))}
              onSelect={() => onSelectItem(String(task['id']))}
              cancelJob={cancelJob}
              retryJob={retryJob}
              deleteJob={deleteJob}
            />
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
