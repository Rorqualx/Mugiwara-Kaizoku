// Adapter interfaces for native downloader integration
// Following Mugiwara-Kaizoku's adapter pattern standards

import type { BaseIntegrationConfig } from '../config.types';
import type { MangaSearchResult} from '../search.types';

// Define MetadataSourceInfo interface
export interface MetadataSourceInfo {
  id: string;
  name: string;
  type: string;
  version?: string;
  baseUrl?: string;
  supportedFeatures?: string[];
  isActive?: boolean;
}

// Native download provider configuration
export interface NativeDownloadProviderConfig extends Omit<BaseIntegrationConfig, 'baseUrl' | 'rateLimit'> {
  id: string;
  name: string;
  baseUrl: string;  // Required in native download, optional in base
  searchUrl: string;
  headers?: Record<string, string>;
  rateLimit?: RateLimitConfig;  // Different type than base
  authentication?: AuthConfig;
  selectors: SelectorMapping;
  downloadServices?: DownloadServiceConfig[];
  enabled: boolean;
  type?: string;
  // Allow additional properties
  [key: string]: unknown;
}

// Rate limiting configuration
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  concurrentRequests?: number;
}

// Authentication configuration
export interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'cookie' | 'custom';
  credentials?: Record<string, string>;
}

// Selector mapping for website scraping
export interface SelectorMapping {
  searchResults: SearchResultSelectors;
  mangaDetails: MangaDetailSelectors;
  chapterList: ChapterListSelectors;
  downloadLinks: DownloadLinkSelectors;
}

// Search result selectors
export interface SearchResultSelectors {
  container: string;
  id: SelectorConfig;
  title: SelectorConfig;
  coverUrl: SelectorConfig;
  url: SelectorConfig;
  metadata?: Record<string, SelectorConfig>;
}

// Manga detail selectors
export interface MangaDetailSelectors {
  title: SelectorConfig;
  alternativeTitles?: SelectorConfig;
  description?: SelectorConfig;
  coverUrl?: SelectorConfig;
  status?: SelectorConfig;
  authors?: SelectorConfig;
  genres?: SelectorConfig;
  tags?: SelectorConfig;
}

// Chapter list selectors
export interface ChapterListSelectors {
  container: string;
  chapterId: SelectorConfig;
  chapterNumber: SelectorConfig;
  chapterTitle: SelectorConfig;
  chapterUrl: SelectorConfig;
  uploadDate?: SelectorConfig;
}

// Download link selectors
export interface DownloadLinkSelectors {
  imageContainer: string;
  imageUrl: SelectorConfig;
  pageNumber?: SelectorConfig;
  nextPageUrl?: SelectorConfig;
}

// Selector configuration
export interface SelectorConfig {
  css?: string;
  xpath?: string;
  extract: 'text' | 'attribute' | 'html';
  attribute?: string;
  transform?: Transform[];
}

// Transform configuration
export interface Transform {
  type: 'regex' | 'replace' | 'trim' | 'prefix' | 'suffix' | 'split' | 'join' | 'match' | 'capitalize';
  params: Record<string, string | number | boolean>;
}

// Download service configuration
export interface DownloadServiceConfig {
  type: 'direct' | 'cloudflare' | 'custom';
  config?: Record<string, unknown>;
}

// Website source selectors (flat format for Visual Inspector)
export interface WebsiteSourceSelectors {
  // Search result fields
  searchResultItem?: string;
  searchResultTitle?: string;
  searchResultUrl?: string;
  searchResultCover?: string;

  // Manga details fields
  detailsTitle?: string;
  detailsCover?: string;
  detailsDescription?: string;
  detailsAuthor?: string;
  detailsGenres?: string;
  detailsStatus?: string;

  // Chapter list fields
  chapterItem?: string;
  chapterTitle?: string;
  chapterNumber?: string;
  chapterUrl?: string;
  chapterDate?: string;

  // Download link fields
  downloadPageItem?: string;
  downloadDirectLink?: string;
  downloadButton?: string;
}

// Native download search options
export interface NativeDownloadSearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  sourceIds?: string[];
  includeCover?: boolean;
}

// Native download manga data
export interface NativeDownloadMangaData {
  id: string;
  title: string;
  alternativeTitles?: string[];
  description?: string;
  coverUrl?: string;
  status?: string;
  authors?: string[];
  genres?: string[];
  tags?: string[];
  chapters?: NativeDownloadChapterData[];
  source: string;
  sourceUrl: string;
}

// Native download chapter data
export interface NativeDownloadChapterData {
  id: string;
  number: number;
  title?: string;
  url: string;
  uploadDate?: Date;
  pages?: string[];
}

// Download link result
export interface DownloadLink {
  pageNumber: number;
  imageUrl: string;
  headers?: Record<string, string>;
  referer?: string;
}

// Website validation result
export interface WebsiteValidationResult {
  isValid: boolean;
  structure?: Partial<NativeDownloadProviderConfig>;
  missingFields?: string[];
  errors?: string[];
  suggestions?: string[];
}

