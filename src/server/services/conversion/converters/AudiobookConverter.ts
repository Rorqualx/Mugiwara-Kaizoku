/**
 * Audiobook Converter
 *
 * Handles conversion between audio formats for audiobooks.
 * Supports: MP3, M4A, M4B, AAC, FLAC, ALAC, WAV, OGG
 *
 * Uses FFmpeg via fluent-ffmpeg for audio conversion.
 * FFmpeg must be installed on the system.
 *
 * @module AudiobookConverter
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { BaseConverter } from '../BaseConverter';
import {
  extractAudioMetadata,
  convertAudioFormat,
  checkFfmpegAvailable,
  isLosslessFormat
} from '../utils/audio-extractor';

import type { ConversionFormat, ConversionOptions, ConversionResult, ValidationResult } from '../BaseConverter';
import type { AudioFormat } from '../utils/audio-extractor';

/**
 * Audio formats supported by this converter
 */
const SUPPORTED_AUDIO_FORMATS: ConversionFormat[] = ['mp3', 'm4a', 'm4b', 'aac', 'flac', 'alac', 'wav', 'ogg'];

/**
 * Audiobook Converter Class
 *
 * Converts between audio formats using FFmpeg.
 * Preserves metadata and chapter information where possible.
 *
 * @extends BaseConverter
 */
export class AudiobookConverter extends BaseConverter {
  constructor() {
    super('AudiobookConverter');
  }

  /**
   * Get supported source formats
   *
   * @returns Array of audio formats this converter can read
   */
  getSupportedSourceFormats(): ConversionFormat[] {
    return SUPPORTED_AUDIO_FORMATS;
  }

  /**
   * Get supported target formats
   *
   * @returns Array of audio formats this converter can write
   */
  getSupportedTargetFormats(): ConversionFormat[] {
    return SUPPORTED_AUDIO_FORMATS;
  }

  /**
   * Validate an audio file
   *
   * @param filePath - Path to audio file
   * @param expectedFormat - Expected audio format
   * @returns AsyncResult with validation result
   */
  override async validate(
    filePath: string,
    expectedFormat: ConversionFormat
  ): Promise<AsyncResult<ValidationResult, Error>> {
    try {
      // First do basic file validation
      const basicValidation = await super.validate(filePath, expectedFormat);
      if (basicValidation.status === 'error') {
        return basicValidation;
      }

      if (basicValidation.status === 'success' && !basicValidation.data.isValid) {
        return basicValidation;
      }

      // Check if FFmpeg is available
      const ffmpegCheck = await checkFfmpegAvailable();
      if (ffmpegCheck.status === 'success' && !ffmpegCheck.data) {
        return createSuccessResult({
          isValid: false,
          error: 'FFmpeg is not installed. Audio conversion requires FFmpeg to be installed on the system.'
        });
      }

      // Verify it's a valid audio file by extracting metadata
      const metadataResult = await extractAudioMetadata(filePath);
      if (metadataResult.status === 'error') {
        return createSuccessResult({
          isValid: false,
          error: `Failed to read audio file: ${metadataResult.error.message}`
        });
      }

      if (metadataResult.status !== 'success') {
        return createSuccessResult({
          isValid: false,
          error: 'Failed to read audio file: unexpected result'
        });
      }

      const { metadata, fileSize, sourceFormat } = metadataResult.data;

      // Verify format matches
      if (sourceFormat !== expectedFormat) {
        return createSuccessResult({
          isValid: false,
          error: `Format mismatch: expected ${expectedFormat}, detected ${sourceFormat}`,
          detectedFormat: sourceFormat as ConversionFormat
        });
      }

      logger.debug(`[AudiobookConverter] Validated audio file`, {
        filePath,
        format: sourceFormat,
        duration: metadata.duration,
        chapters: metadata.chapters.length
      });

      return createSuccessResult({
        isValid: true,
        detectedFormat: sourceFormat as ConversionFormat,
        fileSize
      });
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Perform the audio conversion
   *
   * @param options - Conversion options
   * @returns AsyncResult with conversion result
   */
  protected async doConvert(
    options: ConversionOptions
  ): Promise<AsyncResult<ConversionResult, Error>> {
    const { sourceFile, targetFile, sourceFormat, targetFormat, quality, bitrate: explicitBitrate, onProgress } = options;

    try {
      logger.info(`[AudiobookConverter] Converting ${sourceFormat} → ${targetFormat}`, {
        source: sourceFile,
        target: targetFile
      });

      // Extract source metadata for duration info
      const metadataResult = await extractAudioMetadata(sourceFile);
      if (metadataResult.status === 'error') {
        return createErrorResult(
          new Error(`Failed to read source audio: ${metadataResult.error.message}`)
        );
      }

      if (metadataResult.status !== 'success') {
        return createErrorResult(new Error('Failed to read source audio: unexpected result'));
      }

      const { metadata: sourceMetadata, coverArt } = metadataResult.data;

      // Determine bitrate. Explicit bitrate wins (used by service layer to inject
      // conversion.audioBitrate). Otherwise fall back to quality (1-100) → bitrate mapping.
      // Lossless targets always ignore bitrate.
      let bitrate: string | undefined;
      const isLossless = isLosslessFormat(targetFormat as AudioFormat);
      if (!isLossless) {
        if (explicitBitrate !== undefined) {
          bitrate = explicitBitrate;
        } else if (quality !== undefined) {
          const bitrateValue = Math.round(64 + (quality / 100) * (320 - 64));
          bitrate = `${bitrateValue}k`;
        }
      }

      // Perform conversion
      const conversionResult = await convertAudioFormat({
        sourcePath: sourceFile,
        targetPath: targetFile,
        targetFormat: targetFormat as AudioFormat,
        bitrate,
        sampleRate: undefined,
        channels: undefined,
        onProgress
      });

      if (conversionResult.status === 'error') {
        return createErrorResult(conversionResult.error);
      }

      if (conversionResult.status !== 'success') {
        return createErrorResult(new Error('Audio conversion failed: unexpected result'));
      }

      const { outputPath, fileSize, duration, conversionTime } = conversionResult.data;

      logger.info(`[AudiobookConverter] Conversion complete`, {
        outputPath,
        fileSize,
        duration,
        conversionTime: `${conversionTime}ms`
      });

      return createSuccessResult({
        outputPath,
        fileSize,
        pageCount: sourceMetadata.chapters.length || 1, // Use chapter count or 1
        duration: conversionTime,
        metadata: {
          title: sourceMetadata.title,
          artist: sourceMetadata.artist,
          album: sourceMetadata.album,
          duration: sourceMetadata.duration,
          chapters: sourceMetadata.chapters.length,
          hasCoverArt: coverArt !== undefined,
          sourceFormat,
          targetFormat,
          bitrate,
          lossless: isLosslessFormat(targetFormat as AudioFormat)
        }
      });
    } catch (error: unknown) {
      logger.error('[AudiobookConverter] Conversion failed:', error);
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if this converter can handle a specific conversion
   *
   * Override to prevent same-format conversions (no-op)
   *
   * @param sourceFormat - Source file format
   * @param targetFormat - Target file format
   * @returns True if converter supports this conversion
   */
  override canConvert(sourceFormat: ConversionFormat, targetFormat: ConversionFormat): boolean {
    // Don't allow same-format conversion (no-op)
    if (sourceFormat === targetFormat) {
      return false;
    }

    return super.canConvert(sourceFormat, targetFormat);
  }
}
