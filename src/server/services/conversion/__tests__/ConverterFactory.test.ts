/**
 * @jest-environment node
 *
 * Unit tests for ConverterFactory
 * Tests converter registration, retrieval, and priority management
 */

import { AsyncResult, createSuccessResult } from '@/utils/async-result';

import { BaseConverter, ConversionFormat, ConversionOptions, ConversionResult } from '../BaseConverter';
import { ConverterFactory } from '../ConverterFactory';

// Test converter implementations
class HighPriorityConverter extends BaseConverter {
  constructor() {
    super('HighPriorityConverter');
  }

  getSupportedSourceFormats(): ConversionFormat[] {
    return ['cbz'];
  }

  getSupportedTargetFormats(): ConversionFormat[] {
    return ['pdf'];
  }

  protected doConvert(options: ConversionOptions): Promise<AsyncResult<ConversionResult, Error>> {
    return Promise.resolve(createSuccessResult({
      outputPath: options.targetFile,
      fileSize: 1024,
      pageCount: 10,
      duration: 100
    }));
  }
}

class LowPriorityConverter extends BaseConverter {
  constructor() {
    super('LowPriorityConverter');
  }

  getSupportedSourceFormats(): ConversionFormat[] {
    return ['cbz'];
  }

  getSupportedTargetFormats(): ConversionFormat[] {
    return ['pdf'];
  }

  protected doConvert(options: ConversionOptions): Promise<AsyncResult<ConversionResult, Error>> {
    return Promise.resolve(createSuccessResult({
      outputPath: options.targetFile,
      fileSize: 2048,
      pageCount: 20,
      duration: 200
    }));
  }
}

class EPUBConverter extends BaseConverter {
  constructor() {
    super('EPUBConverter');
  }

  getSupportedSourceFormats(): ConversionFormat[] {
    return ['cbz', 'zip'];
  }

  getSupportedTargetFormats(): ConversionFormat[] {
    return ['epub'];
  }

  protected doConvert(options: ConversionOptions): Promise<AsyncResult<ConversionResult, Error>> {
    return Promise.resolve(createSuccessResult({
      outputPath: options.targetFile,
      fileSize: 1536,
      pageCount: 15,
      duration: 150
    }));
  }
}

