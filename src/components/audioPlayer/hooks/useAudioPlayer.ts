/**
 * @file-size-justified: single hook owns the entire HTML5 Audio lifecycle +
 * Zustand sync + chapter-detection effects; splitting them risks racy
 * re-mounts and event-handler-vs-state ordering bugs.
 *
 * useAudioPlayer Hook
 *
 * Main hook for managing audio playback using HTML5 Audio API.
 * Synchronizes with Zustand store and handles audio element lifecycle.
 *
 * Features:
 * - Audio element management
 * - Play/pause/seek controls
 * - Volume and playback speed
 * - Event handling (timeupdate, ended, error)
 * - Chapter detection for M4B files
 *
 * @module components/audioPlayer/hooks/useAudioPlayer
 */

import { useCallback, useEffect, useRef } from 'react';

import { useAudioPlayerStore } from '@/store/audioPlayerSlice';
import type { AudioTrack, AudioTrackChapter } from '@/types/audioPlayer';

// ============================================================================
// Types
// ============================================================================

export interface UseAudioPlayerReturn {
  /** Reference to audio element */
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** Play audio */
  play: () => Promise<void>;
  /** Pause audio */
  pause: () => void;
  /** Toggle play/pause */
  togglePlay: () => Promise<void>;
  /** Stop and reset audio */
  stop: () => void;
  /** Seek to time (seconds) */
  seek: (time: number) => void;
  /** Skip forward by seconds */
  skipForward: (seconds?: number) => void;
  /** Skip backward by seconds */
  skipBackward: (seconds?: number) => void;
  /** Load a track */
  loadTrack: (track: AudioTrack) => Promise<void>;
  /** Load playlist */
  loadPlaylist: (tracks: AudioTrack[], startIndex?: number) => Promise<void>;
  /** Set volume (0-1) */
  setVolume: (volume: number) => void;
  /** Toggle mute */
  toggleMute: () => void;
  /** Set playback speed */
  setPlaybackSpeed: (speed: number) => void;
  /** Go to specific chapter */
  goToChapter: (index: number) => void;
  /** Next chapter */
  nextChapter: () => void;
  /** Previous chapter */
  previousChapter: () => void;
  /** Current state */
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  currentTrack: AudioTrack | null;
  hasError: boolean;
  errorMessage: string | null;
}

// ============================================================================
// Hook
// ============================================================================

