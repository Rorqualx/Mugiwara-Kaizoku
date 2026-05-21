/** Active Jobs Page — helper components & utilities (extracted from active.tsx). */
import React, { useState } from 'react';
import type { ReactElement } from 'react';

import { Group, Text, Badge, Progress, ActionIcon, Tooltip } from '@mantine/core';
import {
  IconX, IconRefresh, IconClock, IconAlertCircle, IconPlayerPlay,
  IconDownload, IconChevronDown, IconChevronRight, IconCheck,
  IconAlertTriangle, IconPlayerPause, IconEyeOff,
} from '@tabler/icons-react';

import { JobType } from '@/utils/job-validation';

import { FileNameCell } from './FileNameCell';
import { extractClient, extractErrorMessage, extractFileName, extractProtocol } from './job-row-extractors';
import { isRecord } from './job-row-helpers';
import { coerceTimestamp, formatAddedOn, formatSpeed, formatEta } from './live-stats-formatters';
import { MangaNameCell } from './MangaNameCell';
import { ProtocolBadge, SourceBadge } from './source-badge';
import { FLEX_KEEP_INLINE, TEXT_KEEP_INLINE, muted } from './theme-text-styles';

export { isRecord, extractErrorMessage, formatAddedOn, formatSpeed, formatEta, FileNameCell };

export interface JobRowData {
  taskId: unknown;
  taskType: unknown;
  taskStatus: unknown;
  taskName: string;
  protocol: string;
  client: string;
  fileName: string;
  progress: number;
  wsStatus?: string;
  downloadId?: string | undefined;
  errorMessage?: string | undefined;
  completedAt?: string | undefined;
  createdAt?: string | undefined;
  mangaId?: number | undefined;
  /** Live download speed in bytes/sec from the download client (Transmission/SAB/NZBGet) */
  speed?: number | undefined;
  /** Live ETA in seconds from the download client */
  eta?: number | undefined;
  /** Original task row from the tRPC response — used by JobInfoModal to read payload/result. */
  __raw?: Record<string, unknown> | undefined;
}

export function extractJobRowData(task: Record<string, unknown>): JobRowData {
  const taskId = task['id'];
  const taskType = task['job_type'];
  const taskStatus = task['status'];
  const mangaData = task['manga'] && isRecord(task['manga']) ? task['manga'] : null;
  const taskName = mangaData?.['title'] ? String(mangaData['title']) : 'System Task';
  const mangaIdRaw = mangaData?.['id'];
  const mangaId = typeof mangaIdRaw === 'number' ? mangaIdRaw : undefined;
  const taskPayload = task['payload'] && isRecord(task['payload']) ? task['payload'] : null;
  const taskResult = task['result'] && isRecord(task['result']) ? task['result'] : null;
  const prowlarrResult = taskPayload?.['prowlarrResult'] && isRecord(taskPayload['prowlarrResult'])
    ? taskPayload['prowlarrResult'] : null;
  const protocol = extractProtocol(prowlarrResult, taskPayload, taskType);
  const client = extractClient(taskResult, taskPayload, taskType);
  const fileName = extractFileName(taskResult, prowlarrResult, taskPayload, task);
  const progress = typeof task['progress'] === 'number' ? task['progress'] : 0;
  const downloadId = taskResult?.['downloadId'] ? String(taskResult['downloadId']) : undefined;
  const errorMessage = extractErrorMessage(task['lastError']);
  const completedAt = coerceTimestamp(task['completedAt'] ?? task['completed_at']);
  const createdAt = coerceTimestamp(task['createdAt'] ?? task['created_at']);
  return {
    taskId, taskType, taskStatus, taskName, protocol, client, fileName,
    progress, downloadId, errorMessage, completedAt, createdAt, mangaId,
    __raw: task,
  };
}

function getStatusBadgeColors(color: string): { backgroundColor: string; textColor: string } {
  switch (color) {
    case 'yellow': return { backgroundColor: 'rgba(250, 176, 5, 0.1)', textColor: '#fab005' };
    case 'blue': return { backgroundColor: 'rgba(34, 139, 230, 0.1)', textColor: '#228be6' };
    case 'cyan': return { backgroundColor: 'rgba(21, 170, 191, 0.1)', textColor: '#15aabf' };
    case 'orange': return { backgroundColor: 'rgba(253, 126, 20, 0.1)', textColor: '#fd7e14' };
    case 'green': return { backgroundColor: 'rgba(64, 192, 87, 0.1)', textColor: '#40c057' };
    case 'teal': return { backgroundColor: 'rgba(18, 184, 134, 0.1)', textColor: '#12b886' };
    case 'red': return { backgroundColor: 'rgba(248, 113, 113, 0.1)', textColor: '#f87171' };
    default: return { backgroundColor: 'rgba(134, 142, 150, 0.1)', textColor: '#868e96' };
  }
}

