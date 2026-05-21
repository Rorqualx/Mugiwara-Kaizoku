/**
 * Unified ComicVine Adapter
 * 
 * ComicVine provider adapter that transforms ComicVine API responses to the
 * unified metadata format. ComicVine specializes in Western comics and graphic novels.
 */

import { MangaPublicationStatus } from '@prisma/client';

import type { PartialUnifiedMetadata, PersonInfo, StaffInfo, CharacterInfo, TagInfo, ExternalLinkInfo, ExternalIds, VolumeInfo, EnhancedVolumeData, EnhancedChapterReference, CoverImages } from '@/types/search.types';
import { MangaFormat } from '@/types/search.types';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';


import { ComicVineService} from '../services/comicvine/service';

import { BaseMetadataAdapter } from './base-metadata-adapter';

import type { BaseProviderConfig, ProviderSearchOptions } from './base-metadata-adapter';
/**
 * ComicVine-specific configuration
 */
export interface ComicVineConfig extends BaseProviderConfig {
  apiKey: string;
}
/**
 * ComicVine issue structure
 */
export interface ComicVineIssue {
  id: number;
  name?: string;
  issue_number?: string;
  cover_date?: string;
  store_date?: string;
  description?: string;
  image?: {
    original_url?: string;
    medium_url?: string;
    small_url?: string;
    thumb_url?: string;
  };
}
/**
 * ComicVine character/person structure
 */
export interface ComicVinePerson {
  id: number;
  name: string;
  role?: string;
  api_detail_url?: string;
  image?: {
    original_url?: string;
    medium_url?: string;
  };
}
/**
 * ComicVine API response structure
 */
export interface ComicVineResponse {
  id: number;
  name: string;
  aliases?: string;
  deck?: string; // Short description
  description?: string; // HTML description
  start_year?: number;
  count_of_issues?: number;
  image?: {
    original_url?: string;
    super_url?: string;
    medium_url?: string;
    small_url?: string;
    thumb_url?: string;
    icon_url?: string;
  };
  publisher?: {
    id: number;
    name: string;
    api_detail_url?: string;
  };
  first_issue?: ComicVineIssue;
  last_issue?: ComicVineIssue;
  issues?: ComicVineIssue[];
  characters?: {
    characters?: ComicVinePerson[];
  };
  person_credits?: ComicVinePerson[];
  creators?: ComicVinePerson[];
  // Genres/themes from ComicVine API
  genres?: Array<{
    id: number;
    name: string;
    api_detail_url?: string;
  }>;
  locations?: Array<{
    id: number;
    name: string;
  }>;
  concepts?: Array<{
    id: number;
    name: string;
  }>;
  teams?: Array<{
    id: number;
    name: string;
  }>;
  story_arcs?: Array<{
    id: number;
    name: string;
  }>;
  site_detail_url?: string;
  api_detail_url?: string;
  date_added?: string;
  date_last_updated?: string;
}
/**
 * Options for building metadata object
 */
interface BuildMetadataOptions {
  rawData: ComicVineResponse;
  title: string;
  alternativeTitles: string[];
  covers: CoverImages;
  description: string;
  status: MangaPublicationStatus;
  volumeDetails: VolumeInfo[] | undefined;
  peopleMetadata: {
    authors: PersonInfo[];
    artists: PersonInfo[];
    characters: CharacterInfo[];
  };
  categorizationMetadata: {
    tags: TagInfo[];
    genres: string[];
    themes: string[];
    storyArcs: string[];
  };
  externalIds: ExternalIds;
  externalLinks: ExternalLinkInfo[];
}

/**
 * Unified ComicVine adapter implementation
 */