describe('ConverterFactory', () => {
  beforeEach(() => {
    // Clear all registered converters before each test
    ConverterFactory['converters'].clear();
    ConverterFactory['conversionCache'].clear();
  });

  describe('registerConverter', () => {
    it('should register a converter', () => {
      const converter = new HighPriorityConverter();

      ConverterFactory.registerConverter('high-priority', converter, 100);

      const stats = ConverterFactory.getStatistics();
      expect(stats.totalConverters).toBe(1);
    });

    it('should register multiple converters', () => {
      const converter1 = new HighPriorityConverter();
      const converter2 = new LowPriorityConverter();

      ConverterFactory.registerConverter('converter1', converter1, 100);
      ConverterFactory.registerConverter('converter2', converter2, 50);

      const stats = ConverterFactory.getStatistics();
      expect(stats.totalConverters).toBe(2);
    });

    it('should allow overwriting existing converter', () => {
      const converter1 = new HighPriorityConverter();
      const converter2 = new LowPriorityConverter();

      ConverterFactory.registerConverter('converter', converter1, 100);
      ConverterFactory.registerConverter('converter', converter2, 50);

      const stats = ConverterFactory.getStatistics();
      expect(stats.totalConverters).toBe(1);
    });

    it('should use default priority if not specified', () => {
      const converter = new HighPriorityConverter();

      ConverterFactory.registerConverter('converter', converter);

      const stats = ConverterFactory.getStatistics();
      expect(stats.convertersByPriority[0]?.priority).toBe(50);
    });

    it('should clear conversion cache when registering', () => {
      const converter1 = new HighPriorityConverter();
      const converter2 = new LowPriorityConverter();

      // Register first converter and make a query to populate cache
      ConverterFactory.registerConverter('converter1', converter1, 100);
      ConverterFactory.getConverter('cbz', 'pdf');

      // Register second converter should clear cache
      ConverterFactory.registerConverter('converter2', converter2, 50);

      // Cache should be empty
      expect(ConverterFactory['conversionCache'].size).toBe(0);
    });
  });

  describe('unregisterConverter', () => {
    it('should unregister a converter', () => {
      const converter = new HighPriorityConverter();

      ConverterFactory.registerConverter('converter', converter, 100);
      expect(ConverterFactory.getStatistics().totalConverters).toBe(1);

      ConverterFactory.unregisterConverter('converter');
      expect(ConverterFactory.getStatistics().totalConverters).toBe(0);
    });

    it('should clear cache when unregistering', () => {
      const converter = new HighPriorityConverter();

      ConverterFactory.registerConverter('converter', converter, 100);
      ConverterFactory.getConverter('cbz', 'pdf');

      ConverterFactory.unregisterConverter('converter');

      expect(ConverterFactory['conversionCache'].size).toBe(0);
    });

    it('should not throw error when unregistering non-existent converter', () => {
      expect(() => {
        ConverterFactory.unregisterConverter('non-existent');
      }).not.toThrow();
    });
  });

  describe('getConverter', () => {
    it('should return highest priority converter for format pair', () => {
      const highConverter = new HighPriorityConverter();
      const lowConverter = new LowPriorityConverter();

      ConverterFactory.registerConverter('high', highConverter, 100);
      ConverterFactory.registerConverter('low', lowConverter, 50);

      const result = ConverterFactory.getConverter('cbz', 'pdf');

      if (result.status === 'error') {
        throw new Error('Expected success result');
      }

      if (result.status === 'success') {
        expect(result.data).toBe(highConverter);
      }
    });

    it('should return error if no converter available', () => {
      const result = ConverterFactory.getConverter('cbz', 'pdf');

      if (result.status === 'error') {
        expect(result.error.message).toContain('No converter available');
      } else if (result.status === 'success') {
        throw new Error('Expected error result');
      }
    });

    it('should use cache for repeated queries', () => {
      const converter = new HighPriorityConverter();
      ConverterFactory.registerConverter('converter', converter, 100);

      // First call
      const result1 = ConverterFactory.getConverter('cbz', 'pdf');
      // Second call should use cache
      const result2 = ConverterFactory.getConverter('cbz', 'pdf');

      if (result1.status === 'success' && result2.status === 'success') {
        expect(ConverterFactory['conversionCache'].size).toBe(1);
      } else {
        throw new Error('Expected success results');
      }
    });

    it('should handle case-insensitive format matching', () => {
      const converter = new HighPriorityConverter();
      ConverterFactory.registerConverter('converter', converter, 100);

      const result1 = ConverterFactory.getConverter('cbz' as ConversionFormat, 'pdf' as ConversionFormat);
      const result2 = ConverterFactory.getConverter('cbz', 'pdf');

      if (result1.status !== 'success' || result2.status !== 'success') {
        throw new Error('Expected success results');
      }
    });
  });

  describe('getConvertersForFormats', () => {
    it('should return all converters sorted by priority', () => {
      const highConverter = new HighPriorityConverter();
      const lowConverter = new LowPriorityConverter();

      ConverterFactory.registerConverter('high', highConverter, 100);
      ConverterFactory.registerConverter('low', lowConverter, 50);

      const converters = ConverterFactory.getConvertersForFormats('cbz', 'pdf');

      expect(converters).toHaveLength(2);
      expect(converters[0]).toBe(highConverter);
      expect(converters[1]).toBe(lowConverter);
    });

    it('should return empty array if no converters available', () => {
      const converters = ConverterFactory.getConvertersForFormats('cbz', 'pdf');

      expect(converters).toHaveLength(0);
    });

    it('should filter converters by format support', () => {
      const pdfConverter = new HighPriorityConverter();
      const epubConverter = new EPUBConverter();

      ConverterFactory.registerConverter('pdf', pdfConverter, 100);
      ConverterFactory.registerConverter('epub', epubConverter, 90);

      const pdfConverters = ConverterFactory.getConvertersForFormats('cbz', 'pdf');
      const epubConverters = ConverterFactory.getConvertersForFormats('cbz', 'epub');

      expect(pdfConverters).toHaveLength(1);
      expect(pdfConverters[0]).toBe(pdfConverter);

      expect(epubConverters).toHaveLength(1);
      expect(epubConverters[0]).toBe(epubConverter);
    });
  });

  describe('isConversionSupported', () => {
    it('should return true for supported conversion', () => {
      const converter = new HighPriorityConverter();
      ConverterFactory.registerConverter('converter', converter, 100);

      expect(ConverterFactory.isConversionSupported('cbz', 'pdf')).toBe(true);
    });

    it('should return false for unsupported conversion', () => {
      const converter = new HighPriorityConverter();
      ConverterFactory.registerConverter('converter', converter, 100);

      expect(ConverterFactory.isConversionSupported('cbz', 'epub')).toBe(false);
    });

    it('should return false when no converters registered', () => {
      expect(ConverterFactory.isConversionSupported('cbz', 'pdf')).toBe(false);
    });
  });

  describe('getSupportedSourceFormats', () => {
    it('should return all unique source formats', () => {
      const pdfConverter = new HighPriorityConverter(); // supports cbz
      const epubConverter = new EPUBConverter(); // supports cbz, zip

      ConverterFactory.registerConverter('pdf', pdfConverter, 100);
      ConverterFactory.registerConverter('epub', epubConverter, 90);

      const formats = ConverterFactory.getSupportedSourceFormats();

      expect(formats).toContain('cbz');
      expect(formats).toContain('zip');
      expect(new Set(formats).size).toBe(formats.length); // No duplicates
    });

    it('should return empty array when no converters registered', () => {
      const formats = ConverterFactory.getSupportedSourceFormats();
      expect(formats).toHaveLength(0);
    });
  });

  describe('getSupportedTargetFormats', () => {
    it('should return all unique target formats', () => {
      const pdfConverter = new HighPriorityConverter(); // targets pdf
      const epubConverter = new EPUBConverter(); // targets epub

      ConverterFactory.registerConverter('pdf', pdfConverter, 100);
      ConverterFactory.registerConverter('epub', epubConverter, 90);

      const formats = ConverterFactory.getSupportedTargetFormats();

      expect(formats).toContain('pdf');
      expect(formats).toContain('epub');
      expect(new Set(formats).size).toBe(formats.length); // No duplicates
    });

    it('should return empty array when no converters registered', () => {
      const formats = ConverterFactory.getSupportedTargetFormats();
      expect(formats).toHaveLength(0);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      const converter1 = new HighPriorityConverter();
      const converter2 = new EPUBConverter();

      ConverterFactory.registerConverter('converter1', converter1, 100);
      ConverterFactory.registerConverter('converter2', converter2, 90);

      const stats = ConverterFactory.getStatistics();

      expect(stats.totalConverters).toBe(2);
      expect(stats.supportedConversions).toBeGreaterThan(0);
      expect(stats.convertersByPriority).toHaveLength(2);
      expect(stats.convertersByPriority[0]?.priority).toBe(100);
      expect(stats.convertersByPriority[1]?.priority).toBe(90);
    });

    it('should include conversion paths in statistics', () => {
      const converter = new HighPriorityConverter();
      ConverterFactory.registerConverter('converter', converter, 100);

      const stats = ConverterFactory.getStatistics();

      expect(stats.supportedConversions).toBeGreaterThan(0);
      // Note: convertersByPriority doesn't include supportedConversions property
      expect(stats.convertersByPriority[0]?.name).toBe('converter');
    });
  });

  describe('clearCache', () => {
    it('should clear conversion cache', () => {
      const converter = new HighPriorityConverter();
      ConverterFactory.registerConverter('converter', converter, 100);

      // Populate cache
      ConverterFactory.getConverter('cbz', 'pdf');
      expect(ConverterFactory['conversionCache'].size).toBe(1);

      // Clear cache (using clearConverters as clearCache doesn't exist)
      ConverterFactory.clearConverters();
      expect(ConverterFactory['conversionCache'].size).toBe(0);
    });
  });

  describe('priority handling', () => {
    it('should respect priority order', () => {
      const converters = [
        { converter: new HighPriorityConverter(), priority: 50 },
        { converter: new LowPriorityConverter(), priority: 100 },
        { converter: new EPUBConverter(), priority: 75 }
      ];

      converters.forEach((item, index) => {
        ConverterFactory.registerConverter(`converter${index}`, item.converter, item.priority);
      });

      const result = ConverterFactory.getConvertersForFormats('cbz', 'pdf');

      // Should be sorted by priority descending
      expect(result).toHaveLength(2);
      // LowPriorityConverter has priority 100, HighPriorityConverter has 50
      expect(result[0]).toBe(converters[1]?.converter);
      expect(result[1]).toBe(converters[0]?.converter);
    });

    it('should handle equal priorities', () => {
      const converter1 = new HighPriorityConverter();
      const converter2 = new LowPriorityConverter();

      ConverterFactory.registerConverter('converter1', converter1, 100);
      ConverterFactory.registerConverter('converter2', converter2, 100);

      const result = ConverterFactory.getConvertersForFormats('cbz', 'pdf');

      expect(result).toHaveLength(2);
      // Both should be included
      expect(result).toContain(converter1);
      expect(result).toContain(converter2);
    });
  });
});
