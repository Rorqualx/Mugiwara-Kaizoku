/**
 * ComicVine Filename Matcher Service
 *
 * Matches parsed filename data to ComicVine volumes using native download's
 * matching patterns: title normalization, year matching, volume number scoring.
 *
 * @module server/services/comicvine/comicvine/filename-matcher
 */

/* eslint-disable no-await-in-loop -- Sequential searches required for rate limiting */

import {
  calculateTitleScore,
  calculateYearScore,
  calculateVolumeScore,
  groupFilesByTitle,
  sleep,
} from '@/server/services/matching/base-filename-matcher';
import type {
  FilenameMatchRequest,
  FilenameMatchResult,
  VolumeForMatching,
} from '@/server/services/matching/types';
import { logger } from '@/utils/logger';

import type { ComicVineVolume, ComicVineListResponse } from './types';

// ============================================================================
// Types
// ============================================================================

// Re-export types for backward compatibility
export type { FilenameMatchRequest, FilenameMatchResult };

/**
 * A matched volume with scoring details (ComicVine-specific)
 */
export interface ComicVineMatchedVolume {
  /** ComicVine volume data */
  volume: ComicVineVolume;
  /** Match confidence score (0-1) */
  confidence: number;
  /** Breakdown of how the score was calculated */
  scoreBreakdown: {
    titleMatch: number;
    yearMatch: number;
    volumeMatch: number;
  };
}

/**
 * ComicVine-specific match result
 */
export interface ComicVineMatchResult {
  /** Original request */
  file: FilenameMatchRequest;
  /** Matching volumes sorted by confidence */
  matches: ComicVineMatchedVolume[];
  /** Best match if confidence >= threshold */
  bestMatch?: ComicVineMatchedVolume | undefined;
  /** Overall confidence score (0-1) */
  confidence: number;
}

/**
 * Options for the ComicVine filename matcher
 */
export interface ComicVineMatcherOptions {
  /** ComicVine API key */
  apiKey: string;
  /** Minimum confidence threshold for auto-match (default: 0.95) */
  autoMatchThreshold?: number | undefined;
  /** Maximum results per search (default: 10) */
  maxResultsPerSearch?: number | undefined;
  /** Delay between searches in ms (default: 2000) */
  searchDelayMs?: number | undefined;
}

// ============================================================================
// Constants
// ============================================================================

/** Default configuration */
const DEFAULT_AUTO_MATCH_THRESHOLD = 0.95;
const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_SEARCH_DELAY_MS = 2000;

