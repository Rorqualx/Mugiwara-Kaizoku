/**
 * What the library page tells the user after a bulk "Refresh": a green toast
 * only when titles were queued, and the server's reasons when some were not.
 */
import type { BulkRefreshResult } from '@/server/services/metadata/bulk-refresh';

export interface BulkRefreshNotice {
  kind: 'success' | 'info' | 'error';
  title: string;
  message: string;
  /** Leave the selection in place so the user can try again (titles already queued are skipped). */
  keepSelection: boolean;
}

const TITLES: Record<BulkRefreshResult['outcome'], string> = {
  queued: 'Metadata Refresh Queued',
  partial: 'Metadata Refresh Partly Queued',
  already_queued: 'Metadata Refresh Already Queued',
  failed: 'Bulk Refresh Failed',
};

const KINDS: Record<BulkRefreshResult['outcome'], BulkRefreshNotice['kind']> = {
  queued: 'success',
  partial: 'info',
  already_queued: 'info',
  failed: 'error',
};

export function bulkRefreshNotice(
  result: Pick<BulkRefreshResult, 'outcome' | 'message' | 'errors'>,
): BulkRefreshNotice {
  // The message carries one reason; say how many more there are.
  const more = (result.errors?.length ?? 0) - 1;
  const moreNote = more > 0 && result.outcome !== 'queued' && result.outcome !== 'already_queued'
    ? ` (and ${more} more ${more === 1 ? 'problem' : 'problems'})`
    : '';
  return {
    kind: KINDS[result.outcome],
    title: TITLES[result.outcome],
    message: `${result.message}${moreNote}`,
    keepSelection: result.outcome === 'failed' || result.outcome === 'partial',
  };
}
