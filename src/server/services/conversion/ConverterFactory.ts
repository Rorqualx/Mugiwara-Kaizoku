/**
 * Converter Factory
 *
 * Factory pattern implementation for creating and managing format converters.
 * Provides a centralized way to get the appropriate converter for any conversion task.
 *
 * @module ConverterFactory
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { BaseConverter, ConversionFormat } from './BaseConverter';

/**
 * Converter registration entry
 */
interface ConverterRegistration {
  /** Converter class instance */
  converter: BaseConverter;
  /** Priority for selection (higher = preferred) */
  priority: number;
}

/**
 * Factory class for creating and managing format converters
 *
 * Implements the factory pattern to provide converters based on format requirements.
 * Supports converter registration, prioritization, and automatic selection.
 *
 * @class ConverterFactory
 */
export class ConverterFactory {
  /** Map of registered converters by name */
  private static converters: Map<string, ConverterRegistration> = new Map();

  /** Cache of converters by format pair (source-target) */
  private static conversionCache: Map<string, BaseConverter[]> = new Map();

  /**
   * Register a converter with the factory
   *
   * Converters must be registered before they can be used.
   * Higher priority converters are preferred when multiple options exist.
   *
   * @param name - Unique name for the converter
   * @param converter - Converter instance
   * @param priority - Priority level (default: 50)
   */
  static registerConverter(
    name: string,
    converter: BaseConverter,
    priority: number = 50
  ): void {
    if (this.converters.has(name)) {
      logger.warn(`[ConverterFactory] Overwriting existing converter: ${name}`);
    }

    this.converters.set(name, { converter, priority });

    // Clear cache when registering new converters
    this.conversionCache.clear();

    logger.info(`[ConverterFactory] Registered converter: ${name}`, {
      priority,
      supportedSources: converter.getSupportedSourceFormats(),
      supportedTargets: converter.getSupportedTargetFormats()
    });
  }

  /**
   * Unregister a converter
   *
   * @param name - Name of converter to unregister
   */
  static unregisterConverter(name: string): void {
    if (this.converters.delete(name)) {
      this.conversionCache.clear();
      logger.info(`[ConverterFactory] Unregistered converter: ${name}`);
    }
  }

  /**
   * Get all converters that support a specific conversion
   *
   * Returns converters sorted by priority (highest first).
   *
   * @param sourceFormat - Source file format
   * @param targetFormat - Target file format
   * @returns Array of converters that support this conversion
   */
  static getConvertersForFormats(
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat
  ): BaseConverter[] {
    // Check cache first
    const cacheKey = `${sourceFormat}-${targetFormat}`;
    const cached = this.conversionCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Find all converters that support this conversion
    const supportedConverters: Array<{ converter: BaseConverter; priority: number }> = [];

    for (const [_name, registration] of this.converters.entries()) {
      if (registration.converter.canConvert(sourceFormat, targetFormat)) {
        supportedConverters.push({
          converter: registration.converter,
          priority: registration.priority
        });
      }
    }

    // Sort by priority (highest first)
    supportedConverters.sort((a, b) => b.priority - a.priority);

    // Extract just the converters
    const result = supportedConverters.map(entry => entry.converter);

    // Cache the result
    this.conversionCache.set(cacheKey, result);

    return result;
  }

  /**
   * Get the best converter for a specific conversion
   *
   * Returns the highest priority converter that supports the conversion.
   *
   * @param sourceFormat - Source file format
   * @param targetFormat - Target file format
   * @returns AsyncResult with converter or error if none available
   */
  static getConverter(
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat
  ): AsyncResult<BaseConverter, Error> {
    const converters = this.getConvertersForFormats(sourceFormat, targetFormat);

    if (converters.length === 0) {
      const error = new Error(
        `No converter available for ${sourceFormat} to ${targetFormat} conversion`
      );
      logger.error('[ConverterFactory] No converter found', {
        sourceFormat,
        targetFormat
      });
      return createErrorResult(error);
    }

    const bestConverter = converters[0];
    if (!bestConverter) {
      const error = new Error(
        `No converter available for ${sourceFormat} to ${targetFormat} conversion`
      );
      return createErrorResult(error);
    }

    logger.debug(`[ConverterFactory] Selected converter: ${bestConverter.getName()}`, {
      sourceFormat,
      targetFormat,
      totalAvailable: converters.length
    });

    return createSuccessResult(bestConverter);
  }

  /**
   * Get a converter by name
   *
   * @param name - Converter name
   * @returns AsyncResult with converter or error if not found
   */
  static getConverterByName(name: string): AsyncResult<BaseConverter, Error> {
    const registration = this.converters.get(name);

    if (!registration) {
      const error = new Error(`Converter not found: ${name}`);
      logger.error('[ConverterFactory] Converter not found', { name });
      return createErrorResult(error);
    }

    return createSuccessResult(registration.converter);
  }

  /**
   * Check if a conversion is supported
   *
   * @param sourceFormat - Source file format
   * @param targetFormat - Target file format
   * @returns True if at least one converter supports this conversion
   */
  static isConversionSupported(
    sourceFormat: ConversionFormat,
    targetFormat: ConversionFormat
  ): boolean {
    return this.getConvertersForFormats(sourceFormat, targetFormat).length > 0;
  }

  /**
   * Get all registered converter names
   *
   * @returns Array of registered converter names
   */
  static getRegisteredConverters(): string[] {
    return Array.from(this.converters.keys());
  }

  /**
   * Get all supported source formats
   *
   * @returns Array of all source formats supported by any converter
   */
  static getSupportedSourceFormats(): ConversionFormat[] {
    const formats = new Set<ConversionFormat>();

    for (const registration of this.converters.values()) {
      for (const format of registration.converter.getSupportedSourceFormats()) {
        formats.add(format);
      }
    }

    return Array.from(formats);
  }

  /**
   * Get all supported target formats
   *
   * @returns Array of all target formats supported by any converter
   */
  static getSupportedTargetFormats(): ConversionFormat[] {
    const formats = new Set<ConversionFormat>();

    for (const registration of this.converters.values()) {
      for (const format of registration.converter.getSupportedTargetFormats()) {
        formats.add(format);
      }
    }

    return Array.from(formats);
  }

  /**
   * Clear all registered converters
   *
   * Mainly used for testing purposes.
   */
  static clearConverters(): void {
    this.converters.clear();
    this.conversionCache.clear();
    logger.info('[ConverterFactory] Cleared all converters');
  }

  /**
   * Get converter statistics
   *
   * @returns Statistics about registered converters
   */
  static getStatistics(): {
    totalConverters: number;
    supportedConversions: number;
    convertersByPriority: Array<{ name: string; priority: number }>;
  } {
    const convertersByPriority = Array.from(this.converters.entries())
      .map(([name, registration]) => ({
        name,
        priority: registration.priority
      }))
      .sort((a, b) => b.priority - a.priority);

    // Count supported conversions
    const sourceFormats = this.getSupportedSourceFormats();
    const targetFormats = this.getSupportedTargetFormats();
    let supportedConversions = 0;

    for (const source of sourceFormats) {
      for (const target of targetFormats) {
        if (source !== target && this.isConversionSupported(source, target)) {
          supportedConversions++;
        }
      }
    }

    return {
      totalConverters: this.converters.size,
      supportedConversions,
      convertersByPriority
    };
  }
}
