/**
 * MangaDex Config Service
 *
 * Manages MangaDex provider configuration stored in the Config table under
 * the `mangadex.*` namespace. The provider has two roles — metadata
 * enrichment and chapter download — that share `preferredLanguage` and
 * `rateLimit` but otherwise have independent settings (and independent
 * enable toggles).
 *
 * @module server/services/mangadex/configService
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import {
  DEFAULT_MANGADEX_CONFIG,
  DEFAULT_MANGADEX_DOWNLOAD_CONFIG,
  DEFAULT_MANGADEX_METADATA_CONFIG,
} from './types';

import type {
  ContentRating,
  MangaDexConfig,
  MangaDexDownloadConfig,
  MangaDexMetadataConfig,
} from './types';

const log = logger.child('MangaDexConfigService');

// Config keys — `mangadex.*` namespace.
// `mangadex.enabled` is the metadata-provider toggle (consistent with
// `anilist.enabled`, `comicvine.enabled`, …) and is also written by
// `useProviderEnabled('mangadex')` on the metadata-providers page.
// `mangadex.download.enabled` is the indexer/download toggle, owned by
// the indexers settings page.
const CONFIG_KEYS = {
  METADATA_ENABLED: 'mangadex.enabled',
  DOWNLOAD_ENABLED: 'mangadex.download.enabled',
  PREFERRED_LANGUAGE: 'mangadex.preferredLanguage',
  INCLUDE_ADULT: 'mangadex.includeAdult',
  DEFAULT_CONTENT_RATING: 'mangadex.defaultContentRating',
  DATA_SAVER_MODE: 'mangadex.dataSaverMode',
  RATE_LIMIT_MAX: 'mangadex.rateLimit.maxRequests',
  RATE_LIMIT_INTERVAL: 'mangadex.rateLimit.perMilliseconds',
} as const;

const VALID_CONTENT_RATINGS: readonly ContentRating[] = ['safe', 'suggestive', 'erotica', 'pornographic'];

/**
 * MangaDex Configuration Service
 */
class MangaDexConfigService {
  private configCache: MangaDexConfig | null = null;
  private cacheExpiration: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get the full MangaDex configuration (both roles + shared fields).
   * Use the role-specific accessors below when only one slice is needed.
   */
  async getConfig(): Promise<MangaDexConfig> {
    const now = Date.now();
    if (this.configCache && this.cacheExpiration > now) {
      return this.configCache;
    }

    try {
      const config = await this.loadConfig();
      this.configCache = config;
      this.cacheExpiration = now + this.CACHE_DURATION;
      return config;
    } catch (error: unknown) {
      log.error('Failed to load MangaDex config, using defaults', { error });
      return DEFAULT_MANGADEX_CONFIG;
    }
  }

  /** Get the metadata-side slice of the config. */
  async getMetadataConfig(): Promise<MangaDexMetadataConfig> {
    const full = await this.getConfig();
    return {
      enabled: full.metadataEnabled,
      preferredLanguage: full.preferredLanguage,
      includeAdult: full.includeAdult,
      defaultContentRating: full.defaultContentRating,
      rateLimit: full.rateLimit,
    };
  }

  /** Get the download-side slice of the config. */
  async getDownloadConfig(): Promise<MangaDexDownloadConfig> {
    const full = await this.getConfig();
    return {
      enabled: full.downloadEnabled,
      preferredLanguage: full.preferredLanguage,
      dataSaverMode: full.dataSaverMode,
      rateLimit: full.rateLimit,
    };
  }

  /** Is MangaDex enabled as a metadata provider? */
  async isMetadataEnabled(): Promise<boolean> {
    const full = await this.getConfig();
    return full.metadataEnabled;
  }

  /** Is MangaDex enabled as a download source? */
  async isDownloadEnabled(): Promise<boolean> {
    const full = await this.getConfig();
    return full.downloadEnabled;
  }

  /**
   * Update metadata-only fields. `preferredLanguage` is shared with the
   * download role — writing it here also affects chapter downloads.
   */
  async updateMetadataConfig(updates: Partial<MangaDexMetadataConfig>): Promise<void> {
    const writes: Array<[string, string]> = [];
    if (updates.enabled !== undefined) {
      writes.push([CONFIG_KEYS.METADATA_ENABLED, String(updates.enabled)]);
    }
    if (updates.preferredLanguage !== undefined) {
      writes.push([CONFIG_KEYS.PREFERRED_LANGUAGE, updates.preferredLanguage]);
    }
    if (updates.includeAdult !== undefined) {
      writes.push([CONFIG_KEYS.INCLUDE_ADULT, String(updates.includeAdult)]);
    }
    if (updates.defaultContentRating !== undefined) {
      writes.push([CONFIG_KEYS.DEFAULT_CONTENT_RATING, JSON.stringify(updates.defaultContentRating)]);
    }
    if (updates.rateLimit !== undefined) {
      writes.push(
        [CONFIG_KEYS.RATE_LIMIT_MAX, String(updates.rateLimit.maxRequests)],
        [CONFIG_KEYS.RATE_LIMIT_INTERVAL, String(updates.rateLimit.perMilliseconds)],
      );
    }
    await this.applyWrites(writes);
  }

