/**
 * MangaDex Search Provider
 *
 * Thin BaseSearchProvider wrapper around `MangaDexProviderStrategy` so the
 * UnifiedProviderRegistry can include MangaDex in the wizard's Detect & Match
 * candidate pool. Returns `SearchResult[]` with `alternativeTitles` populated
 * (the M7 multi-title scoring in helpers.ts will use them).
 */
import { MetadataProvider } from '@prisma/client';

import { MangaDexProviderStrategy } from '@/server/services/providers/strategies/MangaDexProviderStrategy';
import type { SearchResult, SearchOptions } from '@/types/search.types';
import { isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { BaseSearchProvider } from './BaseSearchProvider';

export class MangaDexProvider extends BaseSearchProvider {
  name = 'mangadex';
  type = MetadataProvider.MANGADEX;
  private readonly strategy = new MangaDexProviderStrategy();

  override async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const result = await this.strategy.search(query, options);
    if (isSuccess(result)) {
      return result.data.map((r) => ({ ...r, provider: 'mangadex' }));
    }
    const reason = isError(result) ? result.error.message : 'unknown async-result state';
    logger.warn(`MangaDex search returned no data for "${query}": ${reason}`);
    return [];
  }

  override async getMetadata(id: string, _title?: string): Promise<SearchResult> {
    const result = await this.strategy.getMetadata(id);
    if (!isSuccess(result)) {
      const reason = isError(result) ? result.error.message : 'unknown async-result state';
      throw new Error(`MangaDex getMetadata failed for ${id}: ${reason}`);
    }
    const m = result.data;
    return {
      id,
      title: m.title,
      type: 'manga',
      provider: 'mangadex',
      coverImage: m.coverImage ?? m.cover ?? '',
      description: m.description ?? '',
      ...(m.alternativeTitles ? { alternativeTitles: m.alternativeTitles } : {}),
      ...(m.year !== undefined ? { year: m.year } : {}),
      ...(m.status !== undefined ? { status: m.status } : {}),
      ...(m.chapters !== undefined ? { chapters: m.chapters } : {}),
      ...(m.volumes !== undefined ? { volumes: m.volumes } : {}),
      ...(m.genres ? { genres: m.genres } : {}),
      ...(m.authors ? { authors: m.authors } : {}),
      ...(m.artists ? { artists: m.artists } : {}),
    };
  }
}

export const mangadexProvider = new MangaDexProvider();
