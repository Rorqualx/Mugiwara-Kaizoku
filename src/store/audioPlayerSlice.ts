/**
 * Audio Player Store
 *
 * Zustand store for managing audio player state including playback,
 * sleep timer, UI visibility, and user settings.
 *
 * Features:
 * - Playback state management
 * - Sleep timer with multiple modes
 * - UI state for mini/fullscreen player
 * - Playlist/queue management
 * - Settings persistence
 *
 * @module store/audioPlayerSlice
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type {
  AudioTrack,
  AudioTrackChapter,
  PlaybackSpeed,
  SleepTimerMode,
  SleepTimerPreset,
} from '@/types/audioPlayer';

// ============================================================================
// State Types
// ============================================================================

/**
 * Core playback state
 */
interface PlaybackState {
  /** Currently playing track */
  currentTrack: AudioTrack | null;
  /** Playlist of tracks */
  playlist: AudioTrack[];
  /** Current playlist index */
  playlistIndex: number;
  /** Is audio playing */
  isPlaying: boolean;
  /** Is audio loading */
  isLoading: boolean;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Buffered time in seconds */
  bufferedTime: number;
  /** Volume level (0-1) */
  volume: number;
  /** Is muted */
  isMuted: boolean;
  /** Playback speed multiplier */
  playbackSpeed: PlaybackSpeed;
  /** Current chapter index within track (for M4B) */
  currentChapterIndex: number;
  /** Has playback error */
  hasError: boolean;
  /** Error message */
  errorMessage: string | null;
}

/**
 * Sleep timer state
 */
interface SleepTimerState {
  /** Is timer active */
  isActive: boolean;
  /** Timer mode */
  mode: SleepTimerMode;
  /** End time as timestamp (for 'time' mode) */
  endTime: number | null;
  /** Remaining time in seconds */
  remainingSeconds: number;
  /** Should fade volume before stopping */
  fadeBeforeStop: boolean;
}

/**
 * UI state for player visibility
 */
interface UIState {
  /** Is mini player visible */
  isMiniPlayerVisible: boolean;
  /** Is fullscreen player open */
  isFullscreenOpen: boolean;
  /** Is chapter list drawer open */
  isChapterListOpen: boolean;
  /** Is bookmark list drawer open */
  isBookmarkListOpen: boolean;
  /** Is sleep timer modal open */
  isSleepTimerOpen: boolean;
  /** Is speed selector open */
  isSpeedSelectorOpen: boolean;
}

/**
 * Persisted settings state
 */
interface SettingsState {
  /** Default playback speed */
  defaultPlaybackSpeed: PlaybackSpeed;
  /** Skip forward seconds */
  skipForwardSeconds: number;
  /** Skip backward seconds */
  skipBackwardSeconds: number;
  /** Default sleep timer preset */
  defaultSleepTimerPreset: SleepTimerPreset | null;
  /** Remember playback position */
  rememberPosition: boolean;
  /** Auto-play next track */
  autoPlayNext: boolean;
  /** Show remaining time (vs elapsed) */
  showRemainingTime: boolean;
  /** Enable haptic feedback on mobile */
  hapticFeedback: boolean;
}

/**
 * Complete audio player state
 */
export interface AudioPlayerState {
  playback: PlaybackState;
  sleepTimer: SleepTimerState;
  ui: UIState;
  settings: SettingsState;
}

/**
 * Audio player state data (serializable)
 */
export type AudioPlayerStateData = AudioPlayerState;

// ============================================================================
// Actions
// ============================================================================

/**
 * Audio player actions
 */
export interface AudioPlayerActions {
  // Playback controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (time: number) => void;
  skipForward: (seconds?: number) => void;
  skipBackward: (seconds?: number) => void;

  // Time updates (from audio element)
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setBufferedTime: (time: number) => void;

  // Loading/error states
  setLoading: (loading: boolean) => void;
  setError: (message: string | null) => void;
  clearError: () => void;