// Native download adapter interface
export interface INativeDownloadAdapter {
  // Core methods
  searchNativeDownload(query: string, options?: NativeDownloadSearchOptions): Promise<MangaSearchResult[]>;
  getNativeDownloadMangaById(id: string): Promise<NativeDownloadMangaData>;
  getNativeDownloadChapters(mangaId: string): Promise<NativeDownloadChapterData[]>;
  getDownloadLinks(mangaId: string, chapterId: string): Promise<DownloadLink[]>;

  // Website-specific methods
  buildSearchUrl(query: string, options?: NativeDownloadSearchOptions): string;
  buildMangaUrl(mangaId: string): string;
  buildChapterUrl(mangaId: string, chapterId: string): string;

  // Validation methods
  validateWebsite(url: string): Promise<WebsiteValidationResult>;
  testSelectors(html: string, selectors: SelectorMapping): Promise<Record<string, boolean>>;

  // Utility methods
  getSourceInfo(): MetadataSourceInfo;
  isEnabled(): boolean;
  getStatus(): Promise<{ status: 'ok' | 'error'; message?: string }>;
  configure(config: Partial<NativeDownloadProviderConfig>): void;
  getConfig(): NativeDownloadProviderConfig;
  dispose(): void;
}

// Type guards
export function isSelectorConfig(obj: unknown): obj is SelectorConfig {
  if (!obj || typeof obj !== 'object') return false;

  const config = obj as Record<string, unknown>;

  return (
    (typeof config["css"] === 'string' || typeof config["xpath"] === 'string') &&
    ['text', 'attribute', 'html'].includes(config["extract"] as string)
  );
}

export function isNativeDownloadProviderConfig(obj: unknown): obj is NativeDownloadProviderConfig {
  if (!obj || typeof obj !== 'object') return false;

  const config = obj as Record<string, unknown>;

  return (
    typeof config["id"] === 'string' &&
    typeof config["name"] === 'string' &&
    typeof config["baseUrl"] === 'string' &&
    typeof config["searchUrl"] === 'string' &&
    typeof config["selectors"] === 'object'
  );
}

// Export for backward compatibility
export { isNativeDownloadProviderConfig as isValidNativeDownloadProviderConfig };

// Type aliases for better clarity
export type NativeDownloadProviderAdapter = INativeDownloadAdapter;
export type NativeDownloadSearchParams = NativeDownloadSearchOptions;
export type NativeDownloadSearchResult = MangaSearchResult;

// ============================================================================
// API Client Types (for API integration, different from web scraping)
// ============================================================================

/**
 * Native download cover image type
 */
export interface NativeDownloadImage {
  coverType: string;
  url: string;
  remoteUrl?: string;
}

/**
 * Native download API client adapter configuration
 * Note: This is for API-based integration, different from NativeDownloadProviderConfig (web scraping)
 */
export interface NativeDownloadAdapterConfig {
  url: string;
  apiKey: string;
  rootFolder?: string;
  qualityProfile?: string;
  metadataProfile?: string;
  autoSearch?: boolean;
  autoMonitor?: boolean;
  autoDownload?: boolean;
  retryAttempts?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  rateLimit?: number; // requests per second
}

/**
 * Native download API manga response format
 * Note: This is the API response format, different from NativeDownloadMangaData (scraper format)
 */
export interface NativeDownloadApiManga {
  id: number;
  title: string;
  alternativeTitles?: string[];
  sortTitle?: string;
  status?: string;
  overview?: string;
  network?: string;
  runtime?: number;
  images?: NativeDownloadImage[];
  year?: number;
  added?: string;
  qualityProfileId?: number;
  metadataProfileId?: number;
  monitored?: boolean;
  rootFolderPath?: string;
  folderName?: string;
  path?: string;
  comicImage?: string;
  publisher?: string;
  comicCount?: number;
  volumeCount?: number;
  issueCount?: number;
}

/**
 * Native download adapter instance configuration (combines adapter config with instance metadata)
 */
export interface NativeDownloadAdapterInstanceConfig extends NativeDownloadAdapterConfig {
  id: string;
  name: string;
}

/**
 * Native download scraped manga data (web scraping format)
 * Note: Uses string IDs, different from NativeDownloadApiManga (number IDs)
 */
export interface NativeDownloadScrapedManga {
  id: string;
  title: string;
  alternativeTitles?: string[];
  coverUrl?: string;
  description?: string;
  status?: string;
  authors?: string[];
  artists?: string[];
  genres?: string[];
  tags?: string[];
  year?: number;
  chapters?: number;
  volumes?: number;
  rating?: number;
  url?: string;
}

/**
 * Native download scraped chapter data (web scraping format)
 * Note: Uses string IDs, different from API format
 */
export interface NativeDownloadScrapedChapter {
  id: string;
  mangaId: string;
  number: number;
  title?: string;
  volume?: number;
  releaseDate?: string;
  url?: string;
  pages?: number;
  uploadDate?: string; // Date when chapter was uploaded
}
