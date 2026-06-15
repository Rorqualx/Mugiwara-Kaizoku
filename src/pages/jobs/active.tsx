/**
 * Unified Jobs Page
 *
 * Displays all jobs across all statuses: active, pending, retrying, completed, and failed.
 * Provides tab-based filtering, real-time monitoring, bulk actions, and manual import.
 *
 * @module pages/jobs/active
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from 'react';

import {
  Title, Stack, Container, Card, Group, Text, Badge,
  Table, Center, Pagination, Loader, Tabs, ActionIcon, Tooltip,
} from '@mantine/core';
import {
  IconPlayerPlay, IconTrash, IconLink, IconArrowUp, IconArrowDown, IconArrowsSort,
} from '@tabler/icons-react';
import { useRouter } from 'next/router';

import {
  extractJobRowData, JobRow, TorrentGroupRow,
  isRecord, groupJobsByDownloadId
} from '@/components/jobs/active-job-helpers';
import type { JobRowData } from '@/components/jobs/active-job-helpers';
import { CompletedJobRow, FailedJobRow } from '@/components/jobs/completed-failed-rows';
import { sortJobs } from '@/components/jobs/job-sort';
import type { JobSortDir, JobSortKey } from '@/components/jobs/job-sort';
import { JobInfoModal } from '@/components/jobs/JobInfoModal';
import { TrackDownloadModal } from '@/components/jobs/TrackDownloadModal';
import { MainLayout } from '@/components/layouts/MainLayout';
import { ManualImportModal } from '@/components/manga/ManualImportModal';
import { useJobQueries, useJobMutations, type JobMutationsReturn } from '@/hooks/jobs/useJobsPage';
import { useTrackedDownloads } from '@/hooks/useTrackedDownloads';
import { useRealTime } from '@/providers/RealTimeProvider';
import { mapChaptersForImport, getSavePath } from '@/utils/jobs/completed-utils';
import { extractBtihFromMagnet } from '@/utils/magnet';
import { trpc } from '@/utils/trpc-client/index';

type JobTab = 'all' | 'active' | 'completed' | 'failed';

// ============================================================================
// Cancel & Blocklist helper (top-level to keep handler nesting flat)
// ============================================================================

/** Pull Prowlarr-sourced release hints (guid, indexerId) from the job's raw
 *  payload when present. Native/pack-import jobs return all-undefined and
 *  block by title + mangaId only. */
function extractReleaseHints(data: JobRowData): { guid?: string; indexerId?: string; source?: string } {
  const payload = data.__raw?.['payload'];
  const prowlarrResult = isRecord(payload) && isRecord(payload['prowlarrResult'])
    ? payload['prowlarrResult'] : null;
  const guid = prowlarrResult && typeof prowlarrResult['guid'] === 'string' ? prowlarrResult['guid'] : undefined;
  const indexerIdRaw = prowlarrResult?.['indexerId'];
  const indexerId = typeof indexerIdRaw === 'number' ? String(indexerIdRaw)
    : typeof indexerIdRaw === 'string' ? indexerIdRaw : undefined;
  const source = typeof data.protocol === 'string' && data.protocol.length > 0 ? data.protocol : undefined;
  return {
    ...(guid !== undefined ? { guid } : {}),
    ...(indexerId !== undefined ? { indexerId } : {}),
    ...(source !== undefined ? { source } : {}),
  };
}

/** Block the release first, then cancel — independent of each other so a
 *  block-failure (e.g. duplicate) still cancels the job.
 *
 *  Normalize the `releaseHash` field to the magnet BTIH up-front so the
 *  dispatcher's lookup (which extracts BTIH from the post-redirect
 *  downloadUrl) actually matches on retrigger. Before Fix 1.1 this was
 *  the full magnet URL string and silently never matched. */
async function runCancelAndBlock(
  data: JobRowData,
  blockRelease: JobMutationsReturn['blockRelease'],
  cancelTask: JobMutationsReturn['cancelTask'],
): Promise<void> {
  const hints = extractReleaseHints(data);
  const releaseHash = hints.guid !== undefined ? extractBtihFromMagnet(hints.guid) : undefined;
  await blockRelease.mutateAsync({
    release: {
      releaseTitle: data.fileName,
      ...(releaseHash !== undefined ? { releaseHash } : {}),
      ...(hints.indexerId !== undefined ? { indexerId: hints.indexerId } : {}),
      ...(data.mangaId !== undefined ? { mangaId: data.mangaId } : {}),
      ...(hints.source !== undefined ? { source: hints.source } : {}),
    },
    reason: 'USER_PREFERENCE',
    reasonDetails: 'Blocked from Jobs page via cancel-and-blocklist',
  }).catch(() => { /* notification already shown by mutation; proceed with cancel */ });
  await cancelTask.mutateAsync({ id: String(data.taskId) });
}

