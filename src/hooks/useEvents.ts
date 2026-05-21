/**
 * Events Monitoring Hook with AsyncResult Pattern
 * 
 * This module provides a hook for monitoring system activities and API calls
 * using the AsyncResult pattern for proper type-safety and state handling.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';

import { apiCallStore } from '../components/apiCallAlert';
import {
  createLoadingResult,
  createSuccessResult,
  createErrorResult,
  isLoading} from
'../utils/async-result'
import { unwrapOr } from '../utils/async-result'
import { trpc } from '../utils/trpc-client';
import { isObject } from '../utils/type-guards';

import type { ApiCallInfo } from '../components/apiCallAlert';
import type {
  AsyncResult} from '../utils/async-result';

/**
 * Mock query result for when activity endpoint is not available.
 * Defined outside component to maintain stable reference.
 */
const MOCK_ACTIVITY_DATA: Record<string, unknown> = {
  active: 0,
  queued: 0,
  scheduled: 0,
  failed: 0,
  completed: 0,
  outOfSync: 0
};
/**
 * Activity data returned from the activity query endpoint
 *
 * Maps to domain JobStatus values in the server/trpc/router/activity.ts router
 */
interface ActivityData {
  active: number; // JobStatus.active or JobStatus.active
  queued: number; // JobStatus.pending or PENDING (ready to run)
  scheduled: number; // JobStatus.pending or PENDING (future)
  failed: number; // JobStatus.failed
  completed: number; // JobStatus.completed
  outOfSync: number; // JobStatus.pending
  conversions: number; // ConversionStatus.PENDING or PROCESSING
}

/**
 * Activity and API call statistics
 * 
 * @interface ActivityCounts
 * @property {number} active - Number of active tasks (JobStatus.active or JobStatus.active)
 * @property {number} queued - Number of queued tasks (JobStatus.pending or PENDING ready to run)
 * @property {number} scheduled - Number of scheduled tasks (JobStatus.pending or PENDING future)
 * @property {number} failed - Number of failed tasks (JobStatus.failed)
 * @property {number} completed - Number of completed tasks (JobStatus.completed)
 * @property {number} outOfSync - Number of out-of-sync chapters (JobStatus.pending)
 * @property {ApiCallInfo[]} apiCalls - List of API calls
 */
interface ActivityCounts extends ActivityData {
  apiCalls: ApiCallInfo[];
}

const POLL_INTERVAL = 3000; // 3 seconds

/**
 * Default activity counts for when data isn't available
 */
const defaultActivityCounts: ActivityCounts = {
  active: 0,
  queued: 0,
  scheduled: 0,
  failed: 0,
  completed: 0,
  outOfSync: 0,
  conversions: 0,
  apiCalls: []
};

/**
 * Return type for the useEvents hook with AsyncResult pattern
 */
export interface UseEventsResult {
  /** Activity counts with AsyncResult pattern */
  countsResult: AsyncResult<ActivityCounts, Error>;
  /** All activity counts (with defaults) */
  counts: ActivityCounts;
  /** Active tasks count (JobStatus.active or JobStatus.active) */
  active: number;
  /** Queued tasks count (JobStatus.pending or PENDING ready to run) */
  queued: number;
  /** Scheduled tasks count (JobStatus.pending or PENDING future) */
  scheduled: number;
  /** Failed tasks count (JobStatus.failed) */
  failed: number;
  /** Completed tasks count (JobStatus.completed) */
  completed: number;
  /** Out-of-sync chapters count (JobStatus.pending) */
  outOfSync: number;
  /** Conversion jobs count (PENDING or PROCESSING) */
  conversions: number;
  /** List of API calls */
  apiCalls: ApiCallInfo[];
  /** Whether any API calls exist */
  hasApiCalls: boolean;
  /** Count of pending API calls */
  pendingApiCalls: number;
  /** Count of successful API calls */
  successApiCalls: number;
  /** Count of failed API calls */
  errorApiCalls: number;
  /** Whether activity data is being loaded */
  isLoading: boolean;
}

