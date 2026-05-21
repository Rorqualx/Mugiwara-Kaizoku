/**
 * MangaDex MetadataProvider implementation
 */

import { MetadataProvider, SearchResult, ProviderResult, ProviderConfig } from '../../types/provider';
import { CoverImages } from '../../types/metadata';
import { MangaDexClient, MangaDexClientConfig, createDefaultClient } from './client';
import { Manga, Chapter } from './types';
import { mapMangaDexManga } from './mapper';

export class MangaDexProvider implements MetadataProvider {
  readonly source = 'mangadex' as const;
  private readonly client: MangaDexClient;

  constructor(client?: MangaDexClient, _config?: ProviderConfig) {
    this.client = client || createDefaultClient();
  }

  isAvailable(): boolean {
    return true; // No API key needed
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const response = await this.client.searchManga({
      title: query,
      limit,
      includes: ['cover_art', 'author', 'artist'],
    });

    const mangaList = Array.isArray(response.data) ? response.data : [response.data];

    return mangaList.map((manga) => {
      const coverRel = manga.relationships.find((r) => r.type === 'cover_art');
      const fileName = coverRel?.attributes?.['fileName'] as string | undefined;

      return {
        id: manga.id,
        title: this.client.getEnglishTitle(manga),
        altTitles: manga.attributes.altTitles.flatMap((t) =>
          Object.values(t).filter((v): v is string => !!v)
        ),
        description: this.client.getEnglishDescription(manga),
        coverImage: fileName
          ? this.client.getCoverUrl(manga.id, { fileName }, '512')
          : undefined,
        year: manga.attributes.year,
        status: manga.attributes.status,
        source: 'mangadex' as const,
      };
    });
  }

  async getMetadata(id: string): Promise<ProviderResult> {
    // Fetch manga with relationships
    const mangaResponse = await this.client.getManga(id, [
      'author',
      'artist',
      'cover_art',
    ]);

    const manga: Manga = Array.isArray(mangaResponse.data)
      ? mangaResponse.data[0]!
      : mangaResponse.data;

    // Fetch additional data in parallel
    const [statisticsRes, aggregate, covers, allChapters] = await Promise.all([
      this.client.getStatistics(id).catch(() => undefined),
      this.client.getMangaAggregate(id, ['en']).catch((err) => {
        console.warn(`[MangaDexProvider] Failed to fetch aggregate for ${id}:`, err instanceof Error ? err.message : err);
        return undefined;
      }),
      this.client.getAllCovers(id).catch((err) => {
        console.warn(`[MangaDexProvider] Failed to fetch covers for ${id}:`, err instanceof Error ? err.message : err);
        return [];
      }),
      this.client.getAllChapters(id, 'en').catch((err) => {
        console.warn(`[MangaDexProvider] Failed to fetch chapters for ${id}:`, err instanceof Error ? err.message : err);
        return [];
      }),
    ]);

    const statistics = statisticsRes?.statistics?.[id];

    // Deduplicate: one chapter per chapter number (first = most established group)
    const chapterMap = new Map<string, Chapter>();
    for (const ch of allChapters) {
      if (!ch?.attributes) continue;
      const num = ch.attributes.chapter;
      if (num && !chapterMap.has(num)) {
        chapterMap.set(num, ch);
      }
    }
    const chapters = Array.from(chapterMap.values());

    const mapped = mapMangaDexManga(manga, this.client, {
      statistics,
      covers,
      aggregate,
      chapters,
    });

    return {
      manga: mapped,
      source: 'mangadex',
      confidence: 1.0,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getCovers(id: string): Promise<CoverImages> {
    const covers = await this.client.getAllCovers(id);
    if (covers.length === 0) return {};

    const first = covers[0]!;
    return {
      original: this.client.getCoverUrl(id, first.attributes, 'original'),
      large: this.client.getCoverUrl(id, first.attributes, '512'),
      medium: this.client.getCoverUrl(id, first.attributes, '256'),
    };
  }

  /** Expose raw client for advanced usage */
  getClient(): MangaDexClient {
    return this.client;
  }
}