  // Track management
  loadTrack: (track: AudioTrack) => void;
  loadPlaylist: (tracks: AudioTrack[], startIndex?: number) => void;
  clearTrack: () => void;
  playNext: () => void;
  playPrevious: () => void;
  setPlaylistIndex: (index: number) => void;

  // Settings
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;

  // Chapters (M4B)
  setCurrentChapterIndex: (index: number) => void;
  goToChapter: (index: number, chapters: AudioTrackChapter[]) => void;
  nextChapter: () => void;
  previousChapter: () => void;

  // Sleep timer
  startSleepTimer: (minutes: number) => void;
  startChapterSleepTimer: () => void;
  cancelSleepTimer: () => void;
  updateSleepTimerRemaining: (seconds: number) => void;
  setFadeBeforeStop: (fade: boolean) => void;

  // UI state
  showMiniPlayer: () => void;
  hideMiniPlayer: () => void;
  openFullscreen: () => void;
  closeFullscreen: () => void;
  toggleChapterList: () => void;
  toggleBookmarkList: () => void;
  toggleSleepTimerModal: () => void;
  toggleSpeedSelector: () => void;
  closeAllModals: () => void;

  // Settings
  updateSettings: (settings: Partial<SettingsState>) => void;
  resetSettings: () => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialPlaybackState: PlaybackState = {
  currentTrack: null,
  playlist: [],
  playlistIndex: 0,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  bufferedTime: 0,
  volume: 1,
  isMuted: false,
  playbackSpeed: 1,
  currentChapterIndex: 0,
  hasError: false,
  errorMessage: null,
};

const initialSleepTimerState: SleepTimerState = {
  isActive: false,
  mode: 'off',
  endTime: null,
  remainingSeconds: 0,
  fadeBeforeStop: true,
};

const initialUIState: UIState = {
  isMiniPlayerVisible: false,
  isFullscreenOpen: false,
  isChapterListOpen: false,
  isBookmarkListOpen: false,
  isSleepTimerOpen: false,
  isSpeedSelectorOpen: false,
};

const initialSettingsState: SettingsState = {
  defaultPlaybackSpeed: 1,
  skipForwardSeconds: 30,
  skipBackwardSeconds: 10,
  defaultSleepTimerPreset: null,
  rememberPosition: true,
  autoPlayNext: true,
  showRemainingTime: false,
  hapticFeedback: true,
};

const initialState: AudioPlayerState = {
  playback: initialPlaybackState,
  sleepTimer: initialSleepTimerState,
  ui: initialUIState,
  settings: initialSettingsState,
};

// ============================================================================
// Store
// ============================================================================

export type AudioPlayerStore = AudioPlayerState & AudioPlayerActions;

export const useAudioPlayerStore = create<AudioPlayerStore>()(
  devtools(
    persist(
      /* eslint-disable max-lines-per-function -- Zustand store requires colocated actions; splitting would fragment state management */
      (set, get) => ({
        // Initial state
        ...initialState,

        // ====================================================================
        // Playback Controls
        // ====================================================================

        play: (): void =>
          set(
            (state) => ({
              playback: { ...state.playback, isPlaying: true, hasError: false },
            }),
            false,
            'audioPlayer/play'
          ),

        pause: (): void =>
          set(
            (state) => ({
              playback: { ...state.playback, isPlaying: false },
            }),
            false,
            'audioPlayer/pause'
          ),

        togglePlay: (): void =>
          set(
            (state) => ({
              playback: { ...state.playback, isPlaying: !state.playback.isPlaying },
            }),
            false,
            'audioPlayer/togglePlay'
          ),

        stop: (): void =>
          set(
            (state) => ({
              playback: {
                ...state.playback,
                isPlaying: false,
                currentTime: 0,
              },
              ui: { ...state.ui, isMiniPlayerVisible: false },
            }),
            false,
            'audioPlayer/stop'
          ),

        seek: (time: number): void =>
          set(
            (state) => ({
              playback: {
                ...state.playback,
                currentTime: Math.max(0, Math.min(time, state.playback.duration)),
              },
            }),
            false,
            'audioPlayer/seek'
          ),

        skipForward: (seconds?: number): void => {
          const { playback, settings } = get();
          const skipAmount = seconds ?? settings.skipForwardSeconds;
          const newTime = Math.min(playback.currentTime + skipAmount, playback.duration);
          set(
            (state) => ({
              playback: { ...state.playback, currentTime: newTime },
            }),
            false,
            'audioPlayer/skipForward'
          );
        },

        skipBackward: (seconds?: number): void => {
          const { playback, settings } = get();
          const skipAmount = seconds ?? settings.skipBackwardSeconds;
          const newTime = Math.max(playback.currentTime - skipAmount, 0);
          set(
            (state) => ({
              playback: { ...state.playback, currentTime: newTime },
            }),
            false,
            'audioPlayer/skipBackward'
          );
        },

        // ====================================================================
        // Time Updates
        // ====================================================================

        setCurrentTime: (time: number): void =>
          set(
            (state) => ({
              playback: { ...state.playback, currentTime: time },
            }),
            false,
            'audioPlayer/setCurrentTime'
          ),

        setDuration: (duration: number): void =>
          set(
            (state) => ({
              playback: { ...state.playback, duration },
            }),
            false,
            'audioPlayer/setDuration'
          ),

        setBufferedTime: (time: number): void =>
          set(
            (state) => ({
              playback: { ...state.playback, bufferedTime: time },
            }),
            false,
            'audioPlayer/setBufferedTime'
          ),

        // ====================================================================
        // Loading/Error States
        // ====================================================================

        setLoading: (loading: boolean): void =>
          set(
            (state) => ({
              playback: { ...state.playback, isLoading: loading },
            }),
            false,
            'audioPlayer/setLoading'
          ),

        setError: (message: string | null): void =>
          set(
            (state) => ({
              playback: {
                ...state.playback,
                hasError: message !== null,
                errorMessage: message,
                isPlaying: false,
                isLoading: false,
              },
            }),
            false,
            'audioPlayer/setError'
          ),

        clearError: (): void =>
          set(
            (state) => ({
              playback: {
                ...state.playback,
                hasError: false,
                errorMessage: null,
              },
            }),
            false,
            'audioPlayer/clearError'
          ),

        // ====================================================================
        // Track Management
        // ====================================================================

        loadTrack: (track: AudioTrack): void =>
          set(
            (state) => ({
              playback: {
                ...state.playback,
                currentTrack: track,
                playlist: [track],
                playlistIndex: 0,
                currentTime: 0,
                duration: track.duration,
                currentChapterIndex: 0,
                isLoading: true,
                hasError: false,
                errorMessage: null,
              },
              ui: { ...state.ui, isMiniPlayerVisible: true },
            }),
            false,
            'audioPlayer/loadTrack'
          ),

        loadPlaylist: (tracks: AudioTrack[], startIndex = 0): void =>
          set(
            (state) => ({
              playback: {
                ...state.playback,
                playlist: tracks,
                playlistIndex: startIndex,
                currentTrack: tracks[startIndex] ?? null,
                currentTime: 0,
                duration: tracks[startIndex]?.duration ?? 0,
                currentChapterIndex: 0,
                isLoading: true,
                hasError: false,
                errorMessage: null,
              },
              ui: { ...state.ui, isMiniPlayerVisible: true },
            }),
            false,
            'audioPlayer/loadPlaylist'
          ),

        clearTrack: (): void =>
          set(
            () => ({
              playback: initialPlaybackState,
              sleepTimer: initialSleepTimerState,
              ui: { ...initialUIState },
            }),
            false,
            'audioPlayer/clearTrack'
          ),

        playNext: (): void => {
          const { playback, settings } = get();
          if (!settings.autoPlayNext) return;

          const nextIndex = playback.playlistIndex + 1;
          if (nextIndex < playback.playlist.length) {
            const nextTrack = playback.playlist[nextIndex];
            if (nextTrack) {
              set(
                (state) => ({
                  playback: {
                    ...state.playback,
                    playlistIndex: nextIndex,
                    currentTrack: nextTrack,
                    currentTime: 0,
                    duration: nextTrack.duration,
                    currentChapterIndex: 0,
                    isLoading: true,
                  },
                }),
                false,
                'audioPlayer/playNext'
              );
            }
          }
        },

        playPrevious: (): void => {
          const { playback } = get();
          // If more than 3 seconds in, restart current track
          if (playback.currentTime > 3) {
            set(
              (state) => ({
                playback: { ...state.playback, currentTime: 0 },
              }),
              false,
              'audioPlayer/restartTrack'
            );
            return;
          }

          const prevIndex = playback.playlistIndex - 1;
          if (prevIndex >= 0) {
            const prevTrack = playback.playlist[prevIndex];
            if (prevTrack) {
              set(
                (state) => ({
                  playback: {
                    ...state.playback,
                    playlistIndex: prevIndex,
                    currentTrack: prevTrack,
                    currentTime: 0,
                    duration: prevTrack.duration,
                    currentChapterIndex: 0,
                    isLoading: true,
                  },
                }),
                false,
                'audioPlayer/playPrevious'
              );
            }
          }
        },

        setPlaylistIndex: (index: number): void => {
          const { playback } = get();
          if (index >= 0 && index < playback.playlist.length) {
            const track = playback.playlist[index];
            if (track) {
              set(
                (state) => ({
                  playback: {
                    ...state.playback,
                    playlistIndex: index,
                    currentTrack: track,
                    currentTime: 0,
                    duration: track.duration,
                    currentChapterIndex: 0,
                    isLoading: true,
                  },
                }),
                false,
                'audioPlayer/setPlaylistIndex'
              );
            }
          }
        },

        // ====================================================================
        // Settings (Volume, Speed, etc.)
        // ====================================================================

        setVolume: (volume: number): void =>
          set(
            (state) => ({
              playback: {
                ...state.playback,
                volume: Math.max(0, Math.min(1, volume)),
                isMuted: volume === 0,
              },
            }),
            false,
            'audioPlayer/setVolume'
          ),

        toggleMute: (): void =>
          set(
            (state) => ({
              playback: { ...state.playback, isMuted: !state.playback.isMuted },
            }),
            false,
            'audioPlayer/toggleMute'
          ),

        setPlaybackSpeed: (speed: PlaybackSpeed): void =>
          set(
            (state) => ({
              playback: { ...state.playback, playbackSpeed: speed },
            }),
            false,
            'audioPlayer/setPlaybackSpeed'
          ),

        // ====================================================================
        // Chapter Navigation (M4B)
        // ====================================================================

        setCurrentChapterIndex: (index: number): void =>
          set(
            (state) => ({
              playback: { ...state.playback, currentChapterIndex: index },
            }),
            false,
            'audioPlayer/setCurrentChapterIndex'
          ),

        goToChapter: (index: number, chapters: AudioTrackChapter[]): void => {
          const chapter = chapters[index];
          if (chapter) {
            set(
              (state) => ({
                playback: {
                  ...state.playback,
                  currentChapterIndex: index,
                  currentTime: chapter.startTime,
                },
              }),
              false,
              'audioPlayer/goToChapter'
            );
          }
        },

        nextChapter: (): void => {
          const { playback } = get();
          const chapters = playback.currentTrack?.chapters ?? [];
          if (playback.currentChapterIndex < chapters.length - 1) {
            const nextChapter = chapters[playback.currentChapterIndex + 1];
            if (nextChapter) {
              set(
                (state) => ({
                  playback: {
                    ...state.playback,
                    currentChapterIndex: state.playback.currentChapterIndex + 1,
                    currentTime: nextChapter.startTime,
                  },
                }),
                false,
                'audioPlayer/nextChapter'
              );
            }
          }
        },

        previousChapter: (): void => {
          const { playback } = get();
          const chapters = playback.currentTrack?.chapters ?? [];
          const currentChapter = chapters[playback.currentChapterIndex];

          // If more than 3 seconds into chapter, restart current chapter
          if (currentChapter && playback.currentTime - currentChapter.startTime > 3) {
            set(
              (state) => ({
                playback: {
                  ...state.playback,
                  currentTime: currentChapter.startTime,
                },
              }),
              false,
              'audioPlayer/restartChapter'
            );
            return;
          }

          // Go to previous chapter
          if (playback.currentChapterIndex > 0) {
            const prevChapter = chapters[playback.currentChapterIndex - 1];
            if (prevChapter) {
              set(
                (state) => ({
                  playback: {
                    ...state.playback,
                    currentChapterIndex: state.playback.currentChapterIndex - 1,
                    currentTime: prevChapter.startTime,
                  },
                }),
                false,
                'audioPlayer/previousChapter'
              );
            }
          }
        },

        // ====================================================================
        // Sleep Timer
        // ====================================================================

        startSleepTimer: (minutes: number): void => {
          const endTime = Date.now() + minutes * 60 * 1000;
          set(
            (state) => ({
              sleepTimer: {
                ...state.sleepTimer,
                isActive: true,
                mode: 'time',
                endTime,
                remainingSeconds: minutes * 60,
              },
            }),
            false,
            'audioPlayer/startSleepTimer'
          );
        },

        startChapterSleepTimer: (): void =>
          set(
            (state) => ({
              sleepTimer: {
                ...state.sleepTimer,
                isActive: true,
                mode: 'chapter',
                endTime: null,
                remainingSeconds: 0,
              },
            }),
            false,
            'audioPlayer/startChapterSleepTimer'
          ),

        cancelSleepTimer: (): void =>
          set(
            () => ({
              sleepTimer: initialSleepTimerState,
            }),
            false,
            'audioPlayer/cancelSleepTimer'
          ),

        updateSleepTimerRemaining: (seconds: number): void =>
          set(
            (state) => ({
              sleepTimer: { ...state.sleepTimer, remainingSeconds: seconds },
            }),
            false,
            'audioPlayer/updateSleepTimerRemaining'
          ),

        setFadeBeforeStop: (fade: boolean): void =>
          set(
            (state) => ({
              sleepTimer: { ...state.sleepTimer, fadeBeforeStop: fade },
            }),
            false,
            'audioPlayer/setFadeBeforeStop'
          ),

        // ====================================================================
        // UI State
        // ====================================================================

        showMiniPlayer: (): void =>
          set(
            (state) => ({
              ui: { ...state.ui, isMiniPlayerVisible: true },
            }),
            false,
            'audioPlayer/showMiniPlayer'
          ),

        hideMiniPlayer: (): void =>
          set(
            (state) => ({
              ui: { ...state.ui, isMiniPlayerVisible: false },
            }),
            false,
            'audioPlayer/hideMiniPlayer'
          ),

        openFullscreen: (): void =>
          set(
            (state) => ({
              ui: { ...state.ui, isFullscreenOpen: true },
            }),
            false,
            'audioPlayer/openFullscreen'
          ),

        closeFullscreen: (): void =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                isFullscreenOpen: false,
                isChapterListOpen: false,
                isBookmarkListOpen: false,
              },
            }),
            false,
            'audioPlayer/closeFullscreen'
          ),

        toggleChapterList: (): void =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                isChapterListOpen: !state.ui.isChapterListOpen,
                isBookmarkListOpen: false,
              },
            }),
            false,
            'audioPlayer/toggleChapterList'
          ),

        toggleBookmarkList: (): void =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                isBookmarkListOpen: !state.ui.isBookmarkListOpen,
                isChapterListOpen: false,
              },
            }),
            false,
            'audioPlayer/toggleBookmarkList'
          ),

        toggleSleepTimerModal: (): void =>
          set(
            (state) => ({
              ui: { ...state.ui, isSleepTimerOpen: !state.ui.isSleepTimerOpen },
            }),
            false,
            'audioPlayer/toggleSleepTimerModal'
          ),

        toggleSpeedSelector: (): void =>
          set(
            (state) => ({
              ui: { ...state.ui, isSpeedSelectorOpen: !state.ui.isSpeedSelectorOpen },
            }),
            false,
            'audioPlayer/toggleSpeedSelector'
          ),

        closeAllModals: (): void =>
          set(
            (state) => ({
              ui: {
                ...state.ui,
                isChapterListOpen: false,
                isBookmarkListOpen: false,
                isSleepTimerOpen: false,
                isSpeedSelectorOpen: false,
              },
            }),
            false,
            'audioPlayer/closeAllModals'
          ),

        // ====================================================================
        // Settings
        // ====================================================================

        updateSettings: (newSettings: Partial<SettingsState>): void =>
          set(
            (state) => ({
              settings: { ...state.settings, ...newSettings },
            }),
            false,
            'audioPlayer/updateSettings'
          ),

        resetSettings: (): void =>
          set(
            () => ({
              settings: initialSettingsState,
            }),
            false,
            'audioPlayer/resetSettings'
          ),

        // ====================================================================
        // Reset
        // ====================================================================

        reset: (): void =>
          set(
            () => ({
              ...initialState,
            }),
            false,
            'audioPlayer/reset'
          ),
      }),
      {
        name: 'kaizoku-audio-player',
        partialize: (state) => ({
          // Only persist settings and volume
          settings: state.settings,
          playback: {
            volume: state.playback.volume,
            playbackSpeed: state.playback.playbackSpeed,
          },
        }),
      }
    ),
    {
      name: 'audio-player-store',
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Selector hooks for audio player state
 */
export const useAudioPlayerSelectors = {
  /** Get current track */
  useCurrentTrack: (): AudioTrack | null => useAudioPlayerStore((state) => state.playback.currentTrack),

  /** Get is playing state */
  useIsPlaying: (): boolean => useAudioPlayerStore((state) => state.playback.isPlaying),

  /** Get is loading state */
  useIsLoading: (): boolean => useAudioPlayerStore((state) => state.playback.isLoading),

  /** Get current time */
  useCurrentTime: (): number => useAudioPlayerStore((state) => state.playback.currentTime),

  /** Get duration */
  useDuration: (): number => useAudioPlayerStore((state) => state.playback.duration),

  /** Get volume */
  useVolume: (): number => useAudioPlayerStore((state) => state.playback.volume),

  /** Get is muted */
  useIsMuted: (): boolean => useAudioPlayerStore((state) => state.playback.isMuted),

  /** Get playback speed */
  usePlaybackSpeed: (): PlaybackSpeed => useAudioPlayerStore((state) => state.playback.playbackSpeed),

  /** Get mini player visibility */
  useIsMiniPlayerVisible: (): boolean => useAudioPlayerStore((state) => state.ui.isMiniPlayerVisible),

  /** Get fullscreen state */
  useIsFullscreenOpen: (): boolean => useAudioPlayerStore((state) => state.ui.isFullscreenOpen),

  /** Get sleep timer active */
  useIsSleepTimerActive: (): boolean => useAudioPlayerStore((state) => state.sleepTimer.isActive),

  /** Get sleep timer remaining */
  useSleepTimerRemaining: (): number => useAudioPlayerStore((state) => state.sleepTimer.remainingSeconds),

  /** Get current chapter index */
  useCurrentChapterIndex: (): number => useAudioPlayerStore((state) => state.playback.currentChapterIndex),

  /** Get settings */
  useSettings: (): SettingsState => useAudioPlayerStore((state) => state.settings),

  /** Get has error */
  useHasError: (): boolean => useAudioPlayerStore((state) => state.playback.hasError),

  /** Get error message */
  useErrorMessage: (): string | null => useAudioPlayerStore((state) => state.playback.errorMessage),

  /** Get progress percentage */
  useProgressPercent: (): number => {
    const currentTime = useAudioPlayerStore((state) => state.playback.currentTime);
    const duration = useAudioPlayerStore((state) => state.playback.duration);
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  },

  /** Check if track is loaded */
  useHasTrack: (): boolean => useAudioPlayerStore((state) => state.playback.currentTrack !== null),
};
