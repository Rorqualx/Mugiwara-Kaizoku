/**
 * Audio format conversion (FFmpeg-driven)
 *
 * Converts between any of the supported AudioFormat values using FFmpeg via
 * fluent-ffmpeg. ffmpeg-availability is memoised with a short TTL — settings
 * pages call checkFfmpegAvailable on every render and we don't want to spawn
 * a subprocess each time.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { extractAudioMetadata } from './audio-metadata';

import type { AudioFormat } from './formats';

export interface AudioConversionOptions {
  sourcePath: string;
  targetPath: string;
  targetFormat: AudioFormat;
  bitrate: string | undefined;
  sampleRate: number | undefined;
  channels: number | undefined;
  onProgress: ((progress: number) => void) | undefined;
}

export interface AudioConversionResult {
  outputPath: string;
  fileSize: number;
  duration: number;
  conversionTime: number;
}

interface FfmpegCommand {
  audioCodec: (codec: string) => FfmpegCommand;
  audioBitrate: (rate: string) => FfmpegCommand;
  audioFrequency: (rate: number) => FfmpegCommand;
  audioChannels: (count: number) => FfmpegCommand;
  on: (event: string, handler: (arg: unknown) => void) => FfmpegCommand;
  save: (path: string) => void;
}

function pickAudioCodec(format: AudioFormat): string {
  if (format === 'mp3') return 'libmp3lame';
  if (format === 'm4a' || format === 'm4b' || format === 'aac') return 'aac';
  if (format === 'flac') return 'flac';
  if (format === 'alac') return 'alac';
  if (format === 'wav') return 'pcm_s16le';
  return 'libvorbis';
}

function applyAudioOptions(command: FfmpegCommand, options: AudioConversionOptions): FfmpegCommand {
  let cmd = command;
  if (options.bitrate) cmd = cmd.audioBitrate(options.bitrate);
  if (options.sampleRate) cmd = cmd.audioFrequency(options.sampleRate);
  if (options.channels) cmd = cmd.audioChannels(options.channels);
  return cmd;
}

function parseTimemark(timemark: string): number | null {
  const parts = timemark.split(':');
  if (parts.length !== 3) return null;
  const hours = parseFloat(parts[0] ?? '0');
  const minutes = parseFloat(parts[1] ?? '0');
  const seconds = parseFloat(parts[2] ?? '0');
  return hours * 3600 + minutes * 60 + seconds;
}

function makeProgressHandler(
  sourceDuration: number,
  onProgress: ((progress: number) => void) | undefined
): (progress: { timemark?: string }) => void {
  return (progress) => {
    if (!onProgress || sourceDuration <= 0 || !progress.timemark) return;
    const currentTime = parseTimemark(progress.timemark);
    if (currentTime === null) return;
    onProgress(Math.min(100, (currentTime / sourceDuration) * 100));
  };
}

async function getSourceDuration(sourcePath: string): Promise<number> {
  const result = await extractAudioMetadata(sourcePath);
  if (result.status === 'success') return result.data.metadata.duration;
  return 0;
}

async function readConversionOutput(
  targetPath: string,
  sourceDuration: number,
  startTime: number
): Promise<AsyncResult<AudioConversionResult, Error>> {
  try {
    const targetStats = await fs.stat(targetPath);
    const conversionTime = Date.now() - startTime;
    logger.info('[AudioExtractor] Conversion complete', {
      outputPath: targetPath,
      fileSize: targetStats.size,
      conversionTime: `${conversionTime}ms`
    });
    return createSuccessResult({
      outputPath: targetPath,
      fileSize: targetStats.size,
      duration: sourceDuration,
      conversionTime
    });
  } catch (statError: unknown) {
    return createErrorResult(
      statError instanceof Error ? statError : new Error('Failed to get output file stats')
    );
  }
}

function runFfmpeg(
  command: FfmpegCommand,
  targetPath: string,
  sourceDuration: number,
  startTime: number
): Promise<AsyncResult<AudioConversionResult, Error>> {
  return new Promise((resolve) => {
    command
      .on('error', (err) => {
        const error = err as Error;
        logger.error('[AudioExtractor] FFmpeg conversion error:', error);
        resolve(createErrorResult(new Error(`FFmpeg error: ${error.message}`)));
      })
      .on('end', () => {
        void readConversionOutput(targetPath, sourceDuration, startTime).then(resolve);
      })
      .save(targetPath);
  });
}

export async function convertAudioFormat(
  options: AudioConversionOptions
): Promise<AsyncResult<AudioConversionResult, Error>> {
  const startTime = Date.now();

  try {
    logger.debug(`[AudioExtractor] Converting audio: ${options.sourcePath} → ${options.targetPath}`);

    const sourceStats = await fs.stat(options.sourcePath);
    if (!sourceStats.isFile()) {
      return createErrorResult(new Error('Source path is not a file'));
    }

    await fs.mkdir(path.dirname(options.targetPath), { recursive: true });

    const ffmpegModule = await import('fluent-ffmpeg');
    const ffmpeg = ffmpegModule.default as unknown as (input: string) => FfmpegCommand;
    const sourceDuration = await getSourceDuration(options.sourcePath);

    let command = ffmpeg(options.sourcePath);
    command = command.audioCodec(pickAudioCodec(options.targetFormat));
    command = applyAudioOptions(command, options);
    command = command.on('progress', makeProgressHandler(sourceDuration, options.onProgress) as (arg: unknown) => void);

    return await runFfmpeg(command, options.targetPath, sourceDuration, startTime);
  } catch (error: unknown) {
    logger.error('[AudioExtractor] Audio conversion failed:', error);
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

let ffmpegAvailableCache: { result: AsyncResult<boolean, Error>; expiresAt: number } | null = null;
const FFMPEG_CACHE_TTL_MS = 5 * 60 * 1000;

interface FfmpegStatic {
  getAvailableFormats: (cb: (err: Error | null) => void) => void;
}

function probeFfmpegAvailable(ffmpeg: FfmpegStatic): Promise<AsyncResult<boolean, Error>> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err) => {
      if (err) {
        logger.warn('[AudioExtractor] FFmpeg not available:', err.message);
        resolve(createSuccessResult(false));
        return;
      }
      logger.debug('[AudioExtractor] FFmpeg is available');
      resolve(createSuccessResult(true));
    });
  });
}

export async function checkFfmpegAvailable(): Promise<AsyncResult<boolean, Error>> {
  if (ffmpegAvailableCache !== null && ffmpegAvailableCache.expiresAt > Date.now()) {
    return ffmpegAvailableCache.result;
  }
  try {
    const ffmpegModule = await import('fluent-ffmpeg');
    const ffmpeg = ffmpegModule.default as unknown as FfmpegStatic;
    const result = await probeFfmpegAvailable(ffmpeg);
    ffmpegAvailableCache = { result, expiresAt: Date.now() + FFMPEG_CACHE_TTL_MS };
    return result;
  } catch (error: unknown) {
    logger.error('[AudioExtractor] Failed to check FFmpeg:', error);
    const result = createSuccessResult(false);
    ffmpegAvailableCache = { result, expiresAt: Date.now() + FFMPEG_CACHE_TTL_MS };
    return result;
  }
}
