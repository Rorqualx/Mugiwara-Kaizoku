/**
 * Audio Player Controls Index
 *
 * Exports all playback control components.
 *
 * @module components/audioPlayer/controls
 */

export { PlaybackControls } from './PlaybackControls';
export { ProgressSlider } from './ProgressSlider';
export { VolumeControl, HorizontalVolumeControl } from './VolumeControl';
export { SpeedControl } from './SpeedControl';
export { SkipControls } from './SkipControls';
export type { SkipControlsProps } from './SkipControls';

// Re-export types from audioPlayer types
export type {
  PlaybackControlsProps,
  ProgressSliderProps,
  VolumeControlProps,
  SpeedControlProps,
} from '@/types/audioPlayer';
