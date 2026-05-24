/**
 * Enhanced Directory Scanner
 *
 * Main scanner class that orchestrates the scanning process using modular components.
 * Refactored from 570 lines to use extracted modules for better maintainability.
 *
 * Modules:
 * - scanner/types.ts - Type definitions
 * - scanner/utils.ts - Utility functions and type guards
 * - scanner/file-parser.ts - File name parsing
 * - scanner/rule-processor.ts - Import rule processing
 * - scanner/duplicate-checker.ts - Duplicate detection
 * - scanner/manga-creator.ts - Manga entry creation
 * - scanner/chapter-creator.ts - Chapter entry creation
 * - scanner/enrichment-handler.ts - Metadata enrichment
 * - scanner/batch-processor.ts - Batch processing utilities
 */

import * as path from 'path';

import { TRPCError } from '@trpc/server';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { findMangaFiles, naturalSort, getDirectorySizeBytes, getFilesSizeBytes } from '@/utils/file-utils';
import { serverLogger } from '@/utils/serverLogger';

import { DuplicateDetector } from './duplicateDetector';
import { ImportRuleEngine } from './importRuleEngine';
import { MetadataEnrichmentService } from './metadataEnrichmentService';
import { processMangaGroupsBatch } from './scanner/batch-processor';
import { createChaptersFromFileList } from './scanner/chapter-creator';
import { checkForDuplicates } from './scanner/duplicate-checker';
import { enrichMangaMetadata } from './scanner/enrichment-handler';
import { parseMangaFromFilesWithComicInfo } from './scanner/file-parser';
import { validateImportResult } from './scanner/import-validator';
import { createMangaWithMetadata } from './scanner/manga-creator';
import { processImportRules } from './scanner/rule-processor';
import {
  DEFAULT_SUBFOLDER_EXCLUSIONS,
  type EnhancedScanOptions,
  type ScanResult,
  type ScanItem
} from './scanner/types';
import { collectFileDetails } from './scanner/utils';

const MANGA_SUBDIRS = new Set(['chapters', 'volumes']);

/**
 * Fold a discovered file/image-dir path to its manga-root directory.
 * Walks ancestors leaf→root and returns the parent of the first `chapters`/
 * `volumes` segment so `<title>/Chapters/Vol 1/Chapter 1/` (image dir),
 * `<title>/Volumes/Vol 1.cbz`, and `<title>/Volumes/Vol 1/` all collapse to
 * `<title>`. Falls back to `path.dirname(filePath)` when no wrapper exists.
 */
function resolveMangaRoot(filePath: string): string {
  const dir = path.dirname(filePath);
  const segments = dir.split(path.sep);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg !== undefined && MANGA_SUBDIRS.has(seg.toLowerCase())) {
      const root = segments.slice(0, i).join(path.sep);
      return root.length > 0 ? root : path.sep;
    }
  }
  return dir;
}


/**
 * Enhanced directory scanner with improved file type support and parsing
 *
 * Features:
 * - Automatic manga file grouping by directory structure
 * - Import rule processing for automated organization
 * - Duplicate detection with configurable similarity threshold
 * - Metadata enrichment from external providers
 * - Batch processing to avoid performance bottlenecks
 */
export class EnhancedScanner {
  private duplicateDetector: DuplicateDetector;
  private enrichmentService: MetadataEnrichmentService;
  private ruleEngine: ImportRuleEngine | null = null;

  constructor() {
    this.duplicateDetector = new DuplicateDetector();
    this.enrichmentService = new MetadataEnrichmentService();
  }

