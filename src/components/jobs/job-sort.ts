/** Sort helpers for the Jobs page table — shared across all 4 tabs. */
import type { JobRowData } from './active-job-helpers';

export type JobSortKey =
  | 'id' | 'fileName' | 'source' | 'name' | 'status'
  | 'addedOn' | 'progress' | 'protocol' | 'client';
export type JobSortDir = 'asc' | 'desc';

function toComparable(row: JobRowData, key: JobSortKey): string | number {
  switch (key) {
    case 'id': {
      const n = Number(row.taskId);
      return Number.isFinite(n) ? n : String(row.taskId ?? '').toLowerCase();
    }
    case 'fileName': return row.fileName.toLowerCase();
    case 'source':   return typeof row.taskType === 'string' ? row.taskType.toLowerCase() : '';
    case 'name':     return row.taskName.toLowerCase();
    case 'status':   return typeof row.taskStatus === 'string' ? row.taskStatus.toLowerCase() : '';
    case 'addedOn':  return row.createdAt ?? '';
    case 'progress': return row.progress;
    case 'protocol': return row.protocol.toLowerCase();
    case 'client':   return row.client.toLowerCase();
    default:         return '';
  }
}

export function sortJobs(rows: JobRowData[], key: JobSortKey, dir: JobSortDir): JobRowData[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = toComparable(a, key);
    const bv = toComparable(b, key);
    if (av < bv) return -sign;
    if (av > bv) return  sign;
    return 0;
  });
}
