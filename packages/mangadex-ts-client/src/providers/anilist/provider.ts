/**
 * AniList MetadataProvider implementation
 */

import { MetadataProvider, SearchResult, ProviderResult, ProviderConfig } from '../../types/provider';
import { CoverImages } from '../../types/metadata';
import { AniListClient, AniListClientConfig } from './client';
import { mapAniListMedia } from './mapper';

export class AniListProvider implements MetadataProvider {
  readonly source = 'anilist' as const;
  private readonly client: AniListClient;

  constructor(_config?: ProviderConfig) {
    this.client = new AniListClient();
  }

  isAvailable(): boolean {
    return true; // No API key needed
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const results = await this.client.searchManga(query, limit);

    return results.map((media) => ({
      id: String(media.id),
      title: media.title.english || media.title.romaji || media.title.native || 'Unknown',
      altTitles: media.synonyms?.filter((s): s is string => !!s),
      description: media.description ?? undefined,
      coverImage: media.coverImage?.extraLarge || media.coverImage?.large || undefined,
      year: media.startDate?.year ?? undefined,
      status: media.status ?? undefined,
      source: 'anilist' as const,
    }));
  }

  async getMetadata(id: string): Promise<ProviderResult> {
    const media = await this.client.getMangaDetails(Number(id));
    const mapped = mapAniListMedia(media);

    return {
      manga: mapped,
      source: 'anilist',
      confidence: 0.9,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getCovers(id: string): Promise<CoverImages> {
    const media = await this.client.getMangaDetails(Number(id));
    return {
      original: media.coverImage?.extraLarge ?? undefined,
      large: media.coverImage?.extraLarge ?? media.coverImage?.large ?? undefined,
      medium: media.coverImage?.large ?? media.coverImage?.medium ?? undefined,
      small: media.coverImage?.medium ?? undefined,
      color: media.coverImage?.color ?? undefined,
    };
  }

  getClient(): AniListClient {
    return this.client;
  }
}
