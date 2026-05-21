/**
 * Mutation Types for Universal Import Wizard
 *
 * Properly typed interfaces for all tRPC mutations used in the wizard.
 * Replaces the previous `any` typed MutationResults interface.
 *
 * Where possible, we import types directly from the server to ensure consistency.
 *
 * @module components/addManga/wizard-utils/mutation-types
 */

// Import types from server where they exist
import type { FandomMetadata } from '@/server/trpc/routers/metadata/fandom-fetch/types';
import type {
  FandomParseResult,
  FandomVolumeDetail,
  FandomChapterDetail,
} from '@/server/trpc/routers/metadata/fandom-url-parser-utils';
import type { AsyncResult } from '@/utils/async-result';

// Re-export imported types
export type { FandomMetadata, FandomParseResult, FandomVolumeDetail, FandomChapterDetail };

// ============================================================================
// Input Types
// ============================================================================

export interface AnilistInput {
  url?: string;
  id?: string;
}

export interface FandomInput {
  url: string;
}

export interface ParseFandomUrlInput {
  url: string;
  forceRefresh?: boolean;
  fetchChapterCovers?: boolean;
  maxChaptersToFetch?: number;
  /** Parsing hints from static analysis (optional) */
  parsingHints?: SerializedParsingHints;
  /** Recommended parser from static analysis (optional) */
  recommendedParser?: string;
}

export interface ComicvineInput {
  url?: string;
  id?: string;
}

export interface ComicvineVolumeDetailsInput {
  url?: string;
  id?: string;
  type?: 'volume' | 'issue';
}

export interface ParseUrlInput {
  url: string;
  field?: string;
}

export interface FandomChapterInput {
  url: string;
  forceRefresh?: boolean;
}

export interface ScrapeComicVineVolumeInput {
  volumeUrl: string;
}

export interface ScrapeComicVineChaptersInput {
  volumeUrls?: string[];
  seriesUrl?: string;
}

export interface ScrapeComicVineVolumeUrlsInput {
  seriesUrl: string;
}

export interface AnalyzeUrlInput {
  url: string;
}

// ============================================================================
// Output Types (defined here when not available from server)
// ============================================================================

export interface AniListMetadataResult {
  id?: string | number;
  cover?: string;
  bannerImage?: string;
  description?: string;
  alternativeTitles?: string[];
  synonyms?: string[];
  genres?: string[];
  tags?: string[];
  themes?: string[];
  authors?: string[];
  artists?: string[];
  status?: string;
  volumes?: number;
  chapters?: number;
  averageScore?: number;
  popularity?: number;
  startDate?: string;
  endDate?: string;
  characters?: unknown[];
  staff?: unknown[];
  relations?: unknown[];
  recommendations?: unknown[];
}

export interface ComicvineMetadataResult {
  id?: string | number;
  cover?: string;
  description?: string;
  alternativeTitles?: string[];
  genres?: string[];
  authors?: string[];
  publisher?: string;
  status?: string;
  volumeCount?: number;
  issueCount?: number;
  startYear?: number;
  siteDetailUrl?: string;
}

export interface ComicvineCoverImages {
  small?: string;
  medium?: string;
  large?: string;
  original?: string;
}

export interface ComicvineIssue {
  id: number;
  name?: string;
  issueNumber?: string;
  coverImages?: ComicvineCoverImages;
  description?: string;
  deck?: string;
  coverDate?: string;
  storeDate?: string;
  siteDetailUrl?: string;
}

export interface ComicvineCharacter {
  id: number;
  name?: string;
}

export interface ComicvineCreator {
  id: number;
  name?: string;
  role?: string;
}

export interface ComicvineIssueRef {
  id: number;
  name?: string;
  issueNumber?: string;
}

export interface ComicvineVolumeRef {
  id: number;
  name?: string;
}

