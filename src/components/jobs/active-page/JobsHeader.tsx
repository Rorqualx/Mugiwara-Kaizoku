/**
 * Header, tab badge and sortable column header for the Jobs page.
 *
 * @module components/jobs/active-page/JobsHeader
 */
import React from 'react';

import { Title, Group, Badge, ActionIcon, Tooltip } from '@mantine/core';
import {
  IconPlayerPlay, IconTrash, IconLink, IconArrowUp, IconArrowDown, IconArrowsSort,
} from '@tabler/icons-react';

import type { JobSortDir, JobSortKey } from '@/components/jobs/job-sort';
import { useIsAdmin } from '@/hooks/useIsAdmin';

/** Tabs of the Jobs page. */
export type JobTab = 'all' | 'active' | 'completed' | 'failed';

/** Type guard for a `?tab=` query value. */
export function isJobTab(value: unknown): value is JobTab {
  return value === 'all' || value === 'active' || value === 'completed' || value === 'failed';
}

export const TABLE_STYLES = {
  table: { backgroundColor: '#333333', color: '#e0e0e0' },
  thead: { backgroundColor: '#424242', color: '#ffffff' },
  th: {
    color: '#ffffff', fontWeight: 600, borderBottom: '2px solid #565f89',
    padding: '12px 18px', whiteSpace: 'nowrap',
  },
  tr: { '&:nth-of-type(odd)': { backgroundColor: '#3a3a3a' }, '&:hover': { backgroundColor: '#424242' } },
  td: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#e0e0e0',
    padding: '12px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap',
  },
} as const;

export const PAGINATION_STYLES = {
  control: {
    backgroundColor: '#424242', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#e0e0e0',
    '&[data-active]': { backgroundColor: '#7aa2f7', borderColor: '#7aa2f7', color: '#ffffff' },
    '&:hover:not([data-active])': { backgroundColor: '#3a3a3a' },
  },
} as const;

interface SortableThProps {
  label: string;
  columnKey: JobSortKey;
  sortKey: JobSortKey | null;
  sortDir: JobSortDir;
  onSort: (k: JobSortKey) => void;
}

/** Count badge shown on the right of a tab. */
export function TabCount({ value, color }: { value: number; color: string }): React.ReactElement {
  return (
    <Badge size="xs" variant="filled" color={color} radius="sm"
      styles={{ root: { minWidth: 24, padding: '0 6px' } }}>
      {value}
    </Badge>
  );
}

/** Column header that toggles the sort on click. */
export function SortableTh({ label, columnKey, sortKey, sortDir, onSort }: SortableThProps): React.ReactElement {
  const isActive = sortKey === columnKey;
  const Icon = !isActive ? IconArrowsSort : sortDir === 'asc' ? IconArrowUp : IconArrowDown;
  return (
    <th onClick={() => onSort(columnKey)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        <Icon size={12} style={{ opacity: isActive ? 1 : 0.4 }} />
      </span>
    </th>
  );
}

interface JobsHeaderProps {
  totalCount: number;
  completedCount: number;
  failedCount: number;
  activeTab: JobTab;
  deleteAllCompleted: { mutate: () => void; isPending: boolean };
  deleteAllFailed: { mutate: () => void; isPending: boolean };
  onTrackDownload: () => void;
}

/**
 * Page title, total badge and the queue-wide actions.
 *
 * The queue-wide actions are admin-only on the server and are shown to
 * administrators only: tracking an existing client download reads the shared
 * download-client queue, and "clear all completed / failed" deletes those jobs
 * for every user. Regular users still delete their own jobs row by row.
 */
export function JobsHeader({ totalCount, completedCount, failedCount, activeTab, deleteAllCompleted, deleteAllFailed, onTrackDownload }: JobsHeaderProps): React.ReactElement {
  const isAdmin = useIsAdmin();
  return (
    <Group justify="space-between">
      <Title order={2} style={{ color: '#ffffff' }}>
        <Group gap="xs">
          <IconPlayerPlay size={28} style={{ color: '#7aa2f7' }} />
          Jobs
        </Group>
      </Title>
      <Group gap="md">
        {isAdmin && (
          <Tooltip label="Track download from client">
            <ActionIcon color="blue" variant="light" size="lg" onClick={onTrackDownload}>
              <IconLink size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        <Badge size="lg" color="blue" variant="filled">{totalCount} Total</Badge>
        {isAdmin && completedCount > 0 && activeTab !== 'failed' && (
          <Tooltip label={`Clear all ${completedCount} completed jobs`}>
            <ActionIcon color="green" variant="filled" size="lg"
              loading={deleteAllCompleted.isPending}
              onClick={() => { if (confirm(`Delete all ${completedCount} completed jobs?`)) deleteAllCompleted.mutate(); }}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        {isAdmin && failedCount > 0 && activeTab !== 'completed' && (
          <Tooltip label={`Clear all ${failedCount} failed jobs`}>
            <ActionIcon color="red" variant="filled" size="lg"
              loading={deleteAllFailed.isPending}
              onClick={() => { if (confirm(`Delete all ${failedCount} failed jobs?`)) deleteAllFailed.mutate(); }}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Group>
  );
}
