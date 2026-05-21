/**
 * Metadata Refresh Progress Hook
 *
 * Subscribes to real-time WebSocket events for metadata refresh progress
 * on a specific manga. Used by MangaActionBar to show phase-by-phase progress.
 *
 * Includes a simulated progress fallback when WebSocket events are unavailable
 * (e.g., connection drops in dev mode). Real WS events take priority when received.
 *
 * @module hooks/manga/useMetadataRefreshProgress
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { CHANNEL_PATTERNS } from '@/types/api/v1/websocket';
import type { WebSocketEvent } from '@/types/api/v1/websocket';

// ============================================================================
// Types
// ============================================================================

type MetadataRefreshPhase =
  | 'starting'
  | 'fetching_providers'
  | 'enriching_metadata'
  | 'persisting_data'
  | 'reconciling_chapters'
  | 'validating_volumes'
  | 'fandom_enrichment'
  | 'fandom_chapters'
  | 'fandom_scraping'
  | 'wikipedia_enrichment'
  | 'comicvine_scraping'
  | 'applying_data'
  | 'rebuilding_chapters'
  | 'completed'
  | 'error';

interface MetadataRefreshProgressData {
  mangaId: number;
  phase: MetadataRefreshPhase;
  phaseIndex: number;
  totalPhases: number;
  message: string;
  error?: string;
}

interface ProgressSetters {
  setPhase: (v: MetadataRefreshPhase | null) => void;
  setMessage: (v: string) => void;
  setPercent: (v: number) => void;
  setError: (v: string | null) => void;
}

export interface MetadataRefreshProgress {
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** Current phase identifier */
  phase: MetadataRefreshPhase | null;
  /** Human-readable status message */
  message: string;
  /** Progress percentage (0-100) */
  percent: number;
  /** Whether the refresh completed successfully */
  isComplete: boolean;
  /** Whether the refresh ended with an error */
  isError: boolean;
  /** Error message if failed */
  error: string | null;
  /** Reset progress state (e.g. after dismissing) */
  reset: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Fallback labels — backend sends specific messages with chapter counts,
 *  these are only used if the backend message is empty. */
const PHASE_LABELS: Record<MetadataRefreshPhase, string> = {
  starting: 'Starting metadata refresh...',
  fetching_providers: 'Searching MangaDex, AniList, ComicVine...',
  enriching_metadata: 'Fetching chapter data from providers...',
  persisting_data: 'Creating chapters and volumes...',
  reconciling_chapters: 'Reconciling chapters from all sources...',
  validating_volumes: 'Cross-validating volume ranges...',
  fandom_enrichment: 'Scraping Fandom wiki...',
  fandom_chapters: 'Fetching Fandom chapter covers...',
  fandom_scraping: 'Fetching Fandom chapter covers...',
  wikipedia_enrichment: 'Gap-filling with Wikipedia...',
  comicvine_scraping: 'Processing ComicVine data...',
  applying_data: 'Writing enriched data to database...',
  rebuilding_chapters: 'Finalizing volumes and covers...',
  completed: 'Complete',
  error: 'Failed',
};

/** Simulated phase timeline (seconds after start → phase).
 *  Only used as fallback when WebSocket is not connected. */
const SIMULATED_PHASES: ReadonlyArray<{
  at: number;
  phase: MetadataRefreshPhase;
  percent: number;
}> = [
  { at: 0, phase: 'starting', percent: 3 },
  { at: 2, phase: 'fetching_providers', percent: 10 },
  { at: 10, phase: 'enriching_metadata', percent: 20 },
  { at: 18, phase: 'persisting_data', percent: 30 },
  { at: 25, phase: 'reconciling_chapters', percent: 40 },
  { at: 32, phase: 'validating_volumes', percent: 50 },
  { at: 40, phase: 'fandom_enrichment', percent: 60 },
  { at: 50, phase: 'fandom_scraping', percent: 70 },
  { at: 60, phase: 'wikipedia_enrichment', percent: 80 },
  { at: 70, phase: 'rebuilding_chapters', percent: 90 },
];

const SIMULATION_INTERVAL_MS = 500;
const AUTO_RESET_DELAY_MS = 4000;

// ============================================================================
// Pure Helpers
// ============================================================================

/**
 * Find the simulated phase for a given elapsed time.
 * Walks the timeline backwards to find the latest matching phase.
 */
function getSimulatedPhase(
  elapsedSeconds: number
): { phase: MetadataRefreshPhase; percent: number; label: string } {
  for (let i = SIMULATED_PHASES.length - 1; i >= 0; i--) {
    const entry = SIMULATED_PHASES[i];
    if (entry && elapsedSeconds >= entry.at) {
      return {
        phase: entry.phase,
        percent: entry.percent,
        label: PHASE_LABELS[entry.phase],
      };
    }
  }
  return {
    phase: 'starting',
    percent: 5,
    label: PHASE_LABELS.starting,
  };
}