export interface ComicvineVolumeDetailsResult {
  id: number;
  name?: string;
  description?: string;
  coverImages?: ComicvineCoverImages;
  publisher?: {
    id: number;
    name?: string;
  };
  startYear?: number;
  issueCount?: number;
  issues?: ComicvineIssue[];
  characters?: ComicvineCharacter[];
  creators?: ComicvineCreator[];
  firstIssue?: ComicvineIssueRef;
  lastIssue?: ComicvineIssueRef;
  dateAdded?: string;
  dateLastUpdated?: string;
  // Issue-specific fields
  coverDate?: string;
  storeDate?: string;
  volume?: ComicvineVolumeRef;
  characterCredits?: ComicvineCharacter[];
  personCredits?: ComicvineCreator[];
}

export interface ParsedMetadataResult {
  type: string;
  data: unknown;
  confidence: number;
  parser: string;
}

export interface ChapterMetadata {
  coverImageUrl?: string;
  description?: string;
  summary?: string;
  synopsis?: string;
  title?: string;
  chapterNumber?: string;
  releaseDate?: string;
  pageCount?: number;
}

export interface ScrapedVolumeChapter {
  /** Chapter number - can be numeric or string (e.g., 'special', 'extra-evil', 'final') */
  chapterNumber: number | string;
  title: string;
  url: string;
  /** Chapter prefix (e.g., 'Spell' for Dorohedoro, 'Chapter' for most manga) */
  prefix?: string;
}

export interface ScrapedVolumeDetail {
  volumeNumber: number;
  title: string;
  summary: string;
  coverUrl: string;
  chapters: ScrapedVolumeChapter[];
}

export interface ScrapedVolume {
  volumeDetails: ScrapedVolumeDetail[];
  totalChapters: number;
}

/**
 * Volume item in scraped volumes result.
 * This type covers both API and scraping paths which return slightly different shapes.
 * - API path: has volumeNumber, volumeTitle, volumeSummary, coverImage, chapters=[], totalChapters
 * - Scraping path: has volumeId, volumeNumber, volumeTitle, volumeSummary?, coverImage?, chapters, totalChapters
 */
export interface ScrapedVolumesItem {
  volumeId?: string;
  volumeNumber: number;
  volumeTitle: string;
  volumeSummary?: string;
  coverImage?: string;
  chapters: unknown[];
  totalChapters: number;
  themes?: string[];
  genres?: string[];
}

/**
 * Result type for scraping multiple ComicVine volumes.
 */
export interface ScrapedVolumesResult {
  volumes: Array<ScrapedVolumesItem | null>;
}

export interface VolumeUrlInfo {
  volumeNumber: number;
  url: string;
  coverImageUrl?: string;
  title?: string;
  summary?: string;
}

export interface VolumeUrlsResult {
  volumeUrls: VolumeUrlInfo[];
  fromApi?: boolean;
}

// ============================================================================
// Static Analysis Types
// ============================================================================

/**
 * Parser recommendation from static analysis.
 */
export interface ParserRecommendation {
  primary: string;
  fallbacks: string[];
  confidence: number;
  reason: string;
}

/**
 * Serialized parsing hints (RegExp fields converted to strings).
 */
export interface SerializedParsingHints {
  chapterConvention: string | null;
  volumeSelectors: string[];
  chapterSelectors: string[];
  chapterUrlPattern: string | null;
  checkCollapsible: boolean;
  checkNestedLists: boolean;
  hasJpEnTabs: boolean;
  skipSelectors: string[];
}

/**
 * Static analysis response from the server (Fandom).
 */
export interface StaticAnalysisResponse {
  analyzedAt: string;
  analysisTimeMs: number;
  recommendedParser: ParserRecommendation;
  summary: {
    tableCount: number;
    chapterLinkCount: number;
    volumeLinkCount: number;
    namingConvention: string | null;
    structureType: string;
    headerPattern: string;
    listPattern: string;
  };
  parsingHints: SerializedParsingHints;
}

// ============================================================================
// Wikipedia Static Analysis Types
// ============================================================================

export interface AnalyzeWikipediaUrlInput {
  url: string;
}

export interface FetchMangaDexVolumesInput {
  mangadexId?: string;
  url?: string;
  language?: string;
  mangaTitle?: string;
}