/** ComicVine-specific scoring weights */
const COMICVINE_WEIGHTS = {
  title: 0.50,
  year: 0.25,
  volume: 0.25,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build ComicVine API URL
 */
function buildApiUrl(
  apiKey: string,
  params: Record<string, string>
): string {
  const baseUrl = 'https://comicvine.gamespot.com/api/search/';
  const url = new URL(baseUrl);

  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('resources', 'volume');
  url.searchParams.set('field_list', 'id,name,image,start_year,publisher,count_of_issues,deck,site_detail_url,volume_number');

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

/**
 * Calculate overall match confidence for ComicVine
 * Weighted combination: Title (50%) + Year (25%) + Volume (25%)
 */
function calculateComicVineConfidence(breakdown: {
  titleMatch: number;
  yearMatch: number;
  volumeMatch: number;
}): number {
  return (
    breakdown.titleMatch * COMICVINE_WEIGHTS.title +
    breakdown.yearMatch * COMICVINE_WEIGHTS.year +
    breakdown.volumeMatch * COMICVINE_WEIGHTS.volume
  );
}

// ============================================================================
// Main Matcher Class
// ============================================================================

/**
 * ComicVine Filename Matcher
 *
 * Matches parsed filename data to ComicVine volumes using
 * title normalization, year matching, and volume number scoring.
 */
export class ComicVineFilenameMatcher {
  private apiKey: string;
  private autoMatchThreshold: number;
  private maxResultsPerSearch: number;
  private searchDelayMs: number;

  // Cache to avoid duplicate searches for same title
  private searchCache: Map<string, ComicVineVolume[]> = new Map();

  constructor(options: ComicVineMatcherOptions) {
    this.apiKey = options.apiKey;
    this.autoMatchThreshold = options.autoMatchThreshold ?? DEFAULT_AUTO_MATCH_THRESHOLD;
    this.maxResultsPerSearch = options.maxResultsPerSearch ?? DEFAULT_MAX_RESULTS;
    this.searchDelayMs = options.searchDelayMs ?? DEFAULT_SEARCH_DELAY_MS;
  }

  /**
   * Match multiple files to ComicVine volumes
   *
   * Groups files by title to avoid duplicate searches (Kapowarr pattern)
   *
   * @param files - Array of parsed filename data
   * @returns Array of match results
   */
  async matchFilesToVolumes(
    files: FilenameMatchRequest[]
  ): Promise<ComicVineMatchResult[]> {
    logger.info(`[ComicVineFilenameMatcher] Matching ${files.length} files to ComicVine volumes`);

    // Group files by normalized title to reduce API calls
    const filesByTitle = groupFilesByTitle(files);

    logger.info(`[ComicVineFilenameMatcher] Grouped into ${filesByTitle.size} unique titles`);

    const results: ComicVineMatchResult[] = [];

    // Search each unique title once
    let searchCount = 0;
    for (const [normalizedTitle, titleFiles] of filesByTitle.entries()) {
      // Use first file's title for search (original, not normalized)
      const firstFile = titleFiles[0];
      if (!firstFile) continue;

      const searchTitle = firstFile.title;

      // Check cache
      let volumes = this.searchCache.get(normalizedTitle);

      if (!volumes) {
        // Rate limiting delay (except for first search)
        if (searchCount > 0) {
          await sleep(this.searchDelayMs);
        }
        searchCount++;

        volumes = await this.searchForTitle(searchTitle);
        this.searchCache.set(normalizedTitle, volumes);
      }

      // Match each file against the volumes
      for (const file of titleFiles) {
        const matchResult = this.matchFileToVolumes(file, volumes);
        results.push(matchResult);
      }
    }

    // Log summary
    const autoMatched = results.filter(r => r.bestMatch !== undefined).length;
    logger.info(
      `[ComicVineFilenameMatcher] Complete: ${autoMatched}/${results.length} files auto-matched`
    );

    return results;
  }

  /**
   * Match files to pre-fetched volumes (no API search)
   * Used when volumes are already available from import wizard
   */
  matchFilesToPreloadedVolumes(
    files: FilenameMatchRequest[],
    volumes: VolumeForMatching[]
  ): FilenameMatchResult[] {
    logger.info(`[ComicVineFilenameMatcher] Matching ${files.length} files to ${volumes.length} preloaded volumes`);

    const results: FilenameMatchResult[] = [];

    for (const file of files) {
      const matchResult = this.matchFileToPreloadedVolumes(file, volumes);
      results.push(matchResult);
    }

    const autoMatched = results.filter(r => r.bestMatch !== undefined).length;
    logger.info(
      `[ComicVineFilenameMatcher] Complete: ${autoMatched}/${results.length} files auto-matched`
    );

    return results;
  }

  /**
   * Search ComicVine for volumes matching a title
   */
  private async searchForTitle(title: string): Promise<ComicVineVolume[]> {
    try {
      const url = buildApiUrl(this.apiKey, {
        query: title,
        limit: String(this.maxResultsPerSearch),
      });

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mugiwara-Kaizoku/1.0 (https://github.com/mugiwara-kaizoku)',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        logger.warn(`[ComicVineFilenameMatcher] Search failed for "${title}": HTTP ${response.status}`);
        return [];
      }

      const data = await response.json() as ComicVineListResponse<ComicVineVolume>;

      if (data.status_code !== 1 || !Array.isArray(data.results)) {
        logger.warn(`[ComicVineFilenameMatcher] API error for "${title}": ${data.error}`);
        return [];
      }

      logger.debug(`[ComicVineFilenameMatcher] Found ${data.results.length} volumes for "${title}"`);
      return data.results;

    } catch (error) {
      logger.error(
        `[ComicVineFilenameMatcher] Search error for "${title}":`,
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  /**
   * Match a single file against a list of ComicVine volumes
   */
  private matchFileToVolumes(
    file: FilenameMatchRequest,
    volumes: ComicVineVolume[]
  ): ComicVineMatchResult {
    if (volumes.length === 0) {
      return {
        file,
        matches: [],
        confidence: 0,
      };
    }

    // Score each volume
    const matches: ComicVineMatchedVolume[] = volumes.map(volume => {
      const volumeName = volume.name ?? '';
      const volumeYear = volume.start_year;
      // volume_number is typically the series iteration (e.g., "Volume 2" of a title)
      const volumeNumber = volume.volume_number;

      const scoreBreakdown = {
        titleMatch: calculateTitleScore(file.title, volumeName),
        yearMatch: calculateYearScore(file.year, volumeYear),
        volumeMatch: calculateVolumeScore(file.volume, volumeNumber),
      };

      const confidence = calculateComicVineConfidence(scoreBreakdown);

      return {
        volume,
        confidence,
        scoreBreakdown,
      };
    });

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);

    // Determine best match (if above threshold)
    const topMatch = matches[0];
    const bestMatch = topMatch && topMatch.confidence >= this.autoMatchThreshold
      ? topMatch
      : undefined;

    return {
      file,
      matches,
      bestMatch,
      confidence: topMatch?.confidence ?? 0,
    };
  }

  /**
   * Match a single file against preloaded volumes
   */
  private matchFileToPreloadedVolumes(
    file: FilenameMatchRequest,
    volumes: VolumeForMatching[]
  ): FilenameMatchResult {
    if (volumes.length === 0) {
      return {
        file,
        matches: [],
        confidence: 0,
      };
    }

    // Score each volume
    const matches = volumes.map(volume => {
      const volumeTitle = volume.title ?? volume.name ?? '';
      const volumeNumber = volume.volumeNumber ?? volume.number;

      // Extract year from release date if available
      let volumeYear: number | undefined;
      if (volume.year) {
        volumeYear = volume.year;
      } else if (volume.releaseDate) {
        const yearMatch = volume.releaseDate.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch) {
          volumeYear = parseInt(yearMatch[1] ?? '0', 10);
        }
      }

      const scoreBreakdown = {
        titleMatch: calculateTitleScore(file.title, volumeTitle),
        yearMatch: calculateYearScore(file.year, volumeYear),
        volumeMatch: calculateVolumeScore(file.volume, volumeNumber),
      };

      const confidence = calculateComicVineConfidence(scoreBreakdown);

      return {
        volumeNumber: volumeNumber ?? 0,
        title: volumeTitle,
        confidence,
        scoreBreakdown,
      };
    });

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);

    // Determine best match (if above threshold)
    const topMatch = matches[0];
    const bestMatch = topMatch && topMatch.confidence >= this.autoMatchThreshold
      ? topMatch
      : undefined;

    return {
      file,
      matches,
      bestMatch,
      confidence: topMatch?.confidence ?? 0,
    };
  }

  /**
   * Clear the search cache
   */
  clearCache(): void {
    this.searchCache.clear();
    logger.debug('[ComicVineFilenameMatcher] Cache cleared');
  }
}
