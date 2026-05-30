/**
 * Jikan Service
 *
 * High-level service for interacting with MyAnimeList via the Jikan API.
 * Provides manga metadata retrieval by MAL ID.
 * Follows the same pattern as MangaUpdates and AniList services.
 *
 * @module server/services/jikan/service
 */

import { logger } from '@/utils/logger';

import * as client from './client';
import { MAL_STATUS_MAP, type MALResult } from './types';

const log = logger.child('JikanService');

class JikanService {
  private available: boolean | null = null;

  /**
   * Get manga metadata by MyAnimeList ID.
   *
   * @param malId - MyAnimeList manga ID (positive integer)
   * @returns Normalized MAL result or null on failure
   */
  async getMangaByMALId(malId: number): Promise<MALResult | null> {
    try {
      const response = await client.fetchMangaById(malId);
      const data = response?.data;
      if (!data) return null;

      // Normalize genres (lowercase, deduped) + detect adult flag
      const genreNames = [
        ...(data.genres ?? []).map(g => g.name),
        ...(data.explicit_genres ?? []).map(g => g.name),
      ].filter((n): n is string => typeof n === 'string' && n.length > 0);
      const genres = [...new Set(genreNames.map(n => n.toLowerCase()))];
      const isAdult = (data.explicit_genres ?? []).length > 0
        || genres.some(g => g === 'hentai' || g === 'erotica' || g === 'adult');

      return {
        malId: data.mal_id ?? malId,
        title: data.title ?? 'Unknown',
        titleEnglish: data.title_english ?? null,
        titleJapanese: data.title_japanese ?? null,
        chapters: data.chapters ?? null,
        volumes: data.volumes ?? null,
        status: MAL_STATUS_MAP[data.status ?? ''] ?? 'UNKNOWN',
        score: data.score ?? null,
        // Phase 1: surfaced for Metadata.rating JSON aggregation.
        scoredBy: data.scored_by ?? null,
        rank: data.rank ?? null,
        genres,
        isAdult,
      };
    } catch (error: unknown) {
      log.error('Failed to fetch MAL data', {
        malId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Phase 5 Sprint #2: fetch MAL recommendations for a manga.
   * Returns a normalized list mirroring AL's recommendation shape so the
   * shared MangaRecommendation table can carry both sources.
   */
  async getMangaRecommendationsByMALId(malId: number): Promise<Array<{
    anilistId: number; // legacy field name in resolver — carries malId here
    title: string;
    format: string | null;
    coverUrl: string | null;
    medium: 'MANGA' | 'ANIME' | 'NOVEL' | 'OTHER' | null;
    rating: number | null;
  }>> {
    try {
      const response = await client.fetchRecommendationsByMALId(malId);
      const entries = response?.data ?? [];
      const out: Array<{
        anilistId: number;
        title: string;
        format: string | null;
        coverUrl: string | null;
        medium: 'MANGA' | 'ANIME' | 'NOVEL' | 'OTHER' | null;
        rating: number | null;
      }> = [];
      for (const item of entries.slice(0, 20)) {
        const e = item.entry;
        if (!e || typeof e.mal_id !== 'number' || typeof e.title !== 'string') continue;
        const cover = e.images?.jpg?.large_image_url ?? e.images?.jpg?.image_url ?? null;
        out.push({
          anilistId: e.mal_id, // resolver's legacy param name
          title: e.title,
          format: null,
          coverUrl: cover,
          medium: 'MANGA', // Jikan recommendations endpoint scope is manga-to-manga
          rating: typeof item.votes === 'number' ? item.votes : null,
        });
      }
      return out;
    } catch (error: unknown) {
      log.warn('Failed to fetch MAL recommendations', {
        malId, error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Check if the Jikan API is reachable.
   * Result is cached until the service is re-instantiated.
   */
  async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;

    this.available = await client.isAvailable();
    log.info('Jikan availability', { available: this.available });
    return this.available;
  }
}

export const jikanService = new JikanService();
export type { MALResult } from './types';