/**
 * Hook for monitoring system activity and API calls
 * 
 * This hook provides real-time tracking of system activities and API calls.
 * It polls the activity endpoint at regular intervals and subscribes to
 * API call store updates to provide current system status.
 * 
 * This implementation uses the AsyncResult pattern for proper state handling.
 * 
 * @returns {UseEventsResult} Activity monitoring state with AsyncResult pattern
 * 
 * @example
 * ```tsx
 * const { 
 *   countsResult,
 *   active,
 *   failed,
 *   hasApiCalls,
 *   pendingApiCalls 
 * } = useEvents();
 * 
 * // Handle different AsyncResult states
 * if (isLoading(countsResult)) {
 *   return <div>Loading activity data...</div>;
 * }
 * 
 * if (isError(countsResult)) {
 *   return <div>Error loading activity: {countsResult.error instanceof Error ? countsResult.error.message : String(countsResult.error)}</div>;
 * }
 * 
 * return (
 *   <div>
 *     <div>Active Tasks: {active}</div>
 *     <div>Failed Tasks: {failed}</div>
 *     {hasApiCalls && (
 *       <div>Pending API Calls: {pendingApiCalls}</div>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useEvents(): UseEventsResult {
  // State with AsyncResult pattern
  const [countsResult, setCountsResult] = useState<AsyncResult<ActivityCounts, Error>>(createLoadingResult());
  const [apiCalls, setApiCalls] = useState<ApiCallInfo[]>([]);

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Use ref for apiCalls to avoid triggering effect re-runs
  const apiCallsRef = useRef<ApiCallInfo[]>(apiCalls);
  apiCallsRef.current = apiCalls;

  // Use tRPC activity query directly - activity router is guaranteed to exist
  // Use WebSocket-first with polling fallback
  const activityQuery = trpc.activity.query.useQuery(undefined, {
    refetchInterval: isConnected ? false : POLL_INTERVAL,
    staleTime: 60_000, // 1 minute — avoid refetching on every mount
    gcTime: 5 * 60 * 1000, // 5 minutes — prevent stale payloads from accumulating in cache
  });

  // Refetch callback for WebSocket subscription
  const refetch = useCallback((): void => {
    void activityQuery.refetch();
  }, [activityQuery]);

  // Subscribe to WebSocket jobs:active events for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('jobs:active', () => {
      refetch();
    });

    return unsubscribe;
  }, [isConnected, subscribe, refetch]);

  // Use memoized values to avoid object identity changes triggering effects
  const queryData = activityQuery.data ?? MOCK_ACTIVITY_DATA;
  const queryIsLoading = activityQuery.isPending;
  const queryError = activityQuery.error ?? undefined;

  // Update counts when new data arrives - use primitive values in dependency array
  useEffect(() => {
    // Check error state first
    if (queryError) {
      setCountsResult(createErrorResult(
        queryError instanceof Error ?
        queryError :
        new Error(`Failed to fetch activity data: ${String(queryError)}`)
      ));
    } else if (queryIsLoading) {
      setCountsResult(createLoadingResult());
    } else if (isObject(queryData)) {
      // queryData is always truthy due to MOCK_ACTIVITY_DATA fallback
      // Validate and normalize the activity data
      const data = queryData;
      const validatedData: ActivityCounts = {
        active: typeof data['active'] === 'number' ? data['active'] : 0,
        queued: typeof data['queued'] === 'number' ? data['queued'] : 0,
        scheduled: typeof data['scheduled'] === 'number' ? data['scheduled'] : 0,
        failed: typeof data['failed'] === 'number' ? data['failed'] : 0,
        completed: typeof data['completed'] === 'number' ? data['completed'] : 0,
        outOfSync: typeof data['outOfSync'] === 'number' ? data['outOfSync'] : 0,
        conversions: typeof data['conversions'] === 'number' ? data['conversions'] : 0,
        apiCalls: apiCallsRef.current
      };

      setCountsResult(createSuccessResult(validatedData));
    } else {
      // Handle unexpected data format
      setCountsResult(createErrorResult(new Error('Invalid activity data format')));
    }
  }, [queryData, queryError, queryIsLoading]);

  // Subscribe to API call store updates
  useEffect(() => {
    const unsubscribe = apiCallStore.subscribe(() => {
      const latestCalls = apiCallStore.getCalls();
      setApiCalls(latestCalls);
    });

    return unsubscribe;
  }, []);

  // Get current counts with safety against null values
  const counts = unwrapOr(countsResult, defaultActivityCounts);

  // Create a comprehensive API
  return {
    countsResult,
    counts,
    active: counts.active,
    queued: counts.queued,
    scheduled: counts.scheduled,
    failed: counts.failed,
    completed: counts.completed,
    outOfSync: counts.outOfSync,
    conversions: counts.conversions,
    apiCalls: apiCalls,
    hasApiCalls: apiCalls.length > 0,
    pendingApiCalls: apiCalls.filter((call) => call["status"] === 'pending').length,
    successApiCalls: apiCalls.filter((call) => call["status"] === 'success').length,
    errorApiCalls: apiCalls.filter((call) => call["status"] === 'error').length,
    isLoading: isLoading(countsResult) || queryIsLoading
  };
}