  /**
   * Scan a directory for manga files with enhanced parsing and organization
   *
   * @param options - Scan configuration options
   * @returns AsyncResult containing ScanResult on success or Error on failure
   */
  async scanDirectory(options: EnhancedScanOptions): Promise<AsyncResult<ScanResult>> {
    const { path: scanPath, targetLibraryId, options: scanOptions = {} } = options;
    const {
      importRules = [],
      onProgress,
      excludeSubfolderPatterns = [...DEFAULT_SUBFOLDER_EXCLUSIONS]
    } = scanOptions;

    const result: ScanResult = {
      totalFiles: 0,
      processed: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      items: []
    };

    // Initialize rule engine if rules are provided
    if (Array.isArray(importRules) && importRules.length > 0) {
      this.ruleEngine = new ImportRuleEngine(importRules);
    }

    try {
      // Verify library exists
      const library = await prisma.library.findUnique({
        where: { id: targetLibraryId }
      });

      if (!library) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Target library not found'
        });
      }

      serverLogger.info('Starting enhanced directory scan', { path: scanPath });

      // Report initial progress
      onProgress?.(0, 0, 'Scanning directory for manga files...');

      // Find all manga files
      const mangaFiles = await findMangaFiles(scanPath, {
        recursive: true,
        includeImageDirs: true,
        followSymlinks: false
      });

      result.totalFiles = mangaFiles.length;
      serverLogger.info(`Found ${mangaFiles.length} manga files/directories`);

      // Report file discovery progress
      onProgress?.(0, mangaFiles.length, `Found ${mangaFiles.length} files, grouping...`);

      // Emit scan started via WebSocket
      void realtimeEmitter.emitLibraryScanStarted(targetLibraryId, mangaFiles.length);

      // Group files by manga (with subfolder exclusion)
      const mangaGroups = this.groupMangaFiles(mangaFiles, excludeSubfolderPatterns);
      const totalGroups = mangaGroups.size;

      // Report grouping complete
      onProgress?.(0, totalGroups, `Found ${totalGroups} manga series, processing...`);

      // Process each manga group using batch processor with progress tracking
      let processedCount = 0;
      let lastEmittedPercent = 0;
      const items = await processMangaGroupsBatch(
        mangaGroups,
        async (mangaPath, files) => {
          const scanItem = await this.processMangaGroup(
            mangaPath,
            files,
            targetLibraryId,
            scanOptions
          );
          processedCount++;
          // Report per-item progress
          onProgress?.(processedCount, totalGroups, `Processing: ${scanItem.parsed.cleanTitle}`);

          // Emit WebSocket progress (throttled - every 5% or every 10 items)
          const currentPercent = Math.floor((processedCount / totalGroups) * 100);
          if (currentPercent >= lastEmittedPercent + 5 || processedCount % 10 === 0) {
            lastEmittedPercent = currentPercent;
            void realtimeEmitter.emitLibraryScanProgress({
              libraryId: targetLibraryId,
              progress: currentPercent,
              status: 'scanning',
              currentFile: scanItem.parsed.cleanTitle,
              totalFiles: totalGroups,
              processedFiles: processedCount,
            });
          }

          return scanItem;
        },
        { concurrency: 5 }
      );

      result.items = items;
      result.processed = items.length;

      // Count statuses
      for (const item of items) {
        switch (item.status) {
          case 'created':
            result.created++;
            break;
          case 'exists':
            result.skipped++;
            break;
          case 'error':
            result.errors++;
            break;
          default:
            break;
        }
      }

      serverLogger.info('Scan completed', {
        total: result.totalFiles,
        created: result.created,
        skipped: result.skipped,
        errors: result.errors
      });

      // Report completion
      onProgress?.(totalGroups, totalGroups, `Completed: ${result.created} created, ${result.skipped} skipped`);

      // Emit scan completed via WebSocket
      void realtimeEmitter.emitLibraryScanCompleted(targetLibraryId, result.processed);

      return createSuccessResult(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      serverLogger.error('Enhanced scan failed', {
        path: scanPath,
        error: errorMessage
      });
      // Report error
      onProgress?.(0, 0, `Error: ${errorMessage}`);

      // Emit scan failed via WebSocket
      void realtimeEmitter.emitLibraryScanProgress({
        libraryId: targetLibraryId,
        progress: 0,
        status: 'failed',
        error: errorMessage,
      });

      return createErrorResult(error instanceof Error ? error : new Error(errorMessage));
    }
  }

  /**
   * Check if a folder should be excluded from scanning
   *
   * Uses exact (case-insensitive) match on folder name to avoid false positives
   * where a folder like "drawing-raw-manga" would match the "raw" pattern.
   *
   * @param folderPath - Path to the folder
   * @param exclusions - Array of exclusion patterns
   * @returns The matched exclusion pattern, or null if not excluded
   */
  private shouldExcludeSubfolder(folderPath: string, exclusions: string[]): string | null {
    const folderName = path.basename(folderPath).toLowerCase();
    return exclusions.find((pattern) => folderName === pattern.toLowerCase()) ?? null;
  }

  /**
   * Group manga files intelligently based on directory structure
   *
   * Groups files into manga collections by checking if directories contain images
   * or by grouping archive files by their parent directory.
   * Excludes subfolders matching exclusion patterns.
   *
   * @param files - Array of file paths to group
   * @param exclusions - Subfolder patterns to exclude
   * @returns Map of manga paths to their associated files
   */
  private groupMangaFiles(
    files: string[],
    exclusions: string[]
  ): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    for (const file of files) {
      // Check if the file's directory or the file itself should be excluded
      const dir = path.dirname(file);
      const matchedExclusion = this.shouldExcludeSubfolder(file, exclusions)
        ?? this.shouldExcludeSubfolder(dir, exclusions);
      if (matchedExclusion) {
        serverLogger.info('Excluding subfolder from scan', { file, matchedPattern: matchedExclusion });
        continue;
      }

      // Fold to the manga root, walking past any chapters/ or volumes/ wrapper —
      // handles multi-level layouts like <title>/Chapters/Vol 1/Chapter 1/ and
      // <title>/Volumes/Vol 1.cbz alike.
      const groupDir = resolveMangaRoot(file);
      const existing = groups.get(groupDir) ?? [];
      existing.push(file);
      groups.set(groupDir, existing);
    }

    // Sort files within each group naturally
    for (const [key, fileList] of groups) {
      groups.set(key, naturalSort(fileList));
    }

    return groups;
  }

  /**
   * Process a single manga group (SIMPLIFIED - delegates to modules)
   *
   * Orchestrates the scanning pipeline:
   * 1. Parse manga information from files
   * 2. Apply import rules
   * 3. Check for duplicates
   * 4. Create manga entry
   * 5. Create chapter entries
   * 6. Enrich with metadata
   *
   * @param mangaPath - Path to the manga directory
   * @param files - List of manga files in the directory
   * @param libraryId - Target library ID
   * @param options - Scan options
   * @returns Scan item result
   */
  private async processMangaGroup(
    mangaPath: string,
    files: string[],
    libraryId: number,
    options: EnhancedScanOptions['options'] = {}
  ): Promise<ScanItem> {
    const {
      autoMatch = false,
      preview = false,
      skipExisting = true,
      parseFileNames = true,
    } = options;

    // Debug: Log preview mode status
    serverLogger.info('[Scanner] processMangaGroup options:', {
      preview,
      autoMatch,
      skipExisting,
      mangaPath
    });

    // Parse manga information (delegated to file-parser)
    const parsed = await parseMangaFromFilesWithComicInfo(mangaPath, files, parseFileNames);

    // Calculate total file size for this manga
    // If files array contains the directory itself (image dir), use directory size
    // Otherwise, sum up the sizes of individual archive files
    let fileSize = 0;
    try {
      if (files.length === 1 && files[0] === mangaPath) {
        // Image directory - calculate directory size
        fileSize = await getDirectorySizeBytes(mangaPath);
      } else {
        // Archive files - sum individual file sizes
        fileSize = await getFilesSizeBytes(files);
      }
    } catch {
      // Ignore size calculation errors, default to 0
      fileSize = 0;
    }

    // Collect detailed file information for review display
    const fileDetails = await collectFileDetails(files);
    const scanItem: ScanItem = {
      path: mangaPath,
      parsed,
      status: 'preview',
      chapters: files.length,
      fileSize,
      files: fileDetails
    };

    // Apply import rules (delegated to rule-processor)
    const ruleResult = await processImportRules(
      scanItem,
      mangaPath,
      files,
      libraryId,
      this.ruleEngine
    );

    if (ruleResult.shouldSkip) {
      scanItem.status = 'exists';
      return scanItem;
    }

    const targetLibraryId = ruleResult.targetLibraryId;
    if (ruleResult.ruleActions !== undefined) {
      scanItem.ruleActions = ruleResult.ruleActions;
    }

    // Check for duplicates (delegated to duplicate-checker)
    const duplicateResult = await checkForDuplicates(
      parsed.cleanTitle,
      targetLibraryId,
      this.duplicateDetector,
      skipExisting,
      mangaPath,
    );

    if (duplicateResult.isDuplicate) {
      scanItem.status = 'exists';
      scanItem.duplicate = duplicateResult.duplicate;
      if (duplicateResult.duplicateScore !== undefined) {
        scanItem.duplicateScore = duplicateResult.duplicateScore;
      }
      return scanItem;
    }

    // Preview mode - don't create
    if (preview) {
      serverLogger.info('[Scanner] Preview mode - skipping manga creation:', {
        mangaPath,
        title: parsed.cleanTitle
      });
      return scanItem;
    }

    serverLogger.info('[Scanner] Creating manga entry (preview=false):', {
      mangaPath,
      title: parsed.cleanTitle
    });

    // Create manga entry (delegated to manga-creator)
    const manga = await createMangaWithMetadata({
      title: parsed.cleanTitle,
      path: mangaPath,
      libraryId: targetLibraryId,
      parsed,
      ...(scanItem.ruleActions !== undefined && { ruleActions: scanItem.ruleActions })
    });

    scanItem.manga = manga;
    scanItem.status = 'created';

    // Create chapters (delegated to chapter-creator)
    const mangaId = typeof manga['id'] === 'number' ? manga['id'] : 0;
    await createChaptersFromFileList(mangaId, files, parseFileNames);

    // Post-import validation
    const validation = await validateImportResult(mangaId, files.length);
    if (validation.warnings.length > 0) {
      scanItem.validationWarnings = validation.warnings;
    }

    // Auto-match metadata (delegated to enrichment-handler)
    if (autoMatch) {
      const enrichmentResult = await enrichMangaMetadata(
        manga,
        this.enrichmentService,
      );

      if (enrichmentResult) {
        scanItem.enrichment = enrichmentResult;
        if (enrichmentResult.status === 'enriched') {
          scanItem.status = 'enriched';
          scanItem.metadata = enrichmentResult.appliedMatch;
        }
      }
    }

    return scanItem;
  }
}

// Re-export types for convenience
export type { EnhancedScanOptions, ScanResult, ScanItem };
