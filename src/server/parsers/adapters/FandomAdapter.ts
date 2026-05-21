/**
 * Fandom Adapter
 * Specialized adapter for Fandom wiki sources using FandomService
 *
 * Integrates FandomService with the Unified Parser architecture
 */


import { MangaPublicationStatus } from '@prisma/client';

import { FandomService } from '@/server/services/fandom/FandomService';
import type { FandomMangaData } from '@/server/services/fandom/types';
import type {
  EnhancedVolumeData,
  EnhancedChapterReference
} from '@/types/search-types/metadata.types';
import { logger } from '@/utils/logger';


import { ContentExtractor } from '../core/ContentExtractor';
import { DataNormalizer, type NormalizedMangaData } from '../core/DataNormalizer';


// ============================================================================
// Type Definitions
// ============================================================================

export interface FandomAdapterOptions {
  // Wiki options
  wikiSubdomain?: string;

  // Content options
  fetchFullContent?: boolean;
  fetchCharacters?: boolean;
  fetchChapters?: boolean;
  fetchVolumes?: boolean;

  // Caching
  useCache?: boolean;
  cacheTimeout?: number;

  // Dependency injection for testing
  fandomService?: FandomService;
}

export class FandomAdapter {
  private fandomService: FandomService;
  private contentExtractor: ContentExtractor;
  private dataNormalizer: DataNormalizer;
  private cache: Map<string, { data: NormalizedMangaData; timestamp: number }> = new Map();
  private log = logger.child('FandomAdapter');

  constructor(private options: FandomAdapterOptions = {}) {
    this.contentExtractor = new ContentExtractor();
    this.dataNormalizer = new DataNormalizer();

    // Use injected service or create new one
    if (options.fandomService) {
      this.fandomService = options.fandomService;
    } else {
      const wikiSubdomain = options.wikiSubdomain ?? 'manga';
      this.fandomService = new FandomService(wikiSubdomain);
    }
  }

