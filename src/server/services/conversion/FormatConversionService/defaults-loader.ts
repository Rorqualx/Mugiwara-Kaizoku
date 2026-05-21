/**
 * Conversion defaults loader
 *
 * Pulls quality/compression/bitrate sliders from /settings/file-conversion
 * (via the global config service) so converters see UI-driven defaults.
 * Per-job DB overrides on ConversionJob still win at execution time.
 */

import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { logger } from '@/utils/logger';

export const EBOOK_SOURCE_FORMATS = new Set(['mobi', 'azw3']);
export const AUDIO_FORMATS = new Set(['mp3', 'm4a', 'm4b', 'aac', 'flac', 'alac', 'wav', 'ogg']);

export interface ConversionDefaults {
  quality?: number;
  compression?: number;
  bitrate?: string;
}

export async function loadDefaultsForJob(
  sourceFormat: string,
  targetFormat: string
): Promise<ConversionDefaults> {
  const defaults: ConversionDefaults = {};

  // Wrapped so a config-service outage (or an uninitialised global in tests)
  // doesn't fail conversions — converters fall back to their built-in defaults.
  try {
    const config = getGlobalConfigService();

    const isEbookSource = EBOOK_SOURCE_FORMATS.has(sourceFormat.toLowerCase());
    const isAudio = AUDIO_FORMATS.has(sourceFormat.toLowerCase()) || AUDIO_FORMATS.has(targetFormat.toLowerCase());

    const qualityKey = isEbookSource ? 'conversion.ebookQuality' : 'conversion.quality';
    const qualityRaw = await config.get(qualityKey);
    if (qualityRaw !== undefined && qualityRaw !== null) {
      const parsed = Number(qualityRaw);
      if (Number.isFinite(parsed)) defaults.quality = parsed;
    }

    const compressionRaw = await config.get('conversion.compressionLevel');
    if (compressionRaw !== undefined && compressionRaw !== null) {
      const parsed = Number(compressionRaw);
      if (Number.isFinite(parsed)) defaults.compression = parsed;
    }

    if (isAudio) {
      const bitrateRaw = await config.get('conversion.audioBitrate');
      if (bitrateRaw !== undefined && bitrateRaw !== null) {
        const parsed = Number(bitrateRaw);
        if (Number.isFinite(parsed) && parsed > 0) defaults.bitrate = `${parsed}k`;
      }
    }
  } catch (error: unknown) {
    logger.warn('[FormatConversionService] Failed to load conversion defaults from config; using built-in defaults', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return defaults;
}
