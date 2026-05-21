/**
 * Unified Filename Matcher Service
 *
 * Orchestrates provider-specific filename matchers for
 * ComicVine, Fandom, and Wikipedia volumes.
 *
 * @module server/services/matching/unified-filename-matcher
 */

import { ComicVineFilenameMatcher } from '@/server/services/comicvine/comicvine/filename-matcher';
import { FandomFilenameMatcher } from '@/server/services/fandom/fandom/filename-matcher';
import type { FandomVolumeData } from '@/server/services/fandom/fandom/filename-matcher';
import { WikipediaFilenameMatcher } from '@/server/services/wikipedia/wikipedia/filename-matcher';
import type { WikipediaVolumeData } from '@/server/services/wikipedia/wikipedia/filename-matcher';
import { logger } from '@/utils/logger';

import {
  parseFilename,
  extractVolumeNumber,
  extractChapterNumber,
} from './base-filename-matcher';

import type {
  FilenameMatchRequest,
  FilenameMatchResult,
  VolumeForMatching,
  ChapterForMatching,
  SupportedProvider,
  BatchMatchResult,
  BatchProgressCallback,
} from './types';

// ============================================================================
// Types
// ============================================================================

// Re-export types for convenience
export type { FilenameMatchRequest, FilenameMatchResult, SupportedProvider };

/**
 * Options for the unified filename matcher
 */
export interface UnifiedMatcherOptions {
  /** Auto-match threshold for all providers (default: 0.85) */
  autoMatchThreshold?: number | undefined;
  /** ComicVine API key (required for ComicVine API searches) */
  comicVineApiKey?: string | undefined;
}

/**
 * Context for matching operation
 */
export interface MatchContext {
  /** The provider being used */
  provider: SupportedProvider;
  /** Series title for reference */
  seriesTitle?: string | undefined;
  /** Local directory path */
  localDirectory?: string | undefined;
}

// ============================================================================
// Main Unified Matcher Class
// ============================================================================

/**
 * Unified Filename Matcher
 *
 * Provides a single interface for matching files to volumes
 * across all supported providers (ComicVine, Fandom, Wikipedia).
 */
export class UnifiedFilenameMatcher {
  private comicVineMatcher: ComicVineFilenameMatcher | null = null;
  private fandomMatcher: FandomFilenameMatcher;
  private wikipediaMatcher: WikipediaFilenameMatcher;
  private defaultThreshold: number;

  constructor(options: UnifiedMatcherOptions = {}) {
    this.defaultThreshold = options.autoMatchThreshold ?? 0.85;

    // Initialize ComicVine matcher only if API key provided
    if (options.comicVineApiKey) {
      this.comicVineMatcher = new ComicVineFilenameMatcher({
        apiKey: options.comicVineApiKey,
        autoMatchThreshold: this.defaultThreshold,
      });
    }

    // Initialize other matchers (no API key needed)
    this.fandomMatcher = new FandomFilenameMatcher({
      autoMatchThreshold: this.defaultThreshold,
    });

    this.wikipediaMatcher = new WikipediaFilenameMatcher({
      autoMatchThreshold: this.defaultThreshold,
    });
  }

  /**
   * Match files to volumes using the appropriate provider matcher
   *
   * @param files - Array of parsed filename data or raw filenames
   * @param volumes - Array of volume data
   * @param provider - The provider to use for matching
   * @returns Array of match results
   */
  matchFilesToVolumes(
    files: FilenameMatchRequest[] | string[],
    volumes: VolumeForMatching[],
    provider: SupportedProvider
  ): FilenameMatchResult[] {
    // Parse raw filenames if needed
    const parsedFiles = this.ensureParsedFiles(files);

    logger.info(`[UnifiedFilenameMatcher] Matching ${parsedFiles.length} files using ${provider} matcher`);

    switch (provider) {
      case 'comicvine':
        return this.matchWithComicVine(parsedFiles, volumes);

      case 'fandom':
        return this.matchWithFandom(parsedFiles, volumes as FandomVolumeData[]);

      case 'wikipedia':
        return this.matchWithWikipedia(parsedFiles, volumes as WikipediaVolumeData[]);

      default:
        logger.warn(`[UnifiedFilenameMatcher] Unknown provider: ${provider}, falling back to Fandom`);
        return this.matchWithFandom(parsedFiles, volumes as FandomVolumeData[]);
    }
  }

  /**
   * Match files to chapters (flat chapter array)
   * Currently only Fandom supports this directly
   *
   * @param files - Array of parsed filename data or raw filenames
   * @param chapters - Array of chapter data
   * @returns Map of chapter number to matched file
   */
  matchFilesToChapters(
    files: FilenameMatchRequest[] | string[],
    chapters: ChapterForMatching[]
  ): Map<number, FilenameMatchRequest> {
    const parsedFiles = this.ensureParsedFiles(files);
    return this.fandomMatcher.matchFilesToChapters(parsedFiles, chapters);
  }

