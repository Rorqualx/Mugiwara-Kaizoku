/**
 * Chapter Detection Module
 *
 * Extracted from volumeSplitter.ts with ESLint fixes and improved modularity.
 * Handles chapter boundary detection using multiple strategies:
 * - Filename pattern analysis
 * - Sequential gap detection
 * - Metadata-assisted detection
 *
 * @module server/services/download/volume-splitter
 */

import * as path from 'path';

import { logger } from '@/utils/logger';

import { isTitlePage } from './utils';

import type { ImageEntry, ChapterBoundary, VolumeMetadata } from './types';

/**
 * Result of chapter detection operation
 */
export interface ChapterDetectionResult {
  boundaries: ChapterBoundary[];
  confidence: number;
}

// ============================================================================
// Filename Pattern Detection
// ============================================================================

/**
 * Extract chapter number from filename using multiple patterns
 */
function extractChapterFromFilename(filename: string, dirName: string): number | null {
  // Pattern 1: "Chapter 01" or "Ch 01" in filename or directory
  const chapterPattern = /(?:chapter|ch|c)[\s._-]*(\d+)/i;
  const filenameMatch = filename.match(chapterPattern);
  const dirMatch = dirName.match(chapterPattern);

  if (dirMatch?.[1]) {
    return parseInt(dirMatch[1], 10);
  }
  if (filenameMatch?.[1]) {
    return parseInt(filenameMatch[1], 10);
  }

  // Pattern 2: "c001p001" format
  const compactPattern = /c(\d{2,})p\d+/i;
  const compactMatch = filename.match(compactPattern);
  if (compactMatch?.[1]) {
    return parseInt(compactMatch[1], 10);
  }

  // Pattern 3: Leading digits before dash or underscore (01-001.jpg)
  const leadingPattern = /^(\d{1,2})[-_]\d+/;
  const leadingMatch = filename.match(leadingPattern);
  if (leadingMatch?.[1]) {
    return parseInt(leadingMatch[1], 10);
  }

  return null;
}

/**
 * Create chapter boundary from grouped images
 */
function createChapterBoundary(
  chapterNum: number,
  chapterImages: ImageEntry[],
  confidence: number
): ChapterBoundary | null {
  if (chapterImages.length < 5) {
    // Too few pages, likely a false positive
    logger.debug(`[ChapterDetector] Skipping chapter ${chapterNum} (only ${chapterImages.length} pages)`);
    return null;
  }

  const firstImage = chapterImages[0];
  const lastImage = chapterImages[chapterImages.length - 1];

  if (!firstImage || !lastImage) {
    logger.warn(`[ChapterDetector] Invalid chapter ${chapterNum}: missing images`);
    return null;
  }

  return {
    chapterNumber: chapterNum,
    startIndex: firstImage.index,
    endIndex: lastImage.index,
    pageCount: chapterImages.length,
    images: chapterImages,
    confidence
  };
}

/**
 * Detect chapter boundaries using filename patterns
 *
 * Looks for patterns like:
 * - "Chapter 01 - Page 01.jpg"
 * - "c001p001.png"
 * - "01-001.jpg"
 * - Folder structure: "Chapter 01/page001.jpg"
 */
export function detectChaptersByFilename(images: ImageEntry[]): ChapterBoundary[] {
  const chapterMap = new Map<number, ImageEntry[]>();

  for (const image of images) {
    const filename = path.basename(image.filename);
    const dirName = path.dirname(image.filename);

    const chapterNum = extractChapterFromFilename(filename, dirName);

    if (chapterNum !== null && chapterNum > 0) {
      const chapterImages = chapterMap.get(chapterNum) ?? [];
      chapterImages.push(image);
      chapterMap.set(chapterNum, chapterImages);
      image.detectedChapter = chapterNum;
    }
  }

  // Convert map to chapter boundaries
  const chapters: ChapterBoundary[] = [];
  const sortedChapters = Array.from(chapterMap.keys()).sort((a, b) => a - b);

  for (const chapterNum of sortedChapters) {
    const chapterImages = chapterMap.get(chapterNum);
    if (!chapterImages) {
      continue;
    }

    const boundary = createChapterBoundary(chapterNum, chapterImages, 0.8);
    if (boundary) {
      chapters.push(boundary);
    }
  }

  return chapters;
}

// ============================================================================
// Sequential Detection Helpers
// ============================================================================

/**
 * Calculate typical chapter length based on metadata
 */
function calculateTypicalChapterLength(metadata: VolumeMetadata | null): number {
  const defaultChapterLength = 40; // Default average manga chapter pages

  if (metadata && metadata.chapters.length > 0 && metadata.totalPages) {
    const derivedLength = Math.round(metadata.totalPages / metadata.chapters.length);
    logger.debug(`[ChapterDetector] Using metadata-derived chapter length: ${derivedLength} pages`);
    return derivedLength;
  }

  return defaultChapterLength;
}

/**
 * Check if current chapter should split based on length and patterns
 */
function shouldSplitChapter(
  currentChapter: ImageEntry[],
  typicalChapterLength: number,
  tolerance: number,
  nextImage?: ImageEntry
): boolean {
  const currentLength = currentChapter.length;
  const isWithinLengthRange =
    currentLength >= typicalChapterLength - tolerance &&
    currentLength <= typicalChapterLength + tolerance;

  const hasTitlePage = nextImage ? isTitlePage(nextImage.filename) : false;

  return isWithinLengthRange || hasTitlePage;
}

