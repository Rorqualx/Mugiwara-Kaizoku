/**
 * usePlaybackProgress Hook
 *
 * Auto-saves playback progress to server with debouncing.
 * Restores position on track load when rememberPosition is enabled.
 *
 * Features:
 * - Debounced progress saves (5 second interval)
 * - Save on pause, visibility change, and unmount
 * - Position restoration on track load
 * - Listening time tracking
 *
 * @module components/audioPlayer/hooks/usePlaybackProgress
 */

import { useCallback, useEffect, useRef } from 'react';

import { useAudioPlayerStore } from '@/store/audioPlayerSlice';
import type { AudioTrack } from '@/types/audioPlayer';
import { trpc } from '@/utils/trpc-client';


// ============================================================================
// Types
// ============================================================================

export interface UsePlaybackProgressOptions {
  /** Debounce interval in milliseconds */
  saveInterval?: number;
  /** Whether to restore position on track load */
  restorePosition?: boolean;
}

export interface UsePlaybackProgressReturn {
  /** Save progress immediately */
  saveProgress: () => Promise<void>;
  /** Get saved progress for a track */
  getSavedProgress: (mangaId: number, chapterId: number) => Promise<number | null>;
  /** Mark track as completed */
  markCompleted: () => Promise<void>;
  /** Whether currently saving */
  isSaving: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SAVE_INTERVAL = 5000; // 5 seconds
const COMPLETION_THRESHOLD = 0.95; // 95% listened = completed

// ============================================================================
// Hook
// ============================================================================

export function usePlaybackProgress(
  options: UsePlaybackProgressOptions = {}
): UsePlaybackProgressReturn {
  const { saveInterval = DEFAULT_SAVE_INTERVAL, restorePosition = true } = options;

  // Store state
  const { playback, settings } = useAudioPlayerStore();
  const { currentTrack, currentTime, duration, isPlaying, volume, playbackSpeed } = playback;

  // Refs for tracking
  const lastSaveTimeRef = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const sessionStartPositionRef = useRef<number>(0);

  // tRPC mutations (procedures are at top level, not nested)
  const updateProgressMutation = trpc.audioPlayer.updateProgress.useMutation();
  const markCompletedMutation = trpc.audioPlayer.markCompleted.useMutation();
  const recordSessionMutation = trpc.audioPlayer.recordSession.useMutation();

  // tRPC queries
  const utils = trpc.useUtils();

  // ============================================================================
  // Save Progress
  // ============================================================================

  const saveProgress = useCallback(async (): Promise<void> => {
    if (!currentTrack || duration <= 0) return;

    // Prevent rapid saves
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 1000) return;
    lastSaveTimeRef.current = now;

    try {
      await updateProgressMutation.mutateAsync({
        mangaId: currentTrack.mangaId,
        chapterId: currentTrack.chapterId,
        currentTime,
        duration,
        playbackSpeed,
        volume,
      });
    } catch (_error) {
      // Silently fail - progress saving is non-critical
      // Error will be logged by tRPC error handling
    }
  }, [currentTrack, currentTime, duration, playbackSpeed, volume, updateProgressMutation]);

  // ============================================================================
  // Get Saved Progress
  // ============================================================================

  const getSavedProgress = useCallback(
    async (mangaId: number, chapterId: number): Promise<number | null> => {
      try {
        const progress = await utils.audioPlayer.getProgress.fetch({
          mangaId,
          chapterId,
        });

        if (progress?.currentTime) {
          return progress.currentTime;
        }
        return null;
      } catch {
        return null;
      }
    },
    [utils]
  );

  // ============================================================================
  // Mark Completed
  // ============================================================================

  const markCompleted = useCallback(async (): Promise<void> => {
    if (!currentTrack) return;

    try {
      // Use the dedicated markCompleted mutation
      await markCompletedMutation.mutateAsync({
        mangaId: currentTrack.mangaId,
        chapterId: currentTrack.chapterId,
      });

      // Record listening session
      const sessionDuration = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      if (sessionDuration > 10) {
        await recordSessionMutation.mutateAsync({
          mangaId: currentTrack.mangaId,
          chapterId: currentTrack.chapterId,
          timeListened: sessionDuration,
          startTime: sessionStartPositionRef.current,
          endTime: duration,
          playbackSpeed,
        });
      }

      // Reset session start for next track
      sessionStartRef.current = Date.now();
      sessionStartPositionRef.current = 0;
    } catch {
      // Silently fail
    }
  }, [currentTrack, duration, playbackSpeed, markCompletedMutation, recordSessionMutation]);

  // ============================================================================
  // Auto-save on interval while playing
  // ============================================================================

  useEffect(() => {
    if (!isPlaying || !currentTrack) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      return;
    }

    const scheduleNextSave = (): void => {
      saveTimeoutRef.current = setTimeout(() => {
        void saveProgress();
        scheduleNextSave();
      }, saveInterval);
    };

    scheduleNextSave();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [isPlaying, currentTrack, saveProgress, saveInterval]);

  // ============================================================================
  // Save on pause
  // ============================================================================

  useEffect(() => {
    if (!isPlaying && currentTrack && currentTime > 0) {
      void saveProgress();
    }
  }, [isPlaying, currentTrack, currentTime, saveProgress]);

  // ============================================================================
  // Save on visibility change (tab switch, minimize)
  // ============================================================================

  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.hidden && currentTrack && currentTime > 0) {
        void saveProgress();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentTrack, currentTime, saveProgress]);

  // ============================================================================
  // Save on unmount
  // ============================================================================

  useEffect(() => {
    return () => {
      if (currentTrack && currentTime > 0) {
        // Use synchronous approach for unmount
        // Note: This may not complete if page is closed
        void saveProgress();
      }
    };
  }, [currentTrack, currentTime, saveProgress]);

  // ============================================================================
  // Auto-complete when near end
  // ============================================================================

  useEffect(() => {
    if (!currentTrack || duration <= 0) return;

    const progress = currentTime / duration;
    if (progress >= COMPLETION_THRESHOLD) {
      void markCompleted();
    }
  }, [currentTrack, currentTime, duration, markCompleted]);

  // ============================================================================
  // Restore position on track load
  // ============================================================================

  useEffect(() => {
    const restoreTrackPosition = async (track: AudioTrack): Promise<void> => {
      if (!restorePosition || !settings.rememberPosition) return;

      const savedTime = await getSavedProgress(track.mangaId, track.chapterId);
      if (savedTime !== null && savedTime > 0) {
        // Store will handle seeking through the audio hook
        useAudioPlayerStore.getState().setCurrentTime(savedTime);
        // Initialize session start position for session tracking
        sessionStartPositionRef.current = savedTime;
      } else {
        sessionStartPositionRef.current = 0;
      }
    };

    if (currentTrack) {
      void restoreTrackPosition(currentTrack);
      sessionStartRef.current = Date.now();
    }
  }, [currentTrack, restorePosition, settings.rememberPosition, getSavedProgress]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    saveProgress,
    getSavedProgress,
    markCompleted,
    isSaving: updateProgressMutation.isPending,
  };
}

export default usePlaybackProgress;