const TASK_TYPE_LABELS: Partial<Record<JobType, string>> = {
  [JobType.chapter_check]: 'Check Chapters',
  [JobType.chapter_download]: 'Prowlarr',
  [JobType.mangadex_download]: 'MangaDex',
  [JobType.suwayomi_download]: 'Suwayomi',
  [JobType.getcomics_download]: 'GetComics',
  [JobType.metadata_refresh]: 'Metadata Refresh',
  [JobType.library_scan]: 'Library Scan',
  [JobType.backup_create]: 'Backup',
  [JobType.chapter_sync]: 'Sync Fix',
};

export const getTaskTypeLabel = (type: JobType): string =>
  TASK_TYPE_LABELS[type] ?? type.replace(/_/g, ' ');

type StatusBadge = { label: string; color: string; icon: ReactElement };

const trackedStateBadge = (trackedState: string): StatusBadge | null => {
  switch (trackedState) {
    case 'ImportPending':
      return { label: 'Import Pending', color: 'teal', icon: <IconClock size={14} /> };
    case 'Importing':
      return { label: 'Importing', color: 'green', icon: <IconDownload size={14} /> };
    case 'ImportBlocked':
      return { label: 'Import Blocked', color: 'red', icon: <IconAlertTriangle size={14} /> };
    case 'DownloadPaused':
      return { label: 'Paused', color: 'yellow', icon: <IconPlayerPause size={14} /> };
    case 'Ignored':
      return { label: 'Ignored', color: 'gray', icon: <IconEyeOff size={14} /> };
    case 'Downloading':
      return { label: 'Downloading', color: 'blue', icon: <IconDownload size={14} /> };
    case 'DownloadFailed':
      return { label: 'Download Failed', color: 'red', icon: <IconX size={14} /> };
    case 'Imported':
      return { label: 'Imported', color: 'green', icon: <IconCheck size={14} /> };
    case 'Failed':
      return { label: 'Failed', color: 'red', icon: <IconX size={14} /> };
    default:
      return null; // Fall through to existing logic for unknown tracked states
  }
};

export const getStatusBadge = (
  status: string,
  wsStatus?: string,
  progress?: number,
  trackedState?: string,
): StatusBadge => {
  // Tracked download state takes priority when available
  if (trackedState) {
    const tracked = trackedStateBadge(trackedState);
    if (tracked) return tracked;
  }

  if (wsStatus === 'importing') {
    return { label: 'Importing', color: 'green', icon: <IconDownload size={14} /> };
  }
  if (wsStatus === 'processing') {
    return { label: 'Processing', color: 'cyan', icon: <IconRefresh size={14} /> };
  }
  const s = status.toLowerCase();
  switch (s) {
    case 'pending':
      return { label: 'Queued', color: 'yellow', icon: <IconClock size={14} /> };
    case 'active': {
      // Granular status based on progress
      if (progress !== undefined && progress >= 100) return { label: 'Processing', color: 'cyan', icon: <IconRefresh size={14} /> };
      if (progress !== undefined && progress > 0) return { label: 'Downloading', color: 'blue', icon: <IconDownload size={14} /> };
      return { label: 'Starting', color: 'blue', icon: <IconPlayerPlay size={14} /> };
    }
    case 'retrying':
      return { label: 'Retrying', color: 'orange', icon: <IconRefresh size={14} /> };
    case 'completed':
      return { label: 'Completed', color: 'green', icon: <IconCheck size={14} /> };
    case 'failed':
      return { label: 'Failed', color: 'red', icon: <IconX size={14} /> };
    default:
      return { label: status, color: 'gray', icon: <IconAlertCircle size={14} /> };
  }
};

// ============================================================================
// Active Job Row
// ============================================================================

export interface JobRowProps {
  data: JobRowData;
  onCancel: (id: string) => void;
  isCancelling: boolean;
  trackedState?: string | undefined;
  onRetryImport?: ((jobId: string) => void) | undefined;
  onIgnore?: ((jobId: string) => void) | undefined;
  onShowInfo?: ((data: JobRowData) => void) | undefined;
}

