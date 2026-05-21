/**
 * Audio metadata extraction
 *
 * Reads tags, duration, codec info, chapters, and embedded cover art from
 * supported audio files. Uses music-metadata for parsing. FFmpeg is not
 * required for these helpers.
 */

import * as fs from 'fs/promises';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { detectAudioFormat } from './formats';

import type { AudioFormat } from './formats';

export interface AudioChapter {
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface AudioMetadata {
  title: string | undefined;
  artist: string | undefined;
  album: string | undefined;
  albumArtist: string | undefined;
  year: number | undefined;
  genre: string | undefined;
  duration: number;
  bitrate: number | undefined;
  sampleRate: number | undefined;
  channels: number | undefined;
  codec: string | undefined;
  lossless: boolean | undefined;
  chapters: AudioChapter[];
  hasCoverArt: boolean;
}

export interface AudioExtractionResult {
  metadata: AudioMetadata;
  coverArt: Buffer | undefined;
  coverArtMimeType: string | undefined;
  sourceFormat: AudioFormat;
  fileSize: number;
}

interface NativeChapter {
  title?: string;
  startTime?: number;
  endTime?: number;
}

function extractChaptersFromNative(native: Record<string, unknown[]> | undefined): AudioChapter[] {
  const chapters: AudioChapter[] = [];
  if (!native) return chapters;

  const iTunesTags = native['iTunes'] as unknown[] | undefined;
  if (!iTunesTags) return chapters;

  for (const tag of iTunesTags) {
    const tagObj = tag as Record<string, unknown>;
    if (tagObj['id'] !== 'chpl' || !Array.isArray(tagObj['value'])) continue;
    const chapterList = tagObj['value'] as NativeChapter[];
    for (const chapter of chapterList) {
      chapters.push({
        title: chapter.title ?? `Chapter ${chapters.length + 1}`,
        startTime: (chapter.startTime ?? 0) / 1000,
        endTime: (chapter.endTime ?? 0) / 1000,
        duration: ((chapter.endTime ?? 0) - (chapter.startTime ?? 0)) / 1000
      });
    }
  }

  return chapters;
}

interface ParsedPicture {
  data: Buffer | Uint8Array;
  format: string;
}

function extractCoverFromPictures(pictures: ParsedPicture[] | undefined): { data: Buffer; mimeType: string } | null {
  if (!pictures || pictures.length === 0) return null;
  const picture = pictures[0];
  if (!picture) return null;
  return {
    data: Buffer.from(picture.data),
    mimeType: picture.format
  };
}

export async function extractAudioMetadata(
  filePath: string
): Promise<AsyncResult<AudioExtractionResult, Error>> {
  try {
    logger.debug(`[AudioExtractor] Extracting metadata from: ${filePath}`);

    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return createErrorResult(new Error('Path is not a file'));
    }

    const sourceFormat = detectAudioFormat(filePath);
    if (!sourceFormat) {
      return createErrorResult(new Error(`Unsupported audio format: ${filePath}`));
    }

    const { parseFile } = await import('music-metadata');
    const parsed = await parseFile(filePath);

    const chapters = extractChaptersFromNative(parsed.native as Record<string, unknown[]> | undefined);
    const cover = extractCoverFromPictures(parsed.common.picture as ParsedPicture[] | undefined);

    const audioMetadata: AudioMetadata = {
      title: parsed.common.title,
      artist: parsed.common.artist,
      album: parsed.common.album,
      albumArtist: parsed.common.albumartist,
      year: parsed.common.year,
      genre: parsed.common.genre?.[0],
      duration: parsed.format.duration ?? 0,
      bitrate: parsed.format.bitrate ? Math.round(parsed.format.bitrate / 1000) : undefined,
      sampleRate: parsed.format.sampleRate,
      channels: parsed.format.numberOfChannels,
      codec: parsed.format.codec,
      lossless: parsed.format.lossless,
      chapters,
      hasCoverArt: cover !== null
    };

    logger.info(`[AudioExtractor] Extracted metadata from ${sourceFormat} file`, {
      title: audioMetadata.title,
      duration: audioMetadata.duration,
      chapters: chapters.length,
      hasCoverArt: audioMetadata.hasCoverArt
    });

    return createSuccessResult({
      metadata: audioMetadata,
      coverArt: cover?.data,
      coverArtMimeType: cover?.mimeType,
      sourceFormat,
      fileSize: stats.size
    });
  } catch (error: unknown) {
    logger.error('[AudioExtractor] Metadata extraction failed:', error);
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function extractCoverArt(
  filePath: string
): Promise<AsyncResult<{ data: Buffer; mimeType: string } | null, Error>> {
  try {
    const result = await extractAudioMetadata(filePath);
    if (result.status === 'error') return result;
    if (result.status !== 'success') return createSuccessResult(null);

    const { coverArt, coverArtMimeType } = result.data;
    if (!coverArt || !coverArtMimeType) return createSuccessResult(null);

    return createSuccessResult({ data: coverArt, mimeType: coverArtMimeType });
  } catch (error: unknown) {
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}