  /**
   * Batch match files with progress tracking
   *
   * @param files - Array of parsed filename data or raw filenames
   * @param volumes - Array of volume data
   * @param provider - The provider to use for matching
   * @param onProgress - Optional progress callback
   * @returns Batch match result with statistics
   */
  batchMatchFilesToVolumes(
    files: FilenameMatchRequest[] | string[],
    volumes: VolumeForMatching[],
    provider: SupportedProvider,
    onProgress?: BatchProgressCallback
  ): BatchMatchResult {
    const startTime = Date.now();
    const parsedFiles = this.ensureParsedFiles(files);

    const results: FilenameMatchResult[] = [];
    let autoMatchedCount = 0;
    let partialMatchCount = 0;
    let unmatchedCount = 0;

    for (let i = 0; i < parsedFiles.length; i++) {
      const file = parsedFiles[i];
      if (!file) continue;

      // Report progress
      onProgress?.({
        current: i + 1,
        total: parsedFiles.length,
        currentFile: file.filename,
      });

      // Match single file
      const singleResults = this.matchFilesToVolumes([file], volumes, provider);
      const result = singleResults[0];

      if (result) {
        results.push(result);

        // Categorize result
        if (result.bestMatch) {
          autoMatchedCount++;
        } else if (result.matches.length > 0) {
          partialMatchCount++;
        } else {
          unmatchedCount++;
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    logger.info(
      `[UnifiedFilenameMatcher] Batch complete: ` +
      `${autoMatchedCount} auto-matched, ${partialMatchCount} partial, ${unmatchedCount} unmatched ` +
      `(${processingTimeMs}ms)`
    );

    return {
      results,
      autoMatchedCount,
      partialMatchCount,
      unmatchedCount,
      processingTimeMs,
    };
  }

  /**
   * Create a volume-to-file mapping from match results
   *
   * @param results - Array of match results
   * @returns Map of volume number to file path
   */
  createVolumeFileMapping(
    results: FilenameMatchResult[]
  ): Map<number, string> {
    const mapping = new Map<number, string>();

    for (const result of results) {
      if (result.bestMatch) {
        mapping.set(result.bestMatch.volumeNumber, result.file.filename);
      }
    }

    return mapping;
  }

  /**
   * Create a chapter-to-file mapping from volume match results
   * Maps files to chapters based on volume assignment
   *
   * @param results - Array of match results
   * @param volumeToChapters - Map of volume number to chapter numbers
   * @returns Map of chapter number to file path
   */
  createChapterFileMapping(
    results: FilenameMatchResult[],
    volumeToChapters: Map<number, number[]>
  ): Map<number, string> {
    const mapping = new Map<number, string>();

    for (const result of results) {
      if (!result.bestMatch) continue;

      const volumeNumber = result.bestMatch.volumeNumber;
      const chapters = volumeToChapters.get(volumeNumber);

      if (chapters) {
        // Assign file to all chapters in this volume
        for (const chapterNum of chapters) {
          mapping.set(chapterNum, result.file.filename);
        }
      }
    }

    return mapping;
  }

  /**
   * Parse raw filenames into FilenameMatchRequest objects
   */
  parseFilenames(filenames: string[]): FilenameMatchRequest[] {
    return filenames.map(parseFilename);
  }

  /**
   * Update the auto-match threshold for all matchers
   */
  setThreshold(threshold: number): void {
    this.defaultThreshold = threshold;
    this.fandomMatcher.setThreshold(threshold);
    this.wikipediaMatcher.setThreshold(threshold);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Ensure files are parsed FilenameMatchRequest objects
   */
  private ensureParsedFiles(
    files: FilenameMatchRequest[] | string[]
  ): FilenameMatchRequest[] {
    if (files.length === 0) return [];

    // Check if first item is a string
    if (typeof files[0] === 'string') {
      return (files as string[]).map(parseFilename);
    }

    return files as FilenameMatchRequest[];
  }

  /**
   * Match using ComicVine matcher (preloaded volumes, no API search)
   */
  private matchWithComicVine(
    files: FilenameMatchRequest[],
    volumes: VolumeForMatching[]
  ): FilenameMatchResult[] {
    // Use the preloaded volume matching method
    if (this.comicVineMatcher) {
      return this.comicVineMatcher.matchFilesToPreloadedVolumes(files, volumes);
    }

    // Fallback: create a temporary matcher without API capabilities
    const tempMatcher = new ComicVineFilenameMatcher({
      apiKey: '', // Empty key - won't be used for preloaded matching
      autoMatchThreshold: this.defaultThreshold,
    });

    return tempMatcher.matchFilesToPreloadedVolumes(files, volumes);
  }

  /**
   * Match using Fandom matcher
   */
  private matchWithFandom(
    files: FilenameMatchRequest[],
    volumes: FandomVolumeData[]
  ): FilenameMatchResult[] {
    return this.fandomMatcher.matchFilesToVolumes(files, volumes);
  }

  /**
   * Match using Wikipedia matcher
   */
  private matchWithWikipedia(
    files: FilenameMatchRequest[],
    volumes: WikipediaVolumeData[]
  ): FilenameMatchResult[] {
    return this.wikipediaMatcher.matchFilesToVolumes(files, volumes);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let unifiedMatcherInstance: UnifiedFilenameMatcher | null = null;

/**
 * Get or create the singleton UnifiedFilenameMatcher instance
 */
export function getUnifiedFilenameMatcher(
  options?: UnifiedMatcherOptions
): UnifiedFilenameMatcher {
  if (!unifiedMatcherInstance || options) {
    unifiedMatcherInstance = new UnifiedFilenameMatcher(options);
  }
  return unifiedMatcherInstance;
}

/**
 * Utility function for quick file-to-volume matching
 */
export function matchFilesToVolumes(
  files: FilenameMatchRequest[] | string[],
  volumes: VolumeForMatching[],
  provider: SupportedProvider
): FilenameMatchResult[] {
  const matcher = getUnifiedFilenameMatcher();
  return matcher.matchFilesToVolumes(files, volumes, provider);
}

/**
 * Utility function for parsing a single filename
 */
export function parseFile(filename: string): FilenameMatchRequest {
  return parseFilename(filename);
}

/**
 * Re-export parsing utilities
 */
export {
  parseFilename,
  extractVolumeNumber,
  extractChapterNumber,
};