interface ManualImportState {
  opened: boolean;
  jobId: string;
  mangaId: number;
  mangaTitle: string;
  savePath?: string | undefined;
}

interface MutationActions {
  onCancel: (id: string) => void;
  onCancelAndBlock: (data: JobRowData) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: (id: string, mangaId: number, mangaTitle: string) => void;
  onRetryImport: (id: string) => void;
  onIgnore: (id: string) => void;
  onShowInfo: (data: JobRowData) => void;
  isCancelling: boolean;
  isRetrying: boolean;
  isDeleting: boolean;
  getTrackedState: (jobId: string) => string | undefined;
}

const TABLE_STYLES = {
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

const PAGINATION_STYLES = {
  control: {
    backgroundColor: '#424242', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#e0e0e0',
    '&[data-active]': { backgroundColor: '#7aa2f7', borderColor: '#7aa2f7', color: '#ffffff' },
    '&:hover:not([data-active])': { backgroundColor: '#3a3a3a' },
  },
} as const;

// ============================================================================
// Table Row Renderers (extracted to reduce nesting depth)
// ============================================================================

function enrichRowData(
  task: Record<string, unknown>,
  progressMap: Record<string, number>,
  statusMap: Record<string, string>,
  statsMap: Record<string, { speed?: number; eta?: number }>,
): JobRowData {
  const rowData = extractJobRowData(task);
  const taskIdStr = String(rowData.taskId);
  const wsProgress = progressMap[taskIdStr];
  if (wsProgress !== undefined && wsProgress > rowData.progress) {
    rowData.progress = wsProgress;
  }
  const wsStatus = statusMap[taskIdStr];
  if (wsStatus) { rowData.wsStatus = wsStatus; }
  const stats = statsMap[taskIdStr];
  if (stats?.speed !== undefined) rowData.speed = stats.speed;
  if (stats?.eta !== undefined) rowData.eta = stats.eta;
  return rowData;
}

function renderActiveTabRows(rows: JobRowData[], actions: MutationActions): React.ReactNode {
  const { groups, ungrouped } = groupJobsByDownloadId(rows);
  return (
    <>
      {groups.map(g => (
        <TorrentGroupRow key={g.downloadId} group={g}
          onCancel={actions.onCancel} onCancelAndBlock={actions.onCancelAndBlock}
          isCancelling={actions.isCancelling}
          getTrackedState={actions.getTrackedState}
          onRetryImport={actions.onRetryImport} onIgnore={actions.onIgnore}
          onShowInfo={actions.onShowInfo} />
      ))}
      {ungrouped.map(r => (
        <JobRow key={String(r.taskId)} data={r}
          onCancel={actions.onCancel} onCancelAndBlock={actions.onCancelAndBlock}
          isCancelling={actions.isCancelling}
          trackedState={actions.getTrackedState(String(r.taskId))}
          onRetryImport={actions.onRetryImport} onIgnore={actions.onIgnore}
          onShowInfo={actions.onShowInfo} />
      ))}
    </>
  );
}

function renderMixedRow(rowData: JobRowData, actions: MutationActions): React.ReactElement {
  const status = typeof rowData.taskStatus === 'string' ? rowData.taskStatus.toLowerCase() : '';

  if (status === 'completed') {
    return <CompletedJobRow key={String(rowData.taskId)} data={rowData}
      onDelete={actions.onDelete} onImport={actions.onImport}
      onShowInfo={actions.onShowInfo} isDeleting={actions.isDeleting} />;
  }
  if (status === 'failed') {
    return <FailedJobRow key={String(rowData.taskId)} data={rowData}
      onRetry={actions.onRetry} onDelete={actions.onDelete}
      onShowInfo={actions.onShowInfo}
      isRetrying={actions.isRetrying} isDeleting={actions.isDeleting} />;
  }
  return <JobRow key={String(rowData.taskId)} data={rowData}
    onCancel={actions.onCancel} onCancelAndBlock={actions.onCancelAndBlock}
    isCancelling={actions.isCancelling}
    trackedState={actions.getTrackedState(String(rowData.taskId))}
    onRetryImport={actions.onRetryImport} onIgnore={actions.onIgnore}
    onShowInfo={actions.onShowInfo} />;
}

function renderMixedTabRows(rows: JobRowData[], actions: MutationActions): React.ReactNode {
  return rows.map(rowData => renderMixedRow(rowData, actions));
}

interface SortableThProps {
  label: string;
  columnKey: JobSortKey;
  sortKey: JobSortKey | null;
  sortDir: JobSortDir;
  onSort: (k: JobSortKey) => void;
}

function TabCount({ value, color }: { value: number; color: string }): React.ReactElement {
  return (
    <Badge size="xs" variant="filled" color={color} radius="sm"
      styles={{ root: { minWidth: 24, padding: '0 6px' } }}>
      {value}
    </Badge>
  );
}

function SortableTh({ label, columnKey, sortKey, sortDir, onSort }: SortableThProps): React.ReactElement {
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

// ============================================================================
// Header & Summary Components
// ============================================================================

interface JobsHeaderProps {
  totalCount: number;
  completedCount: number;
  failedCount: number;
  activeTab: JobTab;
  deleteAllCompleted: { mutate: () => void; isPending: boolean };
  deleteAllFailed: { mutate: () => void; isPending: boolean };
  onTrackDownload: () => void;
}

function JobsHeader({ totalCount, completedCount, failedCount, activeTab, deleteAllCompleted, deleteAllFailed, onTrackDownload }: JobsHeaderProps): React.ReactElement {
  return (
    <Group justify="space-between">
      <Title order={2} style={{ color: '#ffffff' }}>
        <Group gap="xs">
          <IconPlayerPlay size={28} style={{ color: '#7aa2f7' }} />
          Jobs
        </Group>
      </Title>
      <Group gap="md">
        <Tooltip label="Track download from client">
          <ActionIcon color="blue" variant="light" size="lg" onClick={onTrackDownload}>
            <IconLink size={18} />
          </ActionIcon>
        </Tooltip>
        <Badge size="lg" color="blue" variant="filled">{totalCount} Total</Badge>
        {completedCount > 0 && activeTab !== 'failed' && (
          <Tooltip label={`Clear all ${completedCount} completed jobs`}>
            <ActionIcon color="green" variant="filled" size="lg"
              loading={deleteAllCompleted.isPending}
              onClick={() => { if (confirm(`Delete all ${completedCount} completed jobs?`)) deleteAllCompleted.mutate(); }}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        {failedCount > 0 && activeTab !== 'completed' && (
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

// ============================================================================
// Main Page Component
// ============================================================================

function ActiveJobsContent(): React.ReactElement {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [statsMap, setStatsMap] = useState<Record<string, { speed?: number; eta?: number }>>({});
  const [activeTab, setActiveTab] = useState<JobTab>('active');
  const [manualImportModal, setManualImportModal] = useState<ManualImportState | null>(null);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [infoModalData, setInfoModalData] = useState<JobRowData | null>(null);
  const [sortKey, setSortKey] = useState<JobSortKey | null>(null);
  const [sortDir, setSortDir] = useState<JobSortDir>('desc');
  const itemsPerPage = 100;

  const handleSort = useCallback((key: JobSortKey) => {
    setSortKey(prevKey => {
      if (prevKey !== key) { setSortDir('asc'); return key; }
      setSortDir(prevDir => prevDir === 'asc' ? 'desc' : 'asc');
      return key;
    });
  }, []);

  const { isConnected, subscribe } = useRealTime();
  const queries = useJobQueries();
  const mutations = useJobMutations(queries.refetchActiveStatuses);
  const { getState: getTrackedState } = useTrackedDownloads();

  // Set initial tab from query param (used by redirects from /jobs/failed, /jobs/completed)
  useEffect(() => {
    const tab = router.query['tab'];
    if (typeof tab === 'string' && ['all', 'active', 'completed', 'failed'].includes(tab)) {
      setActiveTab(tab as JobTab);
    }
  }, [router.query]);

  // Queries for manual import modal
  const { data: chaptersForImport } = trpc.chapter.getByMangaId.useQuery(
    { mangaId: manualImportModal?.mangaId ?? 0 },
    { enabled: manualImportModal !== null && manualImportModal.mangaId > 0 },
  );
  const { data: mangaData } = trpc.manga.get.useQuery(
    { id: manualImportModal?.mangaId ?? 0 },
    { enabled: manualImportModal !== null && manualImportModal.mangaId > 0 },
  );

  // Combined lists and filtering
  const allActiveJobs = useMemo(() => [
    ...(queries.pendingJobs ?? []),
    ...(queries.activeJobs ?? []),
    ...(queries.retryingJobs ?? []),
  ], [queries.pendingJobs, queries.activeJobs, queries.retryingJobs]);

  const filteredJobs = useMemo((): unknown[] => {
    switch (activeTab) {
      case 'active': return allActiveJobs;
      case 'completed': return queries.completedJobs ?? [];
      case 'failed': return queries.failedJobs ?? [];
      default: return [...allActiveJobs, ...(queries.completedJobs ?? []), ...(queries.failedJobs ?? [])];
    }
  }, [activeTab, allActiveJobs, queries.completedJobs, queries.failedJobs]);

  const enrichedJobs = useMemo((): JobRowData[] =>
    filteredJobs.filter(isRecord).map(t => enrichRowData(t, progressMap, statusMap, statsMap)),
    [filteredJobs, progressMap, statusMap, statsMap]);

  const sortedJobs = useMemo((): JobRowData[] =>
    sortKey ? sortJobs(enrichedJobs, sortKey, sortDir) : enrichedJobs,
    [enrichedJobs, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedJobs.length / itemsPerPage);
  const paginatedJobs = sortedJobs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  // WebSocket: download progress handler
  const handleDownloadProgress = useCallback((event: { data?: unknown }) => {
    if (!event.data || typeof event.data !== 'object') return;
    const payload = event.data as Record<string, unknown>;
    const taskId = payload['taskId'];
    const progress = payload['progress'];
    const status = payload['status'];
    const speed = payload['speed'];
    const eta = payload['eta'];
    if (typeof taskId !== 'string') return;
    if (typeof progress === 'number') {
      setProgressMap(prev => ({ ...prev, [taskId]: Math.round(progress) }));
    }
    const speedNum = typeof speed === 'number' ? speed : undefined;
    const etaNum = typeof eta === 'number' ? eta : undefined;
    if (speedNum !== undefined || etaNum !== undefined) {
      setStatsMap(prev => ({ ...prev, [taskId]: {
        ...(speedNum !== undefined ? { speed: speedNum } : {}),
        ...(etaNum !== undefined ? { eta: etaNum } : {}),
      } }));
    }
    if (typeof status === 'string') {
      const isImporting = status === 'importing';
      setStatusMap(prev => isImporting
        ? { ...prev, [taskId]: 'importing' }
        : (() => { const next = { ...prev }; delete next[taskId]; return next; })());
    }
    if (status === 'completed' || status === 'failed') { queries.refetchAll(); }
  }, [queries]);

  // WebSocket subscriptions
  useEffect(() => {
    if (!isConnected) return;
    const unsubs = [
      subscribe('jobs:active', queries.refetchActiveStatuses),
      subscribe('jobs:failed', () => { void queries.refetchFailed(); }),
      subscribe('jobs:completed', () => { void queries.refetchCompleted(); }),
      subscribe('downloads:progress', handleDownloadProgress),
    ];
    return () => { unsubs.forEach(u => u()); };
  }, [isConnected, subscribe, queries, handleDownloadProgress]);

  // Fallback polling
  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(queries.refetchAll, 3000);
    return () => clearInterval(interval);
  }, [isConnected, queries]);

  // Manual import handler
  const handleImport = useCallback((jobId: string, mangaId: number, mangaTitle: string): void => {
    const job = ((queries.completedJobs ?? []) as unknown[]).find(
      j => isRecord(j) && String(j['id']) === jobId,
    );
    const savePath = job && isRecord(job) ? getSavePath(job) : undefined;
    setManualImportModal({ opened: true, jobId, mangaId, mangaTitle, savePath });
  }, [queries.completedJobs]);

  // Loading state
  const isLoading = !queries.pendingJobs && !queries.activeJobs && !queries.retryingJobs
    && !queries.completedJobs && !queries.failedJobs;

  if (isLoading) {
    return (
      <Center h="calc(100vh - 200px)" style={{ backgroundColor: '#333333' }}>
        <Stack align="center">
          <Loader size="xl" color="blue" />
          <Text c="dimmed">Loading jobs...</Text>
        </Stack>
      </Center>
    );
  }

  const activeCount = allActiveJobs.length;
  const completedCount = queries.completedJobs?.length ?? 0;
  const failedCount = queries.failedJobs?.length ?? 0;
  const totalCount = activeCount + completedCount + failedCount;

  const progressColumnLabel = activeTab === 'failed' ? 'Error'
    : activeTab === 'completed' ? 'Completed' : 'Progress';

  const actions: MutationActions = {
    onCancel: (id) => { void mutations.cancelTask.mutateAsync({ id }); },
    onCancelAndBlock: (data) => { void runCancelAndBlock(data, mutations.blockRelease, mutations.cancelTask); },
    onRetry: (id) => { void mutations.retryJob.mutateAsync({ id }); },
    onDelete: (id) => { void mutations.deleteJob.mutateAsync({ id }); },
    onImport: handleImport,
    onRetryImport: (id) => { void mutations.retryImport.mutateAsync({ jobId: id }); },
    onIgnore: (id) => { void mutations.ignoreDownload.mutateAsync({ jobId: id }); },
    onShowInfo: (rowData) => { setInfoModalData(rowData); },
    isCancelling: mutations.cancelTask.isPending,
    isRetrying: mutations.retryJob.isPending,
    isDeleting: mutations.deleteJob.isPending,
    getTrackedState,
  };

  const tableRows = activeTab === 'active'
    ? renderActiveTabRows(paginatedJobs, actions)
    : renderMixedTabRows(paginatedJobs, actions);

  return (
    <Container fluid style={{ paddingTop: '80px', paddingBottom: '20px', paddingLeft: '32px', paddingRight: '32px' }}>
      <Stack gap="xl">
        <JobsHeader totalCount={totalCount} completedCount={completedCount} failedCount={failedCount}
          activeTab={activeTab} deleteAllCompleted={mutations.deleteAllCompleted} deleteAllFailed={mutations.deleteAllFailed}
          onTrackDownload={() => setTrackModalOpen(true)} />

        <Tabs
          value={activeTab}
          onChange={(v) => { if (v) setActiveTab(v as JobTab); }}
          color="blue"
          variant="default"
          styles={{
            list: { borderBottom: '1px solid rgba(255, 255, 255, 0.1)' },
            tab: { color: '#9ca3af', fontWeight: 500, padding: '10px 18px' },
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="active"
              rightSection={<TabCount value={activeCount} color={activeCount > 0 ? 'blue' : 'gray'} />}>
              Active
            </Tabs.Tab>
            <Tabs.Tab value="all"
              rightSection={<TabCount value={totalCount} color="gray" />}>
              All
            </Tabs.Tab>
            <Tabs.Tab value="completed"
              rightSection={<TabCount value={completedCount} color="green" />}>
              Completed
            </Tabs.Tab>
            <Tabs.Tab value="failed"
              rightSection={<TabCount value={failedCount} color="red" />}>
              Failed
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <Card style={{ backgroundColor: '#424242', border: '1px solid rgba(255, 255, 255, 0.1)', padding: 0 }}>
          <Table striped highlightOnHover styles={TABLE_STYLES}>
            <thead>
              <tr>
                <SortableTh label="ID"        columnKey="id"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label="File Name" columnKey="fileName" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label="Source"    columnKey="source"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label="Name"      columnKey="name"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label="Status"    columnKey="status"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label="Add On"    columnKey="addedOn"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label={progressColumnLabel} columnKey="progress" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label="Protocol"  columnKey="protocol" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label="Client"    columnKey="client"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>{tableRows}</tbody>
          </Table>
        </Card>

        {sortedJobs.length > 0 && totalPages > 1 && (
          <Center>
            <Pagination value={currentPage} onChange={setCurrentPage} total={totalPages}
              size="md" radius="md" styles={PAGINATION_STYLES} />
          </Center>
        )}
      </Stack>

      {manualImportModal && (
        <ManualImportModal opened={manualImportModal.opened} onClose={() => setManualImportModal(null)}
          jobId={manualImportModal.jobId} mangaId={manualImportModal.mangaId} mangaTitle={manualImportModal.mangaTitle}
          chapters={mapChaptersForImport((chaptersForImport ?? []) as unknown[])}
          suggestedPath={manualImportModal.savePath} mangaData={mangaData as unknown} />
      )}

      <TrackDownloadModal opened={trackModalOpen}
        onClose={() => setTrackModalOpen(false)}
        onTracked={queries.refetchAll} />

      <JobInfoModal opened={infoModalData !== null}
        onClose={() => setInfoModalData(null)}
        data={infoModalData} />
    </Container>
  );
}

export default function ActiveJobsPage(): React.ReactElement {
  return <ActiveJobsContent />;
}

ActiveJobsPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <MainLayout>{page}</MainLayout>;
};
