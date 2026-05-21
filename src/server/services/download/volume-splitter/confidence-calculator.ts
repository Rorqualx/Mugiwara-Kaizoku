/**
 * Confidence Calculator
 *
 * Calculates confidence scores for detected chapter boundaries
 * based on metadata validation and heuristic analysis.
 *
 * Extracted from: volumeSplitter.ts (lines 201-267)
 */

import { logger } from '@/utils/logger';

import type { ChapterBoundary, VolumeMetadata, ConfidenceResult } from './types';

/**
 * Calculate confidence score for detected boundaries based on metadata
 *
 * @param detected - Detected chapter boundaries
 * @param metadata - Volume metadata from database
 * @param totalImages - Total number of images
 * @returns Confidence score (0-1) and warnings
 */
export function calculateConfidence(
  detected: ChapterBoundary[],
  metadata: VolumeMetadata | null,
  totalImages: number
): ConfidenceResult {
  const warnings: string[] = [];

  if (!metadata || metadata.chapters.length === 0) {
    warnings.push('No metadata available for validation - using heuristic detection only');
    return { confidence: 0.5, warnings };
  }

  let confidenceScore = 1.0;

  // Check 1: Total page count match
  if (metadata.totalPages) {
    const pageDiff = Math.abs(totalImages - metadata.totalPages);
    const pageMatchRatio = 1 - (pageDiff / metadata.totalPages);

    if (pageMatchRatio < 0.9) {
      confidenceScore *= 0.7;
      warnings.push(`Volume page count mismatch: expected ${metadata.totalPages}, found ${totalImages}`);
    }

    logger.debug(`[VolumeSplitter] Page count match ratio: ${(pageMatchRatio * 100).toFixed(1)}%`);
  }

  // Check 2: Chapter count match
  if (detected.length !== metadata.chapters.length) {
    confidenceScore *= 0.8;
    warnings.push(`Chapter count mismatch: expected ${metadata.chapters.length}, detected ${detected.length}`);
  }

  // Check 3: Individual chapter page counts
  for (const boundary of detected) {
    const expectedMetadata = metadata.chapters.find(
      ch => ch.chapterNumber === boundary.chapterNumber
    );

    if (expectedMetadata?.expectedPageCount) {
      const pageDiff = Math.abs(boundary.pageCount - expectedMetadata.expectedPageCount);
      const tolerance = Math.max(3, expectedMetadata.expectedPageCount * 0.1); // 10% or 3 pages

      if (pageDiff > tolerance) {
        confidenceScore *= 0.9;
        warnings.push(
          `Chapter ${boundary.chapterNumber}: page count mismatch (expected ${expectedMetadata.expectedPageCount}, detected ${boundary.pageCount})`
        );
      }

      // Store matched metadata
      boundary.matchedMetadata = expectedMetadata;
      boundary.confidence = pageDiff <= tolerance ? 1.0 : 0.7;
    } else {
      // No metadata for this chapter
      boundary.confidence = 0.6;
    }
  }

  // Calculate average confidence per chapter
  const avgChapterConfidence = detected.reduce((sum, ch) => sum + ch.confidence, 0) / detected.length;
  confidenceScore = Math.min(confidenceScore, avgChapterConfidence);

  logger.info(`[VolumeSplitter] Overall confidence: ${(confidenceScore * 100).toFixed(1)}%`);

  return { confidence: Math.max(0, Math.min(1, confidenceScore)), warnings };
}