/**
 * useDetectMatch Hook
 *
 * Combined hook for progressive scanning and metadata matching.
 * Uses isolated queue architecture to prevent closure/reference bugs.
 *
 * @module components/library/import-pipeline/hooks/useDetectMatch
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';

import {
  calculateDetectMatchStats,
  DEFAULT_DETECT_MATCH_PROGRESS,
} from '@/components/library/import-pipeline/types';
import type {
  PipelineAction,
  ScannedMangaItem,
  PipelineError,
  EnrichedProviderMatch,
  ConfidenceThresholds,
  MatchedMangaItem,
  DetectMatchProgress,
  DetectMatchStats,
} from '@/components/library/import-pipeline/types';
import type { MangaSearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

type TrpcUtils = ReturnType<typeof trpc.useUtils>;

import {
  normalizeSearchTitle,
  calculateConfidence,
  mapResultsToMatches,
  processCompletedScan,
  processActiveScan,
  type ScanJobResult,
} from './helpers';
import { MatchQueueManager } from './queue-manager';

import type { SearchResultForQueue } from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Deep clone an object using JSON serialization
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Convert API search result to queue format
 */
function convertToQueueResult(result: MangaSearchResult, query: string): SearchResultForQueue {
  return {
    id: String(result.id),
    title: result.title,
    provider: String(result.provider),
    description: result.description,
    coverImage: result.coverImage,
    confidence: calculateConfidence(query, result.title),
    siteDetailUrl: result['siteDetailUrl'] as string | undefined,
    url: result.url,
    wikiUrl: result['wikiUrl'] as string | undefined,
    year: result.year,
    chapters: result.chapters,
    volumes: result.volumes,
    genres: result.genres,
    status: result.status,
    authors: result['authors'] as string[] | undefined,
    artists: result['artists'] as string[] | undefined,
    publisher: result['publisher'] as string | undefined,
  };
}

/**
 * Create the search function the queue manager injects into each match job.
 * Routes through the tRPC client so the call respects cookies, auth headers,
 * and the standard transformer chain (no hand-rolled superjson handling).
 */
function createSearchFunction(utils: TrpcUtils): (query: string, limit: number, signal: AbortSignal) => Promise<SearchResultForQueue[]> {
  return async (query: string, limit: number, signal: AbortSignal): Promise<SearchResultForQueue[]> => {
    logger.info('[Search] all-providers', { query });
    // utils.client.* is the vanilla tRPC client and forwards `signal` to the link.
    // utils.X.fetch (TanStack Query bridge) does not accept signal in v11.
    const response = await utils.client.search.allWithErrors.query(
      { query, limit },
      { signal }
    );
    return response.results.map((result) => convertToQueueResult(result, query));
  };
}

// ============================================================================
// Types
// ============================================================================

interface UseDetectMatchParams {
  dispatch: Dispatch<PipelineAction>;
  selectedLibraryId: number | null;
  scanPath: string;
  matchedItems: Map<string, MatchedMangaItem>;
  thresholds: ConfidenceThresholds;
  isCancelled: boolean;
  addError: (error: Omit<PipelineError, 'timestamp'>) => void;
}

export interface UseDetectMatchReturn {
  startDetectMatch: () => Promise<void>;
  cancelDetectMatch: () => void;
  matchSingleItem: (itemId: string, query: string) => Promise<void>;
  setItemMatch: (itemId: string, match: EnrichedProviderMatch | null) => void;
  progress: DetectMatchProgress;
  stats: DetectMatchStats;
  isActive: boolean;
}

// ============================================================================
// Queue Manager Factory
// ============================================================================

interface QueueManagerDeps {
  mountedRef: React.RefObject<boolean>;
  matchedCountRef: React.MutableRefObject<number>;
  queueManagerRef: React.MutableRefObject<MatchQueueManager | null>;
  dispatch: Dispatch<PipelineAction>;
  setProgress: React.Dispatch<React.SetStateAction<DetectMatchProgress>>;
  utils: TrpcUtils;
}

