/**
 * ComicVine MetadataProvider implementation
 */

import { MetadataProvider, SearchResult, ProviderResult, ProviderConfig } from '../../types/provider';
import { CoverImages } from '../../types/metadata';
import { ComicVineClient, ComicVineClientConfig } from './client';
import { mapComicVineVolume } from './mapper';

/** Known English manga publishers (lowercase for matching) */
const ENGLISH_PUBLISHERS = new Set([
  'viz media', 'viz', 'kodansha comics', 'kodansha usa', 'kodansha',
  'yen press', 'seven seas entertainment', 'seven seas', 'dark horse comics',
  'dark horse', 'square enix', 'tokyopop', 'vertical', 'vertical comics',
  'shonen jump', 'j-novel club', 'one peace books', 'ghost ship',
  'denpa', 'fantagraphics', 'drawn & quarterly', 'ablaze',
  'shueisha', 'shogakukan', 'kadokawa', 'kodansha ltd.',
]);

/** Known non-English manga publishers (lowercase) */
const NON_ENGLISH_PUBLISHERS = new Set([
  'ki-oon', 'kana', 'glénat', 'glenat', 'delcourt', 'pika', 'kazé', 'kaze',
  'tonkam', 'kurokawa', 'dargaud', 'soleil', 'meian', 'panini',
  'planet manga', 'star comics', 'norma editorial', 'ivrea',
  'egmont', 'carlsen', 'tokyopop germany', 'altraverse',
]);

function isEnglishPublisher(name?: string): boolean {
  if (!name) return false;
  return ENGLISH_PUBLISHERS.has(name.toLowerCase().trim());
}

function isNonEnglishPublisher(name?: string): boolean {
  if (!name) return false;
  return NON_ENGLISH_PUBLISHERS.has(name.toLowerCase().trim());
}

export class ComicVineProvider implements MetadataProvider {
  readonly source = 'comicvine' as const;
  private readonly client: ComicVineClient | undefined;
  private readonly apiKey: string | undefined;

  constructor(config?: ProviderConfig) {
    this.apiKey = config?.apiKey;
    if (this.apiKey) {
      this.client = new ComicVineClient({
        apiKey: this.apiKey,
        cacheTtlMs: config?.cacheTtlMs,
      });
    }
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.client) return [];

    const results = await this.client.searchVolumes(query, limit);

    // Sort results: English publishers first, then unknown, then non-English
    const sorted = [...results].sort((a, b) => {
      const aEnglish = isEnglishPublisher(a.publisher?.name);
      const bEnglish = isEnglishPublisher(b.publisher?.name);
      const aNonEnglish = isNonEnglishPublisher(a.publisher?.name);
      const bNonEnglish = isNonEnglishPublisher(b.publisher?.name);

      if (aEnglish && !bEnglish) return -1;
      if (!aEnglish && bEnglish) return 1;
      if (aNonEnglish && !bNonEnglish) return 1;
      if (!aNonEnglish && bNonEnglish) return -1;
      return 0;
    });

    return sorted.map((r) => ({
      id: String(r.id),
      title: r.name,
      altTitles: r.aliases?.split('\n').filter(Boolean),
      description: r.deck,
      coverImage: r.image?.screen_large_url || r.image?.medium_url,
      year: r.start_year ? Number(r.start_year) : undefined,
      status: undefined,
      source: 'comicvine' as const,
    }));
  }

  async getMetadata(id: string): Promise<ProviderResult> {
    if (!this.client) {
      throw new Error('ComicVine provider not configured (no API key)');
    }

    const volumeId = Number(id);
    const volume = await this.client.getVolume(volumeId);

    // Fetch issues in parallel
    const issues = await this.client.getAllIssues(volumeId).catch(() => []);

    const mapped = mapComicVineVolume(volume, issues.length > 0 ? issues : undefined);

    return {
      manga: mapped,
      source: 'comicvine',
      confidence: 0.8,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getCovers(id: string): Promise<CoverImages> {
    if (!this.client) return {};

    const volume = await this.client.getVolume(Number(id));
    return {
      original: volume.image?.original_url,
      large: volume.image?.super_url || volume.image?.screen_large_url,
      medium: volume.image?.screen_url || volume.image?.medium_url,
      small: volume.image?.small_url,
    };
  }

  getClient(): ComicVineClient | undefined {
    return this.client;
  }
}