export class UnifiedComicVineAdapter extends BaseMetadataAdapter<ComicVineResponse, ComicVineConfig> {
  readonly providerName = 'comicvine';
  readonly priority = 80;
  readonly baseConfidence = 0.85;
  private client: ComicVineService;
  constructor(config: ComicVineConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error('ComicVine API key is required');
    }
    this.client = new ComicVineService();
    // The ComicVineService will initialize with its own configuration
  }
  /**
   * Validate ComicVine response structure
   */
  validateRawData(data: unknown): data is ComicVineResponse {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    // Must have ID and name
    if (!obj['id'] || typeof obj['id'] !== 'number') return false;
    if (!obj['name'] || typeof obj['name'] !== 'string') return false;
    return true;
  }
  /**
   * Extract people-related metadata (authors, artists, characters)
   */
  private extractPeopleMetadata(rawData: ComicVineResponse): {
    authors: PersonInfo[];
    artists: PersonInfo[];
    characters: CharacterInfo[];
  } {
    const staffData = this.extractStaff(rawData);
    return {
      authors: staffData.authors,
      artists: staffData.artists,
      characters: this.extractCharacters(rawData),
    };
  }

  /**
   * Extract categorization metadata (tags, genres, themes, story arcs)
   */
  private extractCategorizationMetadata(rawData: ComicVineResponse): {
    tags: TagInfo[];
    genres: string[];
    themes: string[];
    storyArcs: string[];
  } {
    return {
      tags: this.extractComicVineTags(rawData),
      genres: this.inferGenres(rawData),
      themes: this.extractThemes(rawData),
      storyArcs: this.extractStoryArcs(rawData),
    };
  }

  /**
   * Extract external references (IDs and links)
   */
  private extractExternalReferences(rawData: ComicVineResponse): {
    externalIds: ExternalIds;
    externalLinks: ExternalLinkInfo[];
  } {
    const externalIds: ExternalIds = {
      comicvineId: toStringId(rawData["id"])
    };
    const externalLinks: ExternalLinkInfo[] = [];
    if (rawData.site_detail_url) {
      externalLinks.push({
        url: rawData.site_detail_url,
        site: 'ComicVine',
        type: 'INFO'
      });
    }
    return { externalIds, externalLinks };
  }

  /**
   * Build metadata object from extracted data
   */
  private buildMetadataObject(options: BuildMetadataOptions): PartialUnifiedMetadata {
    const {
      rawData,
      title,
      alternativeTitles,
      covers,
      description,
      status,
      volumeDetails,
      peopleMetadata,
      categorizationMetadata,
      externalIds,
      externalLinks
    } = options;

    const volumes = rawData.count_of_issues;
    const startDate = this.extractStartDate(rawData);
    const endDate = this.extractEndDate(rawData);
    const releaseYear = rawData.start_year;

    return {
      title,
      alternativeTitles,
      covers,
      description,
      status,
      format: MangaFormat.COMIC,
      ...(volumes ? { volumeCount: volumes } : {}),
      ...(volumeDetails ? { volumes: volumeDetails } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(releaseYear ? { year: releaseYear } : {}),
      authors: peopleMetadata.authors.map(a => typeof a === 'string' ? a : a["name"]),
      artists: peopleMetadata.artists.map(a => typeof a === 'string' ? a : a["name"]),
      characters: peopleMetadata.characters,
      genres: categorizationMetadata.genres,
      tags: categorizationMetadata.tags,
      ...(categorizationMetadata.themes.length > 0 ? { themes: categorizationMetadata.themes } : {}),
      ...(categorizationMetadata.storyArcs.length > 0 ? { storyArcs: categorizationMetadata.storyArcs } : {}),
      ...(rawData.publisher?.name !== undefined ? { publisher: rawData.publisher.name } : {}),
      ...(rawData.publisher?.name !== undefined ? { countryOfOrigin: 'US' as const } : {}),
      ...(rawData.publisher?.name !== undefined ? { isAdult: false } : {}),
      ...(rawData.publisher?.name !== undefined ? { contentWarnings: [] } : {}),
      externalIds,
      externalLinks
    };
  }

  /**
   * Transform ComicVine data to unified metadata format
   */
  transform(rawData: ComicVineResponse): Promise<AsyncResult<PartialUnifiedMetadata, Error>> {
    try {
      // Extract title and alternative titles
      const title = rawData["name"];
      const alternativeTitles: string[] = [];
      if (rawData.aliases) {
        const aliases = rawData.aliases.split(/[\n,]/).map(a => a.trim()).filter(a => a);
        alternativeTitles.push(...aliases);
      }

      // Build cover images and description
      const covers = this.buildCoverImages(rawData.image);
      const description = this.cleanHtml(rawData["description"] ?? rawData.deck ?? '');
      const status = this.determineStatus(rawData);
      const volumeDetails = this.extractVolumeDetails(rawData.issues);

      // Extract all metadata using helper methods
      const peopleMetadata = this.extractPeopleMetadata(rawData);
      const categorizationMetadata = this.extractCategorizationMetadata(rawData);
      const { externalIds, externalLinks } = this.extractExternalReferences(rawData);

      // Build final metadata object
      const metadata = this.buildMetadataObject({
        rawData,
        title,
        alternativeTitles,
        covers,
        description,
        status,
        volumeDetails,
        peopleMetadata,
        categorizationMetadata,
        externalIds,
        externalLinks
      });

      return Promise.resolve(createSuccessResult(metadata));
    } catch (error: unknown) {
      this.logger.error('Error transforming ComicVine data:', error);
      return Promise.resolve(createErrorResult(error instanceof Error ? error : new Error(String(error))));
    }
  }
  /**
   * Search for comics/manga
   */
  async search(query: string, options?: ProviderSearchOptions): Promise<AsyncResult<PartialUnifiedMetadata[], Error>> {
    try {
      const searchResults = await this.client.searchVolumes({
        query,
        apiKey: this.config.apiKey,
        limit: options?.limit ?? 10,
        offset: options?.offset ?? 0
      }) as AsyncResult<unknown, Error>;
      if (!isSuccess(searchResults)) {
        const errorObj = searchResults as { error?: Error };
        const error = errorObj.error ?? new Error('Search failed');
        return createErrorResult(error);
      }
      const resultsData = searchResults.data as unknown;
      if (!Array.isArray(resultsData)) {
        return createSuccessResult([]);
      }

      // Transform results in parallel for better performance
      const transformPromises = resultsData
        .filter(result => this.validateRawData(result))
        .map(result => this.transform(result));

      const transformedResults = (await Promise.all(transformPromises))
        .filter(isSuccess)
        .map(result => result.data);
      return createSuccessResult(transformedResults);
    } catch (error: unknown) {
      this.logger.error('Error searching ComicVine:', error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Get metadata by ID
   */
  async getById(id: string | number): Promise<AsyncResult<PartialUnifiedMetadata, Error>> {
    try {
      const result = await this.client.getVolume(toStringId(id), this.config.apiKey);
      if (!this.validateRawData(result)) {
        return createErrorResult(new Error('Invalid response from ComicVine API'));
      }
      return await this.transform(result);
    } catch (error: unknown) {
      this.logger.error(`Error fetching ComicVine volume ${id}:`, error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  /**
   * Determine publication status
   */
  private determineStatus(data: ComicVineResponse): MangaPublicationStatus {
    if (!data.last_issue || !data.date_last_updated) {
      return MangaPublicationStatus.UNKNOWN;
    }
    // Check if last update was recent (within 6 months)
    const lastUpdate = new Date(data.date_last_updated);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (lastUpdate > sixMonthsAgo) {
      return MangaPublicationStatus.ONGOING;
    }
    // If no updates in 6 months, assume completed
    return MangaPublicationStatus.COMPLETED;
  }
  /**
   * Extract start date
   */
  private extractStartDate(data: ComicVineResponse): Date | null {
    if (data.first_issue?.cover_date) {
      return this.normalizeDate(data.first_issue.cover_date);
    }
    if (data.first_issue?.store_date) {
      return this.normalizeDate(data.first_issue.store_date);
    }
    if (data.start_year) {
      return new Date(data.start_year, 0, 1);
    }
    return null;
  }
  /**
   * Extract end date
   */
  private extractEndDate(data: ComicVineResponse): Date | null {
    if (data.last_issue?.cover_date) {
      return this.normalizeDate(data.last_issue.cover_date);
    }
    if (data.last_issue?.store_date) {
      return this.normalizeDate(data.last_issue.store_date);
    }
    return null;
  }
  /**
   * Extract volume details from issues
   */
  private extractVolumeDetails(issues?: ComicVineIssue[]): VolumeInfo[] | undefined {
    if (!issues || issues.length === 0) return undefined;
    return issues.map((issue, index) => {
      const volumeInfo: VolumeInfo = {
        number: parseInt(issue.issue_number ?? String(index + 1)),
        ...(issue["name"] && { title: issue["name"] })
      };
      const coverImage = issue.image?.medium_url ?? issue.image?.original_url;
      if (coverImage) {
        volumeInfo.coverImage = coverImage;
      }
      const releaseDate = issue.cover_date ?? issue.store_date;
      if (releaseDate) {
        volumeInfo.releaseDate = releaseDate;
      }
      return volumeInfo;
    });
  }
  /**
   * Extract staff information
   */
  private extractStaff(data: ComicVineResponse): {
    authors: PersonInfo[];
    artists: PersonInfo[];
    staff: StaffInfo[];
  } {
    // Process person credits inline to avoid CommonJS require()
    const credits = data.person_credits ?? data.creators ?? [];
    const authors: PersonInfo[] = [];
    const artists: PersonInfo[] = [];
    const staff: StaffInfo[] = [];

    // Extract staff roles from credits
    for (const credit of credits) {
      const roleStr = (credit.role ?? '').toLowerCase();

      // Map role string to PersonInfo role type
      const mapToRole = (r: string): PersonInfo['role'] => {
        if (r.includes('writer')) return 'WRITER';
        if (r.includes('author')) return 'AUTHOR';
        if (r.includes('pencil')) return 'PENCILER';
        if (r.includes('ink')) return 'INKER';
        if (r.includes('color')) return 'COLORIST';
        if (r.includes('letter')) return 'LETTERER';
        if (r.includes('cover')) return 'COVER_ARTIST';
        if (r.includes('edit')) return 'EDITOR';
        if (r.includes('translat')) return 'TRANSLATOR';
        if (r.includes('artist') || r.includes('illustrat')) return 'ARTIST';
        return 'AUTHOR'; // Default to AUTHOR
      };

      const mappedRole = mapToRole(roleStr);
      const person: PersonInfo = {
        id: String(credit.id),
        name: credit.name,
        role: mappedRole
      };

      // Categorize by role
      if (roleStr.includes('writer') || roleStr.includes('author')) {
        authors.push(person);
      }
      if (roleStr.includes('artist') || roleStr.includes('illustrator') || roleStr.includes('penciller')) {
        artists.push(person);
      }

      // Add to staff with role
      const staffInfo: StaffInfo = {
        ...person,
        role: mappedRole
      };
      staff.push(staffInfo);
    }

    return { authors, artists, staff };
  }
  /**
   * Extract characters
   */
  private extractCharacters(data: ComicVineResponse): CharacterInfo[] {
    const characters: CharacterInfo[] = [];
    // Check both possible character locations
    let characterList: unknown[] = [];
    if (data.characters?.characters) {
      characterList = data.characters.characters;
    } else if (Array.isArray(data.characters)) {
      characterList = data.characters as unknown[];
    }

    for (const char of characterList) {
      if (typeof char === 'object' && char !== null && "name" in char && char["name"]) {
        const charObj = char as Record<string, unknown>;
        const characterInfo: CharacterInfo = {
          id: toStringId(charObj["id"]),
          name: String(charObj["name"])
        };
        const image = charObj["image"];
        if (image && typeof image === 'object') {
          const imageObj = image as Record<string, unknown>;
          const imageUrl = imageObj["medium_url"] ?? imageObj["original_url"];
          if (typeof imageUrl === 'string') {
            characterInfo.image = imageUrl;
          }
        }
        characters.push(characterInfo);
      }
    }
    return characters;
  }
  /**
   * Extract tags from various ComicVine fields
   */
  private extractComicVineTags(data: ComicVineResponse): TagInfo[] {
    const tags: TagInfo[] = [];
    // Add concepts as tags
    if (data.concepts) {
      for (const concept of data.concepts) {
        tags.push({
          name: concept["name"],
          category: 'Concept'
        });
      }
    }
    // Add teams as tags
    if (data.teams) {
      for (const team of data.teams) {
        tags.push({
          name: team["name"],
          category: 'Team'
        });
      }
    }
    // Add story arcs as tags
    if (data.story_arcs) {
      for (const arc of data.story_arcs) {
        tags.push({
          name: arc["name"],
          category: 'Story Arc'
        });
      }
    }
    // Add locations as tags
    if (data.locations) {
      for (const location of data.locations) {
        tags.push({
          name: location["name"],
          category: 'Location'
        });
      }
    }
    return tags;
  }
  /**
   * Extract themes from concepts
   *
   * Themes are conceptual elements like "Action", "Adventure", "Supernatural"
   * that describe the content type rather than story elements.
   */
  private extractThemes(data: ComicVineResponse): string[] {
    const themes: string[] = [];

    if (data.concepts && Array.isArray(data.concepts)) {
      for (const concept of data.concepts) {
        if (concept.name) {
          themes.push(concept.name);
        }
      }
    }

    // Also check genres field if present
    if (data.genres && Array.isArray(data.genres)) {
      for (const genre of data.genres) {
        if (genre.name && !themes.includes(genre.name)) {
          themes.push(genre.name);
        }
      }
    }

    return themes;
  }
  /**
   * Extract story arcs
   */
  private extractStoryArcs(data: ComicVineResponse): string[] {
    const arcs: string[] = [];

    if (data.story_arcs && Array.isArray(data.story_arcs)) {
      for (const arc of data.story_arcs) {
        if (arc.name) {
          arcs.push(arc.name);
        }
      }
    }

    return arcs;
  }
  /**
   * Extract enhanced volume data with full metadata
   *
   * Returns EnhancedVolumeData[] instead of VolumeInfo[] for richer data storage.
   */
  private extractEnhancedVolumeData(
    data: ComicVineResponse
  ): EnhancedVolumeData[] {
    const volumes: EnhancedVolumeData[] = [];

    if (!data.issues || data.issues.length === 0) {
      return volumes;
    }

    // Extract creators from the volume level
    const { authors, artists } = this.extractStaff(data);
    const themes = this.extractThemes(data);
    const genres = this.inferGenres(data);
    const storyArcs = this.extractStoryArcs(data);
    const characters = this.extractCharacters(data).map(c => c.name);

    // Group issues by volume number if available, otherwise treat each as a volume
    for (const issue of data.issues) {
      const volumeNumber = parseInt(issue.issue_number ?? '1', 10);
      const releaseDate = issue.cover_date ?? issue.store_date;
      const coverImage = issue.image?.medium_url ?? issue.image?.original_url;

      const chapterRef: EnhancedChapterReference = {
        number: volumeNumber,
        sourceId: toStringId(issue.id)
      };
      if (issue.name) chapterRef.title = issue.name;
      if (releaseDate) chapterRef.releaseDate = releaseDate;
      if (coverImage) chapterRef.coverImage = coverImage;

      const chapters: EnhancedChapterReference[] = [chapterRef];

      const enhancedVolume: EnhancedVolumeData = {
        id: toStringId(issue.id),
        number: volumeNumber,
        chapters,
        totalChapters: 1,
        themes,
        genres,
        creators: {
          authors: authors.map(a => a.name),
          artists: artists.map(a => a.name)
        },
        characters,
        storyArcs,
        source: 'comicvine',
        sourceId: toStringId(issue.id),
        fetchedAt: new Date().toISOString(),
        enrichmentTier: 2
      };

      // Add optional fields only if they have values
      if (issue.name) enhancedVolume.title = issue.name;
      if (issue.description) enhancedVolume.description = issue.description;
      if (coverImage) enhancedVolume.coverImage = coverImage;
      if (releaseDate) enhancedVolume.releaseDate = releaseDate;

      volumes.push(enhancedVolume);
    }

    return volumes;
  }
  /**
   * Theme-like concept names that should be treated as genres
   */
  private static readonly THEME_CONCEPTS = new Set([
    'action', 'adventure', 'drama', 'supernatural', 'animated', 'manga',
    'horror', 'comedy', 'romance', 'fantasy', 'sci-fi', 'mystery'
  ]);

  /**
   * Genre keyword mappings for text-based inference
   */
  private static readonly TEXT_GENRE_MAPPINGS: ReadonlyArray<readonly [string, string]> = [
    ['horror', 'Horror'],
    ['mystery', 'Mystery'],
    ['detective', 'Crime'],
    ['romance', 'Romance'],
    ['sci-fi', 'Sci-Fi'],
    ['science fiction', 'Sci-Fi'],
    ['fantasy', 'Fantasy'],
    ['action', 'Action'],
    ['adventure', 'Adventure'],
    ['comedy', 'Comedy'],
    ['drama', 'Drama']
  ] as const;

  /**
   * Extract genres from API response and infer additional genres
   */
  private inferGenres(data: ComicVineResponse): string[] {
    const genres: string[] = [];

    // Extract from multiple sources
    this.extractApiGenres(data, genres);
    this.extractThemesFromConcepts(data, genres);
    this.inferGenresFromPublisher(data, genres);

    // Fallback: infer from text if no genres found
    if (genres.length === 0) {
      this.inferGenresFromText(data, genres);
    }

    return this.deduplicateGenres(genres);
  }

  /**
   * Extract actual genres from ComicVine API response
   */
  private extractApiGenres(data: ComicVineResponse, genres: string[]): void {
    if (!data.genres || !Array.isArray(data.genres)) return;

    for (const genre of data.genres) {
      if (genre.name) {
        genres.push(genre.name);
      }
    }
  }

  /**
   * Extract themes from concepts (ComicVine stores themes as concepts)
   */
  private extractThemesFromConcepts(data: ComicVineResponse, genres: string[]): void {
    if (!data.concepts || !Array.isArray(data.concepts)) return;

    for (const concept of data.concepts) {
      if (concept.name && UnifiedComicVineAdapter.THEME_CONCEPTS.has(concept.name.toLowerCase())) {
        genres.push(concept.name);
      }
    }
  }

  /**
   * Infer genres from publisher name
   */
  private inferGenresFromPublisher(data: ComicVineResponse, genres: string[]): void {
    if (!data.publisher?.name) return;

    const publisher = data.publisher.name.toLowerCase();
    if (publisher.includes('marvel') || publisher.includes('dc')) {
      genres.push('Superhero');
    }
    if (publisher.includes('vertigo') || publisher.includes('image')) {
      genres.push('Mature');
    }
  }

  /**
   * Infer genres from description and deck text
   */
  private inferGenresFromText(data: ComicVineResponse, genres: string[]): void {
    const text = `${data.description ?? ''} ${data.deck ?? ''}`.toLowerCase();

    for (const [keyword, genre] of UnifiedComicVineAdapter.TEXT_GENRE_MAPPINGS) {
      if (text.includes(keyword)) {
        genres.push(genre);
      }
    }
  }

  /**
   * Remove duplicate genres (case-insensitive)
   */
  private deduplicateGenres(genres: string[]): string[] {
    const seen = new Set<string>();
    return genres.filter(g => {
      const lower = g.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
  }
  /**
   * Extract provider-specific fields
   */
  protected extractProviderSpecificFields(rawData: unknown): Record<string, unknown> {
    const data = rawData as ComicVineResponse;

    // Extract enhanced volume data for storage
    const enhancedVolumeData = this.extractEnhancedVolumeData(data);
    const themes = this.extractThemes(data);
    const storyArcs = this.extractStoryArcs(data);
    const { authors, artists } = this.extractStaff(data);

    return {
      deck: data.deck,
      countOfIssues: data.count_of_issues,
      firstIssue: data.first_issue,
      lastIssue: data.last_issue,
      dateAdded: data.date_added,
      dateLastUpdated: data.date_last_updated,
      apiDetailUrl: data.api_detail_url,
      siteDetailUrl: data.site_detail_url,
      // Store enhanced volume data for multi-tiered scraping
      volumeData: enhancedVolumeData,
      totalVolumes: enhancedVolumeData.length,
      // Store aggregated themes and creators
      themes,
      storyArcs,
      creators: {
        authors: authors.map(a => a.name),
        artists: artists.map(a => a.name)
      },
      // Raw concepts for reference
      concepts: data.concepts?.map(c => c.name) ?? [],
      // Keep basic issue data for backward compatibility
      issues: data.issues?.map(issue => ({
        id: issue["id"],
        number: issue.issue_number,
        name: issue["name"],
        coverDate: issue.cover_date,
        storeDate: issue.store_date,
        coverImage: issue.image?.medium_url ?? issue.image?.original_url
      })),
      lastFetched: new Date().toISOString()
    };
  }
}