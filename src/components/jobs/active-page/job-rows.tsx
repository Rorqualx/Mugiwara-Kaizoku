/**
 * Row rendering for the Jobs page table.
 *
 * @module components/jobs/active-page/job-rows
 */
import React from 'react';

import {
  extractJobRowData, JobRow, TorrentGroupRow, groupJobsByDownloadId,
} from '@/components/jobs/active-job-helpers';
import type { JobRowData } from '@/components/jobs/active-job-helpers';
import { CompletedJobRow, FailedJobRow } from '@/components/jobs/completed-failed-rows';
import type { JobLiveOverlay } from '@/hooks/jobs/useJobsRealtime';

/** Row-level callbacks and pending flags shared by every row type. */
export interface MutationActions {
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

/** Builds a table row from a queried job and the live WebSocket overlay. */
export function enrichRowData(task: Record<string, unknown>, overlay: JobLiveOverlay): JobRowData {
  const rowData = extractJobRowData(task);
  const taskIdStr = String(rowData.taskId);
  const wsProgress = overlay.progressMap[taskIdStr];
  if (wsProgress !== undefined && wsProgress > rowData.progress) {
    rowData.progress = wsProgress;
  }
  const wsStatus = overlay.statusMap[taskIdStr];
  if (wsStatus) { rowData.wsStatus = wsStatus; }
  const stats = overlay.statsMap[taskIdStr];
  if (stats?.speed !== undefined) rowData.speed = stats.speed;
  if (stats?.eta !== undefined) rowData.eta = stats.eta;
  return rowData;
}

/** Rows for the Active tab: jobs sharing a download are grouped under it. */
export function renderActiveTabRows(rows: JobRowData[], actions: MutationActions): React.ReactNode {
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

/** Rows for the All / Completed / Failed tabs: one row per job, by status. */
export function renderMixedTabRows(rows: JobRowData[], actions: MutationActions): React.ReactNode {
  return rows.map(rowData => renderMixedRow(rowData, actions));
}
