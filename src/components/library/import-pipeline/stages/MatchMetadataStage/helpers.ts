/**
 * MatchMetadataStage Helper Functions
 *
 * Utility functions for the match metadata stage.
 *
 * @module components/library/import-pipeline/stages/MatchMetadataStage/helpers
 */

// ============================================================================
// Types
// ============================================================================

export interface MatchDetails {
  year: string | null;
  issueCount: number | null;
  publisher: string | null;
  status: string | null;
}

export const EMPTY_MATCH_DETAILS: MatchDetails = {
  year: null,
  issueCount: null,
  publisher: null,
  status: null,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Extract metadata details from match
 */
export function extractMatchDetails(metadata: unknown): MatchDetails {
  if (!metadata || typeof metadata !== 'object') return EMPTY_MATCH_DETAILS;
  const meta = metadata as Record<string, unknown>;

  // Extract year
  const startYear = meta['startYear'];
  const year = meta['year'];
  const yearValue = startYear?.toString() ?? year?.toString() ?? null;

  // Extract issue count
  const issueCount = meta['issueCount'];
  const countOfIssues = meta['count_of_issues'];
  const issueCountValue =
    typeof issueCount === 'number'
      ? issueCount
      : typeof countOfIssues === 'number'
        ? countOfIssues
        : null;

  // Extract publisher
  const publisher = meta['publisher'];
  let publisherValue: string | null = null;
  if (typeof publisher === 'string') {
    publisherValue = publisher;
  } else if (publisher && typeof publisher === 'object') {
    const pubObj = publisher as Record<string, unknown>;
    const name = pubObj['name'];
    if (typeof name === 'string') {
      publisherValue = name;
    }
  }

  // Extract status
  const status = meta['status'];
  const statusValue = typeof status === 'string' ? status : null;

  return {
    year: yearValue,
    issueCount: issueCountValue,
    publisher: publisherValue,
    status: statusValue,
  };
}

/**
 * Status badge color mapping
 */
export const STATUS_COLOR_MAP: Record<string, string> = {
  matched: 'green',
  accepted: 'green',
  skipped: 'gray',
  pending: 'yellow',
  unmatched: 'red',
};

/**
 * Get display label for status
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    matched: 'Matched',
    accepted: 'Accepted',
    skipped: 'Skipped',
    pending: 'Pending',
    unmatched: 'Unmatched',
  };
  return labels[status] ?? status;
}
