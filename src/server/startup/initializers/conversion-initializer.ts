/**
 * Conversion System Initializer Module
 *
 * Initializes the format conversion system, including:
 * - Loading settings for ebook and audiobook format support
 * - Checking FFmpeg availability for audiobook conversion
 * - Registering converters based on enabled settings
 * - Starting the conversion job worker
 *
 * @module startup/initializers/conversion-initializer
 */

import { prisma } from '@/server/db';
import {
  ConverterFactory,
  initializeConverterSystem,
  startConversionWorker,
  stopConversionWorker
} from '@/server/services/conversion';
import { AudiobookConverter } from '@/server/services/conversion/converters/AudiobookConverter';
import { KindleConverter } from '@/server/services/conversion/converters/KindleConverter';
import { checkFfmpegAvailable } from '@/server/services/conversion/utils/audio-extractor';
import { eventEmitter } from '@/server/services/eventEmitter';
import { logger } from '@/utils/logger';

import { formatError } from '../error-utils';

/** Setting keys for format support */
const EBOOK_SETTING_KEY = 'media.enableEbookFormats';
const AUDIOBOOK_SETTING_KEY = 'media.enableAudiobooks';

/** Converter registration names — must match the ones used in initializeConverterSystem */
const KINDLE_CONVERTER_NAME = 'kindle';
const AUDIOBOOK_CONVERTER_NAME = 'audiobook';

/**
 * Apply ebook converter (un)registration based on the new flag value.
 * Idempotent — registering an already-registered converter is a no-op log warning.
 */
function applyEbookFlag(enabled: boolean): void {
  const isRegistered = ConverterFactory.getRegisteredConverters().includes(KINDLE_CONVERTER_NAME);
  if (enabled && !isRegistered) {
    ConverterFactory.registerConverter(KINDLE_CONVERTER_NAME, new KindleConverter(), 75);
    logger.info('[ConversionInitializer] Live-registered Kindle converter');
  } else if (!enabled && isRegistered) {
    ConverterFactory.unregisterConverter(KINDLE_CONVERTER_NAME);
    logger.info('[ConversionInitializer] Live-unregistered Kindle converter');
  }
}

/**
 * Apply audiobook converter (un)registration. Only registers when FFmpeg is available
 * — a config toggle without FFmpeg is a no-op (and logged), matching startup behaviour.
 */
async function applyAudiobookFlag(enabled: boolean): Promise<void> {
  const isRegistered = ConverterFactory.getRegisteredConverters().includes(AUDIOBOOK_CONVERTER_NAME);
  if (enabled && !isRegistered) {
    const ffmpeg = await checkFfmpegAvailable();
    if (!(ffmpeg.status === 'success' && ffmpeg.data)) {
      logger.warn('[ConversionInitializer] Cannot live-enable audiobook converter — FFmpeg unavailable');
      return;
    }
    ConverterFactory.registerConverter(AUDIOBOOK_CONVERTER_NAME, new AudiobookConverter(), 65);
    logger.info('[ConversionInitializer] Live-registered audiobook converter');
  } else if (!enabled && isRegistered) {
    ConverterFactory.unregisterConverter(AUDIOBOOK_CONVERTER_NAME);
    logger.info('[ConversionInitializer] Live-unregistered audiobook converter');
  }
}