function createQueueManager(deps: QueueManagerDeps): MatchQueueManager {
  const { mountedRef, matchedCountRef, queueManagerRef, dispatch, setProgress, utils } = deps;

  const handleJobCompleted = (result: { itemId: string; match: EnrichedProviderMatch | null; availableMatches: readonly EnrichedProviderMatch[] }): void => {
    if (!mountedRef.current) return;

    const matchesCopy = result.availableMatches.map((m) => deepClone(m) as EnrichedProviderMatch);

    dispatch({
      type: 'ITEM_MATCH_COMPLETE',
      itemId: result.itemId,
      match: result.match ? deepClone(result.match) as EnrichedProviderMatch : null,
      availableMatches: matchesCopy,
    });

    matchedCountRef.current += 1;
    setProgress((prev) => ({
      ...prev,
      matchCurrent: matchedCountRef.current,
      matchQueue: queueManagerRef.current?.getQueueLength() ?? 0,
    }));
  };

  const handleJobError = (jobId: string, itemId: string, error: Error): void => {
    if (!mountedRef.current) return;

    logger.error('[DetectMatch] Match error', error, { jobId, itemId });
    dispatch({
      type: 'ITEM_MATCH_COMPLETE',
      itemId,
      match: null,
      availableMatches: [],
    });
  };

  const handleJobStarted = (_jobId: string, itemId: string): void => {
    if (!mountedRef.current) return;
    dispatch({ type: 'ITEM_MATCH_STARTED', itemId });
  };

  const handleStatsChange = (queueStats: { pending: number; running: number }): void => {
    if (!mountedRef.current) return;
    setProgress((prev) => ({
      ...prev,
      matchQueue: queueStats.pending + queueStats.running,
    }));
  };

  return new MatchQueueManager(
    {
      onJobCompleted: handleJobCompleted,
      onJobError: handleJobError,
      onJobStarted: handleJobStarted,
      onStatsChange: handleStatsChange,
    },
    createSearchFunction(utils)
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useDetectMatch(params: UseDetectMatchParams): UseDetectMatchReturn {
  const { dispatch, selectedLibraryId, scanPath, matchedItems, thresholds, isCancelled, addError } = params;
  const utils = trpc.useUtils();
  const scanMutation = trpc.library.scanLibrary.useMutation();
  const libraryId = selectedLibraryId ?? 0;

  const mountedRef = useRef(true);
  const queueManagerRef = useRef<MatchQueueManager | null>(null);
  const seenItemsRef = useRef<Set<string>>(new Set());
  /** Tracks (normalized-title, parent-dir) pairs already submitted for matching.
   * Without this, a series with 111 sub-folders (e.g. One Piece volumes)
   * triggers 111 identical searches; with it we fire one. */
  const seenMatchKeysRef = useRef<Set<string>>(new Set());
  const matchedCountRef = useRef(0);
  // Manual-search abort controller. Replaced (and previous controller aborted)
  // on each new manual search; aborted on unmount.
  const manualSearchAbortRef = useRef<AbortController | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState<DetectMatchProgress>(DEFAULT_DETECT_MATCH_PROGRESS);

  const { data: latestScan, refetch } = trpc.jobs.getLatestScanForLibrary.useQuery(
    { libraryId },
    { enabled: libraryId > 0 && isActive }
  );

  const stats = calculateDetectMatchStats(Array.from(matchedItems.values()), thresholds);

  // Initialize queue manager
  useEffect(() => {
    mountedRef.current = true;

    queueManagerRef.current = createQueueManager({
      mountedRef,
      matchedCountRef,
      queueManagerRef,
      dispatch,
      setProgress,
      utils,
    });

    return () => {
      mountedRef.current = false;
      queueManagerRef.current?.destroy();
      queueManagerRef.current = null;
      // Abort any in-flight manual search so its dispatch doesn't run on an unmounted hook.
      manualSearchAbortRef.current?.abort();
      manualSearchAbortRef.current = null;
    };
  }, [dispatch, utils]);

  // Queue items for matching
  const queueItemsForMatching = useCallback((items: ScannedMangaItem[]): void => {
    const unseenItems = items.filter((item) => {
      if (seenItemsRef.current.has(item.id)) return false;
      seenItemsRef.current.add(item.id);
      return true;
    });

    if (unseenItems.length > 0) {
      unseenItems.forEach((item) => dispatch({ type: 'ITEM_DISCOVERED', item }));
    }

    // Cross-row dedup for the match queue: don't fire identical searches for
    // sibling folders that parse to the same title under the same parent
    // directory (e.g. "One Piece" × 111 volume sub-folders).
    const itemsToMatch = unseenItems.filter((item) => {
      if (item.isDuplicate || item.error) return false;
      const parent = item.path.replace(/\/[^/]+\/?$/, '');
      const key = `${normalizeSearchTitle(item.cleanTitle).toLowerCase()}|${parent}`;
      if (seenMatchKeysRef.current.has(key)) return false;
      seenMatchKeysRef.current.add(key);
      return true;
    });
    if (itemsToMatch.length > 0 && queueManagerRef.current) {
      itemsToMatch.forEach((item) => queueManagerRef.current?.enqueue(item));
      setProgress((prev) => ({
        ...prev,
        matchQueue: queueManagerRef.current?.getQueueLength() ?? 0,
      }));
    }
  }, [dispatch]);

  // Poll for scan results
  useEffect(() => {
    if (!latestScan || !isActive) return;

    const result = latestScan.result as ScanJobResult | null;
    if (!result) return;

    if (latestScan.status === 'completed') {
      processCompletedScan(result, dispatch, setProgress, queueItemsForMatching);
    } else if (latestScan.status === 'active') {
      processActiveScan(result, setProgress, queueItemsForMatching);
    }
  }, [latestScan, isActive, dispatch, queueItemsForMatching]);

  // Polling interval
  useEffect(() => {
    if (!isActive || isCancelled) return;
    const interval = setInterval(() => void refetch(), 2000);
    return () => clearInterval(interval);
  }, [isActive, isCancelled, refetch]);

  // Sync progress to reducer
  useEffect(() => {
    dispatch({ type: 'UPDATE_DETECT_MATCH_PROGRESS', progress });
  }, [dispatch, progress]);

  // Handle completion — re-check when queue count changes (matchCurrent updates on each job)
  useEffect(() => {
    if (!isActive || !progress.isScanComplete || progress.isMatchComplete) return;

    const queueLength = queueManagerRef.current?.getQueueLength() ?? 0;
    const isProcessing = queueManagerRef.current?.isActive() ?? false;

    if (queueLength === 0 && !isProcessing) {
      setProgress((prev) => ({ ...prev, isMatchComplete: true, matchQueue: 0 }));
      dispatch({ type: 'DETECT_MATCH_COMPLETE' });
      setIsActive(false);
    }
  }, [isActive, progress.isScanComplete, progress.isMatchComplete, progress.matchCurrent, dispatch]);

  const startDetectMatch = useCallback(async (): Promise<void> => {
    if (!selectedLibraryId || !scanPath) return;
    // Re-entry guard: a second click while a scan is already in flight would wipe
    // seenItemsRef mid-discovery and double-enqueue every item.
    if (isActive) return;

    // Cancel any straggler queue jobs from a prior cancelled scan before resetting.
    queueManagerRef.current?.cancel();
    seenItemsRef.current = new Set();
    seenMatchKeysRef.current = new Set();
    matchedCountRef.current = 0;
    setProgress(DEFAULT_DETECT_MATCH_PROGRESS);

    try {
      const result = await scanMutation.mutateAsync({
        libraryId: selectedLibraryId,
        path: scanPath,
        options: { preview: true, skipExisting: true, autoMatch: false },
      });
      if (result.jobId) {
        dispatch({ type: 'START_DETECT_MATCH', jobId: result.jobId });
        setIsActive(true);
        setProgress((prev) => ({ ...prev, scanStatus: 'Starting scan...' }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start scan';
      addError({ code: 'DETECT_MATCH_START_FAILED', message, stage: 'detect_match' });
      // The error array is collected in state.errors but no stage currently
      // renders it — so without a toast here, the button silently does
      // nothing on failures like "Scan path is not accessible".
      notify({
        severity: 'ERROR',
        title: 'Could not start scan',
        message,
      });
      logger.error('[DetectMatch] startDetectMatch failed', { message, scanPath });
    }
  }, [selectedLibraryId, scanPath, isActive, scanMutation, dispatch, addError]);

  const cancelDetectMatch = useCallback((): void => {
    setIsActive(false);
    queueManagerRef.current?.cancel();
    dispatch({ type: 'CANCEL_DETECT_MATCH' });
  }, [dispatch]);

  const matchSingleItem = useCallback(async (itemId: string, query: string): Promise<void> => {
    // Cancel any prior in-flight manual search; the latest user query wins.
    manualSearchAbortRef.current?.abort();
    const controller = new AbortController();
    manualSearchAbortRef.current = controller;

    dispatch({ type: 'ITEM_MATCH_STARTED', itemId });

    try {
      // Manual search uses the user's RAW query — we don't run normalizeSearchTitle
      // here because that strips trailing digits ("Kaiju No. 8" → "Kaiju No.") which
      // are often part of the actual title. Trust what the user typed.
      // AniList only — backend enrichment handles other providers post-import.
      const searchTitle = query.trim();
      const response = await utils.client.search.withProviderWithErrors.query(
        { provider: 'anilist', query: searchTitle, limit: 10 },
        { signal: controller.signal }
      );
      // Bail if a newer search has already taken over the abort ref.
      if (manualSearchAbortRef.current !== controller) return;

      const results = response.results.map((r) => convertToQueueResult(r, searchTitle));
      const matches = mapResultsToMatches(results);

      // Populate the candidate list WITHOUT auto-selecting. The user must click
      // a result card in the SearchModal to explicitly pick (`SET_ITEM_MATCH`).
      dispatch({ type: 'SET_ITEM_SEARCH_RESULTS', itemId, availableMatches: matches });
    } catch (error) {
      // Aborted searches throw — don't surface them as item-level errors.
      if (controller.signal.aborted) return;
      logger.error('[DetectMatch] Manual search error', error, { itemId });
      dispatch({
        type: 'SET_ITEM_STATUS',
        itemId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Search failed',
      });
    }
  }, [dispatch, utils]);

  const setItemMatch = useCallback((itemId: string, match: EnrichedProviderMatch | null): void => {
    dispatch({ type: 'SET_ITEM_MATCH', itemId, match });
  }, [dispatch]);

  return { startDetectMatch, cancelDetectMatch, matchSingleItem, setItemMatch, progress, stats, isActive };
}
