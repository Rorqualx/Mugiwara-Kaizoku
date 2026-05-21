/**
 * @jest-environment node
 *
 * Unit tests for BaseConverter abstract class
 * Tests validation, conversion flow, error handling
 */

// Mock fs module BEFORE imports
// NOTE: Bun requires factory functions for jest.mock()
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn().mockResolvedValue({ isFile: () => true, size: 1024 }),
  access: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn(),
  rm: jest.fn(),
  constants: {
    R_OK: 4,
    W_OK: 2,
    X_OK: 1,
    F_OK: 0
  }
}));

// Imports after mocks
import * as fs from 'fs/promises';
import * as _path from 'path';

import { AsyncResult, createSuccessResult, createErrorResult } from '@/utils/async-result';

import { BaseConverter, ConversionFormat, ConversionOptions, ConversionResult} from '../BaseConverter';
// Test implementation of BaseConverter
class TestConverter extends BaseConverter {
  constructor() {
    super('TestConverter');
  }
  getSupportedSourceFormats(): ConversionFormat[] {
    return ['cbz', 'zip'];
  }
  getSupportedTargetFormats(): ConversionFormat[] {
    return ['pdf', 'epub'];
  }
  protected doConvert(options: ConversionOptions): Promise<AsyncResult<ConversionResult, Error>> {
    // Simulate successful conversion - report progress
    this.reportProgress(options, 0);
    this.reportProgress(options, 100);
    return Promise.resolve(createSuccessResult({
      outputPath: options.targetFile,
      fileSize: 1024,
      pageCount: 10,
      duration: 100
    }));
  }
}
describe('BaseConverter', () => {
  let converter: TestConverter;
  const mockSourceFile = '/test/source.cbz';
  const mockTargetFile = '/test/target.pdf';
  beforeEach(() => {
    converter = new TestConverter();
    jest.clearAllMocks();
  });
  describe('canConvert', () => {
    it('should return true for supported format combinations', () => {
      expect(converter.canConvert('cbz', 'pdf')).toBe(true);
      expect(converter.canConvert('zip', 'epub')).toBe(true);
    });
    it('should return false for unsupported source format', () => {
      expect(converter.canConvert('mp4' as ConversionFormat, 'pdf')).toBe(false);
    });
    it('should return false for unsupported target format', () => {
      expect(converter.canConvert('cbz', 'mp4' as ConversionFormat)).toBe(false);
    });
    it('should return false for both unsupported formats', () => {
      expect(converter.canConvert('mp4' as ConversionFormat, 'avi' as ConversionFormat)).toBe(false);
    });
  });
  describe('validate', () => {
    it('should successfully validate existing readable file with correct format', async () => {
      // Mock file exists
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      // Mock file stats
      (fs.stat as jest.Mock).mockResolvedValue({
        isFile: () => true,
        size: 1024
      });
      const result = await converter.validate(mockSourceFile, 'cbz');
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.isValid).toBe(true);
        expect(result.data.fileSize).toBe(1024);
      }
    });
    it('should fail validation for non-existent file', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      const result = await converter.validate(mockSourceFile, 'cbz');
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.isValid).toBe(false);
        expect(result.data.error).toContain('does not exist');
      }
    });
    it('should fail validation for unreadable file', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockRejectedValue(new Error('Permission denied'));
      const result = await converter.validate(mockSourceFile, 'cbz');
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('Permission denied');
      }
    });
    it('should fail validation for directory instead of file', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({
        isFile: () => false,
        size: 0
      });
      const result = await converter.validate(mockSourceFile, 'cbz');
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.isValid).toBe(false);
        expect(result.data.error).toContain('is not a file');
      }
    });
    it('should fail validation for format mismatch', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({
        isFile: () => true,
        size: 1024
      });
      const result = await converter.validate('/test/source.pdf', 'cbz');
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.isValid).toBe(false);
        expect(result.data.error).toContain('Format mismatch');
      }
    });
  });
  describe('convert', () => {
    beforeEach(() => {
      // Mock successful validation
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({
        isFile: () => true,
        size: 1024
      });
      // Mock directory creation
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    });
    it('should successfully convert file', async () => {
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'cbz',
        targetFormat: 'pdf'
      };
      const result = await converter.convert(options);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.outputPath).toBe(mockTargetFile);
        expect(result.data.fileSize).toBe(1024);
        expect(result.data.pageCount).toBe(10);
        expect(result.data.duration).toBeGreaterThanOrEqual(0);
      }
    });
    it('should fail if source format is not supported', async () => {
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'mp4' as ConversionFormat,
        targetFormat: 'pdf'
      };
      const result = await converter.convert(options);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('not supported');
      }
    });
    it('should fail if target format is not supported', async () => {
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'cbz',
        targetFormat: 'mp4' as ConversionFormat
      };
      const result = await converter.convert(options);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('not supported');
      }
    });
    it('should fail if validation fails', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'cbz',
        targetFormat: 'pdf'
      };
      const result = await converter.convert(options);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('validation failed');
      }
    });
    it('should create target directory if it does not exist', async () => {
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: '/new/path/target.pdf',
        sourceFormat: 'cbz',
        targetFormat: 'pdf'
      };
      await converter.convert(options);
      expect(fs.mkdir).toHaveBeenCalledWith(
        '/new/path',
        { recursive: true }
      );
    });
    it('should report progress if callback provided', async () => {
      const onProgress = jest.fn();
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'cbz',
        targetFormat: 'pdf',
        onProgress
      };
      await converter.convert(options);
      // Should have called progress at start (0) and end (100)
      expect(onProgress).toHaveBeenCalledWith(0);
      expect(onProgress).toHaveBeenCalledWith(100);
    });
  });
  describe('error handling', () => {
    beforeEach(() => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({
        isFile: () => true,
        size: 1024
      });
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    });
    it('should handle doConvert errors gracefully', async () => {
      // Create converter that throws error
      class ErrorConverter extends TestConverter {
        protected doConvert(): Promise<AsyncResult<ConversionResult, Error>> {
          return Promise.resolve(createErrorResult(new Error('Conversion failed')));
        }
      }
      const errorConverter = new ErrorConverter();
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'cbz',
        targetFormat: 'pdf'
      };
      const result = await errorConverter.convert(options);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toBe('Conversion failed');
      }
    });
    it('should handle directory creation errors', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'cbz',
        targetFormat: 'pdf'
      };
      const result = await converter.convert(options);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('Permission denied');
      }
    });
  });
  describe('format detection', () => {
    it('should detect format from file extension', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({
        isFile: () => true,
        size: 1024
      });
      const result = await converter.validate('/test/file.cbz', 'cbz');
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.isValid).toBe(true);
      }
    });
    it('should handle case-insensitive extensions', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({
        isFile: () => true,
        size: 1024
      });
      const result = await converter.validate('/test/file.CBZ', 'cbz');
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.isValid).toBe(true);
      }
    });
  });
});
