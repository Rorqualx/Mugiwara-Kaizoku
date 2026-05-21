/**
 * AudioPlayerProvider Component
 *
 * Root provider for the audio player system. Manages the shared audio element
 * and integrates all audio player hooks for a unified experience.
 *
 * Features:
 * - Single audio element shared across the app
 * - Auto-save progress integration
 * - Sleep timer integration
 * - MediaSession API for OS controls
 * - Context for child components
 *
 * @module components/audioPlayer/AudioPlayerProvider
 */

import { createContext, useContext, type ReactNode } from 'react';

import { useAudioPlayer, usePlaybackProgress, useSleepTimer, useMediaSession } from './hooks';

import type { UseAudioPlayerReturn } from './hooks/useAudioPlayer';
import type { UseMediaSessionReturn } from './hooks/useMediaSession';
import type { UsePlaybackProgressReturn } from './hooks/usePlaybackProgress';
import type { UseSleepTimerReturn } from './hooks/useSleepTimer';

// ============================================================================
// Types
// ============================================================================

/**
 * Audio player context value
 */
export interface AudioPlayerContextValue {
  /** Core audio player controls */
  player: UseAudioPlayerReturn;
  /** Progress tracking and saving */
  progress: UsePlaybackProgressReturn;
  /** Sleep timer controls */
  sleepTimer: UseSleepTimerReturn;
  /** MediaSession integration status */
  mediaSession: UseMediaSessionReturn;
}

/**
 * Provider props
 */
export interface AudioPlayerProviderProps {
  children: ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

/**
 * AudioPlayerProvider
 *
 * Wraps the application to provide audio player functionality.
 * Should be placed near the root of the app, typically in _app.tsx.
 *
 * @example
 * ```tsx
 * // In _app.tsx
 * <AudioPlayerProvider>
 *   <Component {...pageProps} />
 * </AudioPlayerProvider>
 * ```
 */
export function AudioPlayerProvider({ children }: AudioPlayerProviderProps): JSX.Element {
  // Initialize all hooks
  const player = useAudioPlayer();
  const progress = usePlaybackProgress({
    saveInterval: 5000, // Save every 5 seconds
    restorePosition: true,
  });
  const sleepTimer = useSleepTimer();
  const mediaSession = useMediaSession({
    skipForwardSeconds: 30,
    skipBackwardSeconds: 10,
  });

  // Create context value
  const contextValue: AudioPlayerContextValue = {
    player,
    progress,
    sleepTimer,
    mediaSession,
  };

  return (
    <AudioPlayerContext.Provider value={contextValue}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useAudioPlayerContext
 *
 * Access the audio player context from any child component.
 * Must be used within AudioPlayerProvider.
 *
 * @throws Error if used outside AudioPlayerProvider
 *
 * @example
 * ```tsx
 * function PlayButton() {
 *   const { player } = useAudioPlayerContext();
 *   return (
 *     <button onClick={player.togglePlay}>
 *       {player.isPlaying ? 'Pause' : 'Play'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useAudioPlayerContext(): AudioPlayerContextValue {
  const context = useContext(AudioPlayerContext);

  if (!context) {
    throw new Error('useAudioPlayerContext must be used within AudioPlayerProvider');
  }

  return context;
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * usePlayer - Shorthand for accessing player controls
 */
export function usePlayer(): UseAudioPlayerReturn {
  const { player } = useAudioPlayerContext();
  return player;
}

/**
 * usePlayerProgress - Shorthand for accessing progress controls
 */
export function usePlayerProgress(): UsePlaybackProgressReturn {
  const { progress } = useAudioPlayerContext();
  return progress;
}

/**
 * usePlayerSleepTimer - Shorthand for accessing sleep timer
 */
export function usePlayerSleepTimer(): UseSleepTimerReturn {
  const { sleepTimer } = useAudioPlayerContext();
  return sleepTimer;
}

export default AudioPlayerProvider;
