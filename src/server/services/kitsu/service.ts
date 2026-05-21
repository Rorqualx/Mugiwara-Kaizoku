/**
 * Kitsu Service
 *
 * High-level service for kitsu.io. Mirrors MangaUpdates/AniList shape:
 * search → match → details. Read-only; no auth.
 */

import { logger } from '@/utils/logger';

import * as client from './client';

import type { KitsuManga } from './types';

const log = logger.child('KitsuService');

class KitsuService {
  async searchManga(title: string, limit: number = 5): Promise<KitsuManga[]> {
    try {
      const response = await client.searchManga(title, limit);
      return response.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      log.error(`Kitsu search failed for "${title}": ${message}`);
      return [];
    }
  }

  async getMangaDetails(id: string): Promise<KitsuManga | null> {
    try {
      const response = await client.getMangaDetails(id);
      return response.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      log.error(`Kitsu details fetch failed for id=${id}: ${message}`);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    return client.isAvailable();
  }
}

export const kitsuService = new KitsuService();
