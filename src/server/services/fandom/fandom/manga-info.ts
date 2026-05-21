/**
 * Fandom Manga Info Extraction
 *
 * Extracts manga information using both dynamic and static parsing methods.
 * Primary: Dynamic parsing for rich data extraction
 * Fallback: Static MediaWiki API for basic data
 */

import { logger } from '@/utils/logger';

import type {
  WikiContentScraper,
  ScrapingResult,
  VolumeInfo,
  ChapterInfo
} from '../dynamic/WikiContentScraper';
import type { MediaWikiAPI } from '../MediaWikiAPI';
import type {
  FandomMangaData,
  WikiConfig,
  FandomPageMetadata,
  MediaWikiPage
} from '../types';

const log = logger.child('FandomMangaInfo');

// ============================================================================
// Type Definitions
// ============================================================================

export interface BulkFetchOptions {
  includeChapterDetails?: boolean;
  maxChaptersPerVolume?: number;
  cacheResults?: boolean;
}

export interface BulkFetchResult {
  volumes: unknown[];
  chapters: unknown[];
  totalChapters: number;
  fetchTime: number;
}

export interface MangaInfoDependencies {
  mediaWikiAPI: MediaWikiAPI;
  wikiConfig: WikiConfig;
  contentScraper: WikiContentScraper;
  getPageMetadata: (title: string) => Promise<FandomPageMetadata | null>;
  bulkFetchVolumeChapterData: (url?: string, options?: BulkFetchOptions) => Promise<BulkFetchResult>;
  getAllChapters: (limit?: number) => Promise<string[]>;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get manga information (PUBLIC API method)
 *
 * Orchestrates between dynamic and static parsing:
 * - PRIMARY: Uses dynamic parsing for rich data extraction
 * - FALLBACK: Falls back to static MediaWiki API if dynamic fails
 */
export async function getMangaInfo(
  title: string,
  deps: MangaInfoDependencies
): Promise<FandomMangaData | null> {
  try {
    // PRIMARY PATH: Use dynamic parsing for rich data extraction
    log.info('Getting manga info via dynamic parsing', { title });
    const mangaData = await getDynamicMangaInfo(title, deps);

    log.info('Dynamic parsing succeeded, returning rich data', {
      title,
      source: mangaData.source,
      volumesCount: mangaData.volumeList?.length,
      chaptersCount: mangaData.chapterList?.length
    });

    return mangaData;
  } catch (dynamicError: unknown) {
    const dynamicErrorMessage = dynamicError instanceof Error ? dynamicError.message : String(dynamicError);

    log.warn('Dynamic parsing failed, falling back to static parsing', {
      title,
      dynamicError: dynamicErrorMessage
    });

    try {
      // FALLBACK PATH: Use static MediaWiki API parsing
      const mangaData = await getStaticMangaInfo(title, deps);

      if (mangaData) {
        mangaData.source = 'static';

        log.info('Static parsing succeeded, returning basic data', {
          title,
          source: mangaData.source
        });

        return mangaData;
      }

      log.warn('Static parsing returned null', { title });
      return null;
    } catch (staticError: unknown) {
      const staticErrorMessage = staticError instanceof Error ? staticError.message : String(staticError);

      log.error('Both dynamic and static parsing failed', {
        title,
        dynamicError: dynamicErrorMessage,
        staticError: staticErrorMessage
      });

      return null;
    }
  }
}

// ============================================================================
// Static Parsing
// ============================================================================

/**
 * Get manga information using static MediaWiki API parsing (FALLBACK method)
 */
async function getStaticMangaInfo(
  title: string,
  deps: MangaInfoDependencies
): Promise<FandomMangaData | null> {
  try {
    const page = await deps.mediaWikiAPI.getPageByTitle(title);
    if (!page) {
      return null;
    }

    const mangaData: FandomMangaData = { title };

    // Extract data in separate steps - merge results into mangaData
    const infoboxResult = extractInfoboxData(page, deps.mediaWikiAPI);
    Object.assign(mangaData, infoboxResult);

    const synopsisResult = extractSynopsis(page, deps.mediaWikiAPI);
    Object.assign(mangaData, synopsisResult);

    const genresResult = extractGenres(page);
    Object.assign(mangaData, genresResult);

    const charactersResult = await extractCharacters(deps);
    Object.assign(mangaData, charactersResult);

    const volumeChapterResult = await extractVolumeChapterData(title, deps);
    Object.assign(mangaData, volumeChapterResult);

    return mangaData;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Failed to get manga info', { title, errorMessage });
    return null;
  }
}

/**
 * Extract infobox data from page
 */
function extractInfoboxData(
  page: MediaWikiPage,
  mediaWikiAPI: MediaWikiAPI
): Partial<FandomMangaData> {
  const result: Partial<FandomMangaData> = {};

  if (!page.pageprops?.infoboxes) {
    return result;
  }

  const infoboxes = mediaWikiAPI.parseInfobox(page.pageprops.infoboxes);
  if (!infoboxes?.[0]) {
    return result;
  }

  const infoboxData = mediaWikiAPI.extractInfoboxData(infoboxes[0]);

  // Basic metadata
  result.author = (infoboxData['Author'] ?? infoboxData['Written by']) as string;
  result.publisher = (infoboxData['Publisher'] ?? infoboxData['English publisher']) as string;
  result.magazine = (infoboxData['Magazine'] ?? infoboxData['Serialized in']) as string;
  result.published = (infoboxData['Published'] ?? infoboxData['Original run']) as string;
  result.demographic = infoboxData['Demographic'] as string;
  result.status = infoboxData['Status'] as string;

  // Parse volumes
  if (infoboxData['Volumes']) {
    const volStr = String(infoboxData['Volumes']);
    const volNum = parseInt(volStr.replace(/[^0-9]/g, ''));
    result.volumes = !isNaN(volNum) ? String(volNum) : infoboxData['Volumes'] as string;
  }

  // Parse chapters
  if (infoboxData['Chapters']) {
    const chapStr = String(infoboxData['Chapters']);
    const chapNum = parseInt(chapStr.replace(/[^0-9]/g, ''));
    result.chapters = !isNaN(chapNum) ? String(chapNum) : infoboxData['Chapters'] as string;
  }

  // Process cover image
  if (infoboxData['image']) {
    result.coverImage = processImageUrl(infoboxData['image'] as string, mediaWikiAPI);
  }

  return result;
}

/**
 * Process and convert image URL to direct path
 */
function processImageUrl(imageUrl: string, mediaWikiAPI: MediaWikiAPI): string {
  if (!imageUrl.startsWith('https://') || !imageUrl.includes('/wiki/File:')) {
    return imageUrl;
  }

  const fileName = imageUrl.split('/wiki/File:')[1];
  if (!fileName) {
    return imageUrl;
  }

  const config = mediaWikiAPI['config'] as { baseUrl: string };
  const subdomain = new URL(config.baseUrl).hostname.split('.')[0];
  return `https://${subdomain}.fandom.com/wiki/Special:FilePath/${fileName}`;
}

/**
 * Extract synopsis from wikitext
 */
function extractSynopsis(
  page: MediaWikiPage,
  mediaWikiAPI: MediaWikiAPI
): Partial<FandomMangaData> {
  const result: Partial<FandomMangaData> = {};

  if (!page.revisions?.[0]?.slots?.main?.['*']) {
    return result;
  }

  const wikitext = page.revisions[0].slots.main['*'];
  const sections = mediaWikiAPI.parseWikitext(wikitext);

  const synopsisSection = sections.find(s =>
    s.title.toLowerCase().includes('synopsis') ||
    s.title.toLowerCase().includes('plot') ||
    s.title.toLowerCase().includes('story')
  );

  if (synopsisSection) {
    result.synopsis = cleanWikitext(synopsisSection.content);
  }

  return result;
}

/**
 * Extract genres from categories
 */
function extractGenres(page: MediaWikiPage): Partial<FandomMangaData> {
  const result: Partial<FandomMangaData> = {};

  if (!page.categories) {
    return result;
  }

  const genreCategories = page.categories
    .map(cat => cat.title.replace('Category:', ''))
    .filter(cat =>
      cat.includes('manga') ||
      cat.includes('Manga') ||
      cat.includes('genre') ||
      cat.includes('Genre')
    );

  if (genreCategories.length > 0) {
    result.genres = genreCategories;
  }

  return result;
}

/**
 * Extract characters from wiki categories
 */
async function extractCharacters(
  deps: MangaInfoDependencies
): Promise<Partial<FandomMangaData>> {
  const result: Partial<FandomMangaData> = {};

  if (!deps.wikiConfig.categories?.characters) {
    return result;
  }

  const characters = await deps.mediaWikiAPI.getCategoryMembers(
    deps.wikiConfig.categories.characters,
    { limit: 100 }
  );

  const config = deps.mediaWikiAPI['config'] as { baseUrl: string };

  result.characters = characters.map(char => ({
    name: char.title,
    url: `${config.baseUrl}/wiki/${encodeURIComponent(char.title)}`
  }));

  return result;
}

/**
 * Extract volume and chapter data
 */
async function extractVolumeChapterData(
  title: string,
  deps: MangaInfoDependencies
): Promise<Partial<FandomMangaData>> {
  try {
    const pageMetadata = await deps.getPageMetadata(title);

    if (pageMetadata?.volumesListUrl) {
      return await extractFromVolumesList(pageMetadata.volumesListUrl, deps);
    }
    return await extractFromCategory(deps);
  } catch (bulkError: unknown) {
    log.warn('Failed to fetch bulk volume/chapter data', {
      error: bulkError instanceof Error ? bulkError.message : String(bulkError)
    });
    return {};
  }
}

/**
 * Extract data from volumes list URL
 */
async function extractFromVolumesList(
  volumesListUrl: string,
  deps: MangaInfoDependencies
): Promise<Partial<FandomMangaData>> {
  const result: Partial<FandomMangaData> = {};

  log.info('Found volumes list URL, fetching bulk data', { url: volumesListUrl });

  const bulkData = await deps.bulkFetchVolumeChapterData(volumesListUrl, {
    includeChapterDetails: false,
    cacheResults: true
  });

  if (bulkData.volumes.length > 0) {
    result.volumeList = bulkData.volumes as NonNullable<FandomMangaData['volumeList']>;
    log.info('Stored volume list', { count: result.volumeList.length });
  }

  if (bulkData.chapters.length > 0) {
    result.chapterList = bulkData.chapters as NonNullable<FandomMangaData['chapterList']>;
    log.info('Stored chapter list', { count: result.chapterList.length });
  }

  return result;
}

/**
 * Extract chapters from category
 */
async function extractFromCategory(
  deps: MangaInfoDependencies
): Promise<Partial<FandomMangaData>> {
  const result: Partial<FandomMangaData> = {};

  log.info('No volumes list URL found, trying category-based chapter fetching');

  const chapterTitles = await deps.getAllChapters(100);

  if (chapterTitles.length > 0) {
    const config = deps.mediaWikiAPI['config'] as { baseUrl: string };

    result.chapterList = chapterTitles.map(chapterTitle => ({
      title: chapterTitle,
      url: `${config.baseUrl}/wiki/${encodeURIComponent(chapterTitle)}`
    }));

    log.info('Fetched chapters from category', { count: result.chapterList.length });
  }

  return result;
}

// ============================================================================
// Dynamic Parsing
// ============================================================================

/**
 * Get manga information using dynamic parsing (PRIMARY method)
 */
async function getDynamicMangaInfo(
  title: string,
  deps: MangaInfoDependencies
): Promise<FandomMangaData> {
  try {
    const wikiUrl = `https://${deps.wikiConfig.subdomain}.fandom.com/wiki/${encodeURIComponent(title)}`;

    log.info('Attempting dynamic parsing', { title, wikiUrl });

    const scrapedData = await deps.contentScraper.scrapeMangaWiki(wikiUrl, {
      maxDepth: 2,
      followLinks: true,
      extractSummaries: true,
      cacheResults: true,
      timeout: 30000,
      retryAttempts: 2
    });

    if (!scrapedData.success || (scrapedData.errors && scrapedData.errors.length > 0)) {
      throw new Error(`Dynamic parsing failed: ${scrapedData.errors?.join(', ') ?? 'Unknown error'}`);
    }

    const mangaData = mapScrapedToMangaData(scrapedData, title);

    log.info('Dynamic parsing succeeded', {
      title,
      volumesFound: scrapedData.totalVolumes,
      chaptersFound: scrapedData.totalChapters
    });

    return mangaData;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Dynamic parsing failed', { title, errorMessage });
    throw new Error(`Dynamic parsing failed for "${title}": ${errorMessage}`);
  }
}

/**
 * Map scraped data to FandomMangaData structure
 */
function mapScrapedToMangaData(scrapedData: ScrapingResult, title: string): FandomMangaData {
  const metadata = scrapedData.metadata;

  // Create base manga data
  const mangaData: FandomMangaData = {
    title: metadata?.title ?? title,
    totalChapters: scrapedData.totalChapters,
    links: { mainPage: scrapedData.mainPageUrl },
    stats: {
      totalVolumes: scrapedData.totalVolumes,
      totalChapters: scrapedData.totalChapters,
      lastUpdated: new Date().toISOString()
    },
    source: 'dynamic',
    coverArt: buildCoverArt(scrapedData)
  };

  // Merge all additional data
  Object.assign(mangaData, extractVolumesAndChaptersFromScraped(scrapedData));
  Object.assign(mangaData, extractMetadataFields(metadata));
  Object.assign(mangaData, extractCountsAndGallery(scrapedData));

  // Add rich metadata object
  const metadataObj = buildMetadataObject(metadata);
  if (metadataObj) {
    mangaData.metadata = metadataObj;
  }

  // Add volumes page link
  if (scrapedData.volumesPageUrl && mangaData.links) {
    mangaData.links.volumesPage = scrapedData.volumesPageUrl;
  }

  return mangaData;
}

/**
 * Extract volume and chapter lists from scraped data
 */
function extractVolumesAndChaptersFromScraped(scrapedData: ScrapingResult): Partial<FandomMangaData> {
  const result: Partial<FandomMangaData> = {};

  const volumeList = mapVolumes(scrapedData.volumes);
  if (volumeList.length > 0) {
    result.volumeList = volumeList;
  }

  const chapterList = mapChapters(scrapedData.chapters);
  if (chapterList.length > 0) {
    result.chapterList = chapterList;
  }

  return result;
}

/**
 * Extract metadata fields from wiki metadata
 */
function extractMetadataFields(
  metadata: ScrapingResult['metadata']
): Partial<FandomMangaData> {
  const result: Partial<FandomMangaData> = {};

  if (!metadata) {
    return result;
  }

  if (metadata.alternativeTitles) {
    result.alternativeTitles = metadata.alternativeTitles;
  }
  if (metadata.author) {
    result.author = metadata.author;
  }
  if (metadata.publisher) {
    result.publisher = metadata.publisher;
  }
  if (metadata.demographic) {
    result.demographic = metadata.demographic;
  }
  if (metadata.genres) {
    result.genres = metadata.genres;
  }
  if (metadata.format) {
    result.format = metadata.format;
  }
  if (metadata.status) {
    result.status = metadata.status;
  }
  if (metadata.description) {
    result.synopsis = metadata.description;
    result.description = metadata.description;
  }
  if (metadata.descriptions) {
    result.descriptions = metadata.descriptions;
  }
  if (metadata.coverImage) {
    result.coverImage = metadata.coverImage;
  }
  if (metadata.startDate) {
    result.startDate = metadata.startDate;
  }
  if (metadata.endDate) {
    result.endDate = metadata.endDate;
  }

  return result;
}

/**
 * Extract counts and gallery data
 */
function extractCountsAndGallery(scrapedData: ScrapingResult): Partial<FandomMangaData> {
  const result: Partial<FandomMangaData> = {};

  if (scrapedData.gallery && Array.isArray(scrapedData.gallery)) {
    result.gallery = scrapedData.gallery as string[];
  }

  if (scrapedData.totalVolumes > 0) {
    result.volumes = String(scrapedData.totalVolumes);
  }

  if (scrapedData.totalChapters > 0) {
    result.chapters = String(scrapedData.totalChapters);
  }

  return result;
}

/**
 * Build cover art object from scraped data
 */
function buildCoverArt(
  scrapedData: ScrapingResult
): NonNullable<FandomMangaData['coverArt']> {
  const coverArt: NonNullable<FandomMangaData['coverArt']> = {
    volumeCovers: scrapedData.volumes
      .map(v => v.coverImage)
      .filter((url): url is string => url !== undefined)
  };

  if (scrapedData.metadata?.coverImage) {
    coverArt.primary = scrapedData.metadata.coverImage;
  }

  if (scrapedData.gallery && Array.isArray(scrapedData.gallery)) {
    coverArt.gallery = scrapedData.gallery as string[];
  }

  return coverArt;
}

/**
 * Build metadata object from wiki metadata
 */
function buildMetadataObject(
  metadata: ScrapingResult['metadata']
): FandomMangaData['metadata'] {
  if (!metadata) {
    return undefined;
  }

  return {
    ...(metadata.alternativeTitles ? { alternativeTitles: metadata.alternativeTitles } : {}),
    ...(metadata.author ? { author: metadata.author } : {}),
    ...(metadata.artist ? { artist: metadata.artist } : {}),
    ...(metadata.publisher ? { publisher: metadata.publisher } : {}),
    ...(metadata.demographic ? { demographic: metadata.demographic } : {}),
    ...(metadata.genres ? { genres: metadata.genres } : {}),
    ...(metadata.format ? { format: metadata.format } : {}),
    ...(metadata.status ? { status: metadata.status } : {}),
    ...(metadata.startDate ? { startDate: metadata.startDate } : {}),
    ...(metadata.endDate ? { endDate: metadata.endDate } : {})
  };
}

/**
 * Map volume info to FandomMangaData volume list format
 */
function mapVolumes(volumes: VolumeInfo[]): NonNullable<FandomMangaData['volumeList']> {
  return volumes.map(vol => ({
    volumeNumber: vol.number,
    number: vol.number,
    title: vol.title,
    ...(vol.url ? { url: vol.url } : {}),
    ...(vol.coverImage ? { coverUrl: vol.coverImage, coverImage: vol.coverImage } : {}),
    ...(vol.releaseDate ? { releaseDate: vol.releaseDate } : {}),
    ...(vol.isbn ? { isbn: vol.isbn } : {}),
    ...(vol.chapters.length > 0 ? {
      chapterCount: vol.chapters.length,
      chapters: vol.chapters.map(ch => ({
        chapterNumber: String(ch.number),
        number: ch.number,
        title: ch.title,
        ...(ch.url ? { url: ch.url } : {}),
        ...(ch.summary ? { summary: ch.summary } : {}),
        ...(ch.coverImage ? { coverImage: ch.coverImage } : {}),
        ...(ch.pages ? { pages: ch.pages } : {}),
        ...(ch.releaseDate ? { releaseDate: ch.releaseDate } : {}),
        ...(ch.alternativeTitles ? { alternativeTitles: ch.alternativeTitles } : {})
      }))
    } : {})
  }));
}

/**
 * Map chapter info to FandomMangaData chapter list format
 */
function mapChapters(chapters: ChapterInfo[]): NonNullable<FandomMangaData['chapterList']> {
  return chapters.map(ch => ({
    chapterNumber: String(ch.number),
    number: ch.number,
    title: ch.title,
    ...(ch.alternativeTitles ? { alternativeTitles: ch.alternativeTitles } : {}),
    ...(ch.url ? { url: ch.url } : {}),
    ...(ch.coverImage ? { coverUrl: ch.coverImage, coverImage: ch.coverImage } : {}),
    ...(ch.volume ? { volumeNumber: ch.volume, volume: ch.volume } : {}),
    ...(ch.summary ? { summary: ch.summary } : {}),
    ...(ch.pages ? { pages: ch.pages } : {}),
    ...(ch.releaseDate ? { releaseDate: ch.releaseDate } : {})
  }));
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Clean wikitext by removing markup
 */
function cleanWikitext(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2') // [[Link|Text]] -> Text
    .replace(/\[\[([^\]]+)\]\]/g, '$1')            // [[Link]] -> Link
    .replace(/'''([^']+)'''/g, '$1')               // '''bold''' -> bold
    .replace(/''([^']+)''/g, '$1')                 // ''italic'' -> italic
    .replace(/{{[^}]+}}/g, '')                     // Remove templates
    .replace(/<ref[^>]*>.*?<\/ref>/g, '')          // Remove references
    .replace(/<[^>]+>/g, '')                       // Remove HTML tags
    .replace(/\n{3,}/g, '\n\n')                    // Normalize line breaks
    .trim();
}
