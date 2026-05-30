/**
 * EnhancedScanner Tests
 *
 * Integration tests for the EnhancedScanner class using mocked dependencies.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TRPCError } from '@trpc/server';

// Library type for mocking
interface MockLibrary {
  id: number;
  name: string;
  path: string;
}

// Duplicate check result type
interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicate: { id: number; title: string } | null;
}

// Permissive mock type to avoid 'never' type issues with jest.Mock
interface PermissiveMock {
  mockResolvedValue: (value: unknown) => PermissiveMock;
  mockResolvedValueOnce: (value: unknown) => PermissiveMock;
  mockRejectedValueOnce: (value: unknown) => PermissiveMock;
}

// Mock dependencies before importing scanner
const mockPrisma = {
  library: {
    findUnique: jest.fn<() => Promise<MockLibrary | null>>()
  }
};

const mockFindMangaFiles = jest.fn<() => Promise<string[]>>();
const mockNaturalSort = jest.fn((arr: string[]) => [...arr].sort());

const mockDuplicateDetector = {
  findDuplicates: jest.fn()
};

const mockImportRuleEngine = jest.fn();

// Mock modules
jest.mock('@/server/db', () => ({
  prisma: mockPrisma
}));

jest.mock('@/utils/file-utils', () => ({
  findMangaFiles: mockFindMangaFiles,
  naturalSort: mockNaturalSort
}));

jest.mock('@/server/services/library/duplicateDetector', () => ({
  DuplicateDetector: jest.fn(() => mockDuplicateDetector)
}));

jest.mock('@/server/services/library/importRuleEngine', () => ({
  ImportRuleEngine: mockImportRuleEngine
}));

// Mock scanner modules
jest.mock('@/server/services/library/scanner/batch-processor', () => ({
  processMangaGroupsBatch: jest.fn(async (groups: Map<string, string[]>, processor: Function) => {
    const items = [];
    for (const [path, files] of groups) {
      try {
        // eslint-disable-next-line no-await-in-loop
        items.push(await processor(path, files));
      } catch (error: unknown) {
        // Return error scan item (matches real implementation)
        const errorMessage = error instanceof Error ? error.message : String(error);
        items.push({
          path,
          parsed: {
            original: path.split('/').pop() ?? path,
            title: path.split('/').pop() ?? path,
            cleanTitle: path.split('/').pop() ?? path
          },
          status: 'error' as const,
          error: errorMessage
        });
      }
    }
    return items;
  }),
  checkImageDirectoriesBatch: jest.fn((files: string[]) => {
    const map = new Map<string, boolean>();
    for (const file of files) {
      map.set(file, file.includes('/images/'));
    }
    return Promise.resolve(map);
  })
}));

jest.mock('@/server/services/library/scanner/file-parser', () => ({
  parseMangaFromFiles: jest.fn((mangaPath: string) => ({
    cleanTitle: mangaPath.split('/').pop() ?? 'Unknown',
    originalFilename: mangaPath,
    year: null,
    extension: '.cbz'
  })),
  parseMangaFromFilesWithComicInfo: jest.fn((mangaPath: string) => Promise.resolve({
    cleanTitle: mangaPath.split('/').pop() ?? 'Unknown',
    originalFilename: mangaPath,
    year: null,
    extension: '.cbz'
  }))
}));

jest.mock('@/server/services/library/scanner/rule-processor', () => ({
  processImportRules: jest.fn((_item: unknown, _path: string, _files: string[], libraryId: number) =>
    Promise.resolve({
      shouldSkip: false,
      targetLibraryId: libraryId
    })
  )
}));

jest.mock('@/server/services/library/scanner/duplicate-checker', () => ({
  checkForDuplicates: jest.fn<() => Promise<DuplicateCheckResult>>(() =>
    Promise.resolve({
      isDuplicate: false,
      duplicate: null
    })
  )
}));

jest.mock('@/server/services/library/scanner/manga-creator', () => ({
  createMangaWithMetadata: jest.fn((data: { title: string; path: string; libraryId: number }) =>
    Promise.resolve({
      id: 1,
      title: data.title,
      path: data.path,
      libraryId: data.libraryId
    })
  )
}));

jest.mock('@/server/services/library/scanner/chapter-creator', () => ({
  createChaptersFromFileList: jest.fn(() => Promise.resolve(undefined))
}));

jest.mock('@/server/services/library/scanner/enrichment-handler', () => ({
  enrichMangaMetadata: jest.fn(() => Promise.resolve(null))
}));

// Import after mocks (required for jest.mock hoisting to work correctly)
import { EnhancedScanner } from '@/server/services/library/scanner';
import type { EnhancedScanOptions, ScanResult } from '@/server/services/library/scanner/types';
import type { AsyncResult } from '@/utils/async-result';

describe('EnhancedScanner', () => {
  let scanner: EnhancedScanner;

  beforeEach(() => {
    scanner = new EnhancedScanner();
    jest.clearAllMocks();

    // Default mock implementations
    mockPrisma.library.findUnique.mockResolvedValue({
      id: 1,
      name: 'Test Library',
      path: '/test/library'
    });
  });

  describe('scanDirectory', () => {
    it('should scan directory and find manga files', async () => {
      // Setup
      mockFindMangaFiles.mockResolvedValue([
        '/test/library/manga1/chapter1.cbz',
        '/test/library/manga1/chapter2.cbz',
        '/test/library/manga2/chapter1.cbz'
      ]);

      const options: EnhancedScanOptions = {
        path: '/test/library',
        targetLibraryId: 1,
        options: {
          parseFileNames: true,
          skipExisting: false
        }
      };

      // Execute
      const result: AsyncResult<ScanResult> = await scanner.scanDirectory(options);

      // Verify
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const scanResult = result.data;
        expect(scanResult.totalFiles).toBe(3);
        expect(scanResult.processed).toBeGreaterThan(0);
        expect(mockFindMangaFiles).toHaveBeenCalledWith('/test/library', {
          recursive: true,
          includeImageDirs: true,
          followSymlinks: false
        });
      }
    });

    it('should skip existing manga when skipExisting is true', async () => {
      // Setup
      mockFindMangaFiles.mockResolvedValue([
        '/test/library/manga1/chapter1.cbz'
      ]);

      // Mock duplicate checker to find duplicate
      const { checkForDuplicates } = await import('@/server/services/library/scanner/duplicate-checker');
      (checkForDuplicates as unknown as PermissiveMock).mockResolvedValue({
        isDuplicate: true,
        duplicate: { id: 999, title: 'Existing Manga' }
      });

      const options: EnhancedScanOptions = {
        path: '/test/library',
        targetLibraryId: 1,
        options: {
          skipExisting: true
        }
      };

      // Execute
      const result: AsyncResult<ScanResult> = await scanner.scanDirectory(options);

      // Verify
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const scanResult = result.data;
        expect(scanResult.skipped).toBeGreaterThan(0);
        expect(scanResult.created).toBe(0);
      }
    });

    it('should work in preview mode without creating anything', async () => {
      // Setup
      mockFindMangaFiles.mockResolvedValue([
        '/test/library/manga1/chapter1.cbz'
      ]);

      // Reset duplicate checker mock to ensure no duplicates found
      const { checkForDuplicates } = await import('@/server/services/library/scanner/duplicate-checker');
      (checkForDuplicates as unknown as PermissiveMock).mockResolvedValue({
        isDuplicate: false,
        duplicate: null
      });

      const { createMangaWithMetadata } = await import('@/server/services/library/scanner/manga-creator');
      const createMock = createMangaWithMetadata as jest.Mock;

      const options: EnhancedScanOptions = {
        path: '/test/library',
        targetLibraryId: 1,
        options: {
          preview: true
        }
      };

      // Execute
      const result: AsyncResult<ScanResult> = await scanner.scanDirectory(options);

      // Verify
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const scanResult = result.data;
        expect(scanResult.items).toHaveLength(1);
        expect(scanResult.items[0]?.status).toBe('preview');
        expect(createMock).not.toHaveBeenCalled();
      }
    });

    it('should handle image directories', async () => {
      // Setup - image directory (no chapters, just images)
      mockFindMangaFiles.mockResolvedValue([
        '/test/library/manga1/images/'
      ]);

      const options: EnhancedScanOptions = {
        path: '/test/library',
        targetLibraryId: 1,
        options: {
          parseFileNames: true
        }
      };

      // Execute
      const result: AsyncResult<ScanResult> = await scanner.scanDirectory(options);

      // Verify
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const scanResult = result.data;
        expect(scanResult.totalFiles).toBe(1);
        expect(mockFindMangaFiles).toHaveBeenCalledWith('/test/library', {
          recursive: true,
          includeImageDirs: true,
          followSymlinks: false
        });
      }
    });

    it('should parse file names when parseFileNames is true', async () => {
      // Setup
      mockFindMangaFiles.mockResolvedValue([
        '/test/library/One Piece - Chapter 001.cbz'
      ]);

      const { parseMangaFromFilesWithComicInfo } = await import('@/server/services/library/scanner/file-parser');
      const parseMock = parseMangaFromFilesWithComicInfo as jest.Mock;
      parseMock.mockReturnValue({
        cleanTitle: 'One Piece',
        originalFilename: 'One Piece - Chapter 001.cbz',
        chapter: 1,
        extension: '.cbz'
      });

      const options: EnhancedScanOptions = {
        path: '/test/library',
        targetLibraryId: 1,
        options: {
          parseFileNames: true
        }
      };

      // Execute
      const result: AsyncResult<ScanResult> = await scanner.scanDirectory(options);

      // Verify
      expect(result.status).toBe('success');
      expect(parseMock).toHaveBeenCalled();

      // Verify the parser was called with parseFileNames = true
      const callArgs = parseMock.mock.calls[0];
      expect(callArgs?.[2]).toBe(true); // Third argument should be parseFileNames
    });

    it('should throw error when library not found', async () => {
      // Setup - library doesn't exist
      mockPrisma.library.findUnique.mockResolvedValue(null);

      const options: EnhancedScanOptions = {
        path: '/test/library',
        targetLibraryId: 999,
        options: {}
      };

      // Execute
      const result: AsyncResult<ScanResult> = await scanner.scanDirectory(options);

      // Verify
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error).toBeInstanceOf(TRPCError);
        const error = result.error as TRPCError;
        expect(error.code).toBe('NOT_FOUND');
        expect(error.message).toBe('Target library not found');
      }
    });

    it('should handle errors gracefully and continue processing', async () => {
      // Setup - multiple files, one will fail
      mockFindMangaFiles.mockResolvedValue([
        '/test/library/manga1/chapter1.cbz',
        '/test/library/manga2/chapter1.cbz'
      ]);

      const { createMangaWithMetadata } = await import('@/server/services/library/scanner/manga-creator');
      const createMock = createMangaWithMetadata as unknown as PermissiveMock;

      // First call succeeds, second fails
      createMock
        .mockResolvedValueOnce({ id: 1, title: 'Manga 1', path: '/test/library/manga1' })
        .mockRejectedValueOnce(new Error('Database error'));

      const options: EnhancedScanOptions = {
        path: '/test/library',
        targetLibraryId: 1,
        options: {
          skipExisting: false
        }
      };

      // Execute
      const result: AsyncResult<ScanResult> = await scanner.scanDirectory(options);

      // Verify - scanner should complete despite errors
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const scanResult = result.data;
        expect(scanResult.processed).toBeGreaterThan(0);
        // At least one should have been processed
        expect(scanResult.totalFiles).toBe(2);
      }
    });
  });

  // Placeholder test to ensure the file runs
  it('test file loads correctly', () => {
    expect(scanner).toBeInstanceOf(EnhancedScanner);
  });
});
