/**
 * @file-size-justified: aggregates all field-level mappings between provider
 * search results and the wizard form shape; splitting would scatter the
 * provenance logic across files and lose the single-source mapping table.
 *
 * Search to Wizard Data Mapper
 *
 * Maps search results (ExtendedMangaSearchResult) to wizard form data (WizardFormData)
 * ensuring all metadata is preserved through the import flow.
 *
 * @module components/addManga/utils/searchToWizardMapper
 */

import type { ExtendedMangaSearchResult } from '@/types/search.types';
import type { WizardFormData, ProviderMetadata, Volume, Chapter } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

/**
 * Type guard to check if value is a Record
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract tag/theme names from array that may contain strings or objects with 'name' property
 * AniList returns tags as objects: [{ name: 'Action', rank: 90, id: 123 }, ...]
 * This function normalizes them to string array: ['Action', ...]
 */
function extractTagNames(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];

  return tags
    .map((tag: unknown) => {
      if (typeof tag === 'string') return tag;
      if (isRecord(tag) && typeof tag['name'] === 'string') return tag['name'];
      return null;
    })
    .filter((tag): tag is string => tag !== null && tag !== '');
}

/**
 * AniList-specific cover structure
 */
interface AniListCoverImage {
  extraLarge?: string;
  large?: string;
  medium?: string;
  small?: string;
  color?: string;
}

/**
 * AniList-specific banner structure
 */
interface AniListBannerImage {
  large?: string;
  medium?: string;
}

/**
 * Type guard for AniList cover structure
 */
function isAniListCover(value: unknown): value is AniListCoverImage {
  if (!isRecord(value)) return false;
  return (
    typeof value['extraLarge'] === 'string' ||
    typeof value['large'] === 'string' ||
    typeof value['medium'] === 'string'
  );
}

/**
 * Type guard for AniList banner structure
 */
function isAniListBanner(value: unknown): value is AniListBannerImage {
  if (!isRecord(value)) return false;
  return (
    typeof value['large'] === 'string' ||
    typeof value['medium'] === 'string'
  );
}

/**
 * Extract cover URL from various possible fields in search result
 */
// eslint-disable-next-line complexity -- Complex URL extraction with provider-specific logic
function extractCoverUrl(result: ExtendedMangaSearchResult): string | undefined {
  const provider = (result.provider || result["source"] || '').toLowerCase();

  // Special handling for AniList's nested cover structure
  if (provider === 'anilist') {
    const metadata = result.metadata;
    const metadataCover = isRecord(metadata) && typeof metadata['coverImage'] === 'string' ? metadata['coverImage'] : undefined;
    const anilistCover = result.cover ?? result.coverImage ?? metadataCover;
    if (isAniListCover(anilistCover)) {
      return anilistCover.extraLarge ??
             anilistCover.large ??
             anilistCover.medium;
    } else if (typeof anilistCover === 'string') {
      return anilistCover;
    }
  }

  // Standard extraction for other providers
  const metadata = result.metadata;
  const metadataCoverImage = isRecord(metadata) && typeof metadata['coverImage'] === 'string' ? metadata['coverImage'] : undefined;
  const metadataCover = isRecord(metadata) && typeof metadata['cover'] === 'string' ? metadata['cover'] : undefined;
  const resultImage = typeof result['image'] === 'string' ? result['image'] : undefined;

  return result.cover ??
         result.coverImage ??
         result.coverUrl ??
         metadataCoverImage ??
         metadataCover ??
         resultImage;
}

/**
 * Extract banner URL from various possible fields
 */
