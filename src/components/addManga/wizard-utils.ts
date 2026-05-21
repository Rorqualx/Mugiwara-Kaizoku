/**
 * Universal Import Wizard - Foundation Utilities
 *
 * Shared helper functions, type definitions, and constants used across
 * all wizard modules. This is the foundation module that all other
 * wizard modules depend on.
 *
 * Extracted from: UniversalImportWizard.tsx
 * Created: 2025-11-17
 * Refactored: 2025-12-25 - Split into submodules for better maintainability
 */

import type { ChapterFetchingService } from './services/chapterFetchingService';
import type { ImportService } from './services/importService';
import type { SourceManagementService } from './services/sourceManagementService';
import type { UrlParsingService } from './services/urlParsingService';

// ============================================================================
// Re-exports from submodules
// ============================================================================

// Mutation types (properly typed, no more `any`)
// Re-exports server types and local input/output types
export type {
  // MutationResults interface
  MutationResults,
  // Input types
  AnilistInput,
  FandomInput,
  ParseFandomUrlInput,
  ComicvineInput,
  ComicvineVolumeDetailsInput,
  ParseUrlInput,
  FandomChapterInput,
  ScrapeComicVineVolumeInput,
  ScrapeComicVineChaptersInput,
  ScrapeComicVineVolumeUrlsInput,
  AnalyzeUrlInput,
  // Output types (local)
  AniListMetadataResult,
  ComicvineMetadataResult,
  ComicvineVolumeDetailsResult,
  ParsedMetadataResult,
  ChapterMetadata,
  ScrapedVolume,
  ScrapedVolumesItem,
  ScrapedVolumesResult,
  VolumeUrlsResult,
  // Static analysis types (Fandom)
  StaticAnalysisResponse,
  SerializedParsingHints,
  ParserRecommendation,
  // Static analysis types (Wikipedia)
  AnalyzeWikipediaUrlInput,
  WikipediaParsingHints,
  WikipediaAnalysisSummary,
  WikipediaAnalysisResponse,
  // Re-exported from server
  FandomMetadata,
  FandomParseResult,
  FandomVolumeDetail,
  FandomChapterDetail,
} from './wizard-utils/mutation-types';

// Metadata extractors
export {
  extractFormat,
  extractUrl,
  extractSiteDetailUrl,
  extractVolumesListUrl,
  extractAuthors,
  extractArtists,
  extractStartDate,
  extractCoverImage,
  extractBannerImage,
  extractAlternativeTitles,
  extractGallery,
  extractPublisher,
  extractDemographic,
  extractEndDate,
  extractSynopsis,
} from './wizard-utils/metadata-extractors';
export type { InitialDataWithMetadata } from './wizard-utils/metadata-extractors';

// Metadata helpers
export {
  cleanHtml,
  calculateFieldConfidence,
  getVolumeCoversByProvider,
  normalizeDateToMMDDYYYY,
} from './wizard-utils/metadata-helpers';

// ============================================================================
// Type Definitions (kept in main file for service integration)
// ============================================================================

export interface VolumeDetails {
  volumeNumber?: number;
  title?: string;
  coverImageUrl?: string;
  coverUrl?: string;
  coverImage?: string;
  chapterCount?: number;
  chapters?: unknown[];
  pageCount?: number;
  releaseDate?: string;
  isbn?: string;
  description?: string;
  url?: string;
  [key: string]: unknown;
}

export interface ComicVineVolumeResult {
  data?: {
    volumeDetails?: VolumeDetails[];
    metadata?: Record<string, unknown>;
    chapters?: number;
    totalChapters?: number;
  };
}

export interface WizardStepContentProps {
  services: {
    urlParsingService: UrlParsingService;
    sourceManagementService: SourceManagementService;
    importService: ImportService;
    chapterFetchingService: ChapterFetchingService;
  };
  mutations: import('./wizard-utils/mutation-types').MutationResults;
  onComplete: (mangaId: number) => void;
  onCancel: () => void;
  isSearchMode?: boolean;
  libraryId?: number;
}

// ============================================================================
// Constants
// ============================================================================

export const WIZARD_STEPS = [
  'Basic Information',
  'Metadata Selection',
  'Volumes & Chapters',
  'Media Selection',
  'Review & Import'
] as const;
