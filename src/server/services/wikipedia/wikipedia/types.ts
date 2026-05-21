/**
 * Wikipedia Types Module
 *
 * Shared type definitions and interfaces for all Wikipedia service modules.
 * Provides type safety for Wikipedia MediaWiki API responses and domain models.
 *
 * Extracted from: WikipediaService.ts (lines 16-162)
 */

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Chapter match extracted from regex patterns
 *
 * A clean interface that replaces the type-unsafe RegExpExecArray casts.
 * Captures only the fields actually needed for chapter parsing.
 */
export interface ChapterMatch {
  /** The complete matched text */
  fullMatch: string;
  /** Chapter number or type (e.g., "123" or "Epilogue 1") */
  chapterNumber: string;
  /** The chapter title text */
  chapterTitle: string;
}

/**
 * Format hints detected once at the top of chapter parsing.
 * Threaded downstream so functions don't re-probe HTML structure.
 */
export interface ChapterListFormatHints {
  /** Primary format detected for chapter listings */
  primaryFormat: 'ol-start' | 'bare-ol-quoted' | 'numbered-text' | 'one-piece' | 'unknown';
  /** Whether <ol start="N"> lists exist (strong chapter signal) */
  hasOlStartLists: boolean;
  /** Whether bare <ol> with quoted <li> items exist (AoT Vol 1 pattern) */
  hasBareOlWithQuotedTitles: boolean;
  /** Whether bare <ol> WITHOUT quoted titles exist (TOC/nav like Berserk) */
  hasBareOlWithoutQuotedTitles: boolean;
  /** Count of chapters found via each format (for tiebreaking) */
  olStartChapterCount: number;
  bareOlQuotedChapterCount: number;
  numberedTextChapterCount: number;
  onePieceChapterCount: number;
}

/**
 * Page-level structure hints detected once before chapter parsing.
 * Determines volume marker format, count, and edition layout.
 */
export interface PageStructureHints {
  /** Which volume marker format was found */
  volumeMarkerFormat: 'id-vol' | 'id-volume' | 'th-volume' | 'rowspan' | 'none';
  /** The prefix string to use for section extraction (e.g., "vol", "Volume_") */
  volumeIdPrefix: string;
  /** Total volume markers found (after deduplication) */
  volumeCount: number;
  /** Whether page has JP+EN dual edition markers (same vol IDs appearing twice) */
  hasDualEditions: boolean;
}

/**
 * Generic cache interface with TTL support
 */
export interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  has(key: string): boolean;
  clear(): void;
}

// ============================================================================
// Wikipedia API Response Types
// ============================================================================

/**
 * Wikipedia API page response
 */
export interface WikipediaApiPage {
  title?: string;
  extract?: string;
  pageid?: number;
}

/**
 * Wikipedia API search result item
 */
export interface WikipediaApiSearchResult {
  pageid: number;
  title: string;
}

/**
 * Main Wikipedia API response structure
 */
export interface WikipediaApiResponse {
  query?: {
    pages?: Record<string, WikipediaApiPage>;
    search?: WikipediaApiSearchResult[];
  };
}

/**
 * Wikipedia section metadata
 */
export interface WikipediaSection {
  toclevel?: number;
  level?: string;
  line?: string;
  number?: string;
  index?: string;
  fromtitle?: string;
  byteoffset?: number;
  anchor?: string;
}

/**
 * Wikipedia parse API response
 */
export interface WikipediaParseResponse {
  parse?: {
    title?: string;
    pageid?: number;
    text?: {
      '*': string;
    };
    sections?: WikipediaSection[];
    [key: string]: unknown;
  };
}

// ============================================================================
// Exported Domain Types
// ============================================================================

/**
 * Wikipedia search result structure
 */
export interface WikipediaSearchResult {
  pageId: number;
  title: string;
  extract?: string;
  url: string;
  isDisambiguation?: boolean;
  redirectTo?: string;
}

/**
 * Chapter information extracted from Wikipedia
 */
export interface WikipediaChapter {
  number: string | number;
  title?: string;
  volumeNumber?: number;
  releaseDate?: string;
  pages?: number;
}

/**
 * Volume information from Wikipedia
 */
export interface WikipediaVolume {
  number: number;
  title?: string;
  alternativeTitles?: string[];
  chapters: WikipediaChapter[];
  originalReleaseDate?: string;
  englishReleaseDate?: string;
  isbn?: string;
  isbn13?: string;
  chapterRange?: string;
  description?: string;
  summary?: string;
  /** Page count for the volume */
  pages?: number;
  /** Special edition info (e.g., "Limited Edition", "Collector's Edition") */
  specialEdition?: string;
}

/**
 * Manga type classification
 */
export type MangaTypeClassification = 'manga' | 'manhwa' | 'manhua' | 'webtoon';

/**
 * Publication status with specific values
 */
export type WikipediaPublicationStatus = 'ongoing' | 'finished' | 'hiatus' | 'cancelled' | 'unknown';

/**
 * Complete manga metadata from Wikipedia
 */
export interface WikipediaMangaData {
  title: string;
  alternativeTitles?: string[];
  /** Main intro paragraphs about the manga (serialization, adaptation, etc.) */
  description?: string;
  /** Story synopsis from Synopsis/Plot/Story section */
  synopsis?: string;
  /** @deprecated Use synopsis instead */
  plot?: string;
  coverImage?: string;
  author?: string[];
  artist?: string[];
  /** Editor(s) if listed in infobox */
  editor?: string[];
  publisher?: string;
  englishPublisher?: string;
  imprint?: string;
  magazine?: string;
  englishMagazine?: string;
  originalRun?: string;
  startDate?: Date;
  endDate?: Date;
  /** Derived status based on originalRun dates (ONGOING, COMPLETED, or UNKNOWN) */
  status?: string;
  /** Structured publication status for downstream processing */
  publicationStatus?: WikipediaPublicationStatus;
  /** Type classification: manga (Japanese), manhwa (Korean), manhua (Chinese), webtoon */
  mangaType?: MangaTypeClassification;
  /** Licensed publishers in other regions */
  licensedBy?: string[];
  volumes?: number;
  chapters?: number;
  chapterList?: WikipediaChapter[];
  volumeList?: WikipediaVolume[];
  genres?: string[];
  demographic?: string;
  wikipediaUrl?: string;
  volumeListUrl?: string;
  chapterListUrls?: string[];
}