export function JobRow({ data, onCancel, isCancelling, trackedState, onRetryImport, onIgnore, onShowInfo }: JobRowProps): React.ReactElement {
  const { taskId, taskType, taskStatus, taskName, protocol, client, fileName, progress, wsStatus, speed, eta, mangaId } = data;
  const statusBadge = getStatusBadge(
    typeof taskStatus === 'string' ? taskStatus : 'unknown',
    wsStatus,
    progress,
    trackedState,
  );
  const badgeColors = getStatusBadgeColors(statusBadge.color);
  const isImporting = wsStatus === 'importing' || trackedState === 'Importing';
  const barColor = isImporting ? 'green' : progress >= 100 ? 'green' : 'blue';
  const liveStats = (speed !== undefined || eta !== undefined) && !isImporting
    ? `↓ ${speed !== undefined ? formatSpeed(speed) : '—'}${eta !== undefined ? ` · ETA ${formatEta(eta)}` : ''}`
    : null;

  return (
    <tr key={String(taskId)}>
      <td><Text size="sm" style={{ color: '#e0e0e0' }}>#{String(taskId)}</Text></td>
      <td><FileNameCell fileName={fileName} onClick={() => onShowInfo?.(data)} /></td>
      <td><SourceBadge taskType={taskType} /></td>
      <td><MangaNameCell taskName={taskName} mangaId={mangaId} /></td>
      <td>
        <Group gap="xs" style={FLEX_KEEP_INLINE}>
          {statusBadge.icon}
          <Badge size="sm" color={statusBadge.color} variant="light"
            styles={{ root: { backgroundColor: badgeColors.backgroundColor, color: badgeColors.textColor } }}>
            {statusBadge.label}
          </Badge>
        </Group>
      </td>
      <td><Text size="sm" style={{ color: '#e0e0e0', ...TEXT_KEEP_INLINE }}>{formatAddedOn(data.createdAt)}</Text></td>
      <td style={{ minWidth: 160 }}>
        <Group gap={6}>
          <Progress value={isImporting ? 100 : progress} size="sm" radius="xl"
            color={barColor} animated={isImporting || (progress > 0 && progress < 100)}
            style={{ flex: 1 }} />
          <Text size="xs" style={muted({ minWidth: 32, textAlign: 'right' })}>
            {isImporting ? 'Import' : `${progress}%`}
          </Text>
        </Group>
        {liveStats && <Text size="xs" mt={2} style={muted()}>{liveStats}</Text>}
      </td>
      <td><ProtocolBadge protocol={protocol} /></td>
      <td><Text size="sm" style={{ color: '#e0e0e0' }}>{client}</Text></td>
      <td style={{ textAlign: 'right' }}>
        <Group gap="xs" justify="flex-end">
          {trackedState === 'ImportBlocked' && (
            <>
              <Tooltip label="Retry Import">
                <ActionIcon color="teal" variant="light" size="sm"
                  onClick={() => { onRetryImport?.(String(taskId)); }}>
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Ignore">
                <ActionIcon color="gray" variant="light" size="sm"
                  onClick={() => { onIgnore?.(String(taskId)); }}>
                  <IconEyeOff size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
          <Tooltip label="Cancel task">
            <ActionIcon color="red" variant="light" onClick={() => { onCancel(String(taskId)); }}
              loading={isCancelling} size="sm">
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </td>
    </tr>
  );
}

// ============================================================================
// Torrent Grouping
// ============================================================================

export interface TorrentGroup {
  downloadId: string;
  jobs: JobRowData[];
  mangaTitle: string;
  releaseTitle: string;
  avgProgress: number;
  protocol: string;
  client: string;
  /** Live speed (bytes/sec) — taken from any job in the group with a value (all share one torrent) */
  speed?: number | undefined;
  /** Live ETA (seconds) */
  eta?: number | undefined;
}


export interface GroupedJobs {
  groups: TorrentGroup[];
  ungrouped: JobRowData[];
}

/** Groups jobs sharing the same downloadId into visual groups */
export function groupJobsByDownloadId(jobs: JobRowData[]): GroupedJobs {
  const groupMap = new Map<string, JobRowData[]>();
  const ungrouped: JobRowData[] = [];

  for (const job of jobs) {
    if (job.downloadId) {
      const existing = groupMap.get(job.downloadId);
      if (existing) {
        existing.push(job);
      } else {
        groupMap.set(job.downloadId, [job]);
      }
    } else {
      ungrouped.push(job);
    }
  }

  const groups: TorrentGroup[] = [];
  for (const [downloadId, groupJobs] of groupMap) {
    const firstJob = groupJobs[0];
    if (groupJobs.length === 1 && firstJob) {
      ungrouped.push(firstJob);
      continue;
    }

    if (!firstJob) continue;
    const totalProgress = groupJobs.reduce((sum, j) => sum + j.progress, 0);
    // All jobs in the group share one torrent — speed/eta are identical from
    // the monitor, so take the first non-undefined one.
    const speed = groupJobs.find(j => j.speed !== undefined)?.speed;
    const eta = groupJobs.find(j => j.eta !== undefined)?.eta;

    groups.push({
      downloadId,
      jobs: groupJobs,
      mangaTitle: firstJob.taskName,
      releaseTitle: firstJob.fileName,
      avgProgress: Math.round(totalProgress / groupJobs.length),
      protocol: firstJob.protocol,
      client: firstJob.client,
      ...(speed !== undefined ? { speed } : {}),
      ...(eta !== undefined ? { eta } : {}),
    });
  }

  return { groups, ungrouped };
}

// ============================================================================
// Torrent Group Row Component
// ============================================================================

export interface TorrentGroupRowProps {
  group: TorrentGroup;
  onCancel: (id: string) => void;
  isCancelling: boolean;
  getTrackedState?: (jobId: string) => string | undefined;
  onRetryImport?: (jobId: string) => void;
  onIgnore?: (jobId: string) => void;
  onShowInfo?: (data: JobRowData) => void;
}

export function TorrentGroupRow({ group, onCancel, isCancelling, getTrackedState, onRetryImport, onIgnore, onShowInfo }: TorrentGroupRowProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const { downloadId, jobs, mangaTitle, releaseTitle, avgProgress, protocol, client, speed, eta } = group;
  const liveStats = speed !== undefined || eta !== undefined
    ? `↓ ${speed !== undefined ? formatSpeed(speed) : '—'}${eta !== undefined ? ` · ETA ${formatEta(eta)}` : ''}`
    : null;

  const anyImporting = jobs.some(j => j.wsStatus === 'importing');
  const barColor = anyImporting ? 'green' : avgProgress >= 100 ? 'green' : 'blue';

  const statuses = jobs.map(j => typeof j.taskStatus === 'string' ? j.taskStatus : 'unknown');
  const aggregateStatus = statuses.includes('active') ? 'active' : statuses.includes('retrying') ? 'retrying' : 'pending';
  const statusBadge = getStatusBadge(aggregateStatus, anyImporting ? 'importing' : undefined, avgProgress);
  const badgeColors = getStatusBadgeColors(statusBadge.color);

  const handleCancelGroup = (): void => {
    for (const job of jobs) {
      onCancel(String(job.taskId));
    }
  };

  return (
    <React.Fragment>
      <tr
        style={{ cursor: 'pointer', backgroundColor: 'rgba(122, 162, 247, 0.05)' }}
        onClick={() => setExpanded(prev => !prev)}
      >
        <td>
          <Group gap={4}>
            {expanded
              ? <IconChevronDown size={14} style={{ color: '#7aa2f7' }} />
              : <IconChevronRight size={14} style={{ color: '#7aa2f7' }} />}
            <Text size="sm" truncate style={muted({ maxWidth: 60 })} title={downloadId}>
              {downloadId.slice(0, 8)}...
            </Text>
          </Group>
        </td>
        <td><FileNameCell fileName={releaseTitle} onClick={() => { if (jobs[0]) onShowInfo?.(jobs[0]); }} /></td>
        <td><SourceBadge taskType={JobType.chapter_download} /></td>
        <td>
          <Group gap={6}>
            <Text size="sm" lineClamp={1} style={{ color: '#e0e0e0' }}>{mangaTitle}</Text>
            <Badge size="xs" color="blue" variant="filled">{jobs.length} chapters</Badge>
          </Group>
        </td>
        <td>
          <Group gap="xs" style={FLEX_KEEP_INLINE}>
            {statusBadge.icon}
            <Badge size="sm" color={statusBadge.color} variant="light"
              styles={{ root: { backgroundColor: badgeColors.backgroundColor, color: badgeColors.textColor } }}>
              {statusBadge.label}
            </Badge>
          </Group>
        </td>
        <td><Text size="sm" style={{ color: '#e0e0e0', ...TEXT_KEEP_INLINE }}>{formatAddedOn(jobs.map(j => j.createdAt).filter((v): v is string => Boolean(v)).sort()[0])}</Text></td>
        <td style={{ minWidth: 160 }}>
          <Group gap={6}>
            <Progress value={anyImporting ? 100 : avgProgress} size="sm" radius="xl"
              color={barColor} animated={anyImporting || (avgProgress > 0 && avgProgress < 100)}
              style={{ flex: 1 }} />
            <Text size="xs" style={muted({ minWidth: 32, textAlign: 'right' })}>
              {anyImporting ? 'Import' : `${avgProgress}%`}
            </Text>
          </Group>
          {liveStats && !anyImporting && (
            <Text size="xs" mt={2} style={muted()}>{liveStats}</Text>
          )}
        </td>
        <td><ProtocolBadge protocol={protocol} /></td>
        <td><Text size="sm" style={{ color: '#e0e0e0' }}>{client}</Text></td>
        <td style={{ textAlign: 'right' }}>
          <Tooltip label={`Cancel all ${jobs.length} jobs`}>
            <ActionIcon color="red" variant="light" onClick={(e) => { e.stopPropagation(); handleCancelGroup(); }}
              loading={isCancelling} size="sm">
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </td>
      </tr>
      {expanded && jobs.map((job) => {
        const childTrackedState = getTrackedState?.(String(job.taskId));
        return (
          <tr key={String(job.taskId)} style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
            <td style={{ paddingLeft: 28 }}><Text size="xs" style={{ color: '#e0e0e0' }}>#{String(job.taskId)}</Text></td>
            <td><FileNameCell fileName={job.fileName} size="xs" onClick={() => onShowInfo?.(job)} /></td>
            <td><SourceBadge taskType={job.taskType} size="xs" /></td>
            <td><MangaNameCell taskName={job.taskName} mangaId={job.mangaId} size="xs" /></td>
            <td>
              {(() => {
                const childStatus = getStatusBadge(
                  typeof job.taskStatus === 'string' ? job.taskStatus : 'unknown',
                  job.wsStatus,
                  job.progress,
                  childTrackedState,
                );
                const childColors = getStatusBadgeColors(childStatus.color);
                return (
                  <Group gap="xs" style={FLEX_KEEP_INLINE}>
                    {childStatus.icon}
                    <Badge size="xs" color={childStatus.color} variant="light"
                      styles={{ root: { backgroundColor: childColors.backgroundColor, color: childColors.textColor } }}>
                      {childStatus.label}
                    </Badge>
                  </Group>
                );
              })()}
            </td>
            <td><Text size="xs" style={{ color: '#e0e0e0', ...TEXT_KEEP_INLINE }}>{formatAddedOn(job.createdAt)}</Text></td>
            <td style={{ minWidth: 140 }}>
              <Group gap={6}>
                <Progress value={job.wsStatus === 'importing' ? 100 : job.progress} size="xs" radius="xl"
                  color={job.wsStatus === 'importing' ? 'green' : job.progress >= 100 ? 'green' : 'blue'}
                  animated={job.wsStatus === 'importing' || (job.progress > 0 && job.progress < 100)}
                  style={{ flex: 1 }} />
                <Text size="xs" style={muted({ minWidth: 32, textAlign: 'right' })}>
                  {job.wsStatus === 'importing' ? 'Import' : `${job.progress}%`}
                </Text>
              </Group>
            </td>
            <td><ProtocolBadge protocol={job.protocol} size="xs" /></td>
            <td><Text size="xs" style={{ color: '#e0e0e0' }}>{job.client}</Text></td>
            <td style={{ textAlign: 'right' }}>
              <Group gap="xs" justify="flex-end">
                {childTrackedState === 'ImportBlocked' && (
                  <>
                    <Tooltip label="Retry Import">
                      <ActionIcon color="teal" variant="subtle" size="xs"
                        onClick={(e) => { e.stopPropagation(); onRetryImport?.(String(job.taskId)); }}>
                        <IconRefresh size={12} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Ignore">
                      <ActionIcon color="gray" variant="subtle" size="xs"
                        onClick={(e) => { e.stopPropagation(); onIgnore?.(String(job.taskId)); }}>
                        <IconEyeOff size={12} />
                      </ActionIcon>
                    </Tooltip>
                  </>
                )}
                <Tooltip label="Cancel task">
                  <ActionIcon color="red" variant="subtle" onClick={() => { onCancel(String(job.taskId)); }}
                    loading={isCancelling} size="xs">
                    <IconX size={12} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </td>
          </tr>
        );
      })}
    </React.Fragment>
  );
}
