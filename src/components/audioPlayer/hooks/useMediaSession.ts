/**
 * useMediaSession Hook
 *
 * Integrates with the MediaSession API for OS-level media controls.
 * Enables lock screen controls, notification media controls, and
 * hardware media button support.
 *
 * Features:
 * - Lock screen / notification controls
 * - Hardware media button support (headphones, etc.)
 * - Track metadata display
 * - Position state synchronization
 * - Chapter navigation support
 *
 * @module components/audioPlayer/hooks/useMediaSession
 */

import { useCallback, useEffect } from 'react';

import { useAudioPlayerStore } from '@/store/audioPlayerSlice';
import type { AudioTrack } from '@/types/audioPlayer';

// ============================================================================
// Types
// ============================================================================

export interface UseMediaSessionOptions {
  /** Skip forward seconds */
  skipForwardSeconds?: number;
  /** Skip backward seconds */
  skipBackwardSeconds?: number;
}

export interface UseMediaSessionReturn {
  /** Whether MediaSession API is supported */
  isSupported: boolean;
  /** Update metadata manually */
  updateMetadata: (track: AudioTrack) => void;
  /** Update position state */
  updatePositionState: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useMediaSession(
  options: UseMediaSessionOptions = {}
): UseMediaSessionReturn {
  const { skipForwardSeconds = 30, skipBackwardSeconds = 10 } = options;

  // Store state and actions
  const { playback, play, pause, skipForward, skipBackward, setCurrentChapterIndex } =
    useAudioPlayerStore();

  const { currentTrack, isPlaying, currentTime, duration, playbackSpeed, currentChapterIndex } =
    playback;

  // Check if MediaSession API is supported
  const isSupported = typeof navigator !== 'undefined' && 'mediaSession' in navigator;

  // ============================================================================
  // Update Metadata
  // ============================================================================

  const updateMetadata = useCallback(
    (track: AudioTrack): void => {
      if (!isSupported) return;

      const artwork: MediaImage[] = [];

      // Add cover art if available
      if (track.coverUrl) {
        artwork.push(
          { src: track.coverUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: track.coverUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: track.coverUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: track.coverUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: track.coverUrl, sizes: '384x384', type: 'image/jpeg' },
          { src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' }
        );
      }

      // Get current chapter title if available
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- chapters may be undefined
      const currentChapter = track.chapters?.[currentChapterIndex];
      const chapterTitle = currentChapter?.title;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapterTitle ?? track.title,
        artist: track.artist ?? track.mangaTitle,
        album: track.mangaTitle,
        artwork,
      });
    },
    [isSupported, currentChapterIndex]
  );

  // ============================================================================
  // Update Position State
  // ============================================================================

  const updatePositionState = useCallback((): void => {
    if (!isSupported || duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: playbackSpeed,
        position: Math.min(currentTime, duration),
      });
    } catch {
      // Some browsers may not support setPositionState
    }
  }, [isSupported, duration, playbackSpeed, currentTime]);

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handlePlay = useCallback((): void => {
    play();
  }, [play]);

  const handlePause = useCallback((): void => {
    pause();
  }, [pause]);

  const handleSeekBackward = useCallback(
    (details: MediaSessionActionDetails): void => {
      const seekOffset = details.seekOffset ?? skipBackwardSeconds;
      skipBackward(seekOffset);
    },
    [skipBackward, skipBackwardSeconds]
  );

  const handleSeekForward = useCallback(
    (details: MediaSessionActionDetails): void => {
      const seekOffset = details.seekOffset ?? skipForwardSeconds;
      skipForward(seekOffset);
    },
    [skipForward, skipForwardSeconds]
  );

  const handleSeekTo = useCallback(
    (details: MediaSessionActionDetails): void => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- seekTime may be undefined/null from MediaSession API
      if (details.seekTime !== null && details.seekTime !== undefined) {
        useAudioPlayerStore.getState().setCurrentTime(details.seekTime);
      }
    },
    []
  );

  const handlePreviousTrack = useCallback((): void => {
    // Go to previous chapter if available
    if (currentTrack?.chapters && currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
    }
  }, [currentTrack, currentChapterIndex, setCurrentChapterIndex]);

  const handleNextTrack = useCallback((): void => {
    // Go to next chapter if available
    if (currentTrack?.chapters && currentChapterIndex < currentTrack.chapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
    }
  }, [currentTrack, currentChapterIndex, setCurrentChapterIndex]);

  const handleStop = useCallback((): void => {
    pause();
    useAudioPlayerStore.getState().setCurrentTime(0);
  }, [pause]);

  // ============================================================================
  // Setup Action Handlers
  // ============================================================================

  useEffect(() => {
    if (!isSupported) return;

    // Set up action handlers
    try {
      navigator.mediaSession.setActionHandler('play', handlePlay);
      navigator.mediaSession.setActionHandler('pause', handlePause);
      navigator.mediaSession.setActionHandler('seekbackward', handleSeekBackward);
      navigator.mediaSession.setActionHandler('seekforward', handleSeekForward);
      navigator.mediaSession.setActionHandler('seekto', handleSeekTo);
      navigator.mediaSession.setActionHandler('stop', handleStop);

      // Chapter navigation (only if chapters available)
      if (currentTrack?.chapters && currentTrack.chapters.length > 1) {
        navigator.mediaSession.setActionHandler('previoustrack', handlePreviousTrack);
        navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack);
      } else {
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      }
    } catch {
      // Some handlers may not be supported
    }

    return () => {
      // Clean up handlers on unmount
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('seekto', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('stop', null);
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [
    isSupported,
    currentTrack,
    handlePlay,
    handlePause,
    handleSeekBackward,
    handleSeekForward,
    handleSeekTo,
    handlePreviousTrack,
    handleNextTrack,
    handleStop,
  ]);

  // ============================================================================
  // Update Metadata on Track Change
  // ============================================================================

  useEffect(() => {
    if (!isSupported || !currentTrack) return;

    updateMetadata(currentTrack);
  }, [isSupported, currentTrack, updateMetadata]);

  // ============================================================================
  // Update Playback State
  // ============================================================================

  useEffect(() => {
    if (!isSupported) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isSupported, isPlaying]);

  // ============================================================================
  // Update Position State Periodically
  // ============================================================================

  useEffect(() => {
    if (!isSupported || !currentTrack) return;

    updatePositionState();
  }, [isSupported, currentTrack, currentTime, duration, playbackSpeed, updatePositionState]);

  // ============================================================================
  // Update Metadata on Chapter Change
  // ============================================================================

  useEffect(() => {
    if (!isSupported || !currentTrack?.chapters) return;

    updateMetadata(currentTrack);
  }, [isSupported, currentTrack, currentChapterIndex, updateMetadata]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    isSupported,
    updateMetadata,
    updatePositionState,
  };
}

export default useMediaSession;