// eslint-disable-next-line complexity -- Complex banner URL extraction with provider-specific logic
function extractBannerUrl(result: ExtendedMangaSearchResult | Record<string, unknown>): string | undefined {
  const provider = (isRecord(result) && typeof result.provider === 'string' ? result.provider :
                   isRecord(result) && typeof result.source === 'string' ? result.source : '').toLowerCase();

  // Special handling for AniList's nested banner structure
  if (provider === 'anilist') {
    const bannerImageVal = isRecord(result) && typeof result['bannerImage'] === 'string' ? result['bannerImage'] : undefined;
    const bannerVal = isRecord(result) && typeof result['banner'] === 'string' ? result['banner'] : undefined;
    const metadata = isRecord(result) ? result.metadata : undefined;
    const metadataBanner = isRecord(metadata) && typeof metadata['bannerImage'] === 'string' ? metadata['bannerImage'] : undefined;

    const anilistBanner = bannerImageVal ?? bannerVal ?? metadataBanner;
    if (isAniListBanner(anilistBanner)) {
      return anilistBanner.large ??
             anilistBanner.medium;
    } else if (typeof anilistBanner === 'string') {
      return anilistBanner;
    }
  }

  // Standard extraction
  if (!isRecord(result)) return undefined;

  const metadata = result.metadata;
  const resultBannerImage = typeof result['bannerImage'] === 'string' ? result['bannerImage'] : undefined;
  const resultBanner = typeof result['banner'] === 'string' ? result['banner'] : undefined;
  const metadataBannerImage = isRecord(metadata) && typeof metadata['bannerImage'] === 'string' ? metadata['bannerImage'] : undefined;
  const metadataBanner = isRecord(metadata) && typeof metadata['banner'] === 'string' ? metadata['banner'] : undefined;

  return resultBannerImage ??
         resultBanner ??
         metadataBannerImage ??
         metadataBanner;
}

/**
 * Extract array field with type safety
 */
function extractArray<T>(result: ExtendedMangaSearchResult, field: string): T[] | undefined {
  if (!isRecord(result)) return undefined;

  const directValue = result[field];
  if (Array.isArray(directValue)) return directValue as T[];

  const metadata = result.metadata;
  if (isRecord(metadata)) {
    const metadataValue = metadata[field];
    if (Array.isArray(metadataValue)) return metadataValue as T[];
  }

  return undefined;
}

/**
 * Extract string field with fallbacks
 */
function extractString(result: ExtendedMangaSearchResult, field: string): string | undefined {
  if (!isRecord(result)) return undefined;

  const directValue = result[field];
  if (typeof directValue === 'string') return directValue;

  const metadata = result.metadata;
  if (isRecord(metadata)) {
    const metadataValue = metadata[field];
    if (typeof metadataValue === 'string') return metadataValue;
  }

  return undefined;
}

/**
 * Extract number field with fallbacks
 */
function extractNumber(result: ExtendedMangaSearchResult, field: string): number | undefined {
  if (!isRecord(result)) return undefined;

  const directValue = result[field];
  if (typeof directValue === 'number') return directValue;

  const metadata = result.metadata;
  if (isRecord(metadata)) {
    const metadataValue = metadata[field];
    if (typeof metadataValue === 'number') return metadataValue;
  }

  return undefined;
}

/**
 * AniList date object structure
 */
interface AniListDate {
  year?: number;
  month?: number;
  day?: number;
}

/**
 * Type guard for AniList date structure
 */
function isAniListDate(value: unknown): value is AniListDate {
  return isRecord(value) && typeof value['year'] === 'number';
}

/**
 * Format AniList date to ISO string
 */
function formatAniListDate(date: AniListDate): string {
  const year = date.year ?? 0;
  const month = date.month !== undefined ? String(date.month).padStart(2, '0') : '01';
  const day = date.day !== undefined ? String(date.day).padStart(2, '0') : '01';
  return `${year}-${month}-${day}`;
}

/**
 * Extract and format date field from various formats
 * Handles both string dates and AniList date objects {year, month, day}
 */
function extractDate(result: ExtendedMangaSearchResult, field: string): string | undefined {
  if (!isRecord(result)) return undefined;

  const directValue = result[field];
  const metadata = result.metadata;
  const metadataValue = isRecord(metadata) ? metadata[field] : undefined;

  // Try direct value first
  if (directValue) {
    // If it's already a string, return it
    if (typeof directValue === 'string') return directValue;

    // If it's an AniList date object {year, month, day}
    if (isAniListDate(directValue)) {
      return formatAniListDate(directValue);
    }
  }

  // Try metadata value
  if (metadataValue) {
    // If it's a string, return it
    if (typeof metadataValue === 'string') return metadataValue;

    // If it's an AniList date object {year, month, day}
    if (isAniListDate(metadataValue)) {
      return formatAniListDate(metadataValue);
    }
  }

  return undefined;
}

