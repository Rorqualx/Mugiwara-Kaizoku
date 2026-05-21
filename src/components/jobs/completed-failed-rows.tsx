/**
 * Completed & Failed Job Row Components
 * Split from active-job-helpers.tsx to keep files under 500 lines.
 */
import React from 'react';

import { Group, Text, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { IconRefresh, IconTrash, IconFolder } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

import { JobType } from '@/utils/job-validation';

import { FileNameCell, formatAddedOn, getStatusBadge } from './active-job-helpers';
import { ProtocolBadge, SourceBadge } from './source-badge';
import { FLEX_KEEP_INLINE, TEXT_KEEP_INLINE } from './theme-text-styles';

import type { JobRowData } from './active-job-helpers';

function getStatusBadgeColors(color: string): { backgroundColor: string; textColor: string } {
  switch (color) {
    case 'green': return { backgroundColor: 'rgba(64, 192, 87, 0.1)', textColor: '#40c057' };
    case 'red': return { backgroundColor: 'rgba(248, 113, 113, 0.1)', textColor: '#f87171' };
    default: return { backgroundColor: 'rgba(134, 142, 150, 0.1)', textColor: '#868e96' };
  }
}

// ============================================================================
// Completed Job Row
// ============================================================================

export interface CompletedJobRowProps {
  data: JobRowData;
  onDelete: (id: string) => void;
  onImport?: (id: string, mangaId: number, mangaTitle: string) => void;
  onShowInfo?: (data: JobRowData) => void;
  isDeleting: boolean;
}

export function CompletedJobRow({ data, onDelete, onImport, onShowInfo, isDeleting }: CompletedJobRowProps): React.ReactElement {
  const { taskId, taskType, taskName, protocol, client, fileName, completedAt, createdAt, mangaId } = data;
  const statusBadge = getStatusBadge('completed');
  const badgeColors = getStatusBadgeColors(statusBadge.color);
  const isDownload = typeof taskType === 'string' && taskType === JobType.chapter_download;
  const timeAgo = completedAt ? formatDistanceToNow(new Date(completedAt), { addSuffix: true }) : '-';

  return (
    <tr>
      <td><Text size="sm" style={{ color: '#e0e0e0' }}>#{String(taskId)}</Text></td>
      <td><FileNameCell fileName={fileName} onClick={() => onShowInfo?.(data)} /></td>
      <td><SourceBadge taskType={taskType} /></td>
      <td><Text size="sm" lineClamp={1} style={{ color: '#e0e0e0' }}>{taskName}</Text></td>
      <td>
        <Group gap="xs" style={FLEX_KEEP_INLINE}>
          {statusBadge.icon}
          <Badge size="sm" color="green" variant="light"
            styles={{ root: { backgroundColor: badgeColors.backgroundColor, color: badgeColors.textColor } }}>
            {statusBadge.label}
          </Badge>
        </Group>
      </td>
      <td><Text size="sm" style={{ color: '#e0e0e0', ...TEXT_KEEP_INLINE }}>{formatAddedOn(createdAt)}</Text></td>
      <td><Text size="sm" style={{ color: '#e0e0e0', ...TEXT_KEEP_INLINE }}>{timeAgo}</Text></td>
      <td><ProtocolBadge protocol={protocol} /></td>
      <td><Text size="sm" style={{ color: '#e0e0e0' }}>{client}</Text></td>
      <td style={{ textAlign: 'right' }}>
        <Group gap="xs" justify="flex-end">
          {isDownload && onImport && typeof mangaId === 'number' && mangaId > 0 && (
            <Tooltip label="Manual import">
              <ActionIcon color="blue" variant="light" size="sm"
                onClick={() => onImport(String(taskId), mangaId, taskName)}>
                <IconFolder size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Delete job">
            <ActionIcon color="red" variant="light" size="sm" loading={isDeleting}
              onClick={() => { onDelete(String(taskId)); }}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </td>
    </tr>
  );
}

// ============================================================================
// Failed Job Row
// ============================================================================

export interface FailedJobRowProps {
  data: JobRowData;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onShowInfo?: (data: JobRowData) => void;
  isRetrying: boolean;
  isDeleting: boolean;
}

export function FailedJobRow({ data, onRetry, onDelete, onShowInfo, isRetrying, isDeleting }: FailedJobRowProps): React.ReactElement {
  const { taskId, taskType, taskName, protocol, client, fileName, errorMessage, createdAt } = data;
  const statusBadge = getStatusBadge('failed');
  const badgeColors = getStatusBadgeColors(statusBadge.color);

  return (
    <tr>
      <td><Text size="sm" style={{ color: '#e0e0e0' }}>#{String(taskId)}</Text></td>
      <td><FileNameCell fileName={fileName} onClick={() => onShowInfo?.(data)} /></td>
      <td><SourceBadge taskType={taskType} /></td>
      <td><Text size="sm" lineClamp={1} style={{ color: '#e0e0e0' }}>{taskName}</Text></td>
      <td>
        <Group gap="xs" style={FLEX_KEEP_INLINE}>
          {statusBadge.icon}
          <Badge size="sm" color="red" variant="light"
            styles={{ root: { backgroundColor: badgeColors.backgroundColor, color: badgeColors.textColor } }}>
            {statusBadge.label}
          </Badge>
        </Group>
      </td>
      <td><Text size="sm" style={{ color: '#e0e0e0', ...TEXT_KEEP_INLINE }}>{formatAddedOn(createdAt)}</Text></td>
      <td>
        <Text size="sm" c="red" lineClamp={1} title={errorMessage}>{errorMessage ?? 'Unknown error'}</Text>
      </td>
      <td><ProtocolBadge protocol={protocol} /></td>
      <td><Text size="sm" style={{ color: '#e0e0e0' }}>{client}</Text></td>
      <td style={{ textAlign: 'right' }}>
        <Group gap="xs" justify="flex-end">
          <Tooltip label="Retry job">
            <ActionIcon color="blue" variant="light" size="sm" loading={isRetrying}
              onClick={() => { onRetry(String(taskId)); }}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete job">
            <ActionIcon color="red" variant="light" size="sm" loading={isDeleting}
              onClick={() => { onDelete(String(taskId)); }}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </td>
    </tr>
  );
}
