/**
 * Format Conversion System - Main Entry Point
 *
 * Initializes and exports the complete file conversion system.
 * Registers all available converters and provides a unified API.
 *
 * @module conversion
 */

import { logger } from '@/utils/logger';

import { ConverterFactory } from './ConverterFactory';
import { AudiobookConverter } from './converters/AudiobookConverter';
import { CBZConverter } from './converters/CBZConverter';
import { EPUBConverter } from './converters/EPUBConverter';
import { EPUBInputConverter } from './converters/EPUBInputConverter';
import { KindleConverter } from './converters/KindleConverter';
import { PDFConverter } from './converters/PDFConverter';

/**
 * Options for initializing the conversion system
 */
export interface ConversionSystemOptions {
  /** Enable ebook format support (MOBI, AZW3) */
  enableEbookFormats?: boolean;
  /** Enable audiobook format support (MP3, M4A, M4B, AAC, FLAC, ALAC, WAV, OGG) */
  enableAudiobooks?: boolean;
}

/**
 * Initialize the conversion system
 *
 * Registers all available converters with the factory.
 * Should be called once during application startup.
 *
 * @param options - Configuration options
 */
export function initializeConverterSystem(options: ConversionSystemOptions = {}): void {
  const { enableEbookFormats = false, enableAudiobooks = false } = options;

  logger.info('[ConversionSystem] Initializing converter system', {
    enableEbookFormats,
    enableAudiobooks
  });

  try {
    // Register CBZ Converter (highest priority - native format)
    // Handles: CBR/ZIP/CBZ → CBZ
    const cbzConverter = new CBZConverter();
    ConverterFactory.registerConverter('cbz', cbzConverter, 100);

    // Register PDF Input Converter (high priority for PDF source)
    // Handles: PDF → CBZ, PDF → EPUB
    const pdfConverter = new PDFConverter();
    ConverterFactory.registerConverter('pdf-input', pdfConverter, 90);

    // Register EPUB Input Converter (high priority for EPUB source)
    // Handles: EPUB → CBZ
    const epubInputConverter = new EPUBInputConverter();
    ConverterFactory.registerConverter('epub-input', epubInputConverter, 85);

    // Register Kindle Converter (optional - requires enableEbookFormats setting)
    // Handles: MOBI/AZW3 → CBZ, MOBI/AZW3 → EPUB
    if (enableEbookFormats) {
      const kindleConverter = new KindleConverter();
      ConverterFactory.registerConverter('kindle', kindleConverter, 75);
      logger.info('[ConversionSystem] Ebook format support enabled (MOBI, AZW3)');
    }

    // Register Audiobook Converter (optional - requires enableAudiobooks setting)
    // Handles: MP3/M4A/M4B/AAC/FLAC/ALAC/WAV/OGG → any audio format
    if (enableAudiobooks) {
      const audiobookConverter = new AudiobookConverter();
      ConverterFactory.registerConverter('audiobook', audiobookConverter, 65);
      logger.info('[ConversionSystem] Audiobook format support enabled (MP3, M4A, M4B, AAC, FLAC, ALAC, WAV, OGG)');
    }

    // Register EPUB Output Converter (medium priority)
    // Handles: CBZ/ZIP/CBR → EPUB
    const epubConverter = new EPUBConverter();
    ConverterFactory.registerConverter('epub', epubConverter, 70);

    // Log registered converters
    const stats = ConverterFactory.getStatistics();
    logger.info('[ConversionSystem] Converter system initialized', {
      totalConverters: stats.totalConverters,
      supportedConversions: stats.supportedConversions,
      converters: stats.convertersByPriority
    });

    logger.info('[ConversionSystem] Supported source formats', {
      formats: ConverterFactory.getSupportedSourceFormats()
    });

    logger.info('[ConversionSystem] Supported target formats', {
      formats: ConverterFactory.getSupportedTargetFormats()
    });
  } catch (error: unknown) {
    logger.error('[ConversionSystem] Failed to initialize converter system', error);
    throw error;
  }
}

// Export all public APIs
export { ConverterFactory } from './ConverterFactory';
export { BaseConverter } from './BaseConverter';
export type {
  ConversionFormat,
  ConversionOptions,
  ConversionResult,
  ValidationResult
} from './BaseConverter';

export { FormatConversionService, getConversionService } from './FormatConversionService';
export type {
  ConversionRequest,
  ConversionJobStatus
} from './FormatConversionService';

// Export converter classes (for advanced usage)
export { AudiobookConverter } from './converters/AudiobookConverter';
export { CBZConverter } from './converters/CBZConverter';
export { PDFConverter } from './converters/PDFConverter';
export { EPUBConverter } from './converters/EPUBConverter';
export { EPUBInputConverter } from './converters/EPUBInputConverter';
export { KindleConverter } from './converters/KindleConverter';

// Export worker
export { ConversionJobWorker } from './ConversionJobWorker';
export type { ConversionWorkerConfig, ConversionJobStats } from './ConversionJobWorker';

// Global worker instance
let globalWorker: import('./ConversionJobWorker').ConversionJobWorker | null = null;

/**
 * Start the conversion job worker
 *
 * Starts a background worker that processes conversion jobs from the queue.
 * Should be called once during application startup.
 *
 * @param config - Optional worker configuration
 * @returns The started worker instance
 */
export async function startConversionWorker(
  config?: import('./ConversionJobWorker').ConversionWorkerConfig
): Promise<import('./ConversionJobWorker').ConversionJobWorker> {
  if (globalWorker) {
    logger.warn('[ConversionSystem] Conversion worker is already running');
    return globalWorker;
  }

  const { ConversionJobWorker } = await import('./ConversionJobWorker');
  globalWorker = new ConversionJobWorker(config);

  // Recover any stale jobs before starting
  const recovered = await ConversionJobWorker.recoverStaleJobs();
  if (recovered > 0) {
    logger.info(`[ConversionSystem] Recovered ${recovered} stale conversion jobs`);
  }

  await globalWorker.start();

  logger.info('[ConversionSystem] Conversion worker started');

  return globalWorker;
}

/**
 * Stop the conversion job worker
 *
 * Gracefully stops the background worker.
 */
export async function stopConversionWorker(): Promise<void> {
  if (!globalWorker) {
    return;
  }

  await globalWorker.stop();
  globalWorker = null;

  logger.info('[ConversionSystem] Conversion worker stopped');
}

/**
 * Get the global conversion worker instance
 *
 * @returns The worker instance or null if not started
 */
export function getConversionWorker(): import('./ConversionJobWorker').ConversionJobWorker | null {
  return globalWorker;
}
