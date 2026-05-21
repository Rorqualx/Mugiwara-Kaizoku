/**
 * useDetectMatch Queue Types
 *
 * Type definitions for the isolated queue architecture that prevents
 * closure/reference bugs in async processing.
 *
 * @module components/library/import-pipeline/hooks/useDetectMatch/types
 */

import type {
  ScannedMangaItem,
  EnrichedProviderMatch,
} from '@/components/library/import-pipeline/types';

// ============================================================================
// Queue Job Types
// ============================================================================

/**
 * Status of a match job in the queue
 */
export type MatchJobStatus =
  | 'pending'    // Waiting in queue
  | 'running'    // Currently executing
  | 'completed'  // Successfully completed
  | 'cancelled'  // Cancelled by user
  | 'error';     // Failed with error

/**
 * An isolated match job with captured values
 *
 * Each job captures the itemId as a PRIMITIVE VALUE at creation time,
 * preventing stale closure issues. The itemData is a deep clone via
 * structuredClone() and frozen to prevent mutations.
 */
export interface MatchJob {
  /** Unique job identifier (UUID) */
  readonly jobId: string;
  /** Item ID captured as VALUE (not reference) at job creation */
  readonly itemId: string;
  /** Deep-cloned and frozen item data */
  readonly itemData: Readonly<ScannedMangaItem>;
  /** AbortController for this specific job */
  readonly abortController: AbortController;
  /** Current job status */
  status: MatchJobStatus;
  /** Timestamp when job was created */
  readonly createdAt: number;
  /** Error message if status is 'error' */
  errorMessage?: string;
}

/**
 * Result from a completed match job
 *
 * All properties are readonly and the entire object is frozen
 * to prevent accidental mutations that could affect other items.
 */
export interface MatchJobResult {
  /** Job ID that produced this result */
  readonly jobId: string;
  /** Item ID (captured primitive value - safe from closure issues) */
  readonly itemId: string;
  /** Best match found (frozen deep clone) */
  readonly match: EnrichedProviderMatch | null;
  /** All available matches (frozen array of frozen objects) */
  readonly availableMatches: readonly EnrichedProviderMatch[];
  /** Timestamp when job completed */
  readonly completedAt: number;
  /** Search query that was used */
  readonly searchQuery: string;
}

// ============================================================================
// Queue Manager Types
// ============================================================================

/**
 * Statistics about the queue state
 */
export interface QueueStats {
  /** Jobs waiting to be processed */
  pending: number;
  /** Jobs currently running */
  running: number;
  /** Jobs that completed successfully */
  completed: number;
  /** Jobs that failed with an error */
  failed: number;
  /** Jobs that were explicitly cancelled by the user */
  cancelled: number;
}

/**
 * Callbacks for queue events
 *
 * All callbacks receive captured values (not references),
 * ensuring they work correctly even with stale closures.
 */
export interface MatchQueueCallbacks {
  /** Called when a job completes successfully */
  onJobCompleted: (result: MatchJobResult) => void;
  /** Called when a job fails */
  onJobError: (jobId: string, itemId: string, error: Error) => void;
  /** Called when a job starts */
  onJobStarted: (jobId: string, itemId: string) => void;
  /** Called when queue stats change */
  onStatsChange?: (stats: QueueStats) => void;
}

/**
 * Configuration for the queue manager
 */
export interface MatchQueueConfig {
  /** Minimum delay between requests in ms (default: 2500 for AniList rate limiting) */
  minRequestDelay?: number;
  /** Maximum concurrent jobs (default: 1 for rate limiting) */
  maxConcurrent?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
}

/**
 * Search function signature for the queue manager
 */
export type SearchFunction = (
  query: string,
  limit: number,
  signal: AbortSignal
) => Promise<SearchResultForQueue[]>;

/**
 * Search result type used by queue manager
 * Note: With exactOptionalPropertyTypes, optional properties must include | undefined
 */
export interface SearchResultForQueue {
  id: string;
  title: string;
  provider: string;
  description?: string | undefined;
  coverImage?: string | undefined;
  confidence: number;
  siteDetailUrl?: string | undefined;
  url?: string | undefined;
  wikiUrl?: string | undefined;
  year?: number | undefined;
  chapters?: number | undefined;
  volumes?: number | undefined;
  genres?: string[] | undefined;
  status?: string | undefined;
  authors?: string[] | undefined;
  artists?: string[] | undefined;
  publisher?: string | undefined;
}