  /**
   * Update download-only fields. `preferredLanguage` is shared with the
   * metadata role — writing it here also affects metadata search.
   */
  async updateDownloadConfig(updates: Partial<MangaDexDownloadConfig>): Promise<void> {
    const writes: Array<[string, string]> = [];
    if (updates.enabled !== undefined) {
      writes.push([CONFIG_KEYS.DOWNLOAD_ENABLED, String(updates.enabled)]);
    }
    if (updates.preferredLanguage !== undefined) {
      writes.push([CONFIG_KEYS.PREFERRED_LANGUAGE, updates.preferredLanguage]);
    }
    if (updates.dataSaverMode !== undefined) {
      writes.push([CONFIG_KEYS.DATA_SAVER_MODE, String(updates.dataSaverMode)]);
    }
    if (updates.rateLimit !== undefined) {
      writes.push(
        [CONFIG_KEYS.RATE_LIMIT_MAX, String(updates.rateLimit.maxRequests)],
        [CONFIG_KEYS.RATE_LIMIT_INTERVAL, String(updates.rateLimit.perMilliseconds)],
      );
    }
    await this.applyWrites(writes);
  }

  /** Reset every `mangadex.*` row to defaults. */
  async resetConfig(): Promise<void> {
    await prisma.config.deleteMany({
      where: { key: { startsWith: 'mangadex.' } },
    });
    this.invalidateCache();
    await this.notifyClientReset();
    log.info('MangaDex config reset to defaults');
  }

  invalidateCache(): void {
    this.configCache = null;
    this.cacheExpiration = 0;
  }

  // ==================== Private Helpers ====================

  private async loadConfig(): Promise<MangaDexConfig> {
    const configs = await prisma.config.findMany({
      where: { key: { startsWith: 'mangadex.' } },
    });
    const map = new Map(configs.map(c => [c.key, c.value]));
    return {
      metadataEnabled: this.parseBoolean(map.get(CONFIG_KEYS.METADATA_ENABLED), DEFAULT_MANGADEX_METADATA_CONFIG.enabled),
      downloadEnabled: this.parseBoolean(map.get(CONFIG_KEYS.DOWNLOAD_ENABLED), DEFAULT_MANGADEX_DOWNLOAD_CONFIG.enabled),
      preferredLanguage: map.get(CONFIG_KEYS.PREFERRED_LANGUAGE) ?? DEFAULT_MANGADEX_CONFIG.preferredLanguage,
      includeAdult: this.parseBoolean(map.get(CONFIG_KEYS.INCLUDE_ADULT), DEFAULT_MANGADEX_CONFIG.includeAdult),
      defaultContentRating: this.parseContentRating(map.get(CONFIG_KEYS.DEFAULT_CONTENT_RATING)),
      dataSaverMode: this.parseBoolean(map.get(CONFIG_KEYS.DATA_SAVER_MODE), DEFAULT_MANGADEX_CONFIG.dataSaverMode),
      rateLimit: {
        maxRequests: this.parseInt(map.get(CONFIG_KEYS.RATE_LIMIT_MAX), DEFAULT_MANGADEX_CONFIG.rateLimit.maxRequests),
        perMilliseconds: this.parseInt(map.get(CONFIG_KEYS.RATE_LIMIT_INTERVAL), DEFAULT_MANGADEX_CONFIG.rateLimit.perMilliseconds),
      },
    };
  }

  private async applyWrites(writes: Array<[string, string]>): Promise<void> {
    if (writes.length === 0) return;
    for (const [key, value] of writes) {
      // eslint-disable-next-line no-await-in-loop -- sequential upserts to keep ordering predictable
      await this.upsertConfig(key, value);
    }
    this.invalidateCache();
    await this.notifyClientReset();
  }

  /**
   * Reset the lazy MangaDex HTTP client so the next caller picks up new
   * config (rate limit in particular). Lazy-imported to avoid the
   * `configService` ↔ `ts-client-factory` circular import.
   */
  private async notifyClientReset(): Promise<void> {
    try {
      const { resetTsMangadexClient } = await import('./ts-client-factory');
      resetTsMangadexClient();
    } catch (error: unknown) {
      log.warn('Failed to reset MangaDex client after config update', { error });
    }
  }

  private async upsertConfig(key: string, value: string): Promise<void> {
    await prisma.config.upsert({
      where: { key },
      create: {
        key,
        value,
        valueType: 'STRING',
        scope: 'INTEGRATION',
        source: 'DATABASE',
      },
      update: { value },
    });
  }

  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1';
  }

  private parseInt(value: string | undefined, defaultValue: number): number {
    if (value === undefined) return defaultValue;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }

  private parseContentRating(value: string | undefined): ContentRating[] {
    if (!value) return DEFAULT_MANGADEX_CONFIG.defaultContentRating;
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return (parsed as unknown[]).filter((r): r is ContentRating =>
          typeof r === 'string' && VALID_CONTENT_RATINGS.includes(r as ContentRating),
        );
      }
    } catch {
      // ignore parse errors
    }
    return DEFAULT_MANGADEX_CONFIG.defaultContentRating;
  }
}

export const mangadexConfigService = new MangaDexConfigService();