/**
 * AniList title object structure
 */
interface AniListTitleObject {
  romaji?: string;
  english?: string;
  native?: string;
  userPreferred?: string;
}

/**
 * Type guard for AniList title object
 */
function isAniListTitleObject(value: unknown): value is AniListTitleObject {
  if (!isRecord(value)) return false;
  return (
    typeof value['romaji'] === 'string' ||
    typeof value['english'] === 'string' ||
    typeof value['native'] === 'string' ||
    typeof value['userPreferred'] === 'string'
  );
}

/**
 * Extract all alternative titles from various sources
 * Handles AniList nested title object and synonyms array
 */
function extractAlternativeTitles(result: ExtendedMangaSearchResult): string[] {
  const titles: string[] = [];

  // Extract from alternativeTitles array (already processed by SearchResultValidator)
  if (Array.isArray(result.alternativeTitles)) {
    const altTitles = result.alternativeTitles.filter((t): t is string => typeof t === 'string');
    titles.push(...altTitles);
  }

  // Extract from metadata.alternativeTitles
  const metadata = result.metadata;
  if (isRecord(metadata) && Array.isArray(metadata['alternativeTitles'])) {
    const metaAltTitles = metadata['alternativeTitles'].filter((t): t is string => typeof t === 'string');
    titles.push(...metaAltTitles);
  }

  // Extract from AniList nested title object (if not already extracted)
  const titleValue = result.title;
  if (isAniListTitleObject(titleValue)) {
    if (titleValue.romaji) titles.push(titleValue.romaji);
    if (titleValue.english) titles.push(titleValue.english);
    if (titleValue.native) titles.push(titleValue.native);
    if (titleValue.userPreferred) titles.push(titleValue.userPreferred);
  }

  // Extract from synonyms array (AniList)
  const synonymsValue = result['synonyms'];
  if (Array.isArray(synonymsValue)) {
    const synonyms = synonymsValue.filter((s): s is string => typeof s === 'string');
    titles.push(...synonyms);
  }

  // Extract from metadata.synonyms
  if (isRecord(metadata) && Array.isArray(metadata['synonyms'])) {
    const metaSynonyms = metadata['synonyms'].filter((s): s is string => typeof s === 'string');
    titles.push(...metaSynonyms);
  }

  // Remove duplicates and empty strings, filter out the main title
  const mainTitle = typeof result.title === 'string' ? result.title : '';
  return [...new Set(titles)]
    .filter(Boolean)
    .filter(t => t !== mainTitle);
}

/**
 * Map search result to ProviderMetadata format
 */
