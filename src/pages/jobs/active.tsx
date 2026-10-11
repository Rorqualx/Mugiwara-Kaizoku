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
  Stack, Container, Card, Text, Table, Center, Pagination, Loader, Tabs,
} from '@mantine/core';
import { useRouter } from 'next/router';

import { isRecord } from '@/components/jobs/active-job-helpers';
import type { JobRowData } from '@/components/jobs/active-job-helpers';
import { runCancelAndBlock } from '@/components/jobs/active-page/cancel-and-block';
import {
  enrichRowData, renderActiveTabRows, renderMixedTabRows, type MutationActions,
} from '@/components/jobs/active-page/job-rows';
import {
  JobsHeader, SortableTh, TabCount, isJobTab, PAGINATION_STYLES, TABLE_STYLES, type JobTab,
} from '@/components/jobs/active-page/JobsHeader';
import { sortJobs } from '@/components/jobs/job-sort';
import type { JobSortDir, JobSortKey } from '@/components/jobs/job-sort';
import { JobInfoModal } from '@/components/jobs/JobInfoModal';
import { TrackDownloadModal } from '@/components/jobs/TrackDownloadModal';
import { MainLayout } from '@/components/layouts/MainLayout';
import { ManualImportModal } from '@/components/manga/ManualImportModal';
import { useJobQueries, useJobMutations } from '@/hooks/jobs/useJobsPage';
import { useJobsRealtime } from '@/hooks/jobs/useJobsRealtime';
import { useTrackedDownloads } from '@/hooks/useTrackedDownloads';
import { mapChaptersForImport, getSavePath } from '@/utils/jobs/completed-utils';
import { trpc } from '@/utils/trpc-client/index';

interface ManualImportState {
  opened: boolean;
  jobId: string;
  mangaId: number;
  mangaTitle: string;
  savePath?: string | undefined;
}

// ============================================================================
// Main Page Component
// ============================================================================

function ActiveJobsContent(): React.ReactElement {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
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

  const queries = useJobQueries();
  const { refetchActiveStatuses, refetchCompleted, refetchFailed, refetchAll } = queries;
  const mutations = useJobMutations(refetchActiveStatuses);
  const { getState: getTrackedState } = useTrackedDownloads();

  // Live progress overlay + event-driven refetches + polling fallback. Only
  // the stable refetch callbacks are passed in (never the `queries` object,
  // which is rebuilt whenever any of its five result sets changes).
  const overlay = useJobsRealtime({ refetchActiveStatuses, refetchCompleted, refetchFailed, refetchAll });

  // Set initial tab from query param (used by redirects from /jobs/failed, /jobs/completed)
  const tabParam = router.query['tab'];
  useEffect(() => {
    if (isJobTab(tabParam)) setActiveTab(tabParam);
  }, [tabParam]);

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
    filteredJobs.filter(isRecord).map(t => enrichRowData(t, overlay)),
    [filteredJobs, overlay]);

  const sortedJobs = useMemo((): JobRowData[] =>
    sortKey ? sortJobs(enrichedJobs, sortKey, sortDir) : enrichedJobs,
    [enrichedJobs, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedJobs.length / itemsPerPage);
  const paginatedJobs = sortedJobs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  // Manual import handler
  const handleImport = useCallback((jobId: string, mangaId: number, mangaTitle: string): void => {
    const job = (queries.completedJobs ?? []).find(
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