  /**
   * Extract manga data from Fandom URL or title
   */
  async extract(urlOrTitle: string): Promise<NormalizedMangaData> {
    // Check cache
    if (this.options.useCache) {
      const cached = this.getFromCache(urlOrTitle);
      if (cached) return cached;
    }

    let title = urlOrTitle;

    // Extract title from URL if it's a URL
    if (urlOrTitle.includes('fandom.com')) {
      title = this.extractTitleFromUrl(urlOrTitle);

      // Also update wiki subdomain if different
      const wikiMatch = urlOrTitle.match(/https?:\/\/([^.]+)\.fandom\.com/);
      if (wikiMatch?.[1] && wikiMatch[1] !== this.options.wikiSubdomain) {
        this.fandomService = new FandomService(wikiMatch[1]);
      }
    }

    try {
      // Fetch manga info from FandomService
      const fandomData = await this.fandomService.getMangaInfo(title);

      if (!fandomData) {
        throw new Error(`No manga data found for: ${title}`);
      }

      // Convert FandomMangaData to NormalizedMangaData
      const normalizedData = this.mapFandomToNormalized(fandomData);

      // Cache result
      if (this.options.useCache) {
        this.saveToCache(urlOrTitle, normalizedData);
      }

      return normalizedData;
    } catch (error: unknown) {
      this.log.error('Failed to extract Fandom data', {
        urlOrTitle,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Map FandomMangaData to NormalizedMangaData
   * Decomposed into helper functions to reduce cyclomatic complexity
   */
  private mapFandomToNormalized(fandomData: FandomMangaData): NormalizedMangaData {
    // Build provider-specific fields with enhanced volume data
    const providerFields = this.buildProviderSpecificFields(fandomData);

    return {
      // Source (always present)
      source: {
        type: 'fandom' as const,
        extractedAt: new Date(),
        confidence: 0.85
      },

      // Base fields (always present)
      title: fandomData.title,
      alternativeTitles: fandomData.alternativeTitles ?? [],
      genres: fandomData.genres ?? [],
      status: this.mapStatus(fandomData.status),
      volumes: [],
      chapters: [],
      lists: [],
      tables: [],
      references: [],
      externalLinks: [],

      // Optional fields from helper functions
      ...this.buildBasicInfoFields(fandomData),
      ...this.buildMetadataFields(fandomData),
      ...this.buildDateFields(fandomData),
      ...this.buildContentFields(fandomData),
      ...this.buildMediaFields(fandomData),
      ...this.buildVolumeChapterFields(fandomData),

      // Provider-specific enhanced data for storage
      providerSpecificFields: providerFields
    };
  }

  /**
   * Build basic info optional fields (description, coverImage, year)
   */
  private buildBasicInfoFields(fandomData: FandomMangaData): Partial<NormalizedMangaData> {
    const result: Partial<NormalizedMangaData> = {};

    const description = fandomData.synopsis ?? fandomData.description;
    if (description) {
      result.description = description;
    }

    if (fandomData.coverImage) {
      result.coverImage = fandomData.coverImage;
    }

    const year = this.extractYear(fandomData.published ?? fandomData.startDate);
    if (year) {
      result.year = year;
    }

    return result;
  }

  /**
   * Build metadata optional fields (author, publisher, magazine, demographic)
   */
  private buildMetadataFields(fandomData: FandomMangaData): Partial<NormalizedMangaData> {
    const result: Partial<NormalizedMangaData> = {};

    // Extract author from top-level or metadata sub-object
    const author = fandomData.author ?? fandomData.metadata?.author;
    if (author) {
      result.author = [author];
    }

    // Extract artist from metadata sub-object (not available at top-level)
    const artist = fandomData.metadata?.artist;
    if (artist) {
      result.artist = [artist];
    }

    if (fandomData.publisher) {
      result.publisher = fandomData.publisher;
    }

    if (fandomData.magazine) {
      result.magazine = fandomData.magazine;
    }

    const demographic = fandomData.demographic ?? fandomData.publicationDemographic;
    if (demographic) {
      result.demographic = demographic;
    }

    return result;
  }

  /**
   * Build date-related optional fields (startDate, endDate)
   */
  private buildDateFields(fandomData: FandomMangaData): Partial<NormalizedMangaData> {
    const result: Partial<NormalizedMangaData> = {};

    const startDate = this.parseDate(fandomData.published ?? fandomData.startDate);
    if (startDate) {
      result.startDate = startDate;
    }

    const endDate = this.parseDate(fandomData.endDate);
    if (endDate) {
      result.endDate = endDate;
    }

    return result;
  }

  /**
   * Build content-related optional fields (totalVolumes, totalChapters, storyArcs)
   */
  private buildContentFields(fandomData: FandomMangaData): Partial<NormalizedMangaData> {
    const result: Partial<NormalizedMangaData> = {};

    const totalVolumes = this.parseNumber(fandomData.volumes);
    if (totalVolumes) {
      result.totalVolumes = totalVolumes;
    }

    const totalChapters = fandomData.totalChapters ?? this.parseNumber(fandomData.chapters);
    if (totalChapters) {
      result.totalChapters = totalChapters;
    }

    if (fandomData.arcs) {
      result.storyArcs = fandomData.arcs.map(arc => ({
        name: typeof arc === 'string' ? arc : arc.name
      }));
    }

    return result;
  }

  /**
   * Build media-related optional fields (images)
   */
  private buildMediaFields(fandomData: FandomMangaData): Partial<NormalizedMangaData> {
    const result: Partial<NormalizedMangaData> = {};

    if (fandomData.images) {
      result.images = fandomData.images.map(url => ({
        url,
        type: 'cover' as const
      }));
    }

    return result;
  }

  /**
   * Build volume and chapter fields from Fandom data
   * Maps volumeList and chapterList to normalized volume/chapter arrays
   */
  private buildVolumeChapterFields(fandomData: FandomMangaData): Partial<NormalizedMangaData> {
    const result: Partial<NormalizedMangaData> = {};

    // Map volumeList to volumes array (NormalizedVolume interface)
    if (fandomData.volumeList && fandomData.volumeList.length > 0) {
      result.volumes = fandomData.volumeList.map(vol => {
        // Extract chapter numbers for this volume
        const chapterNumbers: number[] = [];
        if (vol.chapters) {
          vol.chapters.forEach(ch => {
            const num = typeof ch.number === 'string'
              ? parseInt(ch.number, 10) || 0
              : ch.number ?? 0;
            if (num > 0) chapterNumbers.push(num);
          });
        }

        const normalizedVolume: {
          number: number;
          chapters: number[];
          title?: string;
          coverImage?: string;
          releaseDate?: Date;
          isbn?: string;
        } = {
          number: vol.volumeNumber ?? vol.number ?? 0,
          chapters: chapterNumbers
        };

        if (vol.title) normalizedVolume.title = vol.title;
        const coverImg = vol.coverUrl ?? vol.coverImage;
        if (coverImg) normalizedVolume.coverImage = coverImg;
        const relDate = vol.releaseDate ? this.parseDate(vol.releaseDate) : undefined;
        if (relDate) normalizedVolume.releaseDate = relDate;
        if (vol.isbn) normalizedVolume.isbn = vol.isbn;

        return normalizedVolume;
      });
    }

    // Map chapterList to chapters array (NormalizedChapter interface)
    if (fandomData.chapterList && fandomData.chapterList.length > 0) {
      result.chapters = fandomData.chapterList.map(ch => {
        const chapterNum = typeof ch.number === 'string'
          ? parseInt(ch.number, 10) || 0
          : ch.number ?? 0;

        const normalizedChapter: {
          number: number;
          title?: string;
          volumeNumber?: number;
          releaseDate?: Date;
          pageCount?: number;
        } = {
          number: chapterNum
        };

        if (ch.title) normalizedChapter.title = ch.title;
        const volNum = ch.volumeNumber ?? ch.volume;
        if (volNum !== undefined) normalizedChapter.volumeNumber = volNum;
        const chRelDate = ch.releaseDate ? this.parseDate(ch.releaseDate) : undefined;
        if (chRelDate) normalizedChapter.releaseDate = chRelDate;
        if (ch.pages) normalizedChapter.pageCount = ch.pages;

        return normalizedChapter;
      });
    }

    return result;
  }

  /**
   * Map Fandom status to Prisma MangaPublicationStatus
   */
  private mapStatus(status?: string): MangaPublicationStatus {
    if (!status) return MangaPublicationStatus.UNKNOWN;

    const normalizedStatus = status.toLowerCase().trim();

    if (normalizedStatus.includes('ongoing') || normalizedStatus.includes('publishing')) {
      return MangaPublicationStatus.ONGOING;
    }
    if (normalizedStatus.includes('completed') || normalizedStatus.includes('finished')) {
      return MangaPublicationStatus.COMPLETED;
    }
    if (normalizedStatus.includes('hiatus')) {
      return MangaPublicationStatus.HIATUS;
    }
    if (normalizedStatus.includes('cancelled') || normalizedStatus.includes('canceled')) {
      return MangaPublicationStatus.CANCELLED;
    }

    return MangaPublicationStatus.UNKNOWN;
  }

  /**
   * Extract year from date string
   */
  private extractYear(dateString?: string): number | undefined {
    if (!dateString) return undefined;

    const yearMatch = dateString.match(/\d{4}/);
    return yearMatch ? parseInt(yearMatch[0]) : undefined;
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateString?: string): Date | undefined {
    if (!dateString) return undefined;

    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  }

  /**
   * Parse number from string (handles formats like "300+", "50-100")
   */
  private parseNumber(value?: string): number | undefined {
    if (!value) return undefined;

    const cleaned = value.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned);

    return isNaN(num) ? undefined : num;
  }

  /**
   * Extract title from Fandom URL
   */
  private extractTitleFromUrl(url: string): string {
    // https://onepiece.fandom.com/wiki/One_Piece -> One_Piece
    const match = url.match(/\/wiki\/([^/?#]+)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]).replace(/_/g, ' ');
    }

    throw new Error(`Invalid Fandom URL: ${url}`);
  }

  /**
   * Get data from cache
   */
  private getFromCache(key: string): NormalizedMangaData | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const timeout = this.options.cacheTimeout ?? 3600000; // 1 hour default
    const isExpired = Date.now() - cached.timestamp > timeout;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Save data to cache
   */
  private saveToCache(key: string, data: NormalizedMangaData): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Evict oldest entry when cache exceeds max size
    if (this.cache.size > 50) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ============================================================================
  // Enhanced Volume Data Extraction
  // ============================================================================

  /**
   * Build enhanced volume data from Fandom volumeList
   */
  private buildEnhancedVolumeData(fandomData: FandomMangaData): EnhancedVolumeData[] {
    const volumeList = fandomData.volumeList;
    if (!volumeList || volumeList.length === 0) {
      return [];
    }

    return volumeList.map(vol => {
      const enhancedVolume: EnhancedVolumeData = {
        number: vol.volumeNumber ?? vol.number ?? 0,
        source: 'fandom',
        fetchedAt: new Date().toISOString(),
        enrichmentTier: 2 // Tier 2 = volume page data
      };

      // Add id only if we can extract it
      const extractedId = vol.url ? this.extractIdFromUrl(vol.url) : undefined;
      if (extractedId) enhancedVolume.id = extractedId;

      // Add optional fields only when they have values
      if (vol.title) enhancedVolume.title = vol.title;
      const volCoverImg = vol.coverUrl ?? vol.coverImage;
      if (volCoverImg) enhancedVolume.coverImage = volCoverImg;
      if (vol.releaseDate) enhancedVolume.releaseDate = vol.releaseDate;
      if (vol.isbn) enhancedVolume.isbn = vol.isbn;
      if (vol.description) enhancedVolume.description = vol.description;
      if (vol.url) enhancedVolume.sourceUrl = vol.url;
      if (vol.chapterCount) enhancedVolume.totalChapters = vol.chapterCount;

      // Map chapters to enhanced chapter references
      if (vol.chapters && vol.chapters.length > 0) {
        enhancedVolume.chapters = this.mapChaptersToEnhanced(vol.chapters);
      }

      return enhancedVolume;
    });
  }

  /**
   * Map Fandom chapter data to EnhancedChapterReference format
   */
  private mapChaptersToEnhanced(
    chapters: NonNullable<NonNullable<FandomMangaData['volumeList']>[number]['chapters']>
  ): EnhancedChapterReference[] {
    return chapters.map(ch => {
      const chapterNum = typeof ch.number === 'string'
        ? parseInt(ch.number, 10) || 0
        : ch.number ?? 0;

      const enhancedChapter: EnhancedChapterReference = {
        number: chapterNum
      };

      // Add optional fields only when they have values
      if (ch.title) enhancedChapter.title = ch.title;
      const altTitle = ch.alternativeTitles?.[0];
      if (altTitle) enhancedChapter.alternativeTitle = altTitle;
      if (ch.releaseDate) enhancedChapter.releaseDate = ch.releaseDate;
      if (ch.pages) enhancedChapter.pages = ch.pages;
      if (ch.summary) enhancedChapter.summary = ch.summary;
      if (ch.url) enhancedChapter.url = ch.url;
      if (ch.coverImage) enhancedChapter.coverImage = ch.coverImage;

      return enhancedChapter;
    });
  }

  /**
   * Extract standalone chapter list (chapters not associated with volumes)
   */
  private buildStandaloneChapters(fandomData: FandomMangaData): EnhancedChapterReference[] {
    const chapterList = fandomData.chapterList;
    if (!chapterList || chapterList.length === 0) {
      return [];
    }

    return chapterList.map(ch => {
      const chapterNum = typeof ch.number === 'string'
        ? parseInt(ch.number, 10) || 0
        : ch.number ?? 0;

      const enhancedChapter: EnhancedChapterReference = {
        number: chapterNum
      };

      // Add optional fields
      if (ch.title) enhancedChapter.title = ch.title;
      const altTitle2 = ch.alternativeTitles?.[0];
      if (altTitle2) enhancedChapter.alternativeTitle = altTitle2;
      if (ch.releaseDate) enhancedChapter.releaseDate = ch.releaseDate;
      if (ch.pages) enhancedChapter.pages = ch.pages;
      if (ch.summary) enhancedChapter.summary = ch.summary;
      if (ch.url) enhancedChapter.url = ch.url;
      const chCoverImg = ch.coverUrl ?? ch.coverImage;
      if (chCoverImg) enhancedChapter.coverImage = chCoverImg;

      return enhancedChapter;
    });
  }

  /**
   * Extract ID from Fandom URL
   */
  private extractIdFromUrl(url: string): string | undefined {
    // https://onepiece.fandom.com/wiki/Volume_1 -> Volume_1
    const match = url.match(/\/wiki\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  }

  /**
   * Build provider-specific fields for storage in providerMetadata
   */
  private buildProviderSpecificFields(fandomData: FandomMangaData): Record<string, unknown> {
    const enhancedVolumeData = this.buildEnhancedVolumeData(fandomData);
    const standaloneChapters = this.buildStandaloneChapters(fandomData);

    // Extract themes from genres (Fandom typically stores themes as genres)
    const themes: string[] = [];
    if (fandomData.genres) {
      themes.push(...fandomData.genres);
    }

    // Extract creator info
    const creators: { authors: string[]; artists: string[] } = {
      authors: [],
      artists: []
    };

    if (fandomData.author) {
      creators.authors.push(fandomData.author);
    }
    if (fandomData.metadata?.author && fandomData.metadata.author !== fandomData.author) {
      creators.authors.push(fandomData.metadata.author);
    }
    if (fandomData.metadata?.artist) {
      creators.artists.push(fandomData.metadata.artist);
    }

    // Extract story arcs
    const storyArcs: string[] = [];
    if (fandomData.arcs) {
      if (Array.isArray(fandomData.arcs)) {
        fandomData.arcs.forEach(arc => {
          if (typeof arc === 'string') {
            storyArcs.push(arc);
          } else if (arc.name) {
            storyArcs.push(arc.name);
          }
        });
      }
    }

    return {
      volumeData: enhancedVolumeData,
      totalVolumes: enhancedVolumeData.length,
      totalChapters: fandomData.totalChapters ?? standaloneChapters.length,
      themes,
      genres: fandomData.genres ?? [],
      creators,
      storyArcs,
      characters: fandomData.characters?.map(c => c.name) ?? [],
      standaloneChapters,
      links: fandomData.links,
      source: fandomData.source ?? 'fandom',
      lastFetched: new Date().toISOString()
    };
  }
}
