/**
 * Map a `QuickDownloadResponse.summary` to a notification payload.
 *
 * Centralized so the four call sites (volumeChapters/hooks/download.ts,
 * volume-detail-modal-hooks.ts, DownloadButton.tsx, plus future ones) all
 * report the same scenarios with the same wording. The pipeline's
 * `summary` shape distinguishes:
 *
 *   - all chapters got a release  → green   "Started N/N chapters"
 *   - partial (some yes, some no) → yellow  "Started X/N — Y had no releases"
 *   - everything blocklisted      → orange  "All N releases blocked"
 *   - nothing found anywhere      → yellow  "No releases for any of N chapters"
 *   - empty scope                 → gray    "Nothing to download"
 *   - unexpected (none of above)  → red     "Pipeline returned unexpected outcome"
 *
 * Callers can override the leading title (e.g. "Volume Quick Download Started")
 * but the message + color come from this function.
 */

export interface QuickDownloadSummary {
  total: number;
  started: number;
  failed?: number;
  noResults: number;
  allBlocked: number;
}

export interface NotificationPayload extends Record<`data-${string}`, unknown> {
  title: string;
  message: string;
  color: 'green' | 'yellow' | 'orange' | 'red' | 'gray';
}

export interface MapOptions {
  /** Optional title override for the all-started case (default 'Download Started'). */
  startedTitle?: string;
  /** Optional release-title shown verbatim on the all-started path. */
  firstReleaseTitle?: string;
  /** Indexer name; appended to the all-started message in parens when present. */
  firstIndexer?: string;
}

export function mapSummaryToNotification(
  summary: QuickDownloadSummary,
  options: MapOptions = {},
): NotificationPayload {
  const isPartial = summary.started > 0 && summary.noResults > 0;
  const allStarted = summary.started > 0 && summary.noResults === 0 && summary.allBlocked === 0;
  const startedTitle = options.startedTitle ?? 'Download Started';

  if (allStarted) {
    return {
      title: startedTitle,
      message: options.firstReleaseTitle
        ? `Downloading: ${options.firstReleaseTitle}${options.firstIndexer ? ` (${options.firstIndexer})` : ''}`
        : `Started ${summary.started}/${summary.total} chapters`,
      color: 'green',
    };
  }
  if (isPartial) {
    return {
      title: 'Partial Download Started',
      message: `Started ${summary.started}/${summary.total} chapters — ${summary.noResults} found no releases.`,
      color: 'yellow',
    };
  }
  if (summary.allBlocked > 0) {
    return {
      title: 'All Results Blocked',
      message: `All ${summary.allBlocked} matching releases are on the blocklist.`,
      color: 'orange',
    };
  }
  if (summary.noResults > 0) {
    return {
      title: 'No Releases Found',
      message: `Searched all sources (Prowlarr, MangaDex, Suwayomi) — none had releases for any of the ${summary.total} chapter(s).`,
      color: 'yellow',
    };
  }
  if (summary.total === 0) {
    return {
      title: 'Nothing to Download',
      message: 'No chapters were in scope.',
      color: 'gray',
    };
  }
  return {
    title: 'Download Failed',
    message: 'The pipeline returned an unexpected outcome — check server logs.',
    color: 'red',
  };
}