// eslint-disable-next-line max-statements, complexity -- Complex metadata mapping with extensive field processing
export function mapToProviderMetadata(result: ExtendedMangaSearchResult): ProviderMetadata {
  const metadata = result.metadata;
  const rawData = result.rawData;

  // Debug: Log ComicVine-specific fields to trace siteDetailUrl
  const provider = (result.provider || result.source || '').toLowerCase();

  // Debug: Log authors/artists/idMal fields for tracing
  logger.info('[mapToProviderMetadata] Input result metadata fields:', {
    provider,
    resultAuthors: result.authors,
    resultArtists: isRecord(result) ? result['artists'] : undefined,
    metadataAuthors: isRecord(metadata) ? metadata['authors'] : undefined,
    metadataArtists: isRecord(metadata) ? metadata['artists'] : undefined,
    resultIdMal: isRecord(result) ? result['idMal'] : undefined,
    metadataIdMal: isRecord(metadata) ? metadata['idMal'] : undefined,
  });
  if (provider === 'comicvine') {
    logger.info('[mapToProviderMetadata] ComicVine result properties:', {
      hasResult: !!result,
      resultKeys: Object.keys(result),
      siteDetailUrl: isRecord(result) ? result['siteDetailUrl'] : undefined,
      site_detail_url: isRecord(result) ? result['site_detail_url'] : undefined,
      url: isRecord(result) ? result['url'] : undefined,
      hasMetadata: !!metadata,
      metadataKeys: isRecord(metadata) ? Object.keys(metadata) : [],
      hasRawData: !!rawData,
      rawDataKeys: isRecord(rawData) ? Object.keys(rawData) : [],
      rawDataSiteDetailUrl: isRecord(rawData) ? rawData['site_detail_url'] : undefined,
    });
  }

  // Extract gallery/images safely
  const gallery: string[] | undefined = (isRecord(result) && Array.isArray(result['gallery']) ? result['gallery'] as string[] : undefined) ??
                  (isRecord(result) && Array.isArray(result['images']) ? result['images'] as string[] : undefined) ??
                  (isRecord(metadata) && Array.isArray(metadata['gallery']) ? metadata['gallery'] as string[] : undefined);
  const images: string[] | undefined = (isRecord(result) && Array.isArray(result['images']) ? result['images'] as string[] : undefined) ??
                 (isRecord(result) && Array.isArray(result['gallery']) ? result['gallery'] as string[] : undefined) ??
                 (isRecord(metadata) && Array.isArray(metadata['images']) ? metadata['images'] as string[] : undefined);

  // Extract volume/chapter data safely
  // Check for volumeData first (Wikipedia), then volumes (other providers), then metadata
  const volumeData: Volume[] | undefined =
    (isRecord(result) && Array.isArray(result['volumeData']) ? result['volumeData'] as Volume[] : undefined) ??
    (isRecord(result) && Array.isArray(result['volumes']) ? result['volumes'] as Volume[] : undefined) ??
    (isRecord(rawData) && Array.isArray(rawData['volumeList']) ? rawData['volumeList'] as Volume[] : undefined) ??
    (isRecord(rawData) && Array.isArray(rawData['volumes']) ? rawData['volumes'] as Volume[] : undefined) ??
    (isRecord(metadata) && Array.isArray(metadata['volumeData']) ? metadata['volumeData'] as Volume[] : undefined);

  // Log volumeData extraction for Wikipedia (server-side debugging)
  if (provider === 'wikipedia') {
    logger.info('[mapToProviderMetadata] Wikipedia volumeData extraction:', {
      hasResultVolumeData: isRecord(result) && Array.isArray(result['volumeData']),
      hasRawDataVolumeList: isRecord(rawData) && Array.isArray(rawData['volumeList']),
      finalVolumeDataLength: volumeData?.length ?? 0,
    });
  }

  // Check for chapterData first, then chapters, then nested in rawData
  const chapterData: Chapter[] | undefined =
    (isRecord(result) && Array.isArray(result['chapterData']) ? result['chapterData'] as Chapter[] : undefined) ??
    (isRecord(result) && Array.isArray(result['chapters']) ? result['chapters'] as Chapter[] : undefined) ??
    (isRecord(rawData) && Array.isArray(rawData['chapterList']) ? rawData['chapterList'] as Chapter[] : undefined) ??
    (isRecord(rawData) && Array.isArray(rawData['chapters']) ? rawData['chapters'] as Chapter[] : undefined) ??
    (isRecord(metadata) && Array.isArray(metadata['chapterData']) ? metadata['chapterData'] as Chapter[] : undefined);

  // Extract URL fields
  const url = isRecord(result) && typeof result['url'] === 'string' ? result['url'] : undefined;
  const wikiUrl = isRecord(result) && typeof result['wikiUrl'] === 'string' ? result['wikiUrl'] : undefined;
  const siteUrl = isRecord(result) && typeof result['siteUrl'] === 'string' ? result['siteUrl'] : undefined;

  // Extract siteDetailUrl from multiple locations (ComicVine uses site_detail_url)
  const siteDetailUrl = (() => {
    // Check direct properties first
    if (isRecord(result) && typeof result['siteDetailUrl'] === 'string') return result['siteDetailUrl'];
    if (isRecord(result) && typeof result['site_detail_url'] === 'string') return result['site_detail_url'];

    // Check rawData (ComicVine API response)
    if (isRecord(rawData)) {
      if (typeof rawData['site_detail_url'] === 'string') return rawData['site_detail_url'];
      if (typeof rawData['siteDetailUrl'] === 'string') return rawData['siteDetailUrl'];
    }

    // Check metadata
    if (isRecord(metadata)) {
      if (typeof metadata['siteDetailUrl'] === 'string') return metadata['siteDetailUrl'];
      if (typeof metadata['site_detail_url'] === 'string') return metadata['site_detail_url'];

      // Check nested metadata.rawData (ComicVine stores rawData inside metadata)
      const metadataRawData = metadata['rawData'];
      if (isRecord(metadataRawData)) {
        if (typeof metadataRawData['site_detail_url'] === 'string') return metadataRawData['site_detail_url'];
        if (typeof metadataRawData['siteDetailUrl'] === 'string') return metadataRawData['siteDetailUrl'];
      }
    }

    return undefined;
  })();

  const links = isRecord(result) ? result['links'] : undefined;
  const isAdult = isRecord(result) && typeof result['isAdult'] === 'boolean' ? result['isAdult'] : undefined;
  const rawOrProviderData = result.rawData ?? result.providerSpecific;

  const providerData: ProviderMetadata = {
    id: String(result.id),
    sourceId: result.sourceId ?? String(result.id),
    title: result.title,
    alternativeTitles: extractAlternativeTitles(result)
  };

  // Only add optional fields if they're not undefined
  if (result.description !== undefined) providerData.description = result.description;
  const synopsis = extractString(result, 'synopsis');
  if (synopsis !== undefined) providerData.synopsis = synopsis;
  if (result.status !== undefined) providerData.status = result.status;
  const format = extractString(result, 'format');
  if (format !== undefined) providerData.format = format;
  if (result.genres !== undefined) providerData.genres = result.genres;
  // Extract tags - handle both string arrays and object arrays (AniList returns { name, rank } objects)
  const rawTags = extractArray<unknown>(result, 'tags');
  const tags = extractTagNames(rawTags);
  if (tags.length > 0) providerData.tags = tags;
  // Extract themes - handle both string arrays and object arrays
  const rawThemes = extractArray<unknown>(result, 'themes');
  const themes = extractTagNames(rawThemes);
  if (themes.length > 0) providerData.themes = themes;
  // Use extractArray for authors to check both direct and metadata locations
  // Also prefer non-empty arrays over empty ones (empty [] from search vs populated from metadata)
  const directAuthors = result.authors;
  const metadataAuthors = extractArray<string>(result, 'authors');
  const authors = (directAuthors && directAuthors.length > 0) ? directAuthors : metadataAuthors;
  logger.debug('[mapToProviderMetadata] Authors extraction', {
    provider,
    directAuthors,
    directAuthorsLength: directAuthors?.length ?? 0,
    metadataAuthors,
    metadataAuthorsLength: metadataAuthors?.length ?? 0,
    finalAuthors: authors,
    finalAuthorsLength: authors?.length ?? 0,
  });
  if (authors !== undefined && authors.length > 0) providerData.authors = authors;
  // Use extractArray for artists - also prefer non-empty arrays
  const directArtists = isRecord(result) && Array.isArray(result['artists']) ? result['artists'] as string[] : undefined;
  const metadataArtists = extractArray<string>(result, 'artists');
  const artists = (directArtists && directArtists.length > 0) ? directArtists : metadataArtists;
  if (artists !== undefined && artists.length > 0) providerData.artists = artists;
  const publisher = extractString(result, 'publisher');
  if (publisher !== undefined) providerData.publisher = publisher;
  const demographic = extractString(result, 'demographic');
  if (demographic !== undefined) providerData.demographic = demographic;
  const startDate = extractDate(result, 'startDate');
  if (startDate !== undefined) providerData.startDate = startDate;
  const endDate = extractDate(result, 'endDate');
  if (endDate !== undefined) providerData.endDate = endDate;
  const volumes = extractNumber(result, 'volumes');
  if (volumes !== undefined) providerData.volumes = volumes;
  const chapters = extractNumber(result, 'chapters');
  if (chapters !== undefined) providerData.chapters = chapters;
  const coverUrl = extractCoverUrl(result);
  if (coverUrl !== undefined) {
    providerData.coverImage = coverUrl;
    providerData.coverUrl = coverUrl;
  }
  const bannerUrl = extractBannerUrl(result);
  if (bannerUrl !== undefined) providerData.bannerImage = bannerUrl;
  if (url !== undefined) providerData.url = url;
  if (wikiUrl !== undefined) providerData.wikiUrl = wikiUrl;
  if (siteUrl !== undefined) providerData.siteUrl = siteUrl;
  if (siteDetailUrl !== undefined) providerData.siteDetailUrl = siteDetailUrl;
  if (links !== null && typeof links === 'object' && !Array.isArray(links)) {
    providerData.links = links as Record<string, string>;
  }
  const externalLinks = extractArray<string>(result, 'externalLinks');
  if (externalLinks !== undefined) providerData.externalLinks = externalLinks;
  const idMal = extractNumber(result, 'idMal');
  if (idMal !== undefined) providerData.idMal = idMal;
  const anilistId = extractNumber(result, 'anilistId');
  if (anilistId !== undefined) providerData.anilistId = anilistId;
  const comicVineId = extractString(result, 'comicVineId');
  if (comicVineId !== undefined) providerData.comicVineId = comicVineId;
  const mangaUpdatesId = extractString(result, 'mangaUpdatesId');
  if (mangaUpdatesId !== undefined) providerData.mangaUpdatesId = mangaUpdatesId;
  const averageScore = extractNumber(result, 'averageScore');
  if (averageScore !== undefined) providerData.averageScore = averageScore;
  const popularity = extractNumber(result, 'popularity');
  if (popularity !== undefined) providerData.popularity = popularity;
  if (rawOrProviderData !== undefined) providerData.rawData = rawOrProviderData;
  if (metadata !== undefined) providerData.metadata = metadata;
  if (isAdult !== undefined) providerData.isAdult = isAdult;
  if (gallery !== undefined) providerData.gallery = gallery;
  if (images !== undefined) providerData.images = images;
  if (volumeData !== undefined) providerData.volumeData = volumeData;
  if (chapterData !== undefined) providerData.chapterData = chapterData;

  return providerData;
}