// ============================================================================
// Internal Hooks
// ============================================================================

/** Auto-reset timer after completion/error */
function useAutoReset(
  isComplete: boolean,
  isError: boolean,
  setters: ProgressSetters
): () => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback((): void => {
    setters.setPhase(null);
    setters.setMessage('');
    setters.setPercent(0);
    setters.setError(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [setters]);

  useEffect(() => {
    if (isComplete || isError) {
      timerRef.current = setTimeout(reset, AUTO_RESET_DELAY_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isComplete, isError, reset]);

  return reset;
}

/**
 * Subscribe eagerly to WebSocket progress events.
 * Returns a ref that is set to true when a real WS event arrives.
 */
function useWsSubscription(
  mangaId: number,
  active: boolean,
  setters: ProgressSetters
): { receivedWsEvent: React.MutableRefObject<boolean>; resetWsFlag: () => void } {
  const { subscribe, isConnected } = useRealTime();
  const activeRef = useRef(active);
  activeRef.current = active;

  const settersRef = useRef(setters);
  settersRef.current = setters;

  const receivedWsEvent = useRef(false);
  const resetWsFlag = useCallback((): void => {
    receivedWsEvent.current = false;
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const channel = CHANNEL_PATTERNS.METADATA_REFRESH_PROGRESS(mangaId);

    const unsubscribe = subscribe(channel, (event: WebSocketEvent) => {
      if (!activeRef.current) return;

      const data = event.data as MetadataRefreshProgressData;
      if (data.mangaId !== mangaId) return;

      receivedWsEvent.current = true;
      const s = settersRef.current;
      s.setPhase(data.phase);
      s.setMessage(data.message || PHASE_LABELS[data.phase]);
      s.setPercent(Math.round((data.phaseIndex / data.totalPhases) * 100));

      if (data.error) {
        s.setError(data.error);
      }
    });

    return unsubscribe;
  }, [isConnected, mangaId, subscribe]);

  return { receivedWsEvent, resetWsFlag };
}

/** Apply a simulated phase to state */
function applySimulatedPhase(
  elapsedSeconds: number,
  setters: ProgressSetters
): void {
  const sim = getSimulatedPhase(elapsedSeconds);
  setters.setPhase(sim.phase);
  setters.setMessage(sim.label);
  setters.setPercent(sim.percent);
}

/**
 * Simulated progress fallback when WS events are unavailable.
 * Animates through phases on a timer. Stops if real WS events arrive.
 */
function useSimulatedProgress(
  active: boolean,
  receivedWsEvent: React.MutableRefObject<boolean>,
  resetWsFlag: () => void,
  setters: ProgressSetters
): void {
  const settersRef = useRef(setters);
  settersRef.current = setters;

  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      resetWsFlag();
      return;
    }

    startTimeRef.current = Date.now();
    settersRef.current.setPhase('starting');
    settersRef.current.setMessage(PHASE_LABELS.starting);
    settersRef.current.setPercent(5);
    settersRef.current.setError(null);

    const intervalId = setInterval(() => {
      if (receivedWsEvent.current) {
        clearInterval(intervalId);
        return;
      }
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      applySimulatedPhase(elapsed, settersRef.current);
    }, SIMULATION_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [active, receivedWsEvent, resetWsFlag]);

  // When mutation completes (active goes false), show completion
  const prevActiveRef = useRef(active);
  useEffect(() => {
    if (prevActiveRef.current && !active) {
      settersRef.current.setPhase('completed');
      settersRef.current.setMessage(PHASE_LABELS.completed);
      settersRef.current.setPercent(100);
    }
    prevActiveRef.current = active;
  }, [active]);
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Subscribe to metadata refresh progress events for a specific manga.
 *
 * Uses real WebSocket events when available, falls back to simulated
 * progress animation when the WebSocket connection is unavailable.
 *
 * @param mangaId - The manga ID to track progress for
 * @param active - Whether to listen (set to true when mutation is pending)
 */
export function useMetadataRefreshProgress(
  mangaId: number,
  active: boolean
): MetadataRefreshProgress {
  const [phase, setPhase] = useState<MetadataRefreshPhase | null>(null);
  const [message, setMessage] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isComplete = phase === 'completed';
  const isError = phase === 'error';
  const isRefreshing = active || (phase !== null && !isComplete && !isError);

  const setters = { setPhase, setMessage, setPercent, setError };

  const reset = useAutoReset(isComplete, isError, setters);
  const { receivedWsEvent, resetWsFlag } = useWsSubscription(mangaId, active, setters);
  useSimulatedProgress(active, receivedWsEvent, resetWsFlag, setters);

  return { isRefreshing, phase, message, percent, isComplete, isError, error, reset };
}