export interface MangaDexTransformedVolume {
  volumeNumber: number;
  number: number;
  title: string;
  chapterCount: number;
  chapters: Array<{
    chapterNumber: number;
    id: string;
    pages: number;
  }>;
}

export interface FetchMangaDexVolumesResult {
  provider: 'mangadex';
  volumes: MangaDexTransformedVolume[];
  totalVolumes: number;
  totalChapters: number;
  volumeDetails: MangaDexTransformedVolume[];
}

/**
 * Parsing hints for Wikipedia pages.
 */
export interface WikipediaParsingHints {
  pageType: string;
  structureType: string;
  recommendedParser: string;
  relevantSections: string[];
  tableTypes: string[];
  hasVolumeData: boolean;
  hasChapterData: boolean;
  listPageUrl: string | null;
}

/**
 * Summary of Wikipedia page structure.
 */
export interface WikipediaAnalysisSummary {
  tableCount: number;
  volumeTableCount: number;
  chapterTableCount: number;
  hasMediaSection: boolean;
  hasPublicationSection: boolean;
  hasInfobox: boolean;
  linksToListPage: boolean;
}

/**
 * Static analysis response from the server (Wikipedia).
 */
export interface WikipediaAnalysisResponse {
  analyzedAt: string;
  analysisTimeMs: number;
  pageType: string;
  structureType: string;
  recommendedParser: string;
  confidence: number;
  recommendationReason: string;
  summary: WikipediaAnalysisSummary;
  parsingHints: WikipediaParsingHints;
}

// ============================================================================
// Mutation Interface
// ============================================================================

/**
 * Properly typed mutation interface for tRPC mutations used in the wizard.
 * Each mutation has specific input and output types instead of `any`.
 */
export interface MutationResults {
  fetchAnilistMutation: {
    mutateAsync: (params: AnilistInput) => Promise<AsyncResult<AniListMetadataResult, Error>>;
  };
  fetchFandomMutation: {
    mutateAsync: (params: FandomInput) => Promise<AsyncResult<FandomMetadata, Error>>;
  };
  parseFandomUrlMutation: {
    mutateAsync: (params: ParseFandomUrlInput) => Promise<AsyncResult<FandomParseResult, Error>>;
  };
  fetchComicvineMutation: {
    mutateAsync: (params: ComicvineInput) => Promise<AsyncResult<ComicvineMetadataResult, Error>>;
  };
  fetchComicvineVolumeDetailsMutation: {
    mutateAsync: (params: ComicvineVolumeDetailsInput) => Promise<AsyncResult<ComicvineVolumeDetailsResult, Error>>;
  };
  parseUrlMutation: {
    mutateAsync: (params: ParseUrlInput) => Promise<AsyncResult<ParsedMetadataResult, Error>>;
  };
  fetchFandomChapterMetadata: {
    mutateAsync: (params: FandomChapterInput) => Promise<AsyncResult<ChapterMetadata, Error>>;
  };
  scrapeComicVineVolumeMutation: {
    mutateAsync: (params: ScrapeComicVineVolumeInput) => Promise<AsyncResult<ScrapedVolume, Error>>;
  };
  scrapeComicVineChaptersMutation: {
    mutateAsync: (params: ScrapeComicVineChaptersInput) => Promise<AsyncResult<ScrapedVolumesResult, Error>>;
  };
  scrapeComicVineVolumeUrlsMutation: {
    mutateAsync: (params: ScrapeComicVineVolumeUrlsInput) => Promise<AsyncResult<VolumeUrlsResult, Error>>;
  };
  analyzeUrlMutation: {
    mutateAsync: (params: AnalyzeUrlInput) => Promise<StaticAnalysisResponse>;
    isPending: boolean;
  };
  analyzeWikipediaUrlMutation: {
    mutateAsync: (params: AnalyzeWikipediaUrlInput) => Promise<WikipediaAnalysisResponse>;
    isPending: boolean;
  };
  fetchMangaDexVolumesMutation?: {
    mutateAsync: (params: FetchMangaDexVolumesInput) => Promise<AsyncResult<FetchMangaDexVolumesResult, Error>>;
  };
}