/**
 * Maps a search result to wizard form data
 *
 * @param result - The selected search result
 * @param allResults - All search results from all providers (for caching)
 * @returns Partial wizard form data to initialize the wizard
 */
// eslint-disable-next-line complexity -- Complex data transformation orchestrator
export function mapSearchResultToWizardData(
  result: ExtendedMangaSearchResult,
  allResults?: Record<string, unknown[]>
): Partial<WizardFormData> {
  logger.info('[searchToWizardMapper] Mapping search result to wizard data:', {
    title: result.title,
    provider: result.provider || result.source,
    hasMetadata: !!result.metadata,
    hasRawData: !!result.rawData
  });

  const provider = result.provider || result.source || 'unknown';

  // Extract all possible data from the search result
  const mappedData = {
    // Basic info
    title: result.title,
    ...(extractAlternativeTitles(result).length > 0 && { alternativeTitles: extractAlternativeTitles(result) }),
    ...(result.description !== undefined && { description: result.description }),
    ...(extractString(result, 'synopsis') !== undefined && { synopsis: extractString(result, 'synopsis') }),

    // Cover and media
    ...(extractCoverUrl(result) !== undefined && { coverUrl: extractCoverUrl(result) }),
    ...(extractBannerUrl(result) !== undefined && { bannerUrl: extractBannerUrl(result) }),

    // Publication details
    ...(result.status !== undefined && { status: result.status }),
    ...(extractString(result, 'format') !== undefined && { format: extractString(result, 'format') }),
    ...(extractString(result, 'publisher') !== undefined && { publisher: extractString(result, 'publisher') }),
    ...(extractString(result, 'demographic') !== undefined && { demographic: extractString(result, 'demographic') }),
    ...(extractDate(result, 'startDate') !== undefined && { startDate: extractDate(result, 'startDate') }),
    ...(extractDate(result, 'endDate') !== undefined && { endDate: extractDate(result, 'endDate') }),
    ...(extractNumber(result, 'releaseYear') !== undefined && { releaseYear: extractNumber(result, 'releaseYear') }),
    ...(extractNumber(result, 'averageScore') !== undefined && { averageScore: extractNumber(result, 'averageScore') }),
    ...(extractNumber(result, 'popularity') !== undefined && { popularity: extractNumber(result, 'popularity') }),

    // Genre and tags - use extractTagNames to handle both string and object arrays
    ...((result.genres?.length ?? 0) > 0 && { genres: result.genres }),
    ...(extractTagNames(extractArray(result, 'themes')).length > 0 && { themes: extractTagNames(extractArray(result, 'themes')) }),
    ...(extractTagNames(extractArray(result, 'tags')).length > 0 && { tags: extractTagNames(extractArray(result, 'tags')) }),

    // Authors and artists
    ...((result.authors?.length ?? 0) > 0 && { authors: result.authors }),
    ...((extractArray(result, 'artists')?.length ?? 0) > 0 && { artists: extractArray(result, 'artists') }),

    // Volume and chapter info
    ...(extractNumber(result, 'volumes') !== undefined && { volumes: extractNumber(result, 'volumes') }),
    ...(extractNumber(result, 'chapters') !== undefined && { chapters: extractNumber(result, 'chapters') }),

    // External IDs - only include if at least one ID is present
    ...((extractNumber(result, 'anilistId') ?? extractNumber(result, 'idMal') ?? extractString(result, 'comicVineId') ?? extractString(result, 'kitsuId') ?? extractString(result, 'mangaUpdatesId')) && {
      externalIds: {
        anilistId: String(extractNumber(result, 'anilistId') ?? ''),
        malId: String(extractNumber(result, 'idMal') ?? ''),
        comicVineId: extractString(result, 'comicVineId') ?? '',
        kitsuId: extractString(result, 'kitsuId') ?? '',
        mangaUpdatesId: extractString(result, 'mangaUpdatesId') ?? ''
      }
    }),

    // External links
    ...((extractArray(result, 'externalLinks')?.length ?? 0) > 0 && { externalLinks: extractArray(result, 'externalLinks') }),

    // Provider info
    ...(provider && provider !== 'unknown' && { searchProvider: provider }),
    ...(provider && provider !== 'unknown' && { selectedSource: provider }),
    ...((result.sourceId ?? result.id) && { selectedSourceId: result.sourceId ?? String(result.id) }),

    // Cache all search results for cross-provider metadata selection
    ...(allResults ? { cachedSearchResults: Object.values(allResults).flat() } : { cachedSearchResults: [result] }),

    // Store metadata from the search result
    ...(result.metadata && typeof result.metadata === 'object' ? { metadata: result.metadata as Record<string, unknown> } : {})
  };

  logger.info('[searchToWizardMapper] Mapped data fields:', {
    hasTitle: !!mappedData.title,
    hasDescription: !!mappedData.description,
    hasGenres: !!mappedData.genres?.length,
    hasAuthors: !!mappedData.authors?.length,
    hasCoverUrl: !!mappedData.coverUrl,
    provider: mappedData.searchProvider
  });

  return mappedData as Partial<WizardFormData>;
}