/**
 * Create chapter boundary from sequential images
 */
function createSequentialChapter(
  chapterNumber: number,
  currentChapter: ImageEntry[],
  confidence: number
): ChapterBoundary | null {
  const firstImage = currentChapter[0];
  const lastImage = currentChapter[currentChapter.length - 1];

  if (!firstImage || !lastImage) {
    return null;
  }

  return {
    chapterNumber,
    startIndex: firstImage.index,
    endIndex: lastImage.index,
    pageCount: currentChapter.length,
    images: [...currentChapter],
    confidence
  };
}

/**
 * Detect chapter boundaries using sequential analysis
 *
 * Looks for gaps in page numbering or consistent page counts.
 * Uses metadata hints if available to improve accuracy.
 */
export function detectChaptersBySequence(
  images: ImageEntry[],
  metadata: VolumeMetadata | null = null
): ChapterBoundary[] {
  const chapters: ChapterBoundary[] = [];

  const typicalChapterLength = calculateTypicalChapterLength(metadata);
  const tolerance = Math.max(10, typicalChapterLength * 0.2); // 20% variance or 10 pages

  let currentChapter: ImageEntry[] = [];
  let chapterNumber = 1;

  for (let i = 0; i < images.length; i++) {
    const currentImage = images[i];

    if (!currentImage) {
      logger.warn(`[ChapterDetector] Skipping invalid image at index ${i} in sequential detection`);
      continue;
    }

    currentChapter.push(currentImage);

    const nextImage = i + 1 < images.length ? images[i + 1] : undefined;

    // Check if we should start a new chapter
    if (shouldSplitChapter(currentChapter, typicalChapterLength, tolerance, nextImage) && i < images.length - 1) {
      const boundary = createSequentialChapter(chapterNumber, currentChapter, 0.7);
      if (boundary) {
        chapters.push(boundary);
      }

      currentChapter = [];
      chapterNumber++;
    }
  }

  // Add remaining images as final chapter
  if (currentChapter.length > 0) {
    const boundary = createSequentialChapter(chapterNumber, currentChapter, 0.7);
    if (boundary) {
      chapters.push(boundary);
    }
  }

  return chapters;
}

// ============================================================================
// Fallback Detection
// ============================================================================

/**
 * Create equal-sized chapters as fallback strategy
 */
export function createEqualChapters(images: ImageEntry[], chapterCount: number): ChapterBoundary[] {
  const chapters: ChapterBoundary[] = [];
  const pagesPerChapter = Math.ceil(images.length / chapterCount);

  for (let i = 0; i < chapterCount; i++) {
    const startIdx = i * pagesPerChapter;
    const endIdx = Math.min(startIdx + pagesPerChapter, images.length);
    const chapterImages = images.slice(startIdx, endIdx);

    if (chapterImages.length === 0) {
      break;
    }

    chapters.push({
      chapterNumber: i + 1,
      startIndex: startIdx,
      endIndex: endIdx - 1,
      pageCount: chapterImages.length,
      images: chapterImages,
      confidence: 0.5 // Low confidence for fallback method
    });
  }

  return chapters;
}

// ============================================================================
// Main Detection Interface
// ============================================================================

/**
 * Detect chapter boundaries using multiple strategies
 *
 * Primary interface for chapter detection that combines:
 * 1. Filename-based detection
 * 2. Sequential gap detection
 * 3. Fallback equal distribution
 */
export function detectChapterBoundaries(
  images: ImageEntry[],
  metadata: VolumeMetadata | null = null
): ChapterDetectionResult {
  let boundaries: ChapterBoundary[] = [];

  // Strategy 1: Filename-based detection
  boundaries = detectChaptersByFilename(images);
  if (boundaries.length > 1) {
    logger.info(`[ChapterDetector] Detected ${boundaries.length} chapters using filename analysis`);
    return {
      boundaries,
      confidence: calculateDetectionConfidence(boundaries)
    };
  }

  // Strategy 2: Sequential gap detection (can use metadata hints)
  boundaries = detectChaptersBySequence(images, metadata);
  if (boundaries.length > 1) {
    logger.info(`[ChapterDetector] Detected ${boundaries.length} chapters using sequential analysis`);
    return {
      boundaries,
      confidence: calculateDetectionConfidence(boundaries)
    };
  }

  // Fallback: Use metadata or assume equal distribution
  const estimatedChapterCount = metadata?.chapters.length ?? Math.ceil(images.length / 40);
  boundaries = createEqualChapters(images, estimatedChapterCount);
  logger.warn(`[ChapterDetector] Using fallback: splitting into ${estimatedChapterCount} chapters`);

  return {
    boundaries,
    confidence: 0.5 // Low confidence for fallback
  };
}

/**
 * Calculate overall confidence based on individual chapter confidences
 */
function calculateDetectionConfidence(boundaries: ChapterBoundary[]): number {
  if (boundaries.length === 0) {
    return 0;
  }

  const totalConfidence = boundaries.reduce((sum, boundary) => sum + boundary.confidence, 0);
  return totalConfidence / boundaries.length;
}