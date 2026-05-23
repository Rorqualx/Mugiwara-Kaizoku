/**
 * MangaUpdates Search Provider
 *
 * Thin BaseSearchProvider wrapper around `MangaUpdatesProviderStrategy`.
 * MU's search response doesn't include associated names — the manga is
 * resolved on primary title alone, which is fine for most cases because
 * MU's canonical title typically matches user folder names directly.
 * Detail fetches (which expose `associated`) happen later through the
 * separate metadata-enrichment path, not the wizard's match pool.
 */
import { MetadataProvider } from '@prisma/client';

import { MangaUpdatesProviderStrategy } from '@/server/services/providers/strategies/MangaUpdatesProviderStrategy';
import type { SearchResult, SearchOptions } from '@/types/search.types';
import { isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { BaseSearchProvider } from './BaseSearchProvider';

export class MangaUpdatesProvider extends BaseSearchProvider {
  name = 'mangaupdates';
  type = MetadataProvider.MANGAUPDATES;
  private readonly strategy = new MangaUpdatesProviderStrategy();

  override async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const result = await this.strategy.search(query, options);
    if (isSuccess(result)) {
      return result.data.map((r) => ({ ...r, provider: 'mangaupdates' }));
    }
    const reason = isError(result) ? result.error.message : 'unknown async-result state';
    logger.warn(`MangaUpdates search returned no data for "${query}": ${reason}`);
    return [];
  }

  override async getMetadata(id: string, _title?: string): Promise<SearchResult> {
    const result = await this.strategy.getMetadata(id);
    if (!isSuccess(result)) {
      const reason = isError(result) ? result.error.message : 'unknown async-result state';
      throw new Error(`MangaUpdates getMetadata failed for ${id}: ${reason}`);
    }
    const m = result.data;
    return {
      id,
      title: m.title,
      type: 'manga',
      provider: 'mangaupdates',
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
      ...(m.publisher ? { publisher: m.publisher } : {}),
    };
  }
}

export const mangaupdatesProvider = new MangaUpdatesProvider();
