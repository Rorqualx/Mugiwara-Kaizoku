/**
 * Volume Splitter Service - Main Orchestrator
 *
 * Coordinates volume splitting process using specialized modules.
 *
 * ESLint Fixes Applied:
 * - max-statements: Split large methods into smaller helper functions
 * - no-await-in-loop: Replaced sequential operations with Promise.all()
 *
 * Architecture:
 * - types.ts: Core type definitions
 * - utils.ts: Helper functions (naturalSort, isTitlePage, validateImage)
 * - volume-detector.ts: Volume file detection
 * - metadata-fetcher.ts: Database metadata fetching
 * - confidence-calculator.ts: Confidence scoring
 * - image-extractor.ts: Archive image extraction
 * - chapter-detectors.ts: Chapter boundary detection
 * - archive-creator.ts: CBZ archive creation
 *
 * @module server/services/download/volume-splitter
 */

import * as path from 'path';


import { prisma } from '@/server/db';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { createChapterArchive } from './archive-creator';
import {
  detectChaptersByFilename,
  detectChaptersBySequence,
  createEqualChapters
} from './chapter-detectors';
import { calculateConfidence } from './confidence-calculator';
import { extractImages } from './image-extractor';
import { fetchVolumeMetadata } from './metadata-fetcher';
import { isVolumeFile } from './volume-detector';

import type {
  VolumeMetadata,
  ChapterBoundary,
  ImageEntry,
  VolumeSplitResult,
  SplitOptions
} from './types';
import type { PrismaClient } from '@prisma/client';

// Mock progress tracker for now - should be implemented properly
interface ProgressTracker {
  startOperation(operationId: string, volumePath: string): void;
  updateExtractingImages(operationId: string, count: number): void;
  updateDetectingChapters(operationId: string): void;
  updateCalculatingConfidence(operationId: string, chapterCount: number): void;
  updateCreatingChapter(operationId: string, current: number, total: number): void;
  chapterCreated(operationId: string, chapterPath: string): void;
  completeOperation(operationId: string, createdFiles: string[]): void;
  errorOperation(operationId: string, error: Error): void;
}

function getProgressTracker(): ProgressTracker {
  return {
    startOperation: () => {},
    updateExtractingImages: () => {},
    updateDetectingChapters: () => {},
    updateCalculatingConfidence: () => {},
    updateCreatingChapter: () => {},
    chapterCreated: () => {},
    completeOperation: () => {},
    errorOperation: () => {}
  };
}

function generateOperationId(volumePath: string): string {
  return `volume-split-${Date.now()}-${path.basename(volumePath)}`;
}

export class VolumeSplitter {
  constructor(private prismaClient: PrismaClient = prisma) {}

  /**
   * Check if a file is likely a volume (vs individual chapter)
   */
  async isVolumeFile(filePath: string): Promise<boolean> {
    return isVolumeFile(filePath);
  }

  /**
   * Extract volume metadata from database if available
   * EXTRACTED to reduce max-statements
   */
  private async extractVolumeMetadata(mangaId?: number, volumeNumber?: number): Promise<VolumeMetadata | null> {
    if (!mangaId || !volumeNumber) {
      return null;
    }

    return fetchVolumeMetadata(this.prismaClient, mangaId, volumeNumber);
  }

  /**
   * Process chapter images and validate extraction
   * EXTRACTED to reduce max-statements
   */
  private processChapterImages(volumePath: string, operationId: string): ImageEntry[] {
    const images = extractImages(volumePath);

    if (images.length === 0) {
      const error = new Error('No images found in volume archive');
      const progressTracker = getProgressTracker();
      progressTracker.errorOperation(operationId, error);
      throw error;
    }

    logger.info(`[VolumeSplitter] Extracted ${images.length} images from volume`);
    const progressTracker = getProgressTracker();
    progressTracker.updateExtractingImages(operationId, images.length);

    return images;
  }

  /**
   * Create chapter archives in parallel
   * FIX: Line 370 no-await-in-loop
   * EXTRACTED to reduce max-statements
   */
  private async createChapterArchives(
    chapters: ChapterBoundary[],
    outputDir: string,
    volumeNumber: number,
    mangaTitle: string,
    operationId: string
  ): Promise<string[]> {
    const progressTracker = getProgressTracker();

    // Process chapters in parallel using Promise.all
    const creationPromises = chapters.map(async (chapter, i) => {
      const chapterFilename = `${mangaTitle} VOL${String(volumeNumber).padStart(2, '0')}CH${String(chapter.chapterNumber).padStart(2, '0')}.cbz`;
      const chapterPath = path.join(outputDir, chapterFilename);

      // Update progress: creating this chapter
      progressTracker.updateCreatingChapter(operationId, i + 1, chapters.length);

      await createChapterArchive(chapter.images, chapterPath);

      // Update progress: chapter created
      progressTracker.chapterCreated(operationId, chapterPath);

      const confidenceStr = `${(chapter.confidence * 100).toFixed(0)}%`;
      logger.info(`[VolumeSplitter] Created ${chapterFilename} (${chapter.pageCount} pages, confidence: ${confidenceStr})`);

      return chapterPath;
    });

    const results = await Promise.all(creationPromises);
    return results;
  }

