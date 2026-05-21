/**
 * useSleepTimer Hook
 *
 * Manages sleep timer functionality with countdown and volume fade.
 *
 * Features:
 * - Time-based sleep timer (5, 10, 15, 30, 45, 60 minutes)
 * - End of chapter mode (for M4B files)
 * - Volume fade before pause (3 seconds)
 * - Countdown display
 *
 * @module components/audioPlayer/hooks/useSleepTimer
 */

import { useCallback, useEffect, useRef } from 'react';

import { useAudioPlayerStore } from '@/store/audioPlayerSlice';
import type { SleepTimerMode } from '@/types/audioPlayer';

// ============================================================================
// Types
// ============================================================================

export interface UseSleepTimerReturn {
  /** Set sleep timer (minutes or 'chapter') */
  setSleepTimer: (value: number | 'chapter') => void;
  /** Cancel active sleep timer */
  cancelSleepTimer: () => void;
  /** Extend timer by minutes */
  extendTimer: (minutes: number) => void;
  /** Time remaining in seconds */
  timeRemaining: number | null;
  /** Whether timer is active */
  isActive: boolean;
  /** Current timer mode */
  mode: SleepTimerMode | null;
  /** Formatted time remaining string */
  formattedTimeRemaining: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const FADE_DURATION = 3000; // 3 seconds
const FADE_INTERVAL = 100; // Update every 100ms
const UPDATE_INTERVAL = 1000; // Update countdown every second

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// Hook
// ============================================================================

export function useSleepTimer(): UseSleepTimerReturn {
  // Store state
  const {
    sleepTimer,
    playback,
    startSleepTimer: storeStartSleepTimer,
    startChapterSleepTimer: storeStartChapterSleepTimer,
    cancelSleepTimer: storeCancelSleepTimer,
    updateSleepTimerRemaining,
    pause,
    setVolume,
  } = useAudioPlayerStore();

  const { isActive, endTime, mode, remainingSeconds } = sleepTimer;
  const { isPlaying, volume, currentChapterIndex } = playback;

  // Refs for timer management
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const originalVolumeRef = useRef<number>(volume);
  const chapterIndexRef = useRef<number>(currentChapterIndex);

  // ============================================================================
  // Set Sleep Timer
  // ============================================================================

  const setSleepTimer = useCallback(
    (value: number | 'chapter'): void => {
      // Clear any existing timers
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      if (value === 'chapter') {
        // End of chapter mode - store current chapter index
        chapterIndexRef.current = currentChapterIndex;
        storeStartChapterSleepTimer();
      } else {
        // Time-based mode
        const minutes = value;
        storeStartSleepTimer(minutes);
      }

      // Store original volume for fade
      originalVolumeRef.current = volume;
    },
    [currentChapterIndex, volume, storeStartSleepTimer, storeStartChapterSleepTimer]
  );

  // ============================================================================
  // Cancel Sleep Timer
  // ============================================================================

  const cancelSleepTimer = useCallback((): void => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    // Restore volume if it was being faded
    if (originalVolumeRef.current !== volume) {
      setVolume(originalVolumeRef.current);
    }

    storeCancelSleepTimer();
  }, [volume, setVolume, storeCancelSleepTimer]);

  // ============================================================================
  // Extend Timer
  // ============================================================================

  const extendTimer = useCallback(
    (minutes: number): void => {
      if (!isActive || mode !== 'time') return;

      const additionalMs = minutes * 60 * 1000;
      const newEndTime = (endTime ?? Date.now()) + additionalMs;
      const newRemaining = Math.ceil((newEndTime - Date.now()) / 1000);

      updateSleepTimerRemaining(newRemaining);
    },
    [isActive, mode, endTime, updateSleepTimerRemaining]
  );

  // ============================================================================
  // Volume Fade Effect
  // ============================================================================

  const startVolumeFade = useCallback((): void => {
    const steps = FADE_DURATION / FADE_INTERVAL;
    const volumeStep = originalVolumeRef.current / steps;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = Math.max(0, originalVolumeRef.current - volumeStep * currentStep);
      setVolume(newVolume);

      if (currentStep >= steps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }

        // Pause and restore volume
        pause();
        setVolume(originalVolumeRef.current);
        storeCancelSleepTimer();
      }
    }, FADE_INTERVAL);
  }, [setVolume, pause, storeCancelSleepTimer]);

  // ============================================================================
  // Countdown Timer Effect (time-based mode)
  // ============================================================================

  useEffect(() => {
    if (!isActive || mode !== 'time' || !isPlaying) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = endTime ? Math.ceil((endTime - now) / 1000) : 0;

      if (remaining <= 0) {
        // Time's up - start fade
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        startVolumeFade();
      } else if (remaining <= 3) {
        // Start fade 3 seconds before end
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        startVolumeFade();
      } else {
        updateSleepTimerRemaining(remaining);
      }
    }, UPDATE_INTERVAL);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isActive, mode, endTime, isPlaying, updateSleepTimerRemaining, startVolumeFade]);

  // ============================================================================
  // Chapter End Effect (chapter mode)
  // ============================================================================

  useEffect(() => {
    if (!isActive || mode !== 'chapter') return;

    // Check if chapter changed
    if (currentChapterIndex !== chapterIndexRef.current) {
      // Chapter ended - start fade
      startVolumeFade();
    }
  }, [isActive, mode, currentChapterIndex, startVolumeFade]);

  // ============================================================================
  // Cleanup on unmount
  // ============================================================================

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    setSleepTimer,
    cancelSleepTimer,
    extendTimer,
    timeRemaining: remainingSeconds,
    isActive,
    mode,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- remainingSeconds may be null when timer not active
    formattedTimeRemaining: remainingSeconds !== null ? formatTimeRemaining(remainingSeconds) : null,
  };
}

export default useSleepTimer;
