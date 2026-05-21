/**
 * Audio Player Components Index
 *
 * Main entry point for the audio player feature.
 * Exports all components, hooks, and types.
 *
 * @module components/audioPlayer
 */

// Provider
export {
  AudioPlayerProvider,
  useAudioPlayerContext,
  usePlayer,
  usePlayerProgress,
  usePlayerSleepTimer,
} from './AudioPlayerProvider';
export type { AudioPlayerContextValue, AudioPlayerProviderProps } from './AudioPlayerProvider';

// Hooks
export {
  useAudioPlayer,
  usePlaybackProgress,
  useSleepTimer,
  useMediaSession,
} from './hooks';
export type {
  UseAudioPlayerReturn,
  UsePlaybackProgressOptions,
  UsePlaybackProgressReturn,
  UseSleepTimerReturn,
  UseMediaSessionOptions,
  UseMediaSessionReturn,
} from './hooks';

// Components
export { MiniPlayer } from './MiniPlayer';
export type { MiniPlayerProps } from './MiniPlayer';
export { FullscreenPlayer } from './FullscreenPlayer';
export type { FullscreenPlayerProps } from './FullscreenPlayer';

// Controls
export {
  PlaybackControls,
  ProgressSlider,
  VolumeControl,
  HorizontalVolumeControl,
  SpeedControl,
  SkipControls,
} from './controls';
export type {
  PlaybackControlsProps,
  ProgressSliderProps,
  VolumeControlProps,
  SpeedControlProps,
  SkipControlsProps,
} from './controls';

// Features
export { SleepTimer, ChapterList, BookmarkList } from './features';
export type {
  SleepTimerProps,
  ChapterListProps,
  BookmarkListProps,
} from './features';

// Composite UI
export { AudioPlayerUI } from './AudioPlayerUI';
export type { AudioPlayerUIProps } from './AudioPlayerUI';