async function handleConfigChange(data: { key: string; value: unknown }): Promise<void> {
  try {
    const enabled = data.value === true || data.value === 'true';
    if (data.key === EBOOK_SETTING_KEY) {
      applyEbookFlag(enabled);
    } else if (data.key === AUDIOBOOK_SETTING_KEY) {
      await applyAudiobookFlag(enabled);
    }
  } catch (error: unknown) {
    logger.error('[ConversionInitializer] Failed to apply live config change', {
      key: data.key,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Subscribe to config:updated events so toggling the media.* flags in the UI
 * takes effect immediately, without a server restart.
 */
function subscribeToConfigChanges(): void {
  eventEmitter.on('config:updated', (data) => { void handleConfigChange(data); });
  logger.debug('[ConversionInitializer] Subscribed to config:updated events');
}

/**
 * FFmpeg availability status
 */
interface FfmpegStatus {
  /** Whether FFmpeg is available */
  available: boolean;
  /** Warning message if FFmpeg is not available but audiobooks are enabled */
  warning: string | undefined;
}

/**
 * Check FFmpeg availability
 *
 * @returns FFmpeg status with availability flag and optional warning
 */
async function checkFfmpegStatus(audiobooksEnabled: boolean): Promise<FfmpegStatus> {
  const result = await checkFfmpegAvailable();

  if (result.status === 'success' && result.data) {
    logger.info('[ConversionInitializer] FFmpeg is available on the system');
    return { available: true, warning: undefined };
  }

  const warning = audiobooksEnabled
    ? 'FFmpeg is not available. Audiobook format conversion will not work until FFmpeg is installed.'
    : undefined;

  if (audiobooksEnabled) {
    logger.warn('[ConversionInitializer] ' + warning);
  } else {
    logger.debug('[ConversionInitializer] FFmpeg not available (audiobooks not enabled, skipping)');
  }

  return { available: false, warning };
}

/**
 * Load format settings from database
 *
 * @returns Object with enableEbookFormats and enableAudiobooks booleans
 */
async function loadFormatSettings(): Promise<{ enableEbookFormats: boolean; enableAudiobooks: boolean }> {
  try {
    // Query both settings at once
    const settings = await prisma.config.findMany({
      where: {
        key: {
          in: [EBOOK_SETTING_KEY, AUDIOBOOK_SETTING_KEY]
        }
      },
      select: {
        key: true,
        value: true
      }
    });

    // Parse settings
    let enableEbookFormats = false;
    let enableAudiobooks = false;

    for (const setting of settings) {
      if (setting.key === EBOOK_SETTING_KEY) {
        enableEbookFormats = setting.value === 'true';
      } else if (setting.key === AUDIOBOOK_SETTING_KEY) {
        enableAudiobooks = setting.value === 'true';
      }
    }

    logger.debug('[ConversionInitializer] Loaded format settings', {
      enableEbookFormats,
      enableAudiobooks
    });

    return { enableEbookFormats, enableAudiobooks };
  } catch (error: unknown) {
    logger.warn('[ConversionInitializer] Failed to load format settings, using defaults', {
      error: error instanceof Error ? error.message : String(error)
    });
    return { enableEbookFormats: false, enableAudiobooks: false };
  }
}

/**
 * Initialize the conversion system
 *
 * This function:
 * - Loads format settings from the database
 * - Checks FFmpeg availability if audiobooks are enabled
 * - Initializes the converter system with appropriate settings
 * - Starts the conversion job worker
 *
 * @throws {Error} If critical initialization fails
 */
export async function initializeConversionSystem(): Promise<void> {
  try {
    logger.info('[ConversionInitializer] Initializing conversion system...');

    // Load settings from database
    const { enableEbookFormats, enableAudiobooks } = await loadFormatSettings();

    // Check FFmpeg if audiobooks enabled
    const ffmpegStatus = await checkFfmpegStatus(enableAudiobooks);

    // Initialize converter system with settings
    initializeConverterSystem({
      enableEbookFormats,
      enableAudiobooks: enableAudiobooks && ffmpegStatus.available
    });

    // Log status
    logger.info('[ConversionInitializer] Conversion system initialized', {
      ebookFormatsEnabled: enableEbookFormats,
      audiobooksEnabled: enableAudiobooks,
      ffmpegAvailable: ffmpegStatus.available,
      audiobooksActive: enableAudiobooks && ffmpegStatus.available
    });

    // Warn if audiobooks enabled but FFmpeg not available
    if (ffmpegStatus.warning) {
      logger.warn(`[ConversionInitializer] ${ffmpegStatus.warning}`);
    }

    // Start conversion worker
    await startConversionWorker();
    logger.info('[ConversionInitializer] Conversion worker started');

    // Subscribe to config changes so the ebook/audiobook toggles take effect
    // immediately, without requiring a server restart.
    subscribeToConfigChanges();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[ConversionInitializer] Failed to initialize conversion system: ${formatError(errorMessage)}`);
    // Don't throw - conversion system is not critical for server startup
    // Log error but allow server to continue
  }
}

/**
 * Stop the conversion system
 *
 * Called during graceful shutdown to stop the conversion worker.
 */
export async function stopConversionSystem(): Promise<void> {
  try {
    await stopConversionWorker();
    logger.info('[ConversionInitializer] Conversion system stopped');
  } catch (error: unknown) {
    logger.warn('[ConversionInitializer] Error stopping conversion system', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
