/**
 * Audio Format Extraction Utility
 *
 * Public surface for the audio-extractor module. Re-exports the format
 * helpers, metadata extraction, and FFmpeg-driven conversion from the
 * `audio-extractor/` subdirectory so existing imports
 * (`from '@/server/services/conversion/utils/audio-extractor'`) keep working.
 *
 * @module audio-extractor
 */

export type { AudioFormat } from './audio-extractor/formats';
export {
  detectAudioFormat,
  isSupportedAudioFormat,
  getSupportedAudioFormats,
  isLosslessFormat,
  getRecommendedTargetFormat
} from './audio-extractor/formats';

export type {
  AudioChapter,
  AudioMetadata,
  AudioExtractionResult
} from './audio-extractor/audio-metadata';
export {
  extractAudioMetadata,
  extractCoverArt
} from './audio-extractor/audio-metadata';

export type {
  AudioConversionOptions,
  AudioConversionResult
} from './audio-extractor/audio-converter';
export {
  convertAudioFormat,
  checkFfmpegAvailable
} from './audio-extractor/audio-converter';