  /**
   * Validate final split result
   * EXTRACTED to reduce max-statements
   */
  private validateFinalResult(params: {
    operationId: string;
    volumePath: string;
    images: ImageEntry[];
    chapters: ChapterBoundary[];
    createdFiles: string[];
    detectionMethod: 'filename' | 'sequential' | 'fallback';
    confidence: number;
    warnings: string[];
    metadata: VolumeMetadata | null;
  }): VolumeSplitResult {
    const {
      operationId,
      volumePath,
      images,
      chapters,
      createdFiles,
      detectionMethod,
      confidence,
      warnings,
      metadata
    } = params;
    const result: VolumeSplitResult = {
      operationId,
      volumePath,
      volumeName: path.basename(volumePath),
      totalImages: images.length,
      detectedChapters: chapters,
      createdFiles,
      method: detectionMethod,
      averageConfidence: confidence,
      warnings
    };

    // Only add metadata if it exists (exactOptionalPropertyTypes compliance)
    if (metadata) {
      result.metadata = metadata;
    }

    return result;
  }

  /**
   * Detect chapter boundaries using multiple strategies
   * EXTRACTED to reduce max-statements
   */
  private detectChapters(
    images: ImageEntry[],
    metadata: VolumeMetadata | null,
    operationId: string
  ): { chapters: ChapterBoundary[]; detectionMethod: 'filename' | 'sequential' | 'fallback' } {
    const progressTracker = getProgressTracker();
    progressTracker.updateDetectingChapters(operationId);

    // Try filename detection first
    let chapters = detectChaptersByFilename(images);
    if (chapters.length > 1) {
      logger.info(`[VolumeSplitter] Detected ${chapters.length} chapters using filename analysis`);
      return { chapters, detectionMethod: 'filename' };
    }

    // Try sequential detection
    chapters = detectChaptersBySequence(images, metadata);
    if (chapters.length > 1) {
      logger.info(`[VolumeSplitter] Detected ${chapters.length} chapters using sequential analysis`);
      return { chapters, detectionMethod: 'sequential' };
    }

    // Fallback to equal distribution
    const estimatedChapterCount = metadata?.chapters.length ?? Math.ceil(images.length / 40);
    chapters = createEqualChapters(images, estimatedChapterCount);
    logger.warn(`[VolumeSplitter] Using fallback: splitting into ${estimatedChapterCount} chapters`);
    return { chapters, detectionMethod: 'fallback' };
  }

  /**
   * Split a volume file into individual chapter files
   *
   * ✅ FIXED: max-statements violation by extracting helper functions
   * ✅ FIXED: no-await-in-loop violation by using Promise.all()
   *
   * @param volumePath - Path to volume archive
   * @param outputDir - Directory to save chapter files
   * @param volumeNumber - Volume number for naming
   * @param mangaTitle - Manga title for naming
   * @param mangaId - Manga ID for fetching metadata (optional)
   * @param _options - Additional splitting options (currently unused)
   * @returns AsyncResult with split results
   */
  async splitVolume(params: {
    volumePath: string;
    outputDir: string;
    volumeNumber: number;
    mangaTitle: string;
    mangaId?: number;
    _options?: SplitOptions;
  }): Promise<AsyncResult<VolumeSplitResult, Error>> {
    const { volumePath, outputDir, volumeNumber, mangaTitle, mangaId } = params;
    const operationId = generateOperationId(volumePath);
    const progressTracker = getProgressTracker();

    try {
      logger.info(`[VolumeSplitter] Starting volume split: ${path.basename(volumePath)}`);
      progressTracker.startOperation(operationId, volumePath);

      // 1. Fetch metadata if available
      const metadata = await this.extractVolumeMetadata(mangaId, volumeNumber);

      // 2. Extract images
      const images = this.processChapterImages(volumePath, operationId);

      // 3. Detect chapter boundaries
      const { chapters, detectionMethod } = this.detectChapters(images, metadata, operationId);

      // 4. Calculate confidence
      progressTracker.updateCalculatingConfidence(operationId, chapters.length);
      const { confidence, warnings } = calculateConfidence(chapters, metadata, images.length);

      if (warnings.length > 0) {
        logger.warn(`[VolumeSplitter] Validation warnings:\n  - ${warnings.join('\n  - ')}`);
      }

      // 5. Create chapter files in parallel (FIX: no-await-in-loop)
      const createdFiles = await this.createChapterArchives(
        chapters,
        outputDir,
        volumeNumber,
        mangaTitle,
        operationId
      );

      progressTracker.completeOperation(operationId, createdFiles);

      // 6. Build and validate final result
      const result = this.validateFinalResult({
        operationId,
        volumePath,
        images,
        chapters,
        createdFiles,
        detectionMethod,
        confidence,
        warnings,
        metadata
      });

      return createSuccessResult(result);

    } catch (error) {
      const errorMsg = `Failed to split volume: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(`[VolumeSplitter] ${errorMsg}`);

      // Mark operation as failed
      const err = error instanceof Error ? error : new Error(errorMsg);
      progressTracker.errorOperation(operationId, err);

      return createErrorResult(err);
    }
  }
}

/**
 * Get singleton instance of VolumeSplitter
 */
let volumeSplitterInstance: VolumeSplitter | null = null;

export function getVolumeSplitter(): VolumeSplitter {
  volumeSplitterInstance ??= new VolumeSplitter();
  return volumeSplitterInstance;
}

// Export all types and functions for external use
export * from './types';
export * from './utils';
export * from './volume-detector';
export * from './metadata-fetcher';
export * from './confidence-calculator';
export * from './image-extractor';
export * from './archive-creator';
export * from './chapter-detectors';