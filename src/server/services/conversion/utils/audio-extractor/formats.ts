/**
 * Audio format detection helpers
 *
 * Pure type + extension-mapping utilities. No I/O, no FFmpeg deps —
 * safe to import from anywhere in the conversion pipeline.
 */

import * as path from 'path';

export type AudioFormat = 'mp3' | 'm4a' | 'm4b' | 'aac' | 'flac' | 'alac' | 'wav' | 'ogg';

const AUDIO_EXTENSIONS: Record<string, AudioFormat> = {
  '.mp3': 'mp3',
  '.m4a': 'm4a',
  '.m4b': 'm4b',
  '.aac': 'aac',
  '.flac': 'flac',
  '.alac': 'alac',
  '.wav': 'wav',
  '.ogg': 'ogg'
};

export function detectAudioFormat(filePath: string): AudioFormat | null {
  const ext = path.extname(filePath).toLowerCase();
  return AUDIO_EXTENSIONS[ext] ?? null;
}

export function isSupportedAudioFormat(filePath: string): boolean {
  return detectAudioFormat(filePath) !== null;
}

export function getSupportedAudioFormats(): AudioFormat[] {
  return Object.values(AUDIO_EXTENSIONS);
}

export function isLosslessFormat(format: AudioFormat): boolean {
  return format === 'flac' || format === 'alac' || format === 'wav';
}

export function getRecommendedTargetFormat(
  sourceFormat: AudioFormat,
  preferLossless: boolean = true
): AudioFormat {
  if (isLosslessFormat(sourceFormat)) {
    return preferLossless ? 'flac' : 'mp3';
  }
  if (sourceFormat === 'm4b') {
    return 'm4a';
  }
  return 'mp3';
}