// eslint-disable-next-line max-lines-per-function -- Audio playback hook managing HTML5 Audio API lifecycle, events, and store synchronization
export function useAudioPlayer(): UseAudioPlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Store state
  const {
    playback,
    settings,
    play: storePlay,
    pause: storePause,
    setCurrentTime,
    setDuration,
    setBufferedTime,
    setLoading,
    setError,
    clearError,
    loadTrack: storeLoadTrack,
    loadPlaylist: storeLoadPlaylist,
    setVolume: storeSetVolume,
    toggleMute: storeToggleMute,
    setPlaybackSpeed: storeSetPlaybackSpeed,
    setCurrentChapterIndex,
    playNext,
    skipForward: storeSkipForward,
    skipBackward: storeSkipBackward,
  } = useAudioPlayerStore();

  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackSpeed,
    hasError,
    errorMessage,
    currentChapterIndex,
  } = playback;

  // ============================================================================
  // Audio Element Setup
  // ============================================================================

  // Create audio element on mount
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  // Handle time update
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = (): void => {
      setCurrentTime(audio.currentTime);

      // Update buffered time
      if (audio.buffered.length > 0) {
        setBufferedTime(audio.buffered.end(audio.buffered.length - 1));
      }

      // Detect current chapter for M4B
      if (currentTrack?.chapters && currentTrack.chapters.length > 0) {
        const newChapterIndex = findCurrentChapterIndex(
          audio.currentTime,
          currentTrack.chapters
        );
        if (newChapterIndex !== currentChapterIndex) {
          setCurrentChapterIndex(newChapterIndex);
        }
      }
    };

    const handleDurationChange = (): void => {
      setDuration(audio.duration);
    };

    const handleLoadedMetadata = (): void => {
      setDuration(audio.duration);
      setLoading(false);
    };

    const handleCanPlay = (): void => {
      setLoading(false);
    };

    const handleWaiting = (): void => {
      setLoading(true);
    };

    const handlePlaying = (): void => {
      setLoading(false);
    };

    const handleEnded = (): void => {
      playNext();
    };

    const handleError = (): void => {
      const errorMessage = getAudioErrorMessage(audio.error);
      setError(errorMessage);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [
    currentTrack,
    currentChapterIndex,
    playNext,
    setBufferedTime,
    setCurrentChapterIndex,
    setCurrentTime,
    setDuration,
    setError,
    setLoading,
  ]);

  // Sync volume with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Sync playback speed with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Sync play state with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.play().catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') {
          setError('Failed to play audio');
        }
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack, setError]);

  // ============================================================================
  // Playback Controls
  // ============================================================================

  const play = useCallback(async (): Promise<void> => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    try {
      clearError();
      await audio.play();
      storePlay();
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setError('Failed to play audio');
      }
    }
  }, [currentTrack, clearError, storePlay, setError]);

  const pause = useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    storePause();
  }, [storePause]);

  const togglePlay = useCallback(async (): Promise<void> => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const stop = useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    storePause();
    setCurrentTime(0);
  }, [storePause, setCurrentTime]);

  const seek = useCallback(
    (time: number): void => {
      const audio = audioRef.current;
      if (!audio) return;

      const clampedTime = Math.max(0, Math.min(time, audio.duration || duration));
      audio.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    },
    [duration, setCurrentTime]
  );

  const skipForward = useCallback(
    (seconds?: number): void => {
      const audio = audioRef.current;
      if (!audio) return;

      const skipAmount = seconds ?? settings.skipForwardSeconds;
      const newTime = Math.min(audio.currentTime + skipAmount, audio.duration);
      audio.currentTime = newTime;
      storeSkipForward(skipAmount);
    },
    [settings.skipForwardSeconds, storeSkipForward]
  );

  const skipBackward = useCallback(
    (seconds?: number): void => {
      const audio = audioRef.current;
      if (!audio) return;

      const skipAmount = seconds ?? settings.skipBackwardSeconds;
      const newTime = Math.max(audio.currentTime - skipAmount, 0);
      audio.currentTime = newTime;
      storeSkipBackward(skipAmount);
    },
    [settings.skipBackwardSeconds, storeSkipBackward]
  );

  // ============================================================================
  // Track Loading
  // ============================================================================

  const loadTrack = useCallback(
    async (track: AudioTrack): Promise<void> => {
      const audio = audioRef.current;
      if (!audio) return;

      setLoading(true);
      clearError();

      // Build audio URL
      const audioUrl = `/api/audio/${track.mangaId}/${track.chapterId}`;

      try {
        audio.src = audioUrl;
        audio.load();
        storeLoadTrack(track);

        // Apply settings
        audio.volume = isMuted ? 0 : volume;
        audio.playbackRate = playbackSpeed;

        // Auto-play
        await audio.play();
        storePlay();
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError') {
          setError('Failed to load audio track');
        }
      }
    },
    [
      clearError,
      isMuted,
      playbackSpeed,
      setError,
      setLoading,
      storeLoadTrack,
      storePlay,
      volume,
    ]
  );

  const loadPlaylist = useCallback(
    async (tracks: AudioTrack[], startIndex = 0): Promise<void> => {
      if (tracks.length === 0) return;

      storeLoadPlaylist(tracks, startIndex);

      const track = tracks[startIndex];
      if (track) {
        await loadTrack(track);
      }
    },
    [loadTrack, storeLoadPlaylist]
  );

  // ============================================================================
  // Volume & Speed
  // ============================================================================

  const setVolume = useCallback(
    (newVolume: number): void => {
      const audio = audioRef.current;
      if (!audio) return;

      const clampedVolume = Math.max(0, Math.min(1, newVolume));
      audio.volume = clampedVolume;
      storeSetVolume(clampedVolume);
    },
    [storeSetVolume]
  );

  const toggleMute = useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) return;

    const newMuted = !isMuted;
    audio.volume = newMuted ? 0 : volume;
    storeToggleMute();
  }, [isMuted, volume, storeToggleMute]);

  const setPlaybackSpeed = useCallback(
    (speed: number): void => {
      const audio = audioRef.current;
      if (!audio) return;

      audio.playbackRate = speed;
      storeSetPlaybackSpeed(speed as 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2 | 2.5 | 3);
    },
    [storeSetPlaybackSpeed]
  );

  // ============================================================================
  // Chapter Navigation
  // ============================================================================

  const goToChapter = useCallback(
    (index: number): void => {
      if (!currentTrack?.chapters) return;

      const chapter = currentTrack.chapters[index];
      if (chapter) {
        seek(chapter.startTime);
        setCurrentChapterIndex(index);
      }
    },
    [currentTrack, seek, setCurrentChapterIndex]
  );

  const nextChapter = useCallback((): void => {
    if (!currentTrack?.chapters) return;

    const nextIndex = currentChapterIndex + 1;
    if (nextIndex < currentTrack.chapters.length) {
      goToChapter(nextIndex);
    }
  }, [currentTrack, currentChapterIndex, goToChapter]);

  const previousChapter = useCallback((): void => {
    if (!currentTrack?.chapters) return;

    const currentChapter = currentTrack.chapters[currentChapterIndex];
    // If more than 3 seconds into chapter, restart it
    if (currentChapter && currentTime - currentChapter.startTime > 3) {
      seek(currentChapter.startTime);
      return;
    }

    const prevIndex = currentChapterIndex - 1;
    if (prevIndex >= 0) {
      goToChapter(prevIndex);
    }
  }, [currentTrack, currentChapterIndex, currentTime, seek, goToChapter]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    audioRef,
    play,
    pause,
    togglePlay,
    stop,
    seek,
    skipForward,
    skipBackward,
    loadTrack,
    loadPlaylist,
    setVolume,
    toggleMute,
    setPlaybackSpeed,
    goToChapter,
    nextChapter,
    previousChapter,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackSpeed,
    currentTrack,
    hasError,
    errorMessage,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Find current chapter index based on playback time
 */
function findCurrentChapterIndex(
  currentTime: number,
  chapters: AudioTrackChapter[]
): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    const chapter = chapters[i];
    if (chapter && currentTime >= chapter.startTime) {
      return i;
    }
  }
  return 0;
}

/**
 * Get human-readable error message from MediaError
 */
function getAudioErrorMessage(error: MediaError | null): string {
  if (!error) return 'Unknown audio error';

  switch (error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Playback aborted';
    case MediaError.MEDIA_ERR_NETWORK:
      return 'Network error while loading audio';
    case MediaError.MEDIA_ERR_DECODE:
      return 'Audio decoding error';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'Audio format not supported';
    default:
      return 'Unknown audio error';
  }
}

export default useAudioPlayer;
