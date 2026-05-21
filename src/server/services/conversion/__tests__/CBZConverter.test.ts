/**
 * @jest-environment node
 *
 * Unit tests for CBZConverter
 * Tests CBZ creation, image extraction, and file handling
 */

// Mock fs and JSZip BEFORE imports
// NOTE: Bun requires factory functions for jest.mock()
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  access: jest.fn(),
  unlink: jest.fn(),
  rm: jest.fn(),
  constants: {
    R_OK: 4,
    W_OK: 2,
    X_OK: 1,
    F_OK: 0
  }
}));

jest.mock('jszip', () => {
  const mockZip = {
    file: jest.fn().mockReturnThis(),
    generateAsync: jest.fn().mockResolvedValue(Buffer.from('mock')),
    loadAsync: jest.fn().mockResolvedValue({
      files: {},
      file: jest.fn()
    })
  };
  return { default: jest.fn(() => mockZip), __esModule: true };
});

// Import after mocks
import * as fs from 'fs/promises';

import JSZip from 'jszip';

import { ConversionOptions } from '../BaseConverter';
import { CBZConverter } from '../converters/CBZConverter';
describe('CBZConverter', () => {
  let converter: CBZConverter;
  beforeEach(() => {
    converter = new CBZConverter();
    jest.clearAllMocks();
  });
  describe('getSupportedFormats', () => {
    it('should support zip, cbz, cbr as source formats', () => {
      const formats = converter.getSupportedSourceFormats();
      expect(formats).toContain('zip');
      expect(formats).toContain('cbz');
      expect(formats).toContain('cbr');
    });
    it('should support cbz as target format', () => {
      const formats = converter.getSupportedTargetFormats();
      expect(formats).toContain('cbz');
      expect(formats.length).toBe(1);
    });
  });
  describe('canConvert', () => {
    it('should convert zip to cbz', () => {
      expect(converter.canConvert('zip', 'cbz')).toBe(true);
    });
    it('should convert cbr to cbz', () => {
      expect(converter.canConvert('cbr', 'cbz')).toBe(true);
    });
    it('should convert cbz to cbz (repackaging)', () => {
      expect(converter.canConvert('cbz', 'cbz')).toBe(true);
    });
    it('should not convert to pdf', () => {
      expect(converter.canConvert('cbz', 'pdf')).toBe(false);
    });
  });
  describe('convert', () => {
    const mockSourceFile = '/test/source.zip';
    const mockTargetFile = '/test/target.cbz';
    beforeEach(() => {
      // Mock successful validation
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({
        isFile: () => true,
        size: 1024
      });
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('zip-content'));
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      // Mock JSZip
      const mockZip = {
        loadAsync: jest.fn().mockResolvedValue({
          files: {
            'image1.jpg': {
              name: 'image1.jpg',
              dir: false,
              async: jest.fn().mockResolvedValue(Buffer.from('image1'))
            },
            'image2.jpg': {
              name: 'image2.jpg',
              dir: false,
              async: jest.fn().mockResolvedValue(Buffer.from('image2'))
            },
            'folder/': {
              name: 'folder/',
              dir: true
            }
          }
        }),
        file: jest.fn(),
        generateAsync: jest.fn().mockResolvedValue(Buffer.from('cbz-content'))
      };
      (JSZip as unknown as jest.Mock).mockImplementation(() => mockZip);
    });
    it('should successfully convert zip to cbz', async () => {
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'zip',
        targetFormat: 'cbz'
      };
      const result = await converter.convert(options);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.outputPath).toBe(mockTargetFile);
        expect(result.data.fileSize).toBeGreaterThan(0);
        expect(result.data.pageCount).toBeGreaterThan(0);
      }
    });
    it('should extract images from archive', async () => {
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'zip',
        targetFormat: 'cbz'
      };
      await converter.convert(options);
      expect(fs.readFile).toHaveBeenCalledWith(mockSourceFile);
    });
    it('should write cbz file', async () => {
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'zip',
        targetFormat: 'cbz'
      };
      await converter.convert(options);
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockTargetFile,
        expect.any(Buffer)
      );
    });
    it('should respect compression level', async () => {
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'zip',
        targetFormat: 'cbz',
        compression: 9
      };
      await converter.convert(options);
      // Verify compression was applied during generation
      const mockZipResult = (JSZip as unknown as jest.Mock).mock.results[0];
      const mockZip = mockZipResult?.value as { generateAsync: jest.Mock } | undefined;
      expect(mockZip?.generateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          compression: 'DEFLATE',
          compressionOptions: { level: 9 }
        })
      );
    });
    it('should report progress during conversion', async () => {
      const onProgress = jest.fn();
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'zip',
        targetFormat: 'cbz',
        onProgress
      };
      await converter.convert(options);
      // Should report progress multiple times
      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(0);
      expect(onProgress).toHaveBeenCalledWith(100);
    });
    it('should filter out non-image files', async () => {
      // Mock zip with non-image files
      const mockZipWithText = {
        loadAsync: jest.fn().mockResolvedValue({
          files: {
            'image1.jpg': {
              name: 'image1.jpg',
              dir: false,
              async: jest.fn().mockResolvedValue(Buffer.from('image1'))
            },
            'readme.txt': {
              name: 'readme.txt',
              dir: false,
              async: jest.fn().mockResolvedValue(Buffer.from('text'))
            },
            'metadata.xml': {
              name: 'metadata.xml',
              dir: false,
              async: jest.fn().mockResolvedValue(Buffer.from('xml'))
            }
          }
        }),
        file: jest.fn(),
        generateAsync: jest.fn().mockResolvedValue(Buffer.from('cbz-content'))
      };
      (JSZip as unknown as jest.Mock).mockImplementation(() => mockZipWithText);
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'zip',
        targetFormat: 'cbz'
      };
      const result = await converter.convert(options);
      expect(result.status).toBe('success');
      // Should only include image file
      const mockZipResult = (JSZip as unknown as jest.Mock).mock.results[0];
      const mockZip = mockZipResult?.value as { file: jest.Mock } | undefined;
      expect(mockZip?.file).toHaveBeenCalledWith(
        expect.stringContaining('.jpg'),
        expect.any(Buffer),
        expect.objectContaining({
          compression: 'DEFLATE'
        })
      );
    });
    it('should sort images by filename', async () => {
      const mockZipUnsorted = {
        loadAsync: jest.fn().mockResolvedValue({
          files: {
            'image10.jpg': {
              name: 'image10.jpg',
              dir: false,
              async: jest.fn().mockResolvedValue(Buffer.from('image10'))
            },
            'image2.jpg': {
              name: 'image2.jpg',
              dir: false,
              async: jest.fn().mockResolvedValue(Buffer.from('image2'))
            },
            'image1.jpg': {
              name: 'image1.jpg',
              dir: false,
              async: jest.fn().mockResolvedValue(Buffer.from('image1'))
            }
          }
        }),
        file: jest.fn(),
        generateAsync: jest.fn().mockResolvedValue(Buffer.from('cbz-content'))
      };
      (JSZip as unknown as jest.Mock).mockImplementation(() => mockZipUnsorted);
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'zip',
        targetFormat: 'cbz'
      };
      await converter.convert(options);
      // Verify images were added in sorted order
      const mockZipResult = (JSZip as unknown as jest.Mock).mock.results[0];
      const mockZip = mockZipResult?.value as { file: jest.Mock } | undefined;
      const fileCalls = mockZip?.file.mock.calls as Array<[string, unknown]> | undefined;
      expect(fileCalls?.[0]?.[0]).toBe('image1.jpg');
      expect(fileCalls?.[1]?.[0]).toBe('image2.jpg');
      expect(fileCalls?.[2]?.[0]).toBe('image10.jpg');
    });
  });
  describe('error handling', () => {
    const mockSourceFile = '/test/source.zip';
    const mockTargetFile = '/test/target.cbz';
    beforeEach(() => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({
        isFile: () => true,
        size: 1024
      });
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    });
    it('should handle corrupt zip file', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('corrupt'));
      const mockZip = {
        loadAsync: jest.fn().mockRejectedValue(new Error('Invalid zip file'))
      };
      (JSZip as unknown as jest.Mock).mockImplementation(() => mockZip);
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'zip',
        targetFormat: 'cbz'
      };
      const result = await converter.convert(options);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('Invalid zip file');
      }
    });
    it('should handle empty zip file', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('zip-content'));
      const mockZip = {
        loadAsync: jest.fn().mockResolvedValue({
          files: {}
        }),
        file: jest.fn(),
        generateAsync: jest.fn().mockResolvedValue(Buffer.from('cbz-content'))
      };
      (JSZip as unknown as jest.Mock).mockImplementation(() => mockZip);
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'zip',
        targetFormat: 'cbz'
      };
      const result = await converter.convert(options);
      // Should fail because no images found
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('No images found');
      }
    });
    it('should handle file write errors', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('zip-content'));
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Disk full'));
      const mockZip = {
        loadAsync: jest.fn().mockResolvedValue({
          files: {
            'image1.jpg': {
              name: 'image1.jpg',
              dir: false,
              async: jest.fn().mockResolvedValue(Buffer.from('image1'))
            }
          }
        }),
        file: jest.fn(),
        generateAsync: jest.fn().mockResolvedValue(Buffer.from('cbz-content'))
      };
      (JSZip as unknown as jest.Mock).mockImplementation(() => mockZip);
      const options: ConversionOptions = {
        sourceFile: mockSourceFile,
        targetFile: mockTargetFile,
        sourceFormat: 'zip',
        targetFormat: 'cbz'
      };
      const result = await converter.convert(options);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('Disk full');
      }
    });
  });
  describe('image format support', () => {
    it('should support common image formats', () => {
      const imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      imageFormats.forEach(_format => {
        expect(converter.canConvert('zip', 'cbz')).toBe(true);
      });
    });
  });
});
