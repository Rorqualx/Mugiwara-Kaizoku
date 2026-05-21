/**
 * MangaUpdates Service
 *
 * High-level service for interacting with MangaUpdates.
 * Provides search, metadata retrieval, and availability checks.
 * Follows the same pattern as ComicVine and AniList services.
 */

import { logger } from '@/utils/logger';

import * as client from './client';

import type {
  MUReleaseRecord,
  MUSearchHit,
  MUSearchResponse,
  MUSeriesDetails,
} from './types';

const log = logger.child('MangaUpdatesService');

// ============================================================================
// Service Class
// ============================================================================

class MangaUpdatesService {
  private available: boolean | null = null;

  /**
   * Search for manga series on MangaUpdates.
   *
   * @param title - Search query
   * @param limit - Max results
   * @returns Array of search hits
   */
  async searchSeries(title: string, limit: number = 5): Promise<MUSearchHit[]> {
    try {
      const response: MUSearchResponse = await client.searchSeries(title, limit);
      return response.results;
    } catch (error: unknown) {
      log.error('MangaUpdates search failed', {
        title,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get full series details by ID.
   *
   * @param seriesId - MangaUpdates series ID
   * @returns Series details or null on failure
   */
  async getSeriesDetails(seriesId: number): Promise<MUSeriesDetails | null> {
    try {
      return await client.getSeriesDetails(seriesId);
    } catch (error: unknown) {
      log.error('MangaUpdates details fetch failed', {
        seriesId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get recent releases for a series, filtered by MU series ID.
   * Searches by title then filters results to the specific series.
   *
   * @param title - Series title for search
   * @param seriesId - MangaUpdates series ID to filter by
   * @param limit - Max releases to return (default 50)
   * @returns Release records sorted by date descending
   */
  async getRecentReleases(
    title: string,
    seriesId: number,
    limit: number = 50,
  ): Promise<MUReleaseRecord[]> {
    try {
      const response = await client.searchReleases(title, 40);
      const filtered = response.results
        .filter(hit => hit.metadata?.series.series_id === seriesId)
        .map(hit => hit.record)
        .sort((a, b) => b.release_date.localeCompare(a.release_date));

      log.info('MangaUpdates releases filtered', {
        title,
        seriesId,
        totalHits: response.total_hits,
        matched: filtered.length,
      });

      return filtered.slice(0, limit);
    } catch (error: unknown) {
      log.error('MangaUpdates release search failed', {
        title,
        seriesId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Check if MangaUpdates API is reachable.
   * Result is cached until the service is re-instantiated.
   */
  async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;

    this.available = await client.isAvailable();
    log.info('MangaUpdates availability', { available: this.available });
    return this.available;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const mangaUpdatesService = new MangaUpdatesService();
export type { MUReleaseRecord, MUSearchHit, MUSeriesDetails };