/**
 * Maps all search results to selectedSourcesMetadata format
 *
 * @param allResults - All search results grouped by provider
 * @param selectedResult - The primary selected result
 * @returns Record of provider metadata
 */
export function mapSearchResultsToProviderMetadata(
  allResults: Record<string, unknown[]>,
  selectedResult: ExtendedMangaSearchResult
): Record<string, ProviderMetadata> {
  const providerMetadata: Record<string, ProviderMetadata> = {};

  // Add the primary selected result
  const primaryProvider = selectedResult.provider || selectedResult.source || 'unknown';
  providerMetadata[primaryProvider] = mapToProviderMetadata(selectedResult);

  // Add other matching results from search (for cross-provider selection)
  Object.entries(allResults).forEach(([provider, results]) => {
    if (results.length > 0 && provider !== primaryProvider) {
      // Find the best match in this provider's results
      // For now, just take the first result - could enhance with fuzzy matching
      const bestMatch = results[0];
      if (bestMatch) {
        providerMetadata[provider] = mapToProviderMetadata(bestMatch as ExtendedMangaSearchResult);
      }
    }
  });

  logger.info('[searchToWizardMapper] Created provider metadata for providers:',
    Object.keys(providerMetadata)
  );

  return providerMetadata;
}

/**
 * Type guard to check if data came from search
 */
export function isSearchDerivedData(formData: Partial<WizardFormData>): boolean {
  return !!formData.cachedSearchResults && formData.cachedSearchResults.length > 0;
}